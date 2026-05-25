// DeepSeek API 客户端（OpenAI 协议兼容）
// 仅暴露 chatJson()：要求模型返回 JSON

const axios = require('axios');
const config = require('../config');
const log = require('../utils/log');

const apiKey = process.env.DEEPSEEK_API_KEY;
if (!apiKey) {
  log.warn('DEEPSEEK_API_KEY env var not set — DeepSeek enrichment will be skipped');
}

// 调用 DeepSeek chat completion，要求 JSON 输出
async function chatJson({ system, user, retry = 1 }) {
  if (!apiKey) {
    throw new Error('DEEPSEEK_API_KEY not configured');
  }
  const url = `${config.deepseek.baseURL}/chat/completions`;
  const payload = {
    model: config.deepseek.model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user }
    ],
    temperature: config.deepseek.temperature,
    response_format: { type: 'json_object' }
  };
  let lastErr;
  for (let attempt = 0; attempt <= retry; attempt++) {
    try {
      const res = await axios.post(url, payload, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        timeout: config.deepseek.timeoutMs
      });
      const content = res.data?.choices?.[0]?.message?.content;
      if (!content) throw new Error('empty response from DeepSeek');
      const usage = res.data?.usage || {};
      return { content, usage };
    } catch (e) {
      lastErr = e;
      const status = e.response?.status;
      log.warn(`[deepseek] call failed (attempt ${attempt + 1}): ${e.message} status=${status}`);
      // 4xx 大多无意义重试（401 等）
      if (status && status >= 400 && status < 500) break;
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    }
  }
  throw lastErr;
}

module.exports = { chatJson, hasKey: !!apiKey };
