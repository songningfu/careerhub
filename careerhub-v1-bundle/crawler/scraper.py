#!/usr/bin/env python3
"""
CareerHub 公司库爬虫脚手架
- 抓 GitHub 上的招聘信息聚合 repo（无反爬、合规、信息最新）
- 输出标准化 JSON 推送到 CloudBase opportunities 集合

依赖：
    pip install requests tencentcloud-sdk-python

环境变量：
    TCB_SECRET_ID     - 腾讯云 SecretId
    TCB_SECRET_KEY    - 腾讯云 SecretKey
    TCB_ENV_ID        - CloudBase 环境 ID

运行：
    python scraper.py
"""
import os
import re
import json
import time
import hashlib
import requests
from datetime import datetime

# ============================================================
# 数据源 1：GitHub Awesome 系列招聘合集（最稳定、无反爬）
# ============================================================
GITHUB_SOURCES = [
    {
        'name': '2026届校招汇总',
        'url': 'https://raw.githubusercontent.com/forthespada/CampusRecruitment/master/README.md',
        'parser': 'github_md',
    },
    # 你可以再加更多 repo
]

# ============================================================
# 数据源 2：自建 mock（兜底）
# ============================================================
SEED_DATA = [
    {
        'company': '字节跳动',
        'position': '后端开发工程师（2026届）',
        'city': '北京/上海/杭州',
        'salary': '25-40K·15薪',
        'deadline': '2026-06-15',
        'industry': '互联网',
        'tags': ['校招', '可转正', '大厂'],
        'source': '字节官网',
        'sourceUrl': 'https://jobs.bytedance.com',
        'desc': '参与抖音/今日头条核心服务研发，Go/Python/Java 不限',
    },
    # ... 更多种子数据见 careerhub_v1.html 里的 OPPORTUNITY_MOCK
]

# ============================================================
# GitHub Markdown 解析器（提取表格里的招聘信息）
# ============================================================
def parse_github_md(content):
    """从 Markdown 中解析招聘信息表格"""
    items = []
    # 匹配 Markdown 表格行：| 公司 | 投递链接 | 截止时间 |
    table_re = re.compile(r'\|\s*([^|]+?)\s*\|\s*\[([^\]]+)\]\(([^)]+)\)\s*\|\s*([^|]+?)\s*\|')
    for m in table_re.finditer(content):
        company = m.group(1).strip()
        link_text = m.group(2).strip()
        link_url = m.group(3).strip()
        deadline_raw = m.group(4).strip()
        # 简单清洗
        if not company or 'company' in company.lower() or '----' in company:
            continue
        # 提取 deadline（支持 2026-06-30、6月30日 等格式）
        deadline = ''
        dm = re.search(r'(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})|(\d{1,2})月(\d{1,2})日', deadline_raw)
        if dm:
            if dm.group(1):
                deadline = f"{dm.group(1)}-{dm.group(2).zfill(2)}-{dm.group(3).zfill(2)}"
            else:
                year = datetime.now().year
                deadline = f"{year}-{dm.group(4).zfill(2)}-{dm.group(5).zfill(2)}"
        items.append({
            'company': company,
            'position': link_text or '校招岗位',
            'sourceUrl': link_url,
            'deadline': deadline,
            'source': 'GitHub合集',
            'tags': ['校招'],
            'industry': '',
            'city': '',
            'salary': '',
            'desc': '',
        })
    return items


# ============================================================
# 数据清洗 + 去重
# ============================================================
def normalize_item(item):
    """统一字段格式"""
    norm = {
        'id': '',
        'company': str(item.get('company', '')).strip(),
        'position': str(item.get('position', '')).strip(),
        'city': str(item.get('city', '')).strip(),
        'salary': str(item.get('salary', '')).strip(),
        'deadline': str(item.get('deadline', '')).strip(),
        'industry': str(item.get('industry', '')).strip(),
        'tags': item.get('tags', []) if isinstance(item.get('tags'), list) else [],
        'source': str(item.get('source', '')).strip(),
        'sourceUrl': str(item.get('sourceUrl', '')).strip(),
        'desc': str(item.get('desc', '')).strip(),
        'createdAt': datetime.now().isoformat(),
    }
    # 用 公司+岗位+城市 hash 生成稳定 id
    key = f"{norm['company']}|{norm['position']}|{norm['city']}"
    norm['id'] = 'op_' + hashlib.md5(key.encode()).hexdigest()[:10]
    return norm


def dedup(items):
    """按 id 去重"""
    seen = set()
    result = []
    for item in items:
        if item['id'] in seen:
            continue
        seen.add(item['id'])
        result.append(item)
    return result


# ============================================================
# 主流程
# ============================================================
def fetch_from_github():
    """从 GitHub Markdown 抓取"""
    all_items = []
    for src in GITHUB_SOURCES:
        try:
            print(f"[fetch] {src['name']} ...")
            res = requests.get(src['url'], timeout=15)
            res.raise_for_status()
            if src['parser'] == 'github_md':
                items = parse_github_md(res.text)
            else:
                items = []
            print(f"  → 解析到 {len(items)} 条")
            all_items.extend(items)
        except Exception as e:
            print(f"  ✗ 失败：{e}")
    return all_items


def push_to_cloudbase(items):
    """推送到 CloudBase opportunities 集合"""
    secret_id = os.environ.get('TCB_SECRET_ID')
    secret_key = os.environ.get('TCB_SECRET_KEY')
    env_id = os.environ.get('TCB_ENV_ID')
    if not (secret_id and secret_key and env_id):
        print("⚠ 未配置腾讯云凭证，仅输出到本地 opportunities.json")
        with open('opportunities.json', 'w', encoding='utf-8') as f:
            json.dump(items, f, ensure_ascii=False, indent=2)
        print(f"✓ 已写入 opportunities.json（{len(items)} 条）")
        return

    # 调 CloudBase 数据库 REST API
    # 完整 SDK：https://cloud.tencent.com/document/product/876/41394
    print(f"[push] 推送 {len(items)} 条到 CloudBase ...")

    # 这里用最简单的方式：调 CloudBase HTTP API
    # 实际项目建议用 tencentcloud-sdk-python
    try:
        from tcb_python_sdk import TCB  # pseudo, 实际包名按官方文档
    except ImportError:
        print("⚠ 请安装 tencentcloud-sdk-python，或自己用 requests 实现 HTTP 调用")
        print("  详见 https://cloud.tencent.com/document/product/876/41394")
        # 仍输出到本地
        with open('opportunities.json', 'w', encoding='utf-8') as f:
            json.dump(items, f, ensure_ascii=False, indent=2)
        return

    # 此处省略实际推送代码（不同 SDK 版本差异较大）
    # 建议：写一个简单的 CloudBase 云函数，前端定时调用


def main():
    print("=" * 60)
    print(f"CareerHub 公司库爬虫 · {datetime.now().isoformat()}")
    print("=" * 60)

    # 1. 拉取
    items = fetch_from_github()
    print(f"\n共拉取 {len(items)} 条原始数据")

    # 2. 加上种子数据
    items.extend(SEED_DATA)
    print(f"合并种子 → {len(items)} 条")

    # 3. 清洗
    items = [normalize_item(i) for i in items]

    # 4. 去重
    items = dedup(items)
    print(f"去重后 → {len(items)} 条")

    # 5. 过滤掉过期的
    today = datetime.now().strftime('%Y-%m-%d')
    items = [i for i in items if not i['deadline'] or i['deadline'] >= today]
    print(f"过滤过期 → {len(items)} 条")

    # 6. 推送
    push_to_cloudbase(items)

    print("\n✅ 爬虫运行完成")


if __name__ == '__main__':
    main()
