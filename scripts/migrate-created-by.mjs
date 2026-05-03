#!/usr/bin/env node
// Migration: Add created_by_user_id and created_by_name to orders table
// Run on SERVER: node /root/caprina/scripts/migrate-created-by.mjs

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
  try { const mod = await import(p); createConnection = mod.createConnection; break; } catch {}
}
if (!createConnection) { console.error('❌ mysql2 not found'); process.exit(1); }

const conn = await createConnection({ host, port, user, password, database, connectTimeout: 15000 });
console.log('✅ Connected to DB\n');

// ── Check & add columns ───────────────────────────────────────────
const [[{cnt1}]] = await conn.query(
  `SELECT COUNT(*) as cnt1 FROM INFORMATION_SCHEMA.COLUMNS 
   WHERE TABLE_NAME='orders' AND COLUMN_NAME='created_by_user_id' AND TABLE_SCHEMA=DATABASE()`
);
const [[{cnt2}]] = await conn.query(
  `SELECT COUNT(*) as cnt2 FROM INFORMATION_SCHEMA.COLUMNS 
   WHERE TABLE_NAME='orders' AND COLUMN_NAME='created_by_name' AND TABLE_SCHEMA=DATABASE()`
);

console.log(`created_by_user_id موجود: ${cnt1 > 0 ? '✅ نعم' : '❌ لا'}`);
console.log(`created_by_name موجود:    ${cnt2 > 0 ? '✅ نعم' : '❌ لا'}`);

if (cnt1 === 0) {
  await conn.query(`ALTER TABLE orders ADD COLUMN created_by_user_id INT NULL AFTER assigned_user_id`);
  console.log('✅ created_by_user_id اتضاف');
}
if (cnt2 === 0) {
  await conn.query(`ALTER TABLE orders ADD COLUMN created_by_name VARCHAR(255) NULL AFTER created_by_user_id`);
  console.log('✅ created_by_name اتضاف');
}

if (cnt1 > 0 && cnt2 > 0) {
  console.log('✅ الأعمدة موجودة بالفعل');
}

await conn.end();
console.log('\n✅ Migration تمت بنجاح!');
