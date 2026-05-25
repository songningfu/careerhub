# 公司库 DeepSeek 智能爬虫 · 部署手册

本文档教你把 `opportunityCrawler` 云函数装起来，前端「立即更新」按钮就能工作。

---

## 整体架构

```
前端「立即更新」按钮
   │  app.callFunction('opportunityCrawler', {action:'run', trigger:'manual'})
   ▼
CloudBase 云函数 opportunityCrawler
   ├─ 限流校验（24h ≤ 3 次/用户）
   ├─ 多源抓取（GitHub 招聘合集 Markdown）
   ├─ DeepSeek 批量结构化（字段补齐 + 标签 + 行业归类）
   ├─ upsert 到 opportunities 集合
   └─ 记录 crawler_runs
   ▼
返回 {phases, db, durationMs} → 前端进度面板显示
```

---

## 一次性配置（按顺序做完）

### Step 1 — DeepSeek 账号 & API Key

1. 注册 https://platform.deepseek.com
2. 充值 ¥10 起（按 V4-flash 价格，¥10 够用很久）
3. API Keys → 新建 → 拷贝 `sk-xxxxxxxx`

### Step 2 — GitHub Secret 配置

GitHub repo → Settings → Secrets and variables → Actions → New repository secret，依次添加：

| Secret 名 | 值 | 已有？ |
|---|---|---|
| `TCB_SECRET_ID` | 腾讯云控制台 → 访问密钥 → SecretId | 已有（部署用） |
| `TCB_SECRET_KEY` | 同上 SecretKey | 已有 |
| `TCB_ENV_ID` | CloudBase 环境 ID（如 `jesu-6gwqz60k00cb92a2`） | 已有 |
| **`DEEPSEEK_API_KEY`** | 上一步拷贝的 sk-xxx | **新增** |

可选：仓库 → Settings → Secrets and variables → Actions → Variables 标签页添加：

| Variable 名 | 默认值 | 说明 |
|---|---|---|
| `DEEPSEEK_MODEL` | `deepseek-chat` | 想用 V4 时改成 `deepseek-v4-flash` 或官方公布的名 |

### Step 3 — CloudBase 数据库准备

CloudBase 控制台 → 你的环境 → 数据库 → 集合：

#### 1. 确认 `opportunities` 存在

如果之前没建，新建集合：
- 名称：`opportunities`
- 权限：自定义安全规则

```json
{
  "read": true,
  "write": false
}
```

> 公司库面向所有用户共享，只允许云函数写入。

#### 2. 新建 `crawler_runs` 集合

- 名称：`crawler_runs`
- 权限：自定义安全规则

```json
{
  "read": "auth.openid == doc.openid",
  "write": false
}
```

> 只云函数写。用户可看自己触发的历史（后续版本会做 UI）。

### Step 4 — 部署云函数

把代码 push 上 main 分支，GitHub Actions 会自动跑 `deploy-function.yml`：

```bash
git add cloudfunctions/ .github/workflows/deploy-function.yml docs/
git commit -m "feat: opportunityCrawler cloud function"
git push
```

跑完 1–3 分钟后，CloudBase 控制台 → 云函数 → 列表里应该看到 `opportunityCrawler`。

#### 验证部署成功

CloudBase 控制台 → 云函数 → `opportunityCrawler` → 测试 → 触发参数填 `{"action":"ping"}` → 测试，应返回：

```json
{ "ok": true, "hasDeepseek": true, "model": "deepseek-chat" }
```

`hasDeepseek` 为 `true` 说明 DEEPSEEK_API_KEY 注入成功。

### Step 5 — 配置定时器（可选，但推荐）

CloudBase 控制台 → 云函数 → `opportunityCrawler` → 触发器 → 添加触发器：

- 触发器名称：`daily-9am`
- 类型：**定时触发**
- 触发周期 (cron)：`0 0 9 * * * *` （每天上午 9 点）
- 触发参数：

```json
{ "action": "run", "trigger": "cron" }
```

> 定时触发也走限流（全局每小时最多 1 次），不会和手动触发冲突。

---

## 日常使用

### 用户触发

公司库页面顶部「立即更新」按钮 → 等 5–30 秒 → 进度面板显示结果：

- `FETCHED`：本次源数据条数
- `NEW`：新增数量
- `UPDATED`：刷新数量
- `EXPIRED`：本次标记过期数量
- `LLM CALLS`：调用 DeepSeek 次数
- `TOKENS`：消耗 tokens 数

### 开发者排错

#### 看运行日志

CloudBase 控制台 → 云函数 → `opportunityCrawler` → 日志：

- `[INFO]` 正常节点
- `[WARN]` 单步失败/限流（不致命）
- `[ERR]` 致命错误

#### 看历史运行

CloudBase 控制台 → 数据库 → `crawler_runs`：每条记录包含 phases / db / error / durationMs。

#### 常见问题

| 现象 | 原因 | 排查 |
|---|---|---|
| 前端报 `云端未初始化` | `app` 未 ready 就点了按钮 | F5 刷新页面后重试 |
| `code: RATE_LIMITED` | 同账号 24h 内点超过 3 次 | 第二天再试，或登 CloudBase 改 `config.js` 里 `perUserPerDay` |
| `hasDeepseek: false` | env var 没生效 | 重新 push 跑 workflow，或控制台手动添加环境变量 |
| `LLM CALLS: 0` 且数据未结构化 | DeepSeek 调用全失败 | 看日志的 `[WARN] [deepseek] call failed` 行，常见是 key 写错/账户欠费 |
| `DeepSeek returned non-JSON` | 模型回了非 JSON | 检查 prompts.js 是不是被改坏；或切到 deepseek-chat |

---

## 成本控制

按 DeepSeek V4-flash 计价：

- 输入 ¥1/M tokens（缓存命中 ¥0.02/M）
- 输出 ¥2/M tokens

**单次更新 1000 条原始数据 ≈ ¥0.3**（第二次起 prompt cache 命中后 ≈ ¥0.15）

- 100 个学生 × 每天 1 次 ≈ 月成本 ¥30–¥100
- 加上定时器每天 1 次 ≈ +¥0.5

### 想再省的额外手段

1. `config.js` 调大 `batchSize`（默认 20，可改到 30）
2. `config.js` 调小 `maxCalls`（默认 30 次封顶，可改到 10）
3. 增量更新：让 `sources/githubAwesome.js` 只取最近 30 天的（待实现）

---

## 后续扩展

| 功能 | 难度 | 备注 |
|---|---|---|
| 加新爬虫源 | 低 | 在 `sources/` 加新文件，`config.js` 开关里打开 |
| 实习僧 / 看准官网爬虫 | 中 | 反爬复杂，可能需要 Headless |
| 一键删除 expired | 低 | 加 `cleanup` action |
| 历史运行可视化 | 中 | 设置页加面板，查 crawler_runs 集合 |
| LLM 智能去重（语义） | 中 | 现在是 hash 去重，跨源同名岗位可能漏 |
| 用户提交机会（共建） | 高 | 新增 user_opportunity_submissions，审核后入主表 |

---

## 一键回滚

如果云函数有问题：

```bash
# CloudBase 控制台 → 云函数 → opportunityCrawler → 删除
# 或者保留函数，把前端按钮注释掉：
# careerhub_v1.html 搜 "立即更新" 注释那个 button
```

前端按钮没了，整个流程自动失效，老的 opportunities 数据不受影响。
