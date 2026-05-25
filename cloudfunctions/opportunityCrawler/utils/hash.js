const crypto = require('crypto');

function md5(s) {
  return crypto.createHash('md5').update(s).digest('hex');
}

// 公司+岗位+城市 → 稳定 ID，用于去重和 upsert 主键
function opportunityId(item) {
  const key = `${(item.company || '').trim()}|${(item.position || '').trim()}|${(item.city || '').trim()}`;
  return 'op_' + md5(key).slice(0, 12);
}

module.exports = { md5, opportunityId };
