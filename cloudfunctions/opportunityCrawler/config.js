// CareerHub opportunityCrawler · 配置常量
// 修改后需要重新部署云函数才能生效

module.exports = {
  // ===== DeepSeek 配置 =====
  deepseek: {
    baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
    // 模型名按官方文档为准，V4 出来后可能仍叫 deepseek-chat（指向最新非思考版）
    // 也可以直接写 deepseek-v4-flash（如官方公布该名称）
    model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
    // 单次批量大小：一次发给 DeepSeek 多少条原始 item
    batchSize: 30,
    // 整次更新最多调多少次 DeepSeek（兜底）
    maxCalls: 12,
    // 单次请求超时
    timeoutMs: 60000,
    temperature: 0.1
  },

  // ===== 限流配置 =====
  rateLimit: {
    // 每用户 24h 手动触发上限
    perUserPerDay: 3,
    // 全局每小时定时触发上限（防止定时器叠加）
    globalPerHour: 1
  },

  // ===== 数据库集合名 =====
  collections: {
    opportunities: 'opportunities',
    crawlerRuns: 'crawler_runs'
  },

  // ===== 数据源开关（true 才会跑）=====
  sources: {
    githubAwesome: true
    // internshipDog: false,
    // officialSites: false
  },

  // ===== 过期策略 =====
  expiry: {
    // N 天没在任何源出现就标记 expired
    markExpiredAfterDays: 30
  }
};
