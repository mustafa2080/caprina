#!/bin/bash
# ─── Caprina Fix Transfer Columns + Rebuild API ──────────────────────────────
# الاستخدام: bash /root/caprina/scripts/fix-transfer.sh
# ─────────────────────────────────────────────────────────────────────────────

ROOT="/root/caprina"

echo "================================================================"
echo "  Caprina — Fix Transfer (from_location / to_location)"
echo "================================================================"
echo ""

# ── Step 1: Git pull ──────────────────────────────────────────────
echo "🔄 [1/4] git pull..."
cd "$ROOT"
git pull
echo ""

# ── Step 2: Migration via Node.js ─────────────────────────────────
echo "🗄️  [2/4] DB Migration — إضافة الأعمدة..."

node --input-type=module << 'NODESCRIPT'
import { createConnection } from 'mysql2/promise';

const url = process.env.DATABASE_URL;
// parse: mysql://user:pass@host:port/db
const match = url.match(/mysql:\/\/([^:]+):(.+)@([^:]+):(\d+)\/(.+)/);
if (!match) { console.error('❌ DATABASE_URL parse failed:', url); process.exit(1); }
const [, user, password, host, port, database] = match;

const conn = await createConnection({ host, port: parseInt(port), user, password, database, connectTimeout: 30000 });

// check from_location
const [[{cnt1}]] = await conn.query(
  `SELECT COUNT(*) as cnt1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='inventory_movements' AND COLUMN_NAME='from_location' AND TABLE_SCHEMA=?`,
  [database]
);
// check to_location
const [[{cnt2}]] = await conn.query(
  `SELECT COUNT(*) as cnt2 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='inventory_movements' AND COLUMN_NAME='to_location' AND TABLE_SCHEMA=?`,
  [database]
);

if (cnt1 > 0 && cnt2 > 0) {
  console.log('  ✅ الأعمدة موجودة بالفعل — مفيش حاجة يتعمل.');
} else {
  if (cnt1 === 0) {
    await conn.query(`ALTER TABLE inventory_movements ADD COLUMN from_location VARCHAR(255) NULL`);
    console.log('  ✅ from_location اتضاف');
  }
  if (cnt2 === 0) {
    await conn.query(`ALTER TABLE inventory_movements ADD COLUMN to_location VARCHAR(255) NULL`);
    console.log('  ✅ to_location اتضاف');
  }
}

const [cols] = await conn.query(
  `SELECT COLUMN_NAME, COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='inventory_movements' AND TABLE_SCHEMA=? ORDER BY ORDINAL_POSITION`,
  [database]
);
console.log('\n  📋 أعمدة inventory_movements:');
cols.forEach(c => console.log(`    ${c.COLUMN_NAME} — ${c.COLUMN_TYPE}`));

await conn.end();
NODESCRIPT

MIGRATION_STATUS=$?
echo ""

if [ $MIGRATION_STATUS -ne 0 ]; then
  echo "❌ Migration فشل — شوف الـ error فوق"
  exit 1
fi

# ── Step 3: Build API Server ──────────────────────────────────────
echo "🔧 [3/4] Build API Server..."
cd "$ROOT/artifacts/api-server"
node build.mjs
echo "  ✅ API Server compiled!"
echo ""

# ── Step 4: Restart PM2 ───────────────────────────────────────────
echo "🔄 [4/4] Restart caprina-api..."
pm2 restart caprina-api --update-env
echo ""

echo "================================================================"
echo "  ✅ تم الإصلاح بنجاح!"
echo "  دلوقتي التحويل بين المواقع بيتحفظ صح."
echo "================================================================"
pm2 status
