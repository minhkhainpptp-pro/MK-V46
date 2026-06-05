const AuditLog = require('../models/AuditLog');

function cleanText(value) {
  return String(value || '').trim();
}

async function writeAuditLog(payload = {}, session) {
  const doc = {
    module: cleanText(payload.module),
    action: cleanText(payload.action),
    referenceId: cleanText(payload.referenceId),
    referenceCode: cleanText(payload.referenceCode),
    userCode: cleanText(payload.userCode),
    before: payload.before,
    after: payload.after,
    metadata: payload.metadata,
    ip: cleanText(payload.ip),
    userAgent: cleanText(payload.userAgent),
  };

  if (!doc.module || !doc.action) return null;
  const [created] = await AuditLog.create([doc], session ? { session } : undefined);
  return created;
}

module.exports = { writeAuditLog };
