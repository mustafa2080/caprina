import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(
  'mysql://u144001284_caprina:Capitan@123456@lavender-armadillo-743548.hostingersite.com:3306/u144001284_caprina'
);

// آخر 10 طلبات مع created_by_user_id
const [orders] = await conn.execute(
  `SELECT id, invoice_number, customer_name, status, 
          created_by_user_id, assigned_user_id, tenant_id,
          DATE_FORMAT(created_at, '%Y-%m-%d %H:%i') as date
   FROM orders ORDER BY created_at DESC LIMIT 10`
);
console.log('\n=== LAST 10 ORDERS ===');
console.table(orders);

// كل الـ users عشان نشوف الـ IDs
const [users] = await conn.execute(
  `SELECT id, username, display_name, role, tenant_id FROM users ORDER BY id`
);
console.log('\n=== USERS ===');
console.table(users);

// employee profiles
const [profiles] = await conn.execute(
  `SELECT id, user_id, display_name, tenant_id FROM employee_profiles ORDER BY id`
);
console.log('\n=== EMPLOYEE PROFILES ===');
console.table(profiles);

await conn.end();
