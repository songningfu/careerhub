# GitHub Actions 自动化

本目录下两条 workflow：

| 文件 | 作用 | 触发 |
|---|---|---|
| `deploy.yml`  | 部署到 CloudBase 静态托管 | push 到 main / 手动 |
| `crawler.yml` | 每日抓公司库 → commit 回仓库 | 每天 UTC 02:00 / 手动 / 改 crawler 代码 |

完整部署手册见仓库根目录 **`DEPLOY_GITHUB.md`**。

---

## 🚀 deploy.yml · 部署 workflow

每次 `git push main` 自动同步 `careerhub_v1.html` 等静态文件到 CloudBase。

需要在 GitHub Secrets 配三条：

| Secret | 取处 |
| --- | --- |
| `TCB_SECRET_ID`  | 腾讯云控制台 → 访问管理 → API 密钥 |
| `TCB_SECRET_KEY` | 同上（只显示一次，错过要重建）|
| `TCB_ENV_ID`     | CloudBase 控制台 → 你的环境 ID |

部署完会看到 Step Summary 显示访问地址。

---

## 🕷️ crawler.yml · 公司库爬虫

每天 UTC 02:00（北京 10:00）自动抓取 GitHub 招聘合集 → 清洗 → 去重 → commit 回 `backend/data/opportunities.json`。

### 第一次启用

仓库 → Settings → Actions → General →
- **Workflow permissions** 选 ✅ `Read and write permissions`（让 Action 能 commit 回来）

Actions tab → 选「公司库爬虫定时任务」→ 右上角 **Run workflow** 跑一次确认。

### 前端怎么消费爬虫数据

部署到 CloudBase 后，爬虫产物 `data/opportunities.json` 会随 deploy.yml 一并发到线上，前端直接 fetch 同源：

```js
fetch('./data/opportunities.json')
  .then(r => r.json())
  .then(data => { OPPORTUNITY_MOCK = data; renderPage('opportunities'); });
```

如果用 Public 仓库也可以走 jsDelivr CDN：
```
https://cdn.jsdelivr.net/gh/<你的GitHub用户名>/<仓库名>@main/backend/data/opportunities.json
```

### 调试

- 改 `backend/crawler/scraper.py` 后 push 即触发
- 手动触发：Actions → workflow → Run workflow
- 跑完去 Actions 页面看「拉取 N 条」的 Step Summary
