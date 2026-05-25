// 把 enriched items upsert 到 opportunities 集合
// 策略：
//  - hash(company+position+city) 作为业务主键 (item.id)
//  - 已存在：UPDATE 部分字段 + 更新 lastSeenAt + 不动 firstSeenAt
//  - 不存在：INSERT 完整记录 + firstSeenAt = now
//  - 长期未见（超过配置阈值）：标记 expired=true（本轮不删，留给前端兜底）

const config = require('../config');
const { opportunityId } = require('../utils/hash');
const log = require('../utils/log');

async function upsertAll(db, items) {
  const col = db.collection(config.collections.opportunities);
  const now = new Date().toISOString();
  const stats = { inserted: 0, updated: 0, skipped: 0, errors: 0 };
  const seenIds = [];

  for (const raw of items) {
    if (!raw.company || !raw.position) {
      stats.skipped++;
      continue;
    }
    const id = opportunityId(raw);
    seenIds.push(id);
    const record = {
      ...raw,
      id,
      lastSeenAt: now,
      expired: false
    };
    try {
      const existing = await col.where({ id }).get();
      if (existing.data && existing.data.length > 0) {
        // UPDATE — 保留 firstSeenAt，覆盖其余
        const cur = existing.data[0];
        await col.doc(cur._id).update({
          company:   record.company,
          position:  record.position,
          city:      record.city,
          salary:    record.salary,
          deadline:  record.deadline,
          industry:  record.industry,
          category:  record.category,
          tags:      record.tags,
          descShort: record.descShort,
          desc:      record.desc,
          source:    record.source,
          sourceUrl: record.sourceUrl,
          lastSeenAt: now,
          expired: false
        });
        stats.updated++;
      } else {
        // INSERT
        await col.add({
          ...record,
          firstSeenAt: now,
          createdAt: now
        });
        stats.inserted++;
      }
    } catch (e) {
      stats.errors++;
      log.error(`[db] upsert failed for ${raw.company}/${raw.position}:`, e.message);
    }
  }

  // 过期标记：不在本次 seenIds 且 lastSeenAt 超过阈值的 → expired=true
  // CloudBase Node SDK 没有原生 NOT IN，分批查询 + 更新太贵；
  // 这里只跑简单逻辑：查 expired=false 且 lastSeenAt 早于 N 天前的记录，全部标记
  try {
    const cutoff = new Date(Date.now() - config.expiry.markExpiredAfterDays * 86400 * 1000).toISOString();
    const stale = await col
      .where({ expired: false })
      .limit(500)
      .get();
    let markedExpired = 0;
    for (const doc of stale.data || []) {
      if (doc.lastSeenAt && doc.lastSeenAt < cutoff) {
        await col.doc(doc._id).update({ expired: true });
        markedExpired++;
      }
    }
    stats.markedExpired = markedExpired;
  } catch (e) {
    log.warn('[db] expiry sweep failed:', e.message);
    stats.markedExpired = 0;
  }

  return stats;
}

module.exports = { upsertAll };
