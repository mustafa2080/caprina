#!/usr/bin/env node
// Migration: Fix created_at column in inventory_movements
// from DATETIME (static default) → TIMESTAMP (auto CURRENT_TIMESTAMP)
// Run on SERVER: node /root/caprina/scripts/fix-created-at.mjs

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

const conn = await createConnection({ host, port, user, password, database, connectTimeout: 15000 });
console.log('✅ Connected to DB\n');

// ── Check current column type ─────────────────────────────────────
const [[colInfo]] = await conn.query(
  `SELECT COLUMN_TYPE, COLUMN_DEFAULT, EXTRA
   FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_NAME='inventory_movements' AND COLUMN_NAME='created_at' AND TABLE_SCHEMA=DATABASE()`
);

console.log('📋 العمود الحالي:');
console.log(`  النوع:    ${colInfo.COLUMN_TYPE}`);
console.log(`  Default:  ${colInfo.COLUMN_DEFAULT}`);
console.log(`  Extra:    ${colInfo.EXTRA}`);

// ── Fix the column ────────────────────────────────────────────────
console.log('\n🔧 تغيير العمود إلى TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ...');

await conn.query(`
  ALTER TABLE inventory_movements
  MODIFY COLUMN created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
`);

console.log('✅ تم تغيير العمود بنجاح!\n');

// ── Verify ────────────────────────────────────────────────────────
const [[after]] = await conn.query(
  `SELECT COLUMN_TYPE, COLUMN_DEFAULT, EXTRA
   FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_NAME='inventory_movements' AND COLUMN_NAME='created_at' AND TABLE_SCHEMA=DATABASE()`
);

console.log('📋 العمود بعد التعديل:');
console.log(`  النوع:    ${after.COLUMN_TYPE}`);
console.log(`  Default:  ${after.COLUMN_DEFAULT}`);
console.log(`  Extra:    ${after.EXTRA}`);

// ── Show sample data ──────────────────────────────────────────────
const [rows] = await conn.query(
  `SELECT id, created_at FROM inventory_movements ORDER BY id DESC LIMIT 5`
);
console.log('\n📋 آخر 5 حركات في DB:');
rows.forEach(r => console.log(`  ID: ${r.id}  →  created_at: ${r.created_at}`));

await conn.end();
console.log('\n✅ Migration تمت بنجاح! الحركات الجديدة هتاخد التوقيت الصح تلقائياً.');
