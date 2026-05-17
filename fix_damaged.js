const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'artifacts', 'api-server', 'src', 'routes', 'finance-hub.ts');
let content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

// السطور 108-118 (0-indexed: 108-118) = returnsPrev query
// نصلح sql`status = 'returned'` → sql`status = 'returned' AND is_damaged = 1`
const newBlock = [
  '\r',
  "    const [returnsPrev] = await db.select({\r",
  "      returnCogs:     sql<number>`COALESCE(SUM(cost_price * quantity),0)`,\r",
  "      returnShipping: sql<number>`COALESCE(SUM(shipping_cost),0)`,\r",
  "    }).from(ordersTable).where(and(\r",
  "      isNull(ordersTable.deletedAt),\r",
  "      sql`status = 'returned' AND is_damaged = 1`,\r",
  "      gte(ordersTable.createdAt, prevFrom),\r",
  "      lte(ordersTable.createdAt, prevToEnd),\r",
  "      ...tOrder,\r",
  "    ));\r",
];

const before = lines.slice(0, 108);
const after = lines.slice(118);
const newLines = [...before, ...newBlock, ...after];

fs.writeFileSync(filePath, newLines.join('\n'), 'utf8');
console.log('returnsPrev fixed');

// تحقق
const check = fs.readFileSync(filePath, 'utf8').split('\n');
for (let i = 107; i <= 120; i++) {
  console.log(i+1, ':', check[i]);
}
