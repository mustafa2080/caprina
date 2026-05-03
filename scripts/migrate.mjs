#!/usr/bin/env node
// Migration: Add from_location and to_location to inventory_movements
// Run on SERVER: node /root/caprina/scripts/migrate.mjs

import { readFileSync } from 'fs';

// ── Read DATABASE_URL from .env ───────────────────────────────────
let envContent = '';
const envPaths = ['/root/caprina/.env', '/root/.env', '.env'];
for (const p of envPaths) {
  try { envContent = readFileSync(p, 'utf8'); break; } catch {}
}
if (!envContent) { console.error('❌ لم أجد ملف .env'); process.exit(1); }

const urlMatch = envContent.match(/DATABASE_URL\s*=\s*([^\n\r]+)/);
if (!urlMatch) { console.error('❌ DATABASE_URL غير موجود في .env'); process.exit(1); }

const rawUrl = urlMatch[1].trim();
console.log('🔍 DATABASE_URL:', rawUrl);

// Parse: mysql://user:pass@host:port/db  (password may contain @ or :)
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

console.log(`✅ Parsed → user=${user} host=${host} port=${port} db=${database}`);

// ── Find mysql2 ───────────────────────────────────────────────────
let createConnection;
const mysql2Paths = [
  '/root/caprina/artifacts/api-server/node_modules/mysql2/promise',
  '/root/caprina/node_modules/mysql2/promise',
  'mysql2/promise',
];
for (const p of mysql2Paths) {
  try {
    const mod = await import(p);
    createConnection = mod.createConnection;
    console.log('✅ mysql2 loaded from:', p);
    break;
  } catch {}
}
if (!createConnection) { console.error('❌ mysql2 not found'); process.exit(1); }

// ── Connect ───────────────────────────────────────────────────────
const conn = await createConnection({
  host, port, user, password, database,
  connectTimeout: 15000,
});
console.log('✅ Connected to DB\n');

// ── Check & add columns ───────────────────────────────────────────
const [[{cnt1}]] = await conn.query(
  `SELECT COUNT(*) as cnt1 FROM INFORMATION_SCHEMA.COLUMNS 
   WHERE TABLE_NAME='inventory_movements' AND COLUMN_NAME='from_location' AND TABLE_SCHEMA=DATABASE()`
);
const [[{cnt2}]] = await conn.query(
  `SELECT COUNT(*) as cnt2 FROM INFORMATION_SCHEMA.COLUMNS 
   WHERE TABLE_NAME='inventory_movements' AND COLUMN_NAME='to_location' AND TABLE_SCHEMA=DATABASE()`
);

console.log(`from_location موجود: ${cnt1 > 0 ? '✅ نعم' : '❌ لا'}`);
console.log(`to_location موجود:   ${cnt2 > 0 ? '✅ نعم' : '❌ لا'}`);

if (cnt1 === 0) {
  await conn.query(`ALTER TABLE inventory_movements ADD COLUMN from_location VARCHAR(255) NULL`);
  console.log('✅ from_location اتضاف');
}
if (cnt2 === 0) {
  await conn.query(`ALTER TABLE inventory_movements ADD COLUMN to_location VARCHAR(255) NULL`);
  console.log('✅ to_location اتضاف');
}

if (cnt1 > 0 && cnt2 > 0) {
  console.log('✅ الأعمدة موجودة بالفعل — مفيش حاجة يتعمل');
}

// ── Show columns ──────────────────────────────────────────────────
const [cols] = await conn.query(
  `SELECT COLUMN_NAME, COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS 
   WHERE TABLE_NAME='inventory_movements' AND TABLE_SCHEMA=DATABASE()
   ORDER BY ORDINAL_POSITION`
);
console.log('\n📋 أعمدة inventory_movements:');
cols.forEach(c => console.log(`  ${c.COLUMN_NAME.padEnd(20)} ${c.COLUMN_TYPE}`));

await conn.end();
console.log('\n✅ Migration تمت بنجاح!');
