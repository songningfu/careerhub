# 求职管家（暂用名 · 待定品牌名）

> 秋招 / 春招 / 实习一站式管理 · 为 2026 / 2027 届毕业生设计
> 投递 → 面试 → Offer · 一站集成

线上：`https://jesu-6gwqz60k00cb92a2-1390310568.tcloudbaseapp.com/`

---

## ⚡ 快速开始

```bash
# 本地跑（任何 http 服务器都行）
python3 -m http.server 8000
# 浏览器开 http://localhost:8000
```

部署到 CloudBase 看 [docs/DEPLOY_GITHUB.md](docs/DEPLOY_GITHUB.md)。

---

## 📁 项目结构

```
.
├── careerhub_v1.html         主程序（单文件应用，所有功能在这里）
├── index.html                根路径跳转
├── sw.js                     Service Worker · 离线缓存
├── manifest.webmanifest      PWA 清单
├── verify.html               🩺 功能体检台
│
├── backend/                  后端代码（不直接部署到 CloudBase）
│   ├── crawler/              Python 爬虫 · 抓 GitHub 招聘合集
│   ├── api/                  LLM API · JD 智能解析（部署到 Vercel）
│   └── data/                 爬虫产物 · opportunities.json
│
├── docs/                     所有文档
│   ├── ARCHITECTURE.md       全栈架构总览
│   ├── CHANGELOG.md          ★ 项目更新日志
│   ├── DEPLOY_GITHUB.md      GitHub 自动部署手册
│   └── CLOUDBASE_DEPLOY.md   CloudBase 手动部署文档
│
├── .github/workflows/        GitHub Actions
│   ├── deploy.yml            push 即自动部署到 CloudBase
│   └── crawler.yml           每天 02:00 UTC 跑爬虫
│
├── cloudbaserc.json          CloudBase CLI 配置
└── .gitignore
```

---

## 🚀 日常工作流

```
本地改代码（careerhub_v1.html）
    ↓
git add . && git commit -m "feat: xxx"
    ↓
git push
    ↓ 30 秒
GitHub Actions 自动部署到 CloudBase
    ↓ 1-3 分钟
CDN 同步完成 · 用户强刷见新版
```

**改完代码记得更新 [docs/CHANGELOG.md](docs/CHANGELOG.md)**。

---

## 🛠️ 技术栈速览

| 层 | 选型 |
|---|---|
| 前端 | 单文件 HTML + 原生 JS（无构建步骤） |
| 数据库 | CloudBase 文档型数据库（11 个集合） |
| 认证 | CloudBase Auth（匿名 + 邮箱注册）|
| 文件存储 | CloudBase 云存储 COS（PDF 简历）|
| CDN | CloudBase 静态托管 |
| PDF 解析 | PDF.js（浏览器端，不上传）|
| 推送 | Server酱（浏览器直连）|
| LLM API | Vercel Functions（可选）|
| 爬虫 | GitHub Actions + Python |
| 部署 CI | GitHub Actions + @cloudbase/cli |

完整数据流向看 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)。

---

## 📦 主要功能

- ✅ 投递记录看板（Kanban 拖拽）
- ✅ 意向岗位库（deadline 倒计时）
- ✅ 公司库（22 家种子 + 爬虫增量）
- ✅ 简历库（PDF 上传 + 技能自动提取）
- ✅ 日历（投递 / 面试 / deadline）
- ✅ JD 智能解析（本地正则 + 可选 LLM）
- ✅ Server酱 微信通知（deadline 提前 24h）
- ✅ PWA 可装机（离线可开）
- ✅ 浅色 / 深色主题
- ✅ Driver.js 新手引导

---

## 📈 当前状态

- **版本**：V1.5.1
- **环境**：CloudBase 个人版按量计费
- **域名**：默认 `xxx.tcloudbaseapp.com`（备案中 → 未来切 `songningfu.site`）
- **数据**：11 个集合（6 个核心使用 · 5 个 V2 预留）

详细更新历史见 [docs/CHANGELOG.md](docs/CHANGELOG.md)。

---

## 🎯 V2 路线图（预告）

- [ ] 技能树评分系统（`skills` 集合）
- [ ] LeetCode 刷题打卡（`leetcode` 集合）
- [ ] 求职日志（`journal` 集合）
- [ ] 自我介绍话术库（`speeches` 集合）
- [ ] LLM 智能 JD 解析（部署 Vercel API）
- [ ] Telegram / 飞书推送（除 Server酱外）
- [ ] 多人协作（求职小组）
- [ ] 数据导出 PDF 报告

---

## 🤝 贡献 / 反馈

这是个 ~~开源~~ 个人项目。
微信扫码或邮件联系。
