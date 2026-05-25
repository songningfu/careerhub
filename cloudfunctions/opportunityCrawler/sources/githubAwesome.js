// 数据源：GitHub 招聘合集 repo（Markdown 表格）
// 移植自 backend/crawler/scraper.py，无反爬、最稳

const axios = require('axios');
const log = require('../utils/log');

const REPOS = [
  {
    name: '2026届校招汇总',
    url: 'https://raw.githubusercontent.com/forthespada/CampusRecruitment/master/README.md'
  }
  // 可加更多 repo
];

// 匹配 Markdown 表格行: | 公司 | [岗位](URL) | 截止时间 |
const TABLE_RE = /\|\s*([^|]+?)\s*\|\s*\[([^\]]+)\]\(([^)]+)\)\s*\|\s*([^|]+?)\s*\|/g;
const DATE_RE = /(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})|(\d{1,2})月(\d{1,2})日/;

function parseMarkdown(content) {
  const items = [];
  let m;
  while ((m = TABLE_RE.exec(content)) !== null) {
    const company = m[1].trim();
    const linkText = m[2].trim();
    const linkUrl = m[3].trim();
    const deadlineRaw = m[4].trim();
    if (!company || /company|公司/i.test(company) || /----/.test(company)) continue;

    let deadline = '';
    const dm = DATE_RE.exec(deadlineRaw);
    if (dm) {
      if (dm[1]) {
        deadline = `${dm[1]}-${String(dm[2]).padStart(2, '0')}-${String(dm[3]).padStart(2, '0')}`;
      } else {
        const year = new Date().getFullYear();
        deadline = `${year}-${String(dm[4]).padStart(2, '0')}-${String(dm[5]).padStart(2, '0')}`;
      }
    }

    items.push({
      company,
      position: linkText || '校招岗位',
      sourceUrl: linkUrl,
      deadline,
      source: 'GitHub合集',
      tags: ['校招'],
      industry: '',
      city: '',
      salary: '',
      desc: ''
    });
  }
  return items;
}

async function fetch() {
  const all = [];
  for (const repo of REPOS) {
    try {
      log.info(`[github] fetch ${repo.name}`);
      const res = await axios.get(repo.url, { timeout: 20000 });
      const items = parseMarkdown(res.data);
      log.info(`[github] ${repo.name} → ${items.length} items`);
      all.push(...items);
    } catch (e) {
      log.error(`[github] ${repo.name} failed:`, e.message);
    }
  }
  return all;
}

module.exports = { fetch, parseMarkdown };
