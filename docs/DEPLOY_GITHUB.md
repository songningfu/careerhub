# 🚀 CloudBase + GitHub 自动部署手册

每次 `git push`，CloudBase 自动更新线上版本。

> **预计耗时：首次配置 25 分钟，之后更新只需 `git push` 一次**

---

## ⚙️ 总体架构

```
你 git push main
     ↓
GitHub Actions（.github/workflows/deploy.yml）
     ↓ 用 tcb CLI 推
CloudBase 静态托管
     ↓ 默认 CDN
全国用户访问 https://xxx.tcloudbaseapp.com/
```

数据 / 鉴权 / 简历文件 → 仍走 CloudBase 数据库 + 存储（已接好）。

---

## 第 1 步：在腾讯云上确认 CloudBase 环境（5 分钟）

### 1.1 进控制台
打开 [腾讯云开发控制台](https://console.cloud.tencent.com/tcb)（微信扫码登录）

### 1.2 确认环境
左侧选你的环境 → 顶部能看到 **环境 ID**，形如：
```
careerhub-prod-3g8xxxxxe3c
```
👉 复制下来，待会儿要用。

### 1.3 开通静态托管
左侧菜单 → **静态网站托管** → 点 **「立即开通」**
- 首次开通会自动创建 OSS 存储桶
- 默认带 HTTPS 和 CDN，**免费 5GB 流量/月**
- 开通完成后会显示默认域名：`https://你的环境ID.tcloudbaseapp.com/`

---

## 第 2 步：拿腾讯云 API 密钥（5 分钟）

CI 自动部署需要一对 **SecretId / SecretKey**。

### 2.1 打开访问管理
[腾讯云 → 访问管理 → API 密钥管理](https://console.cloud.tencent.com/cam/capi)

### 2.2 创建子用户密钥（强烈推荐，比根账号密钥安全）
1. 左侧 **用户 → 用户列表 → 新建用户 → 自定义创建**
2. 用户名：`careerhub-ci`
3. 访问方式 → **勾选「编程访问」**，取消「腾讯云控制台访问」
4. 用户权限 → 直接关联策略，**只给以下两条**：
   - `QcloudTCBFullAccess`（CloudBase 完整权限）
   - `QcloudCOSDataFullControl`（COS 写权限，部署到 hosting 需要）
5. 完成 → 拿到 **SecretId** 和 **SecretKey** ⚠️ **只显示一次，立刻保存**

### 2.3 如果嫌麻烦也可以用根账号密钥
直接在「API 密钥管理」页面新建一个 → 同样会拿到 SecretId / SecretKey
（风险：泄露后影响整个腾讯云账号，不推荐）

---

## 第 3 步：把项目推到 GitHub（5 分钟）

### 3.1 在 GitHub 建仓库
[github.com/new](https://github.com/new)
- Repository name：`careerhub`（或你喜欢的名字）
- **Public 或 Private 都行**（注意：用 jsDelivr 消费爬虫数据需要 Public）
- 不勾选 README / .gitignore / license（本地已经有了）

### 3.2 本地初始化 + 推送
打开终端，进入项目目录（`/Users/jasur/Desktop/求职平台助手/`），跑：

```bash
cd /Users/jasur/Desktop/求职平台助手/

# 初始化 git（如果还没初始化）
git init
git branch -M main

# 配作者信息（如果之前没配过）
git config user.name "你的名字"
git config user.email "your@email.com"

# 全部加入暂存
git add .

# 第一次提交
git commit -m "feat: V1.5 上线（PWA + 微信推送 + PDF 技能提取 + 爬虫）"

# 关联远程仓库（把 URL 换成你刚建的）
git remote add origin https://github.com/你的GitHub用户名/careerhub.git

# 推送
git push -u origin main
```

> **认证选择**：HTTPS 协议会让你输用户名 + Personal Access Token（不是密码）。
> 没有 PAT 就去 [Settings → Developer settings → Personal access tokens (classic)](https://github.com/settings/tokens) 生成一个，勾 `repo` 权限。
> 嫌麻烦可以直接装 [GitHub Desktop](https://desktop.github.com/)，鼠标点点就行。

---

## 第 4 步：在 GitHub 仓库配 Secrets（3 分钟）

进入你刚推上去的 GitHub 仓库 → **Settings → Secrets and variables → Actions** → **New repository secret**，添加三条：

| Name | Value |
|---|---|
| `TCB_SECRET_ID` | 第 2 步拿到的 SecretId |
| `TCB_SECRET_KEY` | 第 2 步拿到的 SecretKey |
| `TCB_ENV_ID` | 第 1 步拿到的环境 ID |

> 三条 secrets 加完应该是这样：
> ```
> ☑ TCB_SECRET_ID    Updated 5 seconds ago
> ☑ TCB_SECRET_KEY   Updated 10 seconds ago
> ☑ TCB_ENV_ID       Updated 15 seconds ago
> ```

### 4.1 顺便配 workflow 写仓库权限
**Settings → Actions → General → Workflow permissions** → 选 ✅ **Read and write permissions** → 保存

这个是给爬虫 workflow 用的（它要 commit 回仓库）。部署 workflow 不需要写仓库，但开了不影响。

---

## 第 5 步：触发首次部署（1 分钟）

### 方式 A：直接手动跑
仓库 → **Actions** tab → 左侧选 **「部署到 CloudBase 静态托管」** → 右上角 **Run workflow** → 选 main 分支 → Run

### 方式 B：再 push 一次
随便改个文件 push 一下，自动触发。

跑完会看到 Step Summary 显示：
```
✓ 已部署到 CloudBase
访问地址：https://你的环境ID.tcloudbaseapp.com/
```

---

## 第 6 步：打开网站验收（3 分钟）

打开 `https://你的环境ID.tcloudbaseapp.com/`，按顺序检查：

| 检查项 | 怎么验 |
|---|---|
| 主页能开 | 看到登录页（极光跟手特效） |
| PWA 装机 | 60 秒后弹"添加到主屏幕"横幅 |
| Service Worker | DevTools → Application → Service Workers 看到 `sw.js` activated |
| 体检台 | 访问 `/verify.html`，10 项全跑一遍 |
| 数据库 | 登录后能看到你之前在本地存的数据（同一个 CloudBase 环境） |

---

## 🔁 之后怎么更新

```bash
# 改完代码
git add .
git commit -m "fix: 修复某某 bug"
git push
```

push 完 30 秒内 GitHub Actions 自动跑完，1-3 分钟 CDN 刷新。强刷一下浏览器（Ctrl+Shift+R）就能看到。

---

## 🌐 想绑自己的域名？

你之前说**有域名但没备案**。CloudBase 自定义域名 **强制要求工信部备案**，没有备案就只能用默认域名 `xxx.tcloudbaseapp.com`。

### 想备案
- 阿里云 / 腾讯云的备案是免费的，但要 8-20 个工作日
- 备案完成后，CloudBase 控制台 → 静态网站托管 → 设置 → 自定义域名 → 绑定

### 暂时不备案
- 默认 `tcloudbaseapp.com` 域名也能直接用，HTTPS 自带
- 缺点：域名长、记不住
- 折中方案：搞个国外 `.dev` / `.app` 域名 + Cloudflare CNAME 转发到默认域名（但 CloudBase 不一定接受跨 Host CDN 转发，可能有 SSL 证书问题，不建议）

**结论：先用默认域名上线，等备案完成再绑**

---

## 🐛 常见问题

### Q1：workflow 跑挂了，提示 `tcb: command not found`
A：装 CLI 失败。看 Actions log 里 npm install 那一步。如果是网络问题，重跑就行。

### Q2：提示 `CAM signature/authentication failed`
A：SecretId / SecretKey 填错了。回 GitHub Secrets 重新设置。注意复制时不要带空格。

### Q3：部署成功但访问 404
A：等 1-3 分钟 CDN 刷新。或者去 CloudBase 控制台 → 静态托管 → 刷新缓存。

### Q4：登录页能开但登录失败
A：CloudBase 环境 ID 不匹配。你 HTML 里硬编码的环境 ID 和你部署的环境必须是同一个。检查 `careerhub_v1.html` 里搜 `CLOUDBASE_ENV_ID`。

### Q5：CloudBase 怎么收费？
A：免费档：5GB 存储 + 5GB 流量/月 + 5 万次数据库读 + 5 万次写 + 10 万次函数调用。
个人项目几百日活基本不会超。超了按量计费，CDN 流量约 0.21 元/GB。

### Q6：能不能不部署 verify.html / 不让用户看到？
A：把 deploy.yml 里 `cp verify.html dist/...` 那行删掉就行。或者改成 `verify-${RANDOM}.html` 加一道遮羞布。

### Q7：爬虫 workflow 报错"refusing to allow GitHub Apps to create or update workflow"
A：仓库 Settings → Actions → General → Workflow permissions 要勾 ✅ Read and write。

---

## 📂 项目结构（已经帮你布好）

```
求职平台助手/                           ← Git 仓库根
├── careerhub_v1.html                 ← 主程序
├── index.html                        ← / 跳转到主程序
├── sw.js                             ← Service Worker
├── manifest.webmanifest              ← PWA 清单
├── verify.html                       ← 功能体检台
├── cloudbaserc.json                  ← CloudBase CLI 配置
├── .gitignore
├── .github/workflows/
│   ├── deploy.yml                    ← ★ 自动部署到 CloudBase
│   ├── crawler.yml                   ← 每日爬公司库
│   └── README.md
├── DEPLOY_GITHUB.md                  ← 你现在看的这份
├── CLOUDBASE_DEPLOY.md               ← 原版手动部署文档
└── backend/
    ├── crawler/                      ← 爬虫源码
    ├── api/                  ← LLM API（部署到 Vercel）
    └── data/                         ← 爬虫产物（自动更新）
```

---

## ✅ 上线 Checklist

打印出来逐项打勾：

- [ ] CloudBase 环境 ID 拿到
- [ ] CloudBase 静态托管已开通
- [ ] 腾讯云 SecretId / SecretKey 拿到
- [ ] GitHub 仓库已建并 push
- [ ] GitHub Secrets 三条配齐
- [ ] Workflow permissions 设为 Read and write
- [ ] 首次部署成功（Actions 绿勾）
- [ ] 默认域名能打开主程序
- [ ] verify.html 体检全绿
- [ ] 微信能收到 Server酱 推送（前提你已申请 SCKEY）

完成所有项 = V1.5 正式上线 🎉
