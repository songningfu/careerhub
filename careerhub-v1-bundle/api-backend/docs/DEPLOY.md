# CareerHub - JD 解析 API 部署文档

## 这是什么

一个独立的后端服务，专门接 LLM 来解析招聘 JD。前端 `careerhub_v0.html` 会调它，让"粘贴 JD 智能解析"功能真正工作。

**成本估算**（按 1000 个学生用户 / 每人每周用 5 次）：
- DeepSeek：约 ¥1/月（推荐，国内最便宜）
- GPT-4o-mini：约 ¥20/月
- Claude Haiku：约 ¥25/月

---

## 方案 A：Vercel（推荐，5 分钟搞定）

### 1. 准备
- 注册 [Vercel](https://vercel.com)（用 GitHub 登录最简单）
- 准备一个 LLM API Key：
  - DeepSeek：https://platform.deepseek.com → 充 10 元即可用半年
  - OpenAI：https://platform.openai.com → 国内需要中转
  - Anthropic：https://console.anthropic.com

### 2. 部署
```bash
cd api-backend/vercel
npm i -g vercel
vercel login
vercel --prod
```

部署完成后你会得到一个 URL，比如 `https://careerhub-api.vercel.app`。

### 3. 配置环境变量
在 Vercel Dashboard → Project → Settings → Environment Variables 添加：

| Key | Value | 说明 |
|---|---|---|
| `LLM_PROVIDER` | `deepseek` | 用哪家（openai / anthropic / deepseek）|
| `DEEPSEEK_API_KEY` | `sk-xxx...` | 对应 provider 的 key |

添加完后点 Vercel Dashboard 右上角 "Redeploy" 重新部署一次。

### 4. 验证
```bash
curl -X POST https://careerhub-api.vercel.app/api/parse-jd \
  -H "Content-Type: application/json" \
  -d '{"text":"字节跳动 2026届暑期实习 后端开发工程师 北京/上海 300-500/天 截止2026年6月30日"}'
```

应该返回：
```json
{
  "company": "字节跳动",
  "position": "后端开发工程师",
  "city": "北京/上海",
  "deadline": "2026-06-30",
  "salary": "300-500/天",
  "requirements": [],
  "tags": ["暑期实习", "大厂"]
}
```

### 5. 前端对接
打开 `careerhub_v0.html`，搜索 `JD_API_ENDPOINT`，把 URL 改成你的：
```js
const JD_API_ENDPOINT = 'https://careerhub-api.vercel.app/api/parse-jd';
```

完成！

---

## 方案 B：Cloudflare Workers（备选，免费额度更大）

### 1. 准备
- 注册 [Cloudflare](https://dash.cloudflare.com)
- 安装 wrangler：`npm i -g wrangler`

### 2. 部署
```bash
cd api-backend/cloudflare
wrangler login
wrangler deploy
```

### 3. 配置 Secret
```bash
wrangler secret put DEEPSEEK_API_KEY
# 粘贴你的 key，回车
wrangler secret put LLM_PROVIDER
# 输入 deepseek，回车
```

### 4. 前端对接
```js
const JD_API_ENDPOINT = 'https://careerhub-api.your-username.workers.dev/api/parse-jd';
```

---

## 限流策略

代码里默认每个 IP 每分钟 10 次。学生用户够用，防爬虫也够用。

如果想要更严格的限流，Cloudflare 版本支持接 KV：

```bash
wrangler kv:namespace create RATE_KV
# 把返回的 id 填到 wrangler.toml 对应位置
```

然后取消 `wrangler.toml` 里 KV 配置那几行的注释，重新部署。

---

## 调试技巧

### 查看实时日志

**Vercel**：
```bash
vercel logs --follow
```

**Cloudflare**：
```bash
wrangler tail
```

### 常见错误

| 错误 | 原因 | 修复 |
|---|---|---|
| `LLM 调用失败：HTTP 401` | API Key 错或被吊销 | 重新生成 key 并更新环境变量 |
| `LLM 调用失败：HTTP 429` | 触发了 LLM 厂商的限流 | 加大 LLM 账号余额或换厂商 |
| `请求过于频繁` | 触发了我们自己的限流 | 等 60 秒或加大 `RATE_LIMIT.max` |
| 前端一直走本地解析 | 没改 `JD_API_ENDPOINT` 默认值 | 改成你的真实 URL |

---

## 切换 LLM 厂商

只改一个环境变量 `LLM_PROVIDER` 就行，不需要改代码：

| Provider | 模型 | 单次成本 | 备注 |
|---|---|---|---|
| `deepseek` | deepseek-chat | ¥0.0001 | 国内最便宜，延迟略高 |
| `openai` | gpt-4o-mini | ¥0.001 | 国内需要中转节点访问 |
| `anthropic` | claude-3-5-haiku | ¥0.003 | 输出质量最好 |

---

## 安全建议

1. **API Key 永远不要写在前端代码里**——本方案的设计就是把 key 放在后端 Vercel/CF 的环境变量
2. 上线后建议加 CORS 白名单（把 `Access-Control-Allow-Origin: *` 改成你的实际域名）
3. 如果用户量大了（>500 DAU），建议接 Upstash Redis 做持久化限流
