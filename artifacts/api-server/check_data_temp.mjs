import mysql from 'mysql2/promise';

const conn = await mysql.createConnection('mysql://u144001284_caprina:Capitan@123456@lavender-armadillo-743548.hostingersite.com:3306/u144001284_caprina');

const [manifests] = await conn.execute("SELECT * FROM shippingManifestsTable WHERE manifestNumber LIKE '%1-003%'");
console.log('=== MANIFESTS ===');
console.log(JSON.stringify(manifests, null, 2));

if (manifests.length > 0) {
  const manifestId = manifests[0].id;
  const [links] = await conn.execute('SELECT * FROM shippingManifestOrdersTable WHERE manifestId = ?', [manifestId]);
  console.log('=== LINKS ===');
  console.log(JSON.stringify(links, null, 2));

  const orderIds = links.map(l => l.orderId);
  if (orderIds.length > 0) {
    const [orders] = await conn.execute(`SELECT * FROM ordersTable WHERE id IN (${orderIds.join(',')})`);
    console.log('=== ORDERS ===');
    console.log(JSON.stringify(orders, null, 2));
  }
}

await conn.end();
