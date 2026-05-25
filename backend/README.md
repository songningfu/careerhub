# Offerly V1 完整交付包

> 一个面向 2026/2027 届大学生的求职助理 SaaS，基于腾讯云 CloudBase，可直接部署上线。

## 📦 内容物

```
backend/
├── README.md                    ← 你在看的（总览）
├── careerhub_v1.html            ← 主程序（前端单文件，266KB）
├── CLOUDBASE_DEPLOY.md          ← 腾讯云部署完整指南（必读）
├── api/                 ← JD 智能解析后端
│   ├── README.md
│   ├── docs/DEPLOY.md
│   ├── vercel/                  ← 方案 A：Vercel Edge Function
│   └── cloudflare/              ← 方案 B：Cloudflare Workers
└── crawler/                     ← 公司库爬虫脚手架
    ├── README.md
    └── scraper.py
```

## 🚀 5 分钟快速上线

如果你只想最快把 demo 跑起来：

1. 注册 [腾讯云 CloudBase](https://console.cloud.tencent.com/tcb)，创建环境
2. 编辑 `careerhub_v1.html`，搜索 `CLOUDBASE_ENV_ID`，填上你的环境 ID
3. 控制台「身份认证」启用 **邮箱登录** 和 **匿名登录**
4. 控制台「数据库」创建 10 个集合（见 CLOUDBASE_DEPLOY.md 第三步）
5. 控制台「静态托管」上传 `careerhub_v1.html`（建议改名 `index.html`）

完成。你会拿到一个 `https://xxx.tcloudbaseapp.com` 的 URL，发给同学就能用。

详细步骤 + 安全规则配置见 **CLOUDBASE_DEPLOY.md**。

## ✨ 功能清单

| 模块 | 功能 | 状态 |
|---|---|---|
| 今日页 | 紧急任务 + 求职进度 + 公司库快览 | ✅ |
| 求职台 | 投递记录 + 意向岗位（多维表格） | ✅ |
| 公司库 | 22 条种子机会 + 搜索筛选 | ✅ |
| 简历库 | CloudBase 存储桶上传 + 多版本管理 | ✅ |
| 日历 | 面试/笔试/deadline 一体化 | ✅ |
| 登录系统 | 邮箱注册 + 匿名访客 + 玻璃风 UI | ✅ |
| JD 智能解析 | LLM API（可选，有本地兜底） | ✅ |
| 数据同步 | 多设备同步 + 安全规则隔离 | ✅ |
| 爬虫 | GitHub 合集自动抓取 | ⚠️ 可用，建议人工运营初期 |
| 微信通知 | Server酱 deadline 推送 | ⏸ V2 加 |

## 💰 成本估算

100 个学生用户 / 每人每周用 5 次：

| 项目 | 月成本 |
|---|---|
| CloudBase 数据库 + 存储 + 静态托管 | ¥0（在免费额度内） |
| LLM API（DeepSeek） | ¥1 |
| 爬虫运行（GitHub Actions） | ¥0 |
| **合计** | **不到 ¥5/月** |

## 🛠 升级路径

- V1 → V1.5：接通 LLM API + 上线爬虫定时任务
- V1.5 → V2：移动端 PWA + 微信通知推送
- V2 → V3：iOS/Android 原生 App

## 📞 技术支持

部署遇到问题，按这个清单排查：

1. `CLOUDBASE_ENV_ID` 是否填对？
2. 10 个数据库集合是否都建了？
3. 安全规则是不是配成 `auth.openid == doc._openid`？
4. 「匿名登录」是不是启用了？

90% 的问题都在这 4 项里。
