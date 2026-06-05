const ApiLog = require('../models/ApiLog');

function apiMonitorMiddleware(req, res, next) {
  const startedAt = Date.now();
  const requestId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  req.requestId = requestId;

  res.on('finish', () => {
    const ms = Date.now() - startedAt;
    const shouldLog =
      req.path.startsWith('/api/') ||
      ms >= Number(process.env.API_LOG_SLOW_MS || 1000) ||
      res.statusCode >= 400;

    if (!shouldLog) return;

    ApiLog.create({
      method: req.method,
      url: req.originalUrl,
      path: req.path,
      statusCode: res.statusCode,
      ms,
      queryCount: req.queryCount || 0,
      userCode: (req.user && (req.user.code || req.user.username)) || req.headers['x-user-code'] || '',
      ip: req.ip || '',
      userAgent: req.headers['user-agent'] || '',
      requestId,
    }).catch((err) => {
      console.warn('[API_LOG_WRITE_FAILED]', err.message);
    });
  });

  next();
}

module.exports = apiMonitorMiddleware;
