// 把原始 items 批量送 DeepSeek 结构化
// 输入：[{company, position, city, salary, deadline, source, sourceUrl, desc}, ...]
// 输出：[{...enriched}, ...] 同序号，附加 industry / category / tags / descShort
//
// 单批失败 → 该批回退为原始数据（不阻断流程）

const config = require('../config');
const client = require('./client');
const { SYSTEM, buildUserPrompt } = require('./prompts');
const log = require('../utils/log');

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// 解析 DeepSeek 返回的 JSON，做防御性兜底
function parseResult(content, batchLen) {
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (e) {
    throw new Error('DeepSeek returned non-JSON: ' + content.slice(0, 200));
  }
  if (!Array.isArray(parsed.items)) {
    throw new Error('DeepSeek JSON missing items[] field');
  }
  if (parsed.items.length !== batchLen) {
    log.warn(`[deepseek] batch length mismatch: input=${batchLen} output=${parsed.items.length}`);
  }
  return parsed.items;
}

function mergeWithOriginal(original, enriched) {
  // enriched 优先，但保留原始的 sourceUrl/source/firstSeenAt 等元数据
  return {
    company:   enriched.company   || original.company   || '',
    position:  enriched.position  || original.position  || '',
    city:      enriched.city      || original.city      || '',
    salary:    enriched.salary    || original.salary    || '',
    deadline:  enriched.deadline  || original.deadline  || '',
    industry:  enriched.industry  || original.industry  || '',
    category:  enriched.category  || '',
    tags:      Array.isArray(enriched.tags) ? enriched.tags : (original.tags || []),
    descShort: enriched.descShort || '',
    desc:      original.desc      || enriched.descShort || '',
    source:    original.source    || '',
    sourceUrl: original.sourceUrl || ''
  };
}

async function enrich(items) {
  if (!client.hasKey) {
    log.warn('[enrich] DEEPSEEK_API_KEY missing — skipping enrichment, returning raw items');
    return { enriched: items.map((o) => mergeWithOriginal(o, {})), llmCalls: 0, llmTokens: 0 };
  }
  const batches = chunk(items, config.deepseek.batchSize);
  log.info(`[enrich] ${items.length} items in ${batches.length} batches`);
  if (batches.length > config.deepseek.maxCalls) {
    log.warn(`[enrich] batches (${batches.length}) exceed maxCalls (${config.deepseek.maxCalls}); truncating`);
    batches.length = config.deepseek.maxCalls;
  }

  const out = [];
  let llmCalls = 0;
  let llmTokens = 0;

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    try {
      const { content, usage } = await client.chatJson({
        system: SYSTEM,
        user: buildUserPrompt(batch),
        retry: 1
      });
      llmCalls++;
      llmTokens += (usage.prompt_tokens || 0) + (usage.completion_tokens || 0);
      const parsedItems = parseResult(content, batch.length);
      for (let j = 0; j < batch.length; j++) {
        out.push(mergeWithOriginal(batch[j], parsedItems[j] || {}));
      }
      log.info(`[enrich] batch ${i + 1}/${batches.length} ok (${batch.length} items, ${usage.total_tokens || '?'} tokens)`);
    } catch (e) {
      log.error(`[enrich] batch ${i + 1} failed:`, e.message);
      // 失败回退：原始数据直接入
      for (const item of batch) out.push(mergeWithOriginal(item, {}));
    }
  }

  // 剩余未处理（被 maxCalls 截断）直接原始入库
  const handled = batches.reduce((s, b) => s + b.length, 0);
  if (handled < items.length) {
    for (const item of items.slice(handled)) out.push(mergeWithOriginal(item, {}));
  }

  return { enriched: out, llmCalls, llmTokens };
}

module.exports = { enrich };
