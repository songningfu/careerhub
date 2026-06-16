# PocketBase 自托管部署手册（替代 CloudBase）

前端通过同源路径 `/pb` 访问 PocketBase（Nginx 反代到本机 8090），避免跨域和 HTTP/HTTPS 混合内容问题。

```
浏览器  →  http://43.161.217.43:9527/        (Nginx 静态站点 careerhub)
        →  http://43.161.217.43:9527/pb/api  (Nginx 反代 → 127.0.0.1:8090)  →  PocketBase
```

---

## 第 1 步：把 PocketBase 改成后台常驻（systemd）

之前是在终端前台跑的，关掉终端就停了。改成 systemd 服务：

```bash
# 先 Ctrl+C 停掉前台运行的 pocketbase

# 把数据目录固定下来
sudo mkdir -p /opt/pocketbase/pb_data

# 安装 systemd 服务（仓库里已带 scripts/pocketbase.service）
sudo cp /var/www/careerhub/scripts/pocketbase.service /etc/systemd/system/pocketbase.service
sudo systemctl daemon-reload
sudo systemctl enable --now pocketbase

# 确认在跑
sudo systemctl status pocketbase --no-pager
curl -I http://127.0.0.1:8090/api/health
```

> 注意：服务监听 `127.0.0.1:8090`（只在本机），外网通过 Nginx 的 `/pb` 进来，更安全。
> 之前为测试开的 8090 防火墙规则可以关掉：`sudo ufw delete allow 8090/tcp`

---

## 第 2 步：Nginx 加反代（在 careerhub.conf 里加一段）

编辑 `/etc/nginx/conf.d/careerhub.conf`，在 `server { ... }` 里加上 `/pb/` 反代：

```bash
sudo tee /etc/nginx/conf.d/careerhub.conf > /dev/null << 'EOF'
server {
    listen 9527;
    server_name _;

    root /var/www/careerhub;
    index careerhub_v1.html index.html;

    # PocketBase 反向代理（同源 /pb → 本机 8090）
    location /pb/ {
        proxy_pass http://127.0.0.1:8090/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        # 上传简历附件需要更大 body
        client_max_body_size 20m;
        # realtime（SSE）支持
        proxy_set_header Connection '';
        proxy_buffering off;
    }

    location ~* \.(js|css|png|svg|ico|webmanifest)$ {
        expires 7d;
        add_header Cache-Control "public";
    }
    location = /sw.js { add_header Cache-Control "no-cache"; }
    location /data/ { add_header Cache-Control "no-cache"; }

    location / {
        try_files $uri $uri/ /careerhub_v1.html;
    }
}
EOF

sudo nginx -t && sudo systemctl reload nginx
```

验证反代通了：

```bash
curl -I http://localhost:9527/pb/api/health
# 应返回 200
```

---

## 第 3 步：创建 PocketBase 管理员 + 导入数据表结构

### 3.1 打开管理后台

浏览器访问：**http://43.161.217.43:9527/pb/_/**

第一次会让你创建超级管理员（邮箱 + 密码，自己记住，这是后台管理用的，跟 App 用户无关）。

### 3.2 导入集合结构（一次性）

1. 后台左下角 **Settings**（齿轮）→ **Import collections**
2. 把仓库里 `scripts/pb_schema.json` 的内容整段粘贴进去
   （本地路径：`/var/www/careerhub/scripts/pb_schema.json`，可以 `cat` 出来复制）
3. 点 **Review** → 确认要新建 12 个集合 → **Import**

```bash
# 在服务器上查看 schema 内容方便复制
cat /var/www/careerhub/scripts/pb_schema.json
```

这会创建 12 张表：applications / interviews / jobs / companies / resumes /
skills / leetcode / journal / events / speeches / opportunities / settings，
每张表带 `owner`（归属用户）+ `payload`（JSON 数据），并配好"只能读写自己数据"的权限规则。

### 3.3 确认用户注册开启

后台 → **Collections** → **users** → **Options（API rules / Options）**
确认 "Auth" 里允许注册即可（PocketBase 默认就允许，邮箱验证默认关闭，所以注册不需要验证码）。

---

## 第 4 步：完成

访问 `http://43.161.217.43:9527`：

- **注册**：填邮箱 + 密码（≥8 位）→ 直接进入，数据存云端（PocketBase）
- **游客体验**：数据存在浏览器本地（localStorage），不上云
- **游客升级**：设置页可把本地数据一键迁移到云端账号

---

## 日常运维

```bash
# 重启 PocketBase
sudo systemctl restart pocketbase

# 看日志
sudo journalctl -u pocketbase -f

# 数据备份（整个 pb_data 目录就是全部数据）
sudo tar czf ~/pb_backup_$(date +%F).tar.gz -C /opt/pocketbase pb_data

# 后台管理：http://43.161.217.43:9527/pb/_/
```
