const Role = require('../models/Role');
const Warehouse = require('../models/Warehouse');

const DEFAULT_ROLES = [
  { code: 'admin', name: 'Quản trị', permissions: ['*'] },
  { code: 'accountant', name: 'Kế toán', permissions: [] },
  { code: 'sales', name: 'Nhân viên bán hàng', permissions: [] },
  { code: 'delivery', name: 'Nhân viên giao hàng', permissions: [] },
];

const DEFAULT_WAREHOUSES = [
  { code: 'KHO_HC', name: 'Kho Hóa Chất', type: 'HC' },
  { code: 'KHO_PC', name: 'Kho Personal Care', type: 'PC' },
];

async function seedDefaults() {
  await Promise.all(DEFAULT_ROLES.map(role => Role.updateOne(
    { code: role.code },
    { $setOnInsert: { ...role, isActive: true } },
    { upsert: true }
  )));

  await Promise.all(DEFAULT_WAREHOUSES.map(warehouse => Warehouse.updateOne(
    { code: warehouse.code },
    { $setOnInsert: { ...warehouse, isActive: true } },
    { upsert: true }
  )));

  console.log('[DB] Default roles and warehouses seeded');
}

module.exports = { seedDefaults };
