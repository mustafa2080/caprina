import mysql from './lib/db/node_modules/mysql2/promise.js';
const conn = await mysql.createConnection('mysql://u144001284_caprina:Capitan@123456@lavender-armadillo-743548.hostingersite.com:3306/u144001284_caprina');

const today = new Date().toISOString().split('T')[0];
console.log('اليوم:', today);

const [orders] = await conn.execute(
  `SELECT id, customer_name, invoice_number, status, quantity, partial_quantity,
          unit_price, total_price, cost_price, shipping_cost, is_damaged, return_reason,
          DATE_FORMAT(created_at,'%Y-%m-%d') as day
   FROM orders WHERE deleted_at IS NULL AND DATE(created_at) = ? ORDER BY created_at DESC`,
  [today]
);
console.log('\n=== طلبات اليوم ===');
console.table(orders);

// احسب يدويا
let cashIn=0, costGoods=0, shippingSpend=0, returnLoss=0;
for (const o of orders) {
  const sc = Number(o.shipping_cost ?? 0);
  const cp = Number(o.cost_price ?? 0);
  if (o.status === 'received') {
    cashIn += o.quantity * o.unit_price;
    costGoods += o.quantity * cp;
    shippingSpend += sc;
  } else if (o.status === 'returned') {
    shippingSpend += sc;
    if (o.is_damaged === 1) {
      returnLoss += o.quantity * cp;
      costGoods += o.quantity * cp;
    }
  }
}
console.log('\n=== الحساب اليدوي ===');
console.log('cashIn:', cashIn);
console.log('costGoods:', costGoods);
console.log('shippingSpend:', shippingSpend);
console.log('returnLoss:', returnLoss);
console.log('netProfit:', cashIn - costGoods - shippingSpend - returnLoss);

await conn.end();
