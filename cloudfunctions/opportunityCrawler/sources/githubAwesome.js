// 数据源：GitHub 上活跃的中文校招信息合集 repo（Markdown 表格）
// 优势：无反爬、社区维护、信息密度高
//
// 每个 repo 表格结构不同，必须定义 schema 适配
//   { col: index, role: 'company' | 'position' | 'link' | 'deadline' | 'city' | 'note' | 'ignore' }
// 解析器会按 schema 抽取字段，缺失的字段交给 DeepSeek enrich.js 兜底
//
// 加新源：
//   1. curl -s 看 README 表格结构
//   2. 在 SOURCES 数组加配置
//   3. 重新部署即可

const axios = require('axios');
const log = require('../utils/log');

const SOURCES = [
  {
    name: 'namewyf/Campus2026',
    url: 'https://raw.githubusercontent.com/namewyf/Campus2026/main/README.md',
    // 表格：| 公司 | [岗位](URL) | 日期 | 地点 | 备注 |
    schema: ['company', 'link', 'deadline', 'city', 'note'],
    defaultTags: ['校招']
  },
  {
    name: '0voice/Computer-Spring-Recruitment',
    url: 'https://raw.githubusercontent.com/0voice/2026-Computer-Spring-Recruitment-Job-Compilation/main/README.md',
    // 表格：| NO. | 岗位 | [详细](URL) |
    schema: ['ignore', 'position', 'link'],
    defaultTags: ['校招', '春招']
  }
  // 加新源时往这里加 {name, url, schema, defaultTags}
];

// ─── Markdown 表格解析（通用 row 切分）──────────────────────
// 输入 README 全文，输出 [{cells:[...], rawLine:'...'}, ...]
// 跳过：表头分割行 (-----)、含表头关键字的行
function parseTableRows(content) {
  const rows = [];
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    if (!line.trim().startsWith('|')) continue;
    // 切单元；首尾的 | 会产生空字符串，过滤掉
    const cells = line.split('|').map((s) => s.trim());
    if (cells[0] === '') cells.shift();
    if (cells[cells.length - 1] === '') cells.pop();
    if (cells.length < 2) continue;
    // 分割行 |---|---|
    if (cells.every((c) => /^:?-+:?$/.test(c) || c === '')) continue;
    rows.push({ cells, rawLine: line });
  }
  return rows;
}

// 从 cell 文字里抽取 [text](url)
function extractMarkdownLink(text) {
  const m = /\[([^\]]+)\]\(([^)]+)\)/.exec(text || '');
  if (!m) return { text: (text || '').trim(), url: '' };
  return { text: m[1].trim(), url: m[2].trim() };
}

// 解析日期：支持 2025/7/20、2026-06-15、6月30日、2025-7-1
function parseDate(s) {
  if (!s) return '';
  const a = /(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})/.exec(s);
  if (a) return `${a[1]}-${String(a[2]).padStart(2, '0')}-${String(a[3]).padStart(2, '0')}`;
  const b = /(\d{1,2})月(\d{1,2})/.exec(s);
  if (b) {
    const y = new Date().getFullYear();
    return `${y}-${String(b[1]).padStart(2, '0')}-${String(b[2]).padStart(2, '0')}`;
  }
  return '';
}

// 从 URL 推公司名（兜底，DeepSeek 会再精修）
// 注意：不要把 qq.com / mp.weixin.qq.com 当腾讯——公众号文章往往是中转页
const URL_COMPANY_MAP = [
  [/alibaba\.com|talent\.alibaba|aliyun|alipay/i, '阿里巴巴'],
  [/bytedance|jobs\.bytedance|toutiao|douyin|tiktok/i, '字节跳动'],
  [/join\.qq\.com|careers\.tencent|tencent\.com\/careers/i, '腾讯'],
  [/talent\.baidu/i, '百度'],
  [/zhaopin\.meituan/i, '美团'],
  [/campus\.jd|jingdong/i, '京东'],
  [/kuaishou\.cn|campus\.kuaishou/i, '快手'],
  [/career\.huawei|huawei\.com\/.+\/careers/i, '华为'],
  [/xiaomi\.jobs|mioffice/i, '小米'],
  [/careers\.pdd|pddglobalhr/i, '拼多多'],
  [/game\.campus\.163|hr\.163\.com/i, '网易'],
  [/job\.xiaohongshu|xiaohongshu\.com\/.*job/i, '小红书'],
  [/careers\.microsoft/i, '微软'],
  [/careers\.google|google\.com\/careers/i, 'Google'],
  [/nvidia\.com\/.*careers/i, '英伟达'],
  [/mihoyo|mihayo|hoyoverse/i, '米哈游']
];

// 公众号/聚合链接不可信，不当公司
const UNRELIABLE_URL_RE = /mp\.weixin\.qq\.com|weibo\.com|zhihu\.com|xiaohongshu\.com\/explore|juejin\.cn|csdn\.net/i;

function guessCompanyFromUrl(url) {
  if (!url) return '';
  if (UNRELIABLE_URL_RE.test(url)) return '';
  for (const [re, name] of URL_COMPANY_MAP) {
    if (re.test(url)) return name;
  }
  return '';
}

// 按 schema 把一行 cells 映射成 item
function rowToItem(cells, schema, source) {
  const item = {
    company: '',
    position: '',
    sourceUrl: '',
    deadline: '',
    city: '',
    desc: '',
    source: source.name,
    tags: [...(source.defaultTags || [])]
  };
  for (let i = 0; i < schema.length && i < cells.length; i++) {
    const role = schema[i];
    const cell = cells[i];
    if (!cell || role === 'ignore') continue;
    if (role === 'link') {
      const { text, url } = extractMarkdownLink(cell);
      item.sourceUrl = url;
      if (!item.position) item.position = text;
    } else if (role === 'company') {
      item.company = cell;
    } else if (role === 'position') {
      // 岗位列也可能含 link
      const { text, url } = extractMarkdownLink(cell);
      item.position = text || cell;
      if (url && !item.sourceUrl) item.sourceUrl = url;
    } else if (role === 'deadline') {
      item.deadline = parseDate(cell);
    } else if (role === 'city') {
      item.city = cell;
    } else if (role === 'note') {
      item.desc = cell;
    }
  }
  // 兜底：从 URL 推公司
  if (!item.company && item.sourceUrl) {
    item.company = guessCompanyFromUrl(item.sourceUrl);
  }
  return item;
}

// 过滤掉表头行 / 全空行 / 无效行 / 低信号条目
function isValidItem(item) {
  if (!item.position && !item.company) return false;
  // 表头行：含"公司""岗位""链接"等
  if (/^(公司|岗位|工作岗位|招聘状态|状态|链接|更新日期|日期|地点|备注|company|position|status|deadline)/i.test(item.company || '')) return false;
  if (/^(公司|岗位|工作岗位|招聘状态|链接|更新日期|日期)/i.test(item.position || '')) return false;
  // 低信号：没公司 + 链接是聚合页（公众号/知乎专栏）→ 入库后用户也点不到具体岗位
  if (!item.company && UNRELIABLE_URL_RE.test(item.sourceUrl || '')) return false;
  return true;
}

async function fetchSource(source) {
  try {
    log.info(`[github] fetch ${source.name}`);
    const res = await axios.get(source.url, {
      timeout: 20000,
      headers: { 'User-Agent': 'CareerHub-Crawler/0.1' }
    });
    const rows = parseTableRows(res.data);
    const items = rows
      .map((r) => rowToItem(r.cells, source.schema, source))
      .filter(isValidItem);
    log.info(`[github] ${source.name} → ${items.length} items (from ${rows.length} table rows)`);
    return items;
  } catch (e) {
    log.error(`[github] ${source.name} failed:`, e.message);
    return [];
  }
}

async function fetch() {
  const results = await Promise.all(SOURCES.map(fetchSource));
  return results.flat();
}

module.exports = { fetch, SOURCES, parseTableRows, rowToItem };
