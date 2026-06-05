const User = require('../models/User');

function buildUserFilter(query = {}) {
  const filter = {};
  if (query.isActive !== undefined) filter.isActive = String(query.isActive) !== 'false';
  if (query.roleCode) filter.roleCode = String(query.roleCode).trim();
  if (query.q) {
    const q = String(query.q).trim();
    filter.$or = [
      { code: new RegExp(q, 'i') },
      { name: new RegExp(q, 'i') },
      { phone: new RegExp(q, 'i') },
      { username: new RegExp(q, 'i') },
    ];
  }
  return filter;
}

function safeUser(doc) {
  if (!doc) return doc;
  const obj = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
  delete obj.password;
  return obj;
}

async function listUsers(query = {}) {
  const limit = Math.min(Number(query.limit || 100), 500);
  const filter = buildUserFilter(query);
  const rows = await User.find(filter).sort({ code: 1 }).limit(limit).lean();
  const total = await User.countDocuments(filter);
  return { rows, total };
}

async function getUser(id) {
  const doc = await User.findById(id).lean();
  if (!doc) throw Object.assign(new Error('Không tìm thấy nhân sự'), { status: 404 });
  return doc;
}

async function createUser(input = {}) {
  const payload = {
    code: String(input.code || '').trim(),
    name: String(input.name || '').trim(),
    phone: String(input.phone || '').trim(),
    username: String(input.username || input.code || '').trim(),
    password: String(input.password || '123456'),
    roleCode: String(input.roleCode || '').trim(),
    isActive: input.isActive !== false,
  };
  if (!payload.code) throw Object.assign(new Error('Thiếu mã nhân sự'), { status: 400 });
  if (!payload.name) throw Object.assign(new Error('Thiếu tên nhân sự'), { status: 400 });
  if (!payload.roleCode) throw Object.assign(new Error('Thiếu quyền nhân sự'), { status: 400 });
  const duplicated = await User.exists({ $or: [{ code: payload.code }, { username: payload.username }] });
  if (duplicated) throw Object.assign(new Error(`Nhân sự đã tồn tại: ${payload.code}`), { status: 409 });
  const doc = await User.create(payload);
  return safeUser(doc);
}

async function updateUser(id, input = {}) {
  const payload = { ...input };
  delete payload._id;
  if (!payload.password) delete payload.password;
  const doc = await User.findByIdAndUpdate(id, payload, { new: true, runValidators: true }).lean();
  if (!doc) throw Object.assign(new Error('Không tìm thấy nhân sự'), { status: 404 });
  return safeUser(doc);
}

async function deleteUser(id) {
  const doc = await User.findByIdAndUpdate(id, { isActive: false }, { new: true }).lean();
  if (!doc) throw Object.assign(new Error('Không tìm thấy nhân sự'), { status: 404 });
  return safeUser(doc);
}

module.exports = { listUsers, getUser, createUser, updateUser, deleteUser };
