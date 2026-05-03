// sync_matrix.mjs — مزامنة warehouse_stock لكل المنتجات في كل المخازن
import mysql from "mysql2/promise";

const DB_URL = "mysql://u144001284_caprina:Capitan@123456@lavender-armadillo-743548.hostingersite.com:3306/u144001284_caprina";

// parse URL
const url = new URL(DB_URL);
const conn = await mysql.createConnection({
  host: url.hostname,
  port: Number(url.port) || 3306,
  user: url.username,
  password: url.password,
  database: url.pathname.slice(1),
});

console.log("✅ اتصل بقاعدة البيانات");

const [warehouses] = await conn.execute("SELECT id, name FROM warehouses");
const [products]   = await conn.execute("SELECT id FROM products");
const [variants]   = await conn.execute("SELECT id FROM product_variants");

console.log(`📦 مخازن: ${warehouses.length} | منتجات: ${products.length} | variants: ${variants.length}`);

let inserted = 0;
const now = new Date().toISOString().slice(0, 19).replace("T", " ");

for (const wh of warehouses) {
  for (const p of products) {
    try {
      await conn.execute(
        "INSERT IGNORE INTO warehouse_stock (warehouse_id, product_id, variant_id, quantity, updated_at) VALUES (?, ?, NULL, 0, ?)",
        [wh.id, p.id, now]
      );
      inserted++;
    } catch (_) {}
  }
  for (const v of variants) {
    try {
      await conn.execute(
        "INSERT IGNORE INTO warehouse_stock (warehouse_id, product_id, variant_id, quantity, updated_at) VALUES (?, NULL, ?, 0, ?)",
        [wh.id, v.id, now]
      );
      inserted++;
    } catch (_) {}
  }
  console.log(`  ✓ مخزن "${wh.name}" — تمت المعالجة`);
}

// إحصائية نهائية
const [[{ total }]] = await conn.execute("SELECT COUNT(*) as total FROM warehouse_stock");
console.log(`\n✅ انتهى! صفوف جديدة: ${inserted} | إجمالي warehouse_stock: ${total}`);

await conn.end();
