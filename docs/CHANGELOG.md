# 项目更新日志

记录每次迭代做了什么 · 改了什么 · 知道了什么。
最新版本在最上面。

格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 约定：
- `Added` 新功能
- `Changed` 改动 / 改进
- `Fixed` 修 bug
- `Removed` 删了的
- `Security` 安全相关
- `Note` 经验 / 踩坑笔记（自创）

---

## [V1.5.2] · 2026-05-25（品牌升级 · CareerHub → Offerly）

### Changed
- 🎨 **品牌名升级：CareerHub → Offerly**
  - 调性：严肃 SaaS（对标 Calendly / Linear / Notion）
  - 定位：「面向高校毕业生的求职管理平台」
- 登录页大标语 `HIRED.` → `OFFER.`
- 副标题「一站式求职管家」→「求职管理平台」
- 全站 21 处品牌字样替换
- PWA 装机名 / iOS 主屏名 / Server酱推送署名 / 体检台标题 / Driver.js 引导 全部统一
- Service Worker 缓存版本号升到 `offerly-v1.5`（老用户自动拿新版）

### Kept
- 文件名 `careerhub_v1.html` 保留不动（保证已分发的 URL 仍能打开）
- `localStorage` 的 key（`careerhub_data_v1` 等）保留（避免清空用户本地偏好）
- `data:` 前缀的内嵌 SVG 图标保留（已是 Offerly 上升轨迹标志）

### Note
- 「品牌名」和「文件名」是两件事：用户看到的全是 Offerly，URL 里的文件名是技术遗留
- V2 大版本发布时一并改文件名 + 加 301 重定向，本次先保稳
- 改 SW 缓存名 = 强制用户拿到新版（这就是为什么版本号要 bump）

---

## [V1.5.1] · 2026-05-25（项目结构整理）

### Changed
- 重命名 `careerhub-v1-bundle/` → `backend/`，更直观
- `backend/api-backend/` → `backend/api/`，路径变扁平
- 所有 markdown 文档统一搬到 `docs/`
- 同步更新 18 处路径引用（deploy.yml、crawler.yml、README 等）

### Added
- 新建 `docs/CHANGELOG.md`（你正在看的这份）
- 新建 `README.md` 项目入口

### Note
- `.claude/settings.local.json` 里有历史路径引用是 Claude Code 自身的记录，不影响项目
- 重命名时一定要同步 `.github/workflows/*.yml`，否则 CI 会找不到文件

---

## [V1.5] · 2026-05-24（V1 → V1.5 大版本升级）

### Added — 五大新功能
1. **登录页炫酷化**
   - 自定义品牌 logo（上升轨迹 + 终点星）替代原"AI 闪电"图标
   - 14 个鼠标特效：极光跟手、3D 卡片倾斜、彗星轨迹、粒子飘浮、Logo 光环、流光文字
   - 全部尊重 `prefers-reduced-motion`

2. **Server酱 微信通知**
   - 设置页加 SCKEY 输入 + 测试按钮
   - 进入 App 后台静默扫 `DB.jobs` 的 deadline + `DB.applications` 的 interviewDate
   - 24h（可配置）内的自动推送到微信
   - localStorage 去重，同一条记录只推一次

3. **PWA 完整支持**
   - 真实 `sw.js` 文件（不再用 Blob URL）
   - 真实 `manifest.webmanifest` 文件
   - 「添加到主屏幕」横幅（60s 后弹，关闭后 7 天冷却）
   - iOS Safari 单独教学弹窗
   - safe-area-inset 适配灵动岛 / 刘海

4. **简历 PDF 技能提取**
   - PDF.js v3.11.174 浏览器端解析（不上传任何第三方）
   - 250+ 词内置技能字典（编程/AI/数据库/云/移动端/工具/方法论/语言）
   - chip 风格 UI，可手动添加 / 删除
   - 简历卡片自动显示技能标签

5. **GitHub Actions 爬虫定时任务**
   - 每天 UTC 02:00（北京 10:00）自动爬取
   - 数据 commit 回 `backend/data/opportunities.json`
   - 可选同时推送到 CloudBase（需配 Secrets）

### Added — 工具
- `verify.html` 功能体检台（10 项自动 + 手动检测）
- `index.html` 根路径跳转主程序
- `cloudbaserc.json` CloudBase CLI 配置
- `.github/workflows/deploy.yml` GitHub → CloudBase 自动部署
- `.gitignore` 排除 .DS_Store / node_modules / .venv 等

### Fixed
- 修复 `auth.signInAnonymously is not a function` → CloudBase SDK 版本号错
  - 把 jsdelivr `@cloudbase/js-sdk@1.7.29`（不存在）换成 `static.cloudbase.net/.../2.9.6/cloudbase.full.js`
- 修复 `cloudbase is not defined` → 同上，SDK 没加载
- 修复 `getCurrentUser is not defined` → 改成 `auth.currentUser`（v2 SDK 同步可用）
- 修复 `auth.signInWithEmailAndPassword is not a function` → 改用 `auth.signIn({ username, password })`
- 修复 `signOut is not a function` → v2 改用 `auth.logout()`
- 修复邮箱注册 400 → 改成 v2 标准的「发码 → verify → signUp」3 步流程
- 修复 Service Worker 用 Blob URL 注册失败（浏览器禁止）→ 抽成独立 `sw.js` 文件
- 修复 manifest Blob URL 兼容性差 → 抽成独立 `manifest.webmanifest` 文件
- 修复 `manifest 上传到 CloudBase 变成 0 字节` → 代码加 JSON 合法性校验 + Blob 兜底
- 修复登录页彗星 rAF 永久空转 → overlay 隐藏即停 + MutationObserver
- 修复 PWA 安装横幅永久关闭 → 改成 7 天冷却
- 清理 HTML 残留的孤儿"使用云端模式" setup 弹窗
- 清理 V1 残留的重复 `<div id="registerForm">`（同 ID 冲突）

### Changed
- 文案去 "AI 味"：「AI 正在解析中」→「正在为你提取关键字段」；「一站式智能助理」→「一站式求职管家」
- 侧边栏 logo 用 `i-career` 自定义图标
- 登录页内嵌品牌图标（带光环 + 旋转环）

### Removed
- 删除冗余文件：`.DS_Store`、`ddd.py`、bundle 里重复的 sw.js/manifest/旧 HTML、Cloudflare worker 备份
- 拆掉 V1 setup 引导界面（环境 ID 现已硬编码，不需要让用户填）

### Note
- **CloudBase v2 SDK API 跟 v1 完全不一样**，注册必须走 3 步验证，登录用 `signIn({ username, password })`
- **CDN 选 `static.cloudbase.net`**，不要用 jsdelivr/imgcache.qq.com，老版本号已下架
- **CloudBase 默认域名免备案就能用**，自定义域名必须 ICP 备案
- **Service Worker 不能用 Blob URL 注册**（浏览器安全策略）
- **manifest 用文件 + Blob 双兜底**，应对 CloudBase 偶发上传成 0 字节的 bug
- **PDF.js 用 legacy build**（v3.11.174）有 UMD 全局，新版只有 ESM

---

## [V1.0] · 2026-05-23（原版基础设施）

V1 原作者完成的基础功能：

### Added
- 单 HTML 应用骨架
- 6 大业务模块：今日 / 求职台（投递+意向+面试 Kanban）/ 公司库 / 简历库 / 日历 / 设置
- Bitable 风格的表格组件（看板 / 表格 / 卡片三视图）
- CloudBase 接入：身份认证 + 文档数据库 + 云存储
- 公司库 22 家种子数据（字节/腾讯/阿里/...）
- JD 智能解析（本地正则，可接 LLM API）
- ECharts 图表（投递漏斗、状态分布）
- 浅色 / 深色主题切换
- Driver.js 新手引导（5 步）
- Confetti 庆祝动画
- 快捷键 Ctrl+K 唤起快速添加
- 11 个数据库集合预留（部分 V2 才用）

---

## 模板：下次记录用

```markdown
## [V?.?] · YYYY-MM-DD（这次干了啥的一句话总结）

### Added
- 新功能 A
- 新功能 B

### Changed
- 改了 A
- 优化了 B

### Fixed
- 修了 A 的 bug

### Removed
- 删掉了 A

### Note
- 学到的经验 / 踩的坑 / 未来要注意的
```

---

## 怎么用这份日志

**每次改完代码 / 上线前**：
1. 打开这份 CHANGELOG
2. 在顶部新加一个版本块
3. 把这次改动列进对应分类
4. 把版本号写进 commit message（如 `chore: bump to v1.5.2`）
5. git push → 自动部署

**遇到棘手 bug 修完后**：
- 一定写进 `### Fixed`
- 还有 `### Note` 写"为什么会出问题、以后怎么避免"
- 你未来三个月后忘掉时回来翻这里，能瞬间想起当时怎么解决的

**重大版本（V2.0）发布前**：
- 把所有 V1.x 的内容总结写成 release notes
- 发到给同学的群里
