import mysql2 from 'mysql2/promise';
const conn = await mysql2.createConnection('mysql://u144001284_caprina:Capitan@123456@lavender-armadillo-743548.hostingersite.com:3306/u144001284_caprina');
const [rows] = await conn.execute("SELECT id, username, display_name, role, permissions FROM users WHERE role='custom'");
console.log(JSON.stringify(rows, null, 2));
await conn.end();
