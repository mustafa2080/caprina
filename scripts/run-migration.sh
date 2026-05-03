#!/bin/bash
# Migration: Add from_location and to_location to inventory_movements
# Run from /root/caprina: bash scripts/run-migration.sh

DB_HOST="lavender-armadillo-743548.hostingersite.com"
DB_PORT="3306"
DB_USER="u144001284_caprina"
DB_PASS="Capitan@123456"
DB_NAME="u144001284_caprina"

echo "🔄 Checking columns..."

# Check if columns already exist
HAS_FROM=$(mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" "-p$DB_PASS" "$DB_NAME" -sN -e "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='inventory_movements' AND COLUMN_NAME='from_location' AND TABLE_SCHEMA='$DB_NAME';" 2>/dev/null)

HAS_TO=$(mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" "-p$DB_PASS" "$DB_NAME" -sN -e "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='inventory_movements' AND COLUMN_NAME='to_location' AND TABLE_SCHEMA='$DB_NAME';" 2>/dev/null)

echo "from_location exists: $HAS_FROM"
echo "to_location exists: $HAS_TO"

if [ "$HAS_FROM" = "1" ] && [ "$HAS_TO" = "1" ]; then
  echo "✅ Columns already exist — nothing to do!"
else
  echo "➕ Adding missing columns..."
  
  if [ "$HAS_FROM" != "1" ]; then
    mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" "-p$DB_PASS" "$DB_NAME" -e "ALTER TABLE inventory_movements ADD COLUMN from_location VARCHAR(255) NULL;" 2>&1
    echo "Added from_location"
  fi

  if [ "$HAS_TO" != "1" ]; then
    mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" "-p$DB_PASS" "$DB_NAME" -e "ALTER TABLE inventory_movements ADD COLUMN to_location VARCHAR(255) NULL;" 2>&1
    echo "Added to_location"
  fi

  echo "✅ Migration done!"
fi

echo ""
echo "📋 Current columns in inventory_movements:"
mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" "-p$DB_PASS" "$DB_NAME" -e "SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='inventory_movements' AND TABLE_SCHEMA='$DB_NAME' ORDER BY ORDINAL_POSITION;" 2>/dev/null
