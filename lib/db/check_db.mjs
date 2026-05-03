import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(
  'mysql://u144001284_caprina:Capitan@123456@lavender-armadillo-743548.hostingersite.com:3306/u144001284_caprina'
);

const [movements] = await conn.execute(
  `SELECT id, type, reason, quantity, product, color, size, warehouse_id, order_id,
          DATE_FORMAT(created_at,'%Y-%m-%d %H:%i') as dt
   FROM inventory_movements ORDER BY created_at DESC LIMIT 30`
);
console.log('\n=== INVENTORY MOVEMENTS ===');
console.table(movements);

const [stock] = await conn.execute(
  `SELECT ws.id, w.name as warehouse, ws.product_id, ws.variant_id, ws.quantity,
          DATE_FORMAT(ws.updated_at,'%Y-%m-%d %H:%i') as updated
   FROM warehouse_stock ws
   LEFT JOIN warehouses w ON ws.warehouse_id = w.id
   ORDER BY ws.updated_at DESC LIMIT 30`
);
console.log('\n=== WAREHOUSE STOCK ===');
console.table(stock);

const [products] = await conn.execute(
  `SELECT id, name, total_quantity FROM products ORDER BY updated_at DESC LIMIT 15`
);
console.log('\n=== PRODUCTS totalQuantity ===');
console.table(products);

const [variants] = await conn.execute(
  `SELECT pv.id, p.name as product, pv.color, pv.size, pv.total_quantity
   FROM product_variants pv JOIN products p ON pv.product_id = p.id
   ORDER BY pv.updated_at DESC LIMIT 20`
);
console.log('\n=== VARIANTS totalQuantity ===');
console.table(variants);

await conn.end();
