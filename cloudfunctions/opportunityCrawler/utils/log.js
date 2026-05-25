// 结构化日志（云函数控制台可直接查）
function ts() {
  return new Date().toISOString();
}

const log = {
  info: (...a) => console.log(`[${ts()}] [INFO]`, ...a),
  warn: (...a) => console.warn(`[${ts()}] [WARN]`, ...a),
  error: (...a) => console.error(`[${ts()}] [ERR ]`, ...a),
  step: (label) => console.log(`\n[${ts()}] ───── ${label} ─────`)
};

module.exports = log;
