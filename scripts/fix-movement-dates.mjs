#!/usr/bin/env node
// Fix old movement dates that were all set to the build time
// Run on SERVER: node /root/caprina/scripts/fix-movement-dates.mjs

import { readFileSync } from 'fs';

let envContent = '';
for (const p of ['/root/caprina/.env', '/root/.env', '.env']) {
  try { envContent = readFileSync(p, 'utf8'); break; } catch {}
}
const urlMatch = envContent.match(/DATABASE_URL\s*=\s*([^\n\r]+)/);
const rawUrl = urlMatch[1].trim();
const protoStripped = rawUrl.replace(/^mysql:\/\//, '');
const lastAt = protoStripped.lastIndexOf('@');
const userPass = protoStripped.substring(0, lastAt);
const hostPortDb = protoStripped.substring(lastAt + 1);
const colonInUp = userPass.indexOf(':');
const user = userPass.substring(0, colonInUp);
const password = userPass.substring(colonInUp + 1);
const slashIdx = hostPortDb.indexOf('/');
const hostPort = hostPortDb.substring(0, slashIdx);
const database = hostPortDb.substring(slashIdx + 1).split('?')[0];
const colonInHp = hostPort.lastIndexOf(':');
const host = hostPort.substring(0, colonInHp) || 'localhost';
const port = parseInt(hostPort.substring(colonInHp + 1)) || 3306;

let createConnection;
for (const p of [
  '/root/caprina/artifacts/api-server/node_modules/mysql2/promise',
  '/root/caprina/node_modules/mysql2/promise',
  'mysql2/promise',
]) {
  try { const mod = await import(p); createConnection = mod.createConnection; break; } catch {}
}

const conn = await createConnection({ host, port, user, password, database, connectTimeout: 15000 });
console.log('✅ Connected\n');

// الـ orders عندها created_at صح — هنستخدمها كمرجع لتقدير وقت كل حركة
// كل حركة مرتبطة بـ order_id → نبحث عن تاريخ الأوردر
// الحركات اللي مش مرتبطة → نوزعها بشكل معقول

// أولاً: شوف كام حركة عندها التاريخ الغلط
const [[{ badCount }]] = await conn.query(
  `SELECT COUNT(*) as badCount FROM inventory_movements 
   WHERE DATE(created_at) = '2026-04-20'`
);
console.log(`📋 حركات بتاريخ غلط (2026-04-20): ${badCount}`);

// ثانياً: اتحقق من جدول الـ orders عنده تاريخ صح؟
const [[ordersInfo]] = await conn.query(
  `SELECT MIN(created_at) as minDate, MAX(created_at) as maxDate 
   FROM orders`
).catch(() => [[{ minDate: null, maxDate: null }]]);
console.log(`📋 Orders date range: ${ordersInfo?.minDate} → ${ordersInfo?.maxDate}`);

// ثالثاً: صلح الحركات المرتبطة بـ orders — استخدم تاريخ الأوردر نفسه
const [linkedResult] = await conn.query(`
  UPDATE inventory_movements m
  JOIN orders o ON m.order_id = o.id
  SET m.created_at = o.created_at
  WHERE DATE(m.created_at) = '2026-04-20'
`).catch(e => { console.log('⚠️ orders table issue:', e.message); return [{ affectedRows: 0 }]; });

console.log(`\n✅ حركات مرتبطة بـ orders اتصلحت: ${linkedResult.affectedRows}`);

// رابعاً: الحركات المتبقية (مش مرتبطة بـ orders) — وزعها على آخر 14 يوم
// نفرض إنها اتسجلت في الفترة من 20 أبريل لـ 4 مايو
const [remaining] = await conn.query(
  `SELECT id FROM inventory_movements WHERE DATE(created_at) = '2026-04-20' ORDER BY id ASC`
);

console.log(`\n📋 حركات متبقية (مش مرتبطة بـ orders): ${remaining.length}`);

if (remaining.length > 0) {
  // وزع الحركات على الفترة 20 أبريل → 4 مايو
  const startDate = new Date('2026-04-20T20:12:25Z');
  const endDate = new Date('2026-05-04T12:00:00Z');
  const totalMs = endDate - startDate;
  
  for (let i = 0; i < remaining.length; i++) {
    const { id } = remaining[i];
    // توزيع خطي — الحركة الأولى قرب الأول، الأخيرة قرب الآخر
    const fraction = remaining.length > 1 ? i / (remaining.length - 1) : 0.5;
    const estimatedDate = new Date(startDate.getTime() + fraction * totalMs);
    
    await conn.query(
      `UPDATE inventory_movements SET created_at = ? WHERE id = ?`,
      [estimatedDate, id]
    );
  }
  console.log(`✅ تم توزيع ${remaining.length} حركة على الفترة الزمنية الصح`);
}

// تحقق نهائي
const [[{ remaining2 }]] = await conn.query(
  `SELECT COUNT(*) as remaining2 FROM inventory_movements WHERE DATE(created_at) = '2026-04-20'`
);
console.log(`\n📋 حركات لسه بتاريخ 20 أبريل: ${remaining2}`);

// عرض آخر 10 حركات
const [sample] = await conn.query(
  `SELECT id, created_at, product, reason FROM inventory_movements ORDER BY created_at DESC LIMIT 10`
);
console.log('\n📋 آخر 10 حركات بعد التصليح:');
sample.forEach(r => console.log(`  ID:${r.id} | ${r.created_at} | ${r.product} | ${r.reason}`));

await conn.end();
console.log('\n✅ تم تصليح التواريخ!');
