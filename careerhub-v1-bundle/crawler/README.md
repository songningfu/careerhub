# 公司库爬虫脚手架

一个 Python 脚本，从 GitHub 招聘合集 repo 抓取最新校招/实习信息，去重清洗后推送到 CloudBase。

## 用法

### 1. 安装依赖
```bash
pip install requests
# 推送到 CloudBase 还需要：
pip install tencentcloud-sdk-python
```

### 2. 配置环境变量
```bash
export TCB_SECRET_ID=AKIDxxxxx   # 腾讯云 API 密钥
export TCB_SECRET_KEY=xxxxxxxx
export TCB_ENV_ID=careerhub-prod-3g8xxxxx
```

> 没配也能跑，结果会输出到本地 `opportunities.json`，再手动导入 CloudBase。

### 3. 运行
```bash
python scraper.py
```

## 定时执行

### Linux cron（每天凌晨 3 点）
```bash
crontab -e
# 添加：
0 3 * * * cd /path/to/crawler && python3 scraper.py >> /var/log/careerhub-crawler.log 2>&1
```

### GitHub Actions（推荐，免费）
新建 `.github/workflows/crawler.yml`：

```yaml
name: CareerHub Crawler
on:
  schedule:
    - cron: '0 19 * * *'  # 每天 UTC 19:00 = 北京时间凌晨 3:00
  workflow_dispatch:

jobs:
  crawl:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      - run: pip install requests tencentcloud-sdk-python
      - run: python crawler/scraper.py
        env:
          TCB_SECRET_ID: ${{ secrets.TCB_SECRET_ID }}
          TCB_SECRET_KEY: ${{ secrets.TCB_SECRET_KEY }}
          TCB_ENV_ID: ${{ secrets.TCB_ENV_ID }}
```

## 法律 / 合规说明

本脚手架**只爬 GitHub 上公开的招聘合集 repo**，不爬：
- 牛客网（有反爬 + ToS 禁止）
- Boss 直聘（强反爬 + 法律风险）
- 拉勾（同上）

如果你想扩展爬虫到企业官网（如字节官网招聘页），请：
1. 遵守该网站的 `robots.txt`
2. 控制请求频率（≥ 3 秒/次）
3. 不要存储任何个人信息（包括 HR 联系方式）
4. 数据用途明确为公共服务（不商用）

## 扩展：添加新数据源

编辑 `scraper.py` 顶部的 `GITHUB_SOURCES`：

```python
GITHUB_SOURCES = [
    {
        'name': '我的合集',
        'url': 'https://raw.githubusercontent.com/xxx/yyy/main/README.md',
        'parser': 'github_md',
    },
]
```

如果数据格式不同，自己加一个 parser 函数即可。

## 推荐 GitHub Repo

这些 repo 维护比较积极，每天都有更新：

- [forthespada/CampusRecruitment](https://github.com/forthespada/CampusRecruitment) - 综合校招
- [ProgrammerWuRoc/Internship](https://github.com/ProgrammerWuRoc/Internship) - 实习专门
- [redrock303/Awesome-AI-Job-Notes](https://github.com/redrock303/Awesome-AI-Job-Notes) - AI 方向

直接添加他们的 raw URL 到 `GITHUB_SOURCES` 即可。
