import { createConnection } from 'file:///C:/Users/musta/Desktop/pro/Caprina-Orders/Caprina-Orders/node_modules/.pnpm/mysql2@3.22.1_@types+node@25.3.5/node_modules/mysql2/promise.js';
const conn = await createConnection('mysql://u144001284_caprina:Capitan@123456@lavender-armadillo-743548.hostingersite.com:3306/u144001284_caprina');
const [rows] = await conn.execute("SELECT id, username, display_name, role, permissions FROM users WHERE role='custom'");
console.log(JSON.stringify(rows, null, 2));
await conn.end();
