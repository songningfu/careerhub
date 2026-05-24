# CareerHub API Backend

让 `careerhub_v0.html` 的「粘贴 JD 智能解析」从 60% 准确率（本地正则）升级到 95%+（接 LLM）。

## 目录结构

```
api-backend/
├── README.md              ← 你正在看的
├── docs/
│   └── DEPLOY.md          ← 完整部署文档
├── vercel/                ← 方案 A（推荐）
│   ├── api/
│   │   └── parse-jd.js    ← Edge Function 主代码
│   ├── package.json
│   └── vercel.json
└── cloudflare/            ← 方案 B（备选）
    ├── worker.js
    └── wrangler.toml
```

## 快速开始

**5 分钟部署版本**（Vercel + DeepSeek）：

1. `cd vercel && vercel --prod` 部署
2. 在 Vercel Dashboard 配置环境变量 `LLM_PROVIDER=deepseek` 和 `DEEPSEEK_API_KEY=sk-xxx`
3. 在 `careerhub_v0.html` 里改 `JD_API_ENDPOINT` 为你的 URL

详细步骤看 [docs/DEPLOY.md](./docs/DEPLOY.md)。

## 工作原理

```
学生粘贴 JD
    ↓
前端 careerhub_v0.html → POST /api/parse-jd
    ↓
Vercel Edge / Cloudflare Worker
    ↓ (附上 SYSTEM_PROMPT)
DeepSeek / OpenAI / Claude API
    ↓
返回严格 JSON: {company, position, city, deadline, salary, requirements, tags}
    ↓
前端填充表单 → 用户确认 → 入库
```

## 设计要点

- **零厂商锁定**：环境变量切 `LLM_PROVIDER` 一秒换厂商
- **失败自动降级**：API 挂了/Key 没配，前端自动回退到本地正则解析（不影响功能）
- **IP 限流**：每 IP 每分钟 10 次，防刷
- **CORS 全开**：方便单文件前端直接调用
- **`response_format: json_object`**：强制 LLM 输出 JSON，配合 `safeParseJSON` 兜底，几乎不会解析失败

## 成本

按 1000 学生用户 / 每人每周用 5 次估算：

| Provider | 月成本 |
|---|---|
| DeepSeek | ¥1 |
| GPT-4o-mini | ¥20 |
| Claude Haiku | ¥25 |
