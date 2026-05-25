# Offerly 项目架构总览

理解整个系统数据走向 · 不到 5 分钟看完。

---

## 🗂️ 文件清单（清理后）

```
求职平台助手/                          ← Git 仓库根
│
├─ 🟢 部署到 CloudBase Hosting 的（这些是用户访问的"网站"）
│  ├─ careerhub_v1.html              ← 主程序 · 整个应用都在这一个 HTML 里
│  ├─ index.html                     ← 根路径 / 自动跳转到主程序
│  ├─ sw.js                          ← Service Worker · 离线缓存
│  ├─ manifest.webmanifest           ← PWA 清单 · 装机配置
│  └─ verify.html                    ← 功能体检台（线上也能跑）
│
├─ 🔧 GitHub Actions 配置（push 触发的自动化）
│  └─ .github/workflows/
│     ├─ deploy.yml                  ← push → 自动部署到 CloudBase
│     ├─ crawler.yml                 ← 每天 02:00 UTC 跑爬虫
│     └─ README.md
│
├─ 🛠️ 后端代码（这些不部署到 CloudBase）
│  └─ backend/
│     ├─ crawler/                    ← Python 爬虫源码
│     │  ├─ scraper.py               ← 抓 GitHub 招聘合集
│     │  └─ requirements.txt
│     ├─ data/                       ← 爬虫产出的 opportunities.json
│     ├─ api/         ← LLM API（将来部署到 Vercel）
│     │  └─ api/parse-jd.js          ← JD 智能解析
│     └─ api/docs/DEPLOY.md
│
└─ 📖 文档
   ├─ DEPLOY_GITHUB.md               ← GitHub 自动部署手册
   ├─ CLOUDBASE_DEPLOY.md            ← CloudBase 手动部署文档
   ├─ ARCHITECTURE.md                ← 你正在看的这份
   ├─ cloudbaserc.json               ← CloudBase CLI 配置
   └─ .gitignore
```

---

## 🌐 完整数据流向图

```
┌────────────────────────────────────────────────────────────────┐
│  用户的浏览器（手机 / 电脑）                                    │
│  ──────────────────────────────────────                         │
│  本地 localStorage：                                            │
│   • PWA 装机提示 dismissed 时间                                 │
│   • Server酱 SCKEY                                              │
│   • 已推送提醒去重表                                            │
│   • 主题（浅色 / 深色偏好）                                     │
│   • CloudBase auth token（登录态）                              │
└─────────────┬──────────────────────────────────────────────────┘
              │
       HTTPS 请求
              │
              ▼
┌────────────────────────────────────────────────────────────────┐
│  CloudBase 静态托管（CDN）                                      │
│  jesu-6gwqz60k00cb92a2-1390310568.tcloudbaseapp.com            │
│  ──────────────────────────────────────                         │
│  存的是 5 个静态文件：                                          │
│   • careerhub_v1.html  (主程序)                                 │
│   • index.html         (跳转)                                   │
│   • sw.js              (SW)                                     │
│   • manifest.webmanifest                                        │
│   • verify.html        (体检)                                   │
│                                                                  │
│  无数据库、无后端逻辑。所有页面跑在用户浏览器里。               │
└─────────────┬──────────────────────────────────────────────────┘
              │
       浏览器加载完 HTML 后，JS 主动调下面三个服务
              │
   ┌──────────┼──────────────┐
   ▼          ▼              ▼
┌────────┐ ┌──────────┐ ┌──────────────────────┐
│ 身份认证│ │  数据库   │ │       云存储          │
│        │ │          │ │                        │
│匿名/邮箱│ │ 投递记录  │ │ PDF 简历文件           │
│ 登录   │ │ 面试日程  │ │ （上传后存在腾讯 COS） │
│ 注册   │ │ 公司库   │ │                        │
│ 注销   │ │ 简历元数据│ │                        │
│        │ │ 设置等   │ │                        │
└────────┘ └──────────┘ └──────────────────────┘
   都属于 CloudBase 同一个环境 jesu-6gwqz60k00cb92a2
```

---

## 📊 11 个数据库集合分别存什么

| 集合 | 存什么 | 进入哪个页面看 |
|---|---|---|
| **applications** | 投递记录 · 状态 · 面试时间 · 用了哪份简历 | 求职台（Kanban 看板） |
| **interviews** | 面试详情独立记录（备用，主要数据在 applications.interviewDate） | 求职台 |
| **jobs** | 你"感兴趣"的意向岗位 · deadline · 匹配度 | 求职台 - 意向岗位 |
| **companies** | 公司笔记（自己写的研究） | 求职台 - 公司笔记 |
| **opportunities** | 公开公司库（爬虫定时刷新 / 内置 22 家种子） | 公司库 |
| **resumes** | 简历**元数据**（名称/版本/方向/技能/PDF URL） | 简历库 |
| **skills** | 技能掌握度评估（V1 预留，UI 未做） | 暂无 |
| **leetcode** | 刷题打卡（V1 预留） | 暂无 |
| **journal** | 求职日志 | 暂无（V2 计划） |
| **events** | 日历事件（笔试 / 面试 / deadline） | 日历 |
| **speeches** | 自我介绍话术（V1 预留） | 暂无 |
| **settings** | 你的个人偏好（毕业时间 / 称呼） | 设置 |

> 每个集合的安全规则要设成：`{"read":"auth.openid==doc._openid","write":"auth.openid==doc._openid"}` — 这样你只能看到自己的数据，其他用户互相隔离。

---

## 📄 简历 PDF 文件在哪

**两个地方分开存**：

1. **PDF 文件本身** → CloudBase **云存储（COS）**
   - 路径：`resumes/{你的 UID}/{随机id}_{原文件名}.pdf`
   - CloudBase 控制台 → 云存储 → 能看到所有上传的 PDF
   - 文件 URL 是临时签名 URL（2 小时过期，每次预览自动重新签）

2. **简历元数据** → CloudBase 数据库的 `resumes` 集合
   - `{ name, version, target, notes, skills:[], fileId, fileUrl, fileSize, createdAt }`
   - `fileId` 是 COS 里那个 PDF 的引用，前端拿这个去换签名 URL

3. **PDF 技能提取** → **完全在浏览器里跑**
   - PDF.js（CDN 加载）解析 PDF 文本
   - 拿提取出的文字跟 `SKILL_DICT` 250 词字典匹配
   - 匹配结果存到数据库 `resumes.skills` 字段
   - **PDF 内容不上传给任何第三方 AI**，完全离线计算

---

## 🤖 三条外部服务依赖（可选）

| 服务 | 干啥 | 没配会怎样 | 配置位置 |
|---|---|---|---|
| **Server酱** | 微信推送 deadline 提醒 | 不影响其他功能，只是收不到微信 | 设置页填 SCKEY |
| **JD 解析 API** | LLM 智能识别 JD 文本字段 | 自动降级到本地正则解析 | 设置页填 API URL |
| **GitHub Actions 爬虫** | 每天更新公司库 | 用内置 22 家种子数据 | 自动跑 |

---

## 🔁 用户做一次操作 → 数据怎么流

举例：**用户上传一份 PDF 简历**

```
1. 浏览器：用户选择 resume.pdf
   ↓
2. 浏览器：PDF.js 在浏览器里解析文本
   → 提取出技能 ["Python", "React", "Docker", ...]
   ↓
3. 浏览器：app.uploadFile() 调用 CloudBase SDK
   → PDF 二进制流上传到 COS，返回 fileID
   ↓
4. 浏览器：往 resumes 集合 add 一条记录
   { id, name, fileId, fileUrl, skills:[...] , createdAt }
   ↓
5. CloudBase 数据库写入成功
   → 安全规则自动给这条记录打上 _openid=你的UID
   ↓
6. 浏览器：刷新简历列表，显示新简历卡片 + 技能标签
```

---

## 💾 用户**不登录**会怎样

- CloudBase SDK 仍然初始化
- 自动调匿名登录 → 拿到一个临时 anonymous UID
- 数据库读写正常，数据按 anonymous UID 隔离
- 缺点：**换设备 / 清浏览器后数据丢失**（anonymous UID 不持久）

正式注册（邮箱 + 密码）后：
- 数据绑到永久 UID，跨设备同步
- 设置页可以把当前的 anonymous 账号升级为正式账号（保留所有数据）

---

## 🚀 你做开发的循环

```
本地改代码（careerhub_v1.html）
    ↓
git add . && git commit -m "..."
    ↓
git push
    ↓ （30 秒）
GitHub Actions 自动跑 deploy.yml
    ↓ （1 分钟）
CloudBase 静态托管更新
    ↓ （1-3 分钟 CDN 同步）
用户浏览器强刷后看到新版本
```
