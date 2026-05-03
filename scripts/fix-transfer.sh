#!/bin/bash
# ─── Caprina Fix Transfer Columns + Rebuild API ──────────────────────────────
# الاستخدام من أي مكان: bash /root/caprina/scripts/fix-transfer.sh
# ─────────────────────────────────────────────────────────────────────────────

ROOT="/root/caprina"
DB_HOST="lavender-armadillo-743548.hostingersite.com"
DB_PORT="3306"
DB_USER="u144001284_caprina"
DB_PASS="Capitan@123456"
DB_NAME="u144001284_caprina"

echo "================================================================"
echo "  Caprina — Fix Transfer (from_location / to_location)"
echo "================================================================"
echo ""

# ── Step 1: Git pull ──────────────────────────────────────────────
echo "🔄 [1/4] git pull..."
cd "$ROOT"
git pull
echo ""

# ── Step 2: Migration ─────────────────────────────────────────────
echo "🗄️  [2/4] DB Migration — إضافة الأعمدة..."

HAS_FROM=$(mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" "-p${DB_PASS}" "$DB_NAME" -sN -e \
  "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='inventory_movements' AND COLUMN_NAME='from_location' AND TABLE_SCHEMA='${DB_NAME}';" 2>/dev/null)

HAS_TO=$(mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" "-p${DB_PASS}" "$DB_NAME" -sN -e \
  "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='inventory_movements' AND COLUMN_NAME='to_location' AND TABLE_SCHEMA='${DB_NAME}';" 2>/dev/null)

if [ "$HAS_FROM" = "1" ] && [ "$HAS_TO" = "1" ]; then
  echo "  ✅ الأعمدة موجودة بالفعل — مفيش حاجة يتعمل."
else
  echo "  ➕ إضافة الأعمدة الناقصة..."
  [ "$HAS_FROM" != "1" ] && \
    mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" "-p${DB_PASS}" "$DB_NAME" \
      -e "ALTER TABLE inventory_movements ADD COLUMN from_location VARCHAR(255) NULL;" 2>&1 && \
    echo "  ✅ from_location اتضاف"

  [ "$HAS_TO" != "1" ] && \
    mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" "-p${DB_PASS}" "$DB_NAME" \
      -e "ALTER TABLE inventory_movements ADD COLUMN to_location VARCHAR(255) NULL;" 2>&1 && \
    echo "  ✅ to_location اتضاف"
fi

echo ""
echo "  📋 هيكل الجدول الحالي:"
mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" "-p${DB_PASS}" "$DB_NAME" \
  -e "SELECT COLUMN_NAME, COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='inventory_movements' AND TABLE_SCHEMA='${DB_NAME}' ORDER BY ORDINAL_POSITION;" 2>/dev/null
echo ""

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
