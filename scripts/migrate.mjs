#!/usr/bin/env node
// Migration: Add from_location and to_location to inventory_movements
// Run on SERVER: node /root/caprina/scripts/migrate.mjs

import { readFileSync } from 'fs';
import { createConnection } from 'net';

// ── Read DATABASE_URL from .env ───────────────────────────────────
let envContent = '';
try {
  envContent = readFileSync('/root/caprina/.env', 'utf8');
} catch {
  try {
    envContent = readFileSync('/root/.env', 'utf8');
  } catch {
    console.error('❌ لم أجد ملف .env');
    process.exit(1);
  }
}

const match = envContent.match(/DATABASE_URL\s*=\s*mysql:\/\/([^:]+):(.+?)@([^:]+):(\d+)\/(\S+)/);
if (!match) {
  console.error('❌ DATABASE_URL غير موجود في .env');
  process.exit(1);
}

const [, user, password, host, port, database] = match;
console.log(`✅ DB: ${user}@${host}:${port}/${database}`);

// ── Use mysql2 from api-server node_modules ───────────────────────
const { createConnection: mysqlConnect } = await import(
  '/root/caprina/artifacts/api-server/node_modules/mysql2/promise/index.js'
);

const conn = await mysqlConnect({
  host, port: parseInt(port), user, password, database,
  connectTimeout: 15000,
});

console.log('✅ Connected to DB');

// ── Check & add columns ───────────────────────────────────────────
const [[rows]] = await conn.query(
  `SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.COLUMNS 
   WHERE TABLE_NAME='inventory_movements' 
   AND COLUMN_NAME IN ('from_location','to_location')
   AND TABLE_SCHEMA=?`,
  [database]
);

if (rows.cnt >= 2) {
  console.log('✅ الأعمدة موجودة بالفعل — مفيش حاجة يتعمل');
} else {
  const [[{cnt1}]] = await conn.query(
    `SELECT COUNT(*) as cnt1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='inventory_movements' AND COLUMN_NAME='from_location' AND TABLE_SCHEMA=?`,
    [database]
  );
  const [[{cnt2}]] = await conn.query(
    `SELECT COUNT(*) as cnt2 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='inventory_movements' AND COLUMN_NAME='to_location' AND TABLE_SCHEMA=?`,
    [database]
  );
  if (cnt1 === 0) {
    await conn.query(`ALTER TABLE inventory_movements ADD COLUMN from_location VARCHAR(255) NULL`);
    console.log('✅ from_location اتضاف');
  }
  if (cnt2 === 0) {
    await conn.query(`ALTER TABLE inventory_movements ADD COLUMN to_location VARCHAR(255) NULL`);
    console.log('✅ to_location اتضاف');
  }
}

// ── Show result ───────────────────────────────────────────────────
const [cols] = await conn.query(
  `SELECT COLUMN_NAME, COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS 
   WHERE TABLE_NAME='inventory_movements' AND TABLE_SCHEMA=? 
   ORDER BY ORDINAL_POSITION`,
  [database]
);
console.log('\n📋 أعمدة inventory_movements:');
cols.forEach(c => console.log(`  ${c.COLUMN_NAME} — ${c.COLUMN_TYPE}`));

await conn.end();
console.log('\n✅ Migration تمت بنجاح!');
