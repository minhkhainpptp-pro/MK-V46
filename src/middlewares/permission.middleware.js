const ROLE_ALIASES = {
  admin: 'admin',
  owner: 'admin',
  ketoan: 'accounting',
  accountant: 'accounting',
  accounting: 'accounting',
  kho: 'warehouse',
  warehouse: 'warehouse',
  nvbh: 'sales',
  sales: 'sales',
  nvgh: 'delivery',
  delivery: 'delivery',
};

function getRole(req) {
  const raw = String(
    (req.user && (req.user.roleCode || req.user.role || req.user.type))
    || req.headers['x-user-role']
    || req.headers['x-role']
    || req.query.role
    || ''
  ).trim().toLowerCase();
  return ROLE_ALIASES[raw] || raw || 'guest';
}

function requireRole(...allowedRoles) {
  const allowed = new Set(allowedRoles.map((x) => ROLE_ALIASES[String(x).toLowerCase()] || String(x).toLowerCase()));
  return function permissionMiddleware(req, res, next) {
    const role = getRole(req);
    if (allowed.has(role) || role === 'admin') return next();
    const err = new Error('Không đủ quyền thao tác');
    err.status = 403;
    err.requiredRoles = [...allowed];
    err.currentRole = role;
    return next(err);
  };
}

module.exports = { getRole, requireRole };
