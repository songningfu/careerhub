// CareerHub · opportunityCrawler 云函数入口
// 触发方式：
//   1. 前端 callFunction('opportunityCrawler', { action: 'run', trigger: 'manual' })
//   2. CloudBase 定时器 → 自动以 { trigger: 'cron' } 调用
//   3. 健康检查 { action: 'ping' }

const tcb = require('@cloudbase/node-sdk');
const config = require('./config');
const log = require('./utils/log');
const githubAwesome = require('./sources/githubAwesome');
const enricher = require('./deepseek/enrich');
const dbSync = require('./db/sync');
const runLog = require('./db/runLog');

const app = tcb.init({ env: tcb.SYMBOL_CURRENT_ENV });
const db = app.database();

exports.main = async (event = {}, context) => {
  const action = event.action || 'run';
  const trigger = event.trigger || (event.Type === 'Timer' ? 'cron' : 'manual');

  if (action === 'ping') {
    return { ok: true, hasDeepseek: !!process.env.DEEPSEEK_API_KEY, model: config.deepseek.model };
  }

  // 拿调用方 openid
  let openid = '';
  try {
    openid = app.auth().getUserInfo().openId || '';
  } catch (e) {
    /* 系统触发或匿名 */
  }
  log.step(`RUN start trigger=${trigger} openid=${openid || '(none)'}`);

  // ========== 限流 ==========
  if (trigger === 'manual' && openid) {
    const used = await runLog.recentCount(db, { trigger: 'manual', openid, windowSec: 86400 });
    if (used >= config.rateLimit.perUserPerDay) {
      log.warn(`[ratelimit] user ${openid} exceeded ${config.rateLimit.perUserPerDay}/day (current ${used})`);
      return {
        ok: false,
        code: 'RATE_LIMITED',
        message: `今日手动更新已达上限（${config.rateLimit.perUserPerDay} 次/天），明天再来`,
        used,
        limit: config.rateLimit.perUserPerDay
      };
    }
  }
  if (trigger === 'cron') {
    const globalUsed = await runLog.recentCount(db, { trigger: 'cron', windowSec: 3600 });
    if (globalUsed >= config.rateLimit.globalPerHour) {
      log.warn(`[ratelimit] cron exceeded ${config.rateLimit.globalPerHour}/hour`);
      return { ok: false, code: 'CRON_OVERLAPPED', skipped: true };
    }
  }

  const start = Date.now();
  const phases = { fetched: 0, enriched: 0, llmCalls: 0, llmTokens: 0 };
  let dbStats = { inserted: 0, updated: 0, skipped: 0, errors: 0, markedExpired: 0 };
  let errorMsg = '';

  try {
    // ========== 1. 抓取 ==========
    log.step('FETCH');
    let raw = [];
    if (config.sources.githubAwesome) {
      const items = await githubAwesome.fetch();
      raw.push(...items);
    }
    phases.fetched = raw.length;
    log.info(`fetched total: ${raw.length}`);

    // ========== 2. DeepSeek 结构化 ==========
    log.step('ENRICH');
    const { enriched, llmCalls, llmTokens } = await enricher.enrich(raw);
    phases.enriched = enriched.length;
    phases.llmCalls = llmCalls;
    phases.llmTokens = llmTokens;
    log.info(`enriched: ${enriched.length}, llm_calls=${llmCalls}, tokens=${llmTokens}`);

    // ========== 3. 写库 ==========
    log.step('SYNC');
    dbStats = await dbSync.upsertAll(db, enriched);
    log.info(`db: +${dbStats.inserted} ~${dbStats.updated} skip${dbStats.skipped} err${dbStats.errors} exp${dbStats.markedExpired}`);
  } catch (e) {
    errorMsg = e.message || String(e);
    log.error('RUN failed:', errorMsg);
  }

  const durationMs = Date.now() - start;
  const summary = {
    ok: !errorMsg,
    durationMs,
    trigger,
    openid,
    phases,
    db: dbStats,
    error: errorMsg || null
  };

  // ========== 4. 写运行日志 ==========
  await runLog.record(db, summary);

  log.step(`RUN done in ${durationMs}ms`);
  return summary;
};
