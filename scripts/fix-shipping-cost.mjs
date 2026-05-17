import mysql from 'mysql2/promise';

const conn = await mysql.createConnection('mysql://u144001284_caprina:Capitan@123456@lavender-armadillo-743548.hostingersite.com:3306/u144001284_caprina');

const [row] = await conn.execute('SELECT id, status, cost_price, shipping_cost, return_received, is_damaged FROM orders WHERE id = 1048');
console.log('Order 1048:', JSON.stringify(row));

const [neg] = await conn.execute('SELECT COUNT(*) as cnt FROM orders WHERE shipping_cost < 0');
console.log('Negative shipping rows:', JSON.stringify(neg));

const [fix] = await conn.execute('UPDATE orders SET shipping_cost = ABS(shipping_cost) WHERE shipping_cost < 0');
console.log('Fixed rows:', fix.affectedRows);

await conn.end();
console.log('Done!');
