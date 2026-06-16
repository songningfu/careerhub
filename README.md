<div align="center">

# Offerly · 求职管理平台

**秋招 / 春招 / 实习一站式管理 —— 为 2026 / 2027 届毕业生打造**

投递 → 笔试 → 面试 → Offer，全流程追踪 · AI 求职助手 · 岗位智能聚合

[![部署](https://img.shields.io/badge/部署-腾讯云%20CVM-blue)]()
[![后端](https://img.shields.io/badge/后端-PocketBase-orange)]()
[![AI](https://img.shields.io/badge/AI-DeepSeek-9cf)]()
[![PWA](https://img.shields.io/badge/PWA-可安装-success)]()

🔗 在线体验：<http://43.161.217.43:9527>

</div>

---

## ✨ 这是什么

Offerly 是一个**单文件 Web 应用 + 自托管后端**的求职管理工具。它把求职过程中散落在 Excel、备忘录、各招聘 App 里的信息收拢到一处，并用 AI 帮你做岗位匹配和简历分析。

整个前端是**一个 HTML 文件**（约 7500 行，零构建步骤），后端用自托管的 PocketBase，部署在一台腾讯云轻量服务器上，`git push` 即可更新。

## 🎯 核心功能

| 模块 | 能力 |
|------|------|
| 📊 **今日台** | 毕业倒计时、本周待办、投递进度漏斗、Offer 统计一屏总览 |
| 🎯 **求职台** | 飞书多维表格式的投递看板，拖拽改状态，支持表格 / 看板双视图 |
| 🏢 **公司库** | 聚合字节 / 腾讯 / 阿里等岗位机会，按行业、标签筛选排序 |
| 📄 **简历库** | 多版本简历管理，PDF 在线预览，技能自动解析，按岗位定制 |
| 📅 **日历** | 笔试 / 面试 / DDL 日程视图，截止提醒，可接微信通知 |
| 🤖 **AI 助手** | **RAG 对话**：基于你的 JD 知识库回答"哪些岗位匹配我""我还缺什么技能"；**JD 智能解析**：粘贴招聘原文，AI 自动结构化入库 |

### AI 求职助手亮点

- **检索增强（RAG）**：把收集的 JD 做成知识库，对话时自动召回最相关岗位作为上下文
- **岗位匹配 / 技能差距分析**：结合你的简历，给出 Top 匹配岗位和具体提升建议
- **一键 JD 入库**：粘贴 Boss 直聘 / 官网 JD 全文 → DeepSeek 解析出公司、岗位、薪资、要求 → 存入公司库
- **API Key 本地存储**：DeepSeek Key 只存在浏览器 localStorage，不上传服务器

## 🏗️ 技术架构

```
┌─────────────────────────────────────────────────────────────┐
│  浏览器 (PWA · 可安装到桌面/主屏)                              │
│  careerhub_v1.html — 单文件应用                               │
│  ECharts · SortableJS · Fuse.js · pdf.js · dayjs · PocketBase SDK │
└───────────────┬─────────────────────────┬───────────────────┘
                │ 静态资源                  │ 数据 API (/pb)
                ▼                          ▼
┌──────────────────────────┐   ┌──────────────────────────────┐
│  Nginx (腾讯云香港 CVM)   │   │  PocketBase (systemd 常驻)     │
│  :9527 静态站点 + /pb 反代 │──▶│  127.0.0.1:8090 · SQLite       │
│  :9528 PB 管理后台         │   │  owner+payload 数据模型         │
└──────────────────────────┘   └──────────────────────────────┘
                ▲
                │ git pull (GitHub Actions SSH)
┌──────────────────────────┐   ┌──────────────────────────────┐
│  GitHub Actions           │   │  DeepSeek API (AI 求职助手)    │
│  定时爬虫 → opportunities  │   │  浏览器直连，Key 本地存储       │
└──────────────────────────┘   └──────────────────────────────┘
```

**设计取舍**

- **单文件前端**：零构建、零依赖安装，任意静态服务器可跑，改完直接刷新见效
- **自托管 PocketBase**：单二进制文件自带数据库 + 用户系统 + REST API，替代过期的腾讯云 CloudBase，永久免费可控
- **owner + payload 模型**：每张表只有 `owner`(归属用户) + `payload`(JSON 业务数据) 两个字段，配合 `owner = @request.auth.id` 的 API 规则做到用户数据隔离，schema 灵活无需迁移

## 🧰 技术栈

- **前端**：原生 JavaScript（无框架）、HTML、CSS，PWA（Service Worker + manifest）
- **可视化 / 交互**：ECharts、SortableJS（拖拽）、Fuse.js（模糊搜索）、Tippy.js、pdf.js、canvas-confetti
- **后端**：PocketBase（Go + SQLite），Nginx 反向代理
- **AI**：DeepSeek Chat / Reasoner（OpenAI 兼容协议），RAG 检索
- **爬虫**：Python，抓取 GitHub 招聘合集，DeepSeek 结构化
- **CI/CD**：GitHub Actions（SSH 自动部署 + 定时爬虫）
- **基础设施**：腾讯云轻量应用服务器（香港）

## 📁 项目结构

```
.
├── careerhub_v1.html         主程序（单文件应用，全部前端功能）
├── index.html                根路径跳转
├── sw.js                     Service Worker · 离线缓存
├── manifest.webmanifest      PWA 清单
├── verify.html               功能体检台
│
├── backend/
│   ├── crawler/              Python 爬虫 · 抓 GitHub 招聘合集
│   ├── api/                  LLM API · JD 解析（Vercel，可选）
│   └── data/                 爬虫产物 · opportunities.json
│
├── scripts/                  服务器运维脚本
│   ├── pb-init.sh            PocketBase 一键建表（API）
│   ├── pb_schema.json        集合结构定义
│   └── pocketbase.service    systemd 服务单元
│
├── docs/
│   ├── ARCHITECTURE.md       架构总览
│   ├── DEPLOY_POCKETBASE.md  ★ PocketBase 自托管部署手册
│   ├── DEPLOY_CVM.md         CVM + Nginx 部署
│   ├── CRAWLER_DEEPSEEK.md   爬虫说明
│   └── CHANGELOG.md          更新日志
│
└── .github/workflows/
    ├── deploy-cvm.yml        push → SSH 自动部署到 CVM
    └── crawler.yml           定时爬虫
```

## 🚀 本地运行

```bash
# 任意静态服务器即可（无需构建）
python3 -m http.server 8000
# 浏览器打开 http://localhost:8000

# 首页选「访客身份体验」= 本地模式，数据存浏览器，开箱即用
```

想用 AI 助手：进「设置」填一个 [DeepSeek API Key](https://platform.deepseek.com)（注册即送额度）。

## ☁️ 部署到自己的服务器

完整步骤见 **[docs/DEPLOY_POCKETBASE.md](docs/DEPLOY_POCKETBASE.md)**，概要：

1. **PocketBase**：下载二进制 → systemd 常驻（`scripts/pocketbase.service`）
2. **Nginx**：静态站点 + `/pb` 反代到 PocketBase
3. **建表**：`bash scripts/pb-init.sh` 一键创建 12 张数据表
4. **自动部署**：配好 GitHub Secrets 后，`git push` 即触发服务器 `git pull`

## 🔐 数据与隐私

- **游客模式**：数据存浏览器 localStorage，不上云
- **云端模式**：注册后数据存自托管 PocketBase，API 规则保证只能读写自己的数据
- **AI Key**：DeepSeek Key 仅存本地浏览器，不经过服务器
- **简历附件**：base64 存储，随账号数据一起，可随时导出 JSON 备份

## 🗺️ Roadmap

- [ ] 简历附件改用 PocketBase 文件字段（替代 base64，支持更大文件）
- [ ] 公司库岗位的全局共享池（当前为每用户独立）
- [ ] AI 助手对话流式输出
- [ ] 数据导入（JSON 恢复到云端）
- [ ] HTTPS + 域名

---

<div align="center">

Made with ● by **杰苏 (songningfu)**

> 免责声明：本工具仅用于个人求职信息整理与学习，所有数据由用户自行录入并保管，
> 作者不对数据准确性、平台可用性、求职结果承担任何责任。

</div>
