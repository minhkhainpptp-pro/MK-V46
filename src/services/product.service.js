const Product = require('../models/Product');

function buildProductFilter(query = {}) {
  const filter = {};
  if (query.isActive !== undefined) filter.isActive = String(query.isActive) !== 'false';
  if (query.defaultWarehouseCode) filter.defaultWarehouseCode = String(query.defaultWarehouseCode).trim();
  if (query.brand) filter.brand = String(query.brand).trim();
  if (query.q) {
    const q = String(query.q).trim();
    filter.$or = [
      { code: new RegExp(q, 'i') },
      { name: new RegExp(q, 'i') },
      { barcode: new RegExp(q, 'i') },
    ];
  }
  return filter;
}

async function listProducts(query = {}) {
  const limit = Math.min(Number(query.limit || 100), 500);
  const filter = buildProductFilter(query);
  const rows = await Product.find(filter).sort({ code: 1 }).limit(limit).lean();
  const total = await Product.countDocuments(filter);
  return { rows, total };
}

async function getProduct(id) {
  const doc = await Product.findById(id).lean();
  if (!doc) throw Object.assign(new Error('Không tìm thấy sản phẩm'), { status: 404 });
  return doc;
}

async function createProduct(input = {}) {
  const payload = {
    code: String(input.code || '').trim(),
    name: String(input.name || '').trim(),
    barcode: String(input.barcode || '').trim(),
    brand: String(input.brand || '').trim(),
    category: String(input.category || '').trim(),
    baseUnit: String(input.baseUnit || '').trim(),
    salePrice: Number(input.salePrice || 0),
    costPrice: Number(input.costPrice || 0),
    conversionRate: Number(input.conversionRate || 1),
    defaultWarehouse: String(input.defaultWarehouse || input.defaultWarehouseCode || '').trim(),
    defaultWarehouseCode: String(input.defaultWarehouseCode || input.defaultWarehouse || '').trim(),
    isActive: input.isActive !== false,
  };
  if (!payload.code) throw Object.assign(new Error('Thiếu mã sản phẩm'), { status: 400 });
  if (!payload.name) throw Object.assign(new Error('Thiếu tên sản phẩm'), { status: 400 });
  const duplicated = await Product.exists({ code: payload.code });
  if (duplicated) throw Object.assign(new Error(`Sản phẩm đã tồn tại: ${payload.code}`), { status: 409 });
  return Product.create(payload);
}

async function updateProduct(id, input = {}) {
  const payload = { ...input };
  delete payload._id;
  if (payload.salePrice !== undefined) payload.salePrice = Number(payload.salePrice || 0);
  if (payload.costPrice !== undefined) payload.costPrice = Number(payload.costPrice || 0);
  if (payload.conversionRate !== undefined) payload.conversionRate = Number(payload.conversionRate || 1);
  const doc = await Product.findByIdAndUpdate(id, payload, { new: true, runValidators: true }).lean();
  if (!doc) throw Object.assign(new Error('Không tìm thấy sản phẩm'), { status: 404 });
  return doc;
}

async function deleteProduct(id) {
  const doc = await Product.findByIdAndUpdate(id, { isActive: false }, { new: true }).lean();
  if (!doc) throw Object.assign(new Error('Không tìm thấy sản phẩm'), { status: 404 });
  return doc;
}

module.exports = { listProducts, getProduct, createProduct, updateProduct, deleteProduct };
