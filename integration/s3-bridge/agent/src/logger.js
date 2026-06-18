'use strict';

function sanitize(value) {
  if (!value || typeof value !== 'object') return value;
  const redacted = {};
  for (const [key, item] of Object.entries(value)) {
    if (/password|secret|signature|authorization|connectionstring/i.test(key)) redacted[key] = '[REDACTED]';
    else redacted[key] = item && typeof item === 'object' ? sanitize(item) : item;
  }
  return redacted;
}

function write(level, message, fields = {}) {
  const record = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...sanitize(fields)
  };
  const output = JSON.stringify(record);
  if (level === 'error') console.error(output);
  else if (level === 'warn') console.warn(output);
  else console.log(output);
}

module.exports = {
  info: (message, fields) => write('info', message, fields),
  warn: (message, fields) => write('warn', message, fields),
  error: (message, fields) => write('error', message, fields)
};
