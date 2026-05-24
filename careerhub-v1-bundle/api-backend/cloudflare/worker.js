// ============================================================
// CareerHub - JD 智能解析 Worker
// 部署到 Cloudflare Workers (免费 10 万次/天)
// 路径: /api/parse-jd  (POST)
// ============================================================

const SYSTEM_PROMPT = `你是一个招聘信息解析助手。用户会粘贴一段中文招聘信息（JD），你需要提取关键字段。

【输出要求】
必须返回严格 JSON，不要任何 markdown、解释、前后缀。
字段定义：
- company: 公司名（如"字节跳动"、"腾讯"，不带"科技有限公司"后缀）
- position: 岗位名（如"后端开发工程师"、"算法工程师-推荐"，去掉"急聘""校招"等前缀）
- city: 工作城市（多城市用 / 分隔，如 "北京/上海"）
- deadline: 投递截止日期，格式 YYYY-MM-DD。无法确定的留空字符串
- salary: 薪资范围（如 "25-40K"、"300-500/天"）
- requirements: 关键要求数组，每条不超过 50 字，最多 5 条
- tags: 标签数组（如 ["校招", "急聘", "可转正", "大厂"]），最多 4 个

【缺失字段】留空字符串 "" 或空数组 []。`;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // CORS 预检
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (url.pathname !== '/api/parse-jd' || request.method !== 'POST') {
      return json({ error: 'Not Found' }, 404);
    }

    // 限流（用 Cloudflare KV，可选；这里用内存简化版）
    const ip = request.headers.get('cf-connecting-ip') || 'unknown';
    if (env.RATE_KV) {
      const key = `rate:${ip}`;
      const cnt = parseInt(await env.RATE_KV.get(key) || '0', 10);
      if (cnt >= 10) {
        return json({ error: '请求过于频繁，请稍后再试（每分钟限 10 次）' }, 429);
      }
      await env.RATE_KV.put(key, String(cnt + 1), { expirationTtl: 60 });
    }

    // 解析请求
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Invalid JSON body' }, 400);
    }

    const text = (body.text || '').toString().trim();
    if (text.length < 30) return json({ error: 'JD 内容太短' }, 400);
    if (text.length > 5000) return json({ error: 'JD 内容过长（>5000 字）' }, 400);

    // 调 LLM
    const provider = env.LLM_PROVIDER || 'openai';
    try {
      const parsed = await callLLM(provider, env, text);
      return json(parsed, 200);
    } catch (e) {
      console.error(e);
      return json({ error: 'LLM 调用失败：' + e.message }, 502);
    }
  },
};

async function callLLM(provider, env, text) {
  if (provider === 'anthropic') {
    return await callAnthropic(env.ANTHROPIC_API_KEY, text);
  }
  if (provider === 'deepseek') {
    return await callOpenAICompat(
      'https://api.deepseek.com/v1/chat/completions',
      'deepseek-chat',
      env.DEEPSEEK_API_KEY,
      text
    );
  }
  // 默认 openai
  return await callOpenAICompat(
    'https://api.openai.com/v1/chat/completions',
    'gpt-4o-mini',
    env.OPENAI_API_KEY,
    text
  );
}

async function callOpenAICompat(apiUrl, model, apiKey, text) {
  if (!apiKey) throw new Error('API Key 未配置');
  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: text },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
      max_tokens: 800,
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return safeParseJSON(data.choices?.[0]?.message?.content || '{}');
}

async function callAnthropic(apiKey, text) {
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY 未配置');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 800,
      temperature: 0.1,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: text }],
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return safeParseJSON(data.content?.[0]?.text || '{}');
}

function safeParseJSON(str) {
  const cleaned = str.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  const obj = JSON.parse(cleaned);
  return {
    company: obj.company || '',
    position: obj.position || '',
    city: obj.city || '',
    deadline: normalizeDeadline(obj.deadline),
    salary: obj.salary || '',
    requirements: Array.isArray(obj.requirements) ? obj.requirements.slice(0, 5) : [],
    tags: Array.isArray(obj.tags) ? obj.tags.slice(0, 4) : [],
  };
}

function normalizeDeadline(d) {
  if (!d) return '';
  const m = String(d).match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (!m) return '';
  return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...CORS_HEADERS,
    },
  });
}
