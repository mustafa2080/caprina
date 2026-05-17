const mysql = require('mysql2/promise');
async function main() {
  const conn = await mysql.createConnection('mysql://u144001284_caprina:Capitan@123456@lavender-armadillo-743548.hostingersite.com:3306/u144001284_caprina');
  
  // اعرض بيانات الطلب 1048
  const [rows] = await conn.execute('SELECT id, status, cost_price, shipping_cost, return_received, is_damaged FROM orders WHERE id = 1048');
  console.log('Order 1048:', JSON.stringify(rows, null, 2));
  
  // اعرض كل الطلبات اللي عندها shipping_cost سالب
  const [neg] = await conn.execute('SELECT id, status, shipping_cost FROM orders WHERE shipping_cost < 0');
  console.log('Negative shipping:', JSON.stringify(neg, null, 2));
  
  // اصلح الـ shipping_cost السالبة
  const [fix] = await conn.execute('UPDATE orders SET shipping_cost = ABS(shipping_cost) WHERE shipping_cost < 0');
  console.log('Fixed rows:', fix.affectedRows);
  
  await conn.end();
}
main().catch(e => console.error('ERROR:', e.message));
