// 把每次运行记录到 crawler_runs 集合（用于排错 + 限流计算）

const config = require('../config');
const log = require('../utils/log');

async function record(db, payload) {
  try {
    await db.collection(config.collections.crawlerRuns).add({
      ...payload,
      createdAt: new Date().toISOString()
    });
  } catch (e) {
    log.warn('[runLog] persist failed:', e.message);
  }
}

// 限流：检查最近 windowSec 秒内 该 trigger 类型的运行次数
async function recentCount(db, { trigger, openid, windowSec }) {
  try {
    const since = new Date(Date.now() - windowSec * 1000).toISOString();
    const q = { trigger, createdAt: db.command.gte(since) };
    if (openid) q.openid = openid;
    const res = await db
      .collection(config.collections.crawlerRuns)
      .where(q)
      .count();
    return res.total || 0;
  } catch (e) {
    log.warn('[runLog] count failed:', e.message);
    return 0;
  }
}

module.exports = { record, recentCount };
