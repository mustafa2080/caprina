import mysql from 'mysql2/promise';

const conn = await mysql.createConnection('mysql://u144001284_caprina:Capitan@123456@lavender-armadillo-743548.hostingersite.com:3306/u144001284_caprina');

const [manifests] = await conn.execute("SELECT * FROM shippingManifestsTable WHERE manifestNumber LIKE '%1-003%'");
console.log('=== MANIFESTS ===');
console.log(JSON.stringify(manifests, null, 2));
