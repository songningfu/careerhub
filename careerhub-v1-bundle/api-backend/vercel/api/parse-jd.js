// ============================================================
// CareerHub - JD 智能解析 API
// 部署到 Vercel Edge Functions
// 路径: /api/parse-jd  (POST)
// ============================================================

export const config = {
  runtime: 'edge',
  // 默认部署到 hkg1（香港）+ sin1（新加坡），国内访问 200-400ms
  regions: ['hkg1', 'sin1', 'icn1'],
};

// ---------- 配置 ----------
const PROVIDER = process.env.LLM_PROVIDER || 'openai'; // 'openai' | 'anthropic' | 'deepseek'

const CONFIG = {
  openai: {
    url: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-4o-mini',     // ¥0.001/次，国内最便宜可用
    keyEnv: 'OPENAI_API_KEY',
  },
  anthropic: {
    url: 'https://api.anthropic.com/v1/messages',
    model: 'claude-3-5-haiku-20241022',
    keyEnv: 'ANTHROPIC_API_KEY',
  },
  deepseek: {
    url: 'https://api.deepseek.com/v1/chat/completions',
    model: 'deepseek-chat',   // ¥0.0001/次，国内最便宜！但延迟略高
    keyEnv: 'DEEPSEEK_API_KEY',
  },
};

// ---------- 限流（基于 IP 的简易内存表） ----------
const RATE_LIMIT = { window: 60_000, max: 10 }; // 每 IP 每分钟 10 次
const rateMap = new Map();

function checkRate(ip) {
  const now = Date.now();
  const arr = (rateMap.get(ip) || []).filter(t => now - t < RATE_LIMIT.window);
  if (arr.length >= RATE_LIMIT.max) return false;
  arr.push(now);
  rateMap.set(ip, arr);
  // 清理：表过大时丢掉最早的一半
  if (rateMap.size > 1000) {
    const keys = [...rateMap.keys()].slice(0, 500);
    keys.forEach(k => rateMap.delete(k));
  }
  return true;
}

// ---------- Prompt ----------
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

【缺失字段】留空字符串 "" 或空数组 []。

【示例输入】
"字节跳动 2026届暑期实习招聘
岗位：后端开发工程师（北京/上海）
薪资：300-500/天
要求：
- 熟悉 Go/Python
- 计算机相关专业本科及以上
截止日期：2026-06-30"

【示例输出】
{"company":"字节跳动","position":"后端开发工程师","city":"北京/上海","deadline":"2026-06-30","salary":"300-500/天","requirements":["熟悉 Go/Python","计算机相关专业本科及以上"],"tags":["暑期实习","大厂"]}`;

// ---------- CORS ----------
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

// ---------- 主处理 ----------
export default async function handler(req) {
  // 预检
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  // 限流
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('cf-connecting-ip')
    || 'unknown';
  if (!checkRate(ip)) {
    return json({ error: '请求过于频繁，请稍后再试（每分钟限 10 次）' }, 429);
  }

  // 解析 body
  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const text = (body.text || '').toString().trim();
  if (text.length < 30) {
    return json({ error: 'JD 内容太短（少于 30 字）' }, 400);
  }
  if (text.length > 5000) {
    return json({ error: 'JD 内容过长（超过 5000 字），请精简后重试' }, 400);
  }

  // 调用 LLM
  const cfg = CONFIG[PROVIDER];
  const apiKey = process.env[cfg.keyEnv];
  if (!apiKey) {
    return json({ error: `服务未配置 API Key（${cfg.keyEnv}）` }, 500);
  }

  try {
    const parsed = await callLLM(cfg, apiKey, text);
    return json(parsed, 200);
  } catch (e) {
    console.error('LLM error:', e);
    return json({ error: 'LLM 调用失败：' + (e.message || 'unknown') }, 502);
  }
}

// ---------- LLM 调用 ----------
async function callLLM(cfg, apiKey, text) {
  if (PROVIDER === 'anthropic') {
    return callAnthropic(cfg, apiKey, text);
  }
  // openai / deepseek 共用 OpenAI 兼容协议
  return callOpenAICompatible(cfg, apiKey, text);
}

async function callOpenAICompatible(cfg, apiKey, text) {
  const res = await fetch(cfg.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: cfg.model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: text },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
      max_tokens: 800,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`${cfg.model} HTTP ${res.status}: ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content || '{}';
  return safeParseJSON(content);
}

async function callAnthropic(cfg, apiKey, text) {
  const res = await fetch(cfg.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: cfg.model,
      max_tokens: 800,
      temperature: 0.1,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: text }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`${cfg.model} HTTP ${res.status}: ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  const content = data.content?.[0]?.text || '{}';
  return safeParseJSON(content);
}

// ---------- 工具 ----------
function safeParseJSON(str) {
  // 防御性解析：去掉可能的 markdown code fence
  const cleaned = str.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  try {
    const obj = JSON.parse(cleaned);
    // 字段兜底
    return {
      company: obj.company || '',
      position: obj.position || '',
      city: obj.city || '',
      deadline: normalizeDeadline(obj.deadline),
      salary: obj.salary || '',
      requirements: Array.isArray(obj.requirements) ? obj.requirements.slice(0, 5) : [],
      tags: Array.isArray(obj.tags) ? obj.tags.slice(0, 4) : [],
    };
  } catch (e) {
    throw new Error('LLM 返回了非法 JSON: ' + cleaned.slice(0, 100));
  }
}

function normalizeDeadline(d) {
  if (!d) return '';
  // 接受 YYYY-MM-DD 或 YYYY/MM/DD
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
