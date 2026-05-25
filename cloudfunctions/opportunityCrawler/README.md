# opportunityCrawler 云函数

CareerHub 公司库 · 多源爬取 + DeepSeek 智能化 + CloudBase 入库

## 文件结构

```
opportunityCrawler/
├─ index.js                 # 入口：路由 + 限流 + 异常处理
├─ config.js                # 配置常量（模型/限流/数据源开关）
├─ package.json
├─ sources/
│  └─ githubAwesome.js      # GitHub 招聘合集 Markdown 抓取
├─ deepseek/
│  ├─ client.js             # DeepSeek API 客户端（OpenAI 协议）
│  ├─ prompts.js            # 结构化 prompt（命中 prompt cache 省钱）
│  └─ enrich.js             # 批量 enrich + 失败回退
├─ db/
│  ├─ sync.js               # opportunities upsert + 过期标记
│  └─ runLog.js             # crawler_runs 记录 + 限流计数
└─ utils/
   ├─ hash.js               # MD5 业务主键
   └─ log.js                # 结构化日志
```

## 环境变量

云函数控制台 → 函数配置 → 环境变量：

| key | 是否必需 | 说明 |
|---|---|---|
| `DEEPSEEK_API_KEY` | 必需 | DeepSeek 平台申请的 sk-xxx |
| `DEEPSEEK_MODEL` | 可选 | 默认 `deepseek-chat`，可改 `deepseek-v4-flash` 等 |
| `DEEPSEEK_BASE_URL` | 可选 | 默认 `https://api.deepseek.com` |

未配 KEY 时不会报错，直接跳过 DeepSeek 步骤，把原始数据落库。

## 调用方式

### 前端手动触发

```js
const res = await tcb.callFunction({
  name: 'opportunityCrawler',
  data: { action: 'run', trigger: 'manual' }
});
console.log(res.result);
// {
//   ok: true,
//   durationMs: 8421,
//   phases: { fetched: 87, enriched: 87, llmCalls: 5, llmTokens: 12000 },
//   db: { inserted: 12, updated: 73, skipped: 2, errors: 0, markedExpired: 4 }
// }
```

### 健康检查

```js
await tcb.callFunction({ name: 'opportunityCrawler', data: { action: 'ping' } });
// → { ok: true, hasDeepseek: true, model: 'deepseek-chat' }
```

### 定时器触发

CloudBase 控制台 → 云函数 → 触发器 → 添加触发器：
- 类型：定时触发
- 触发周期：`0 0 9 * * *`（每日 09:00）
- 触发参数：`{"action":"run","trigger":"cron"}`

## 限流

- 单用户手动：24h 内最多 3 次（`config.rateLimit.perUserPerDay`）
- 定时触发全局：1h 内最多 1 次（防止定时器叠加）
- 单次最多调用 DeepSeek 30 批次（防 token 爆炸）

## 数据库集合（首次部署需手动创建）

CloudBase 控制台 → 数据库 → 新建集合：

1. **`opportunities`**（如已存在跳过）
   - 安全规则：`{"read":true,"write":false}` （公司库面向所有用户共享，只云函数写）
2. **`crawler_runs`**（必须新建）
   - 安全规则：`{"read":"auth.openid==doc._openid || false","write":false}`
   - 仅云函数写，前端如需查询自己触发的历史可读

## 字段约定（opportunities 文档）

```json
{
  "id":         "op_xxxxxxxxxx",
  "company":    "字节跳动",
  "position":   "后端开发工程师",
  "city":       "北京/上海",
  "salary":     "25-40K·15薪",
  "deadline":   "2026-06-15",
  "industry":   "互联网",
  "category":   "后端",
  "tags":       ["校招", "大厂", "可转正"],
  "descShort":  "参与抖音核心服务研发",
  "desc":       "原始描述（可能很长）",
  "source":     "GitHub合集",
  "sourceUrl":  "https://...",
  "firstSeenAt": "2026-01-15T01:00:00Z",
  "lastSeenAt":  "2026-05-25T01:00:00Z",
  "expired":     false
}
```

## 成本估算（按 DeepSeek V4-flash 定价）

- 输入 ¥1/M（缓存命中 ¥0.02/M）
- 输出 ¥2/M

单次更新 1000 条原始数据：
- 50 批次 × (system 800 tokens + user 2000 tokens) ≈ 140K input tokens
- 50 批次 × 输出 1500 tokens ≈ 75K output tokens
- 首次：¥0.14 + ¥0.15 = **约 ¥0.3**
- 二次（命中缓存）：¥0.003 + ¥0.15 = **约 ¥0.15**

按 100 个学生用户、每人每天 1 次推算月成本约 ¥30–¥100。

## 排错

云函数控制台 → 日志 → 关键字过滤：
- `[INFO]` 流程节点
- `[WARN]` 单次失败、限流
- `[ERR]` 致命错误（爬虫源、DeepSeek 调用失败、入库失败）

也可以查 `crawler_runs` 集合，每次运行结果都有 `error` 字段。
