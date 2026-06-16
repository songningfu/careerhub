# 腾讯云 CVM 部署手册

push main → GitHub Actions SSH 拉代码 → Nginx 自动生效，**全程约 10 秒**。

---

## 第 1 步：服务器上准备目录和代码（一次性操作）

SSH 进服务器，执行：

```bash
# 克隆仓库（替换成你的 GitHub 仓库地址）
git clone https://github.com/songningfu/careerhub.git /var/www/careerhub

# 确认文件在
ls /var/www/careerhub/careerhub_v1.html
```

---

## 第 2 步：配置 Nginx（一次性操作）

在 `/etc/nginx/conf.d/` 新建文件 `careerhub.conf`：

```nginx
server {
    listen 8080;
    server_name _;          # 只用 IP 访问，_ 匹配所有

    root /var/www/careerhub;
    index careerhub_v1.html index.html;

    # 静态文件缓存
    location ~* \.(js|css|png|svg|ico|webmanifest)$ {
        expires 7d;
        add_header Cache-Control "public";
    }

    # Service Worker 不缓存
    location = /sw.js {
        add_header Cache-Control "no-cache";
    }

    # data 目录（爬虫产物）
    location /data/ {
        add_header Cache-Control "no-cache";
    }

    # 其他走 index
    location / {
        try_files $uri $uri/ /careerhub_v1.html;
    }
}
```

然后重载 Nginx：

```bash
nginx -t                        # 先测试配置有没有语法错误
systemctl reload nginx          # 重载（不中断现有连接）
```

测试访问：`http://你的服务器IP:8080`

---

## 第 3 步：腾讯云安全组开放 8080 端口

控制台 → 云服务器 → 实例 → **安全组** → 入站规则 → 添加：

| 协议 | 端口 | 来源 |
|------|------|------|
| TCP  | 8080 | 0.0.0.0/0 |

---

## 第 4 步：生成 SSH 密钥对，配置 GitHub Secrets

### 4.1 在本地生成部署专用密钥（不要用你日常的密钥）

```bash
ssh-keygen -t ed25519 -C "careerhub-deploy" -f ~/.ssh/careerhub_deploy
# 一路回车（不设密码）
```

会生成两个文件：
- `~/.ssh/careerhub_deploy`      ← 私钥（给 GitHub）
- `~/.ssh/careerhub_deploy.pub`  ← 公钥（给服务器）

### 4.2 把公钥加到服务器

```bash
# 把公钥内容追加到服务器的 authorized_keys
cat ~/.ssh/careerhub_deploy.pub | ssh root@你的服务器IP \
  "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"

# 测试能不能免密登录
ssh -i ~/.ssh/careerhub_deploy root@你的服务器IP "echo ok"
```

### 4.3 在 GitHub 仓库添加 3 个 Secrets

进仓库 → Settings → Secrets and variables → Actions → New repository secret：

| Secret 名       | 值                              |
|----------------|---------------------------------|
| `CVM_HOST`     | 服务器公网 IP（如 `43.xx.xx.xx`）  |
| `CVM_USER`     | SSH 用户名（通常是 `root`）        |
| `CVM_SSH_KEY`  | 私钥文件全部内容（`cat ~/.ssh/careerhub_deploy`） |

---

## 第 5 步：提交触发第一次部署

```bash
git add .github/workflows/deploy-cvm.yml docs/DEPLOY_CVM.md
git commit -m "ci: 添加 CVM 自动部署 workflow"
git push
```

去 GitHub → Actions 标签页查看运行状态，绿勾 = 部署成功。

---

## 日常使用

```bash
# 改了代码后
git add .
git commit -m "feat: xxx"
git push    # ← 自动触发部署，约 10 秒后线上更新
```

---

## 故障排查

```bash
# 查看 Nginx 错误日志
tail -f /var/log/nginx/error.log

# 手动拉代码（Actions 挂掉时应急）
ssh root@服务器IP "cd /var/www/careerhub && git pull"

# 检查 8080 端口是否在监听
ss -tlnp | grep 8080
```
