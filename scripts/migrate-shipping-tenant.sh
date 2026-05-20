#!/bin/bash
# Migration: Add tenant_id to shipping_companies
# Run on server: bash /root/caprina/scripts/migrate-shipping-tenant.sh

DB_HOST="lavender-armadillo-743548.hostingersite.com"
DB_PORT="3306"
DB_USER="u144001284_caprina"
DB_PASS="Capitan@123456"
DB_NAME="u144001284_caprina"

echo "Checking shipping_companies.tenant_id..."

HAS_COL=$(mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" "-p$DB_PASS" "$DB_NAME" -sN -e \
  "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='shipping_companies' AND COLUMN_NAME='tenant_id' AND TABLE_SCHEMA='$DB_NAME';" 2>/dev/null)

if [ "$HAS_COL" = "1" ]; then
  echo "Column already exists - skipping ALTER"
else
  echo "Adding tenant_id column..."
  mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" "-p$DB_PASS" "$DB_NAME" -e \
    "ALTER TABLE shipping_companies ADD COLUMN tenant_id INT NULL AFTER id;" 2>&1
  echo "Done!"
fi

echo ""
echo "Current columns in shipping_companies:"
mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" "-p$DB_PASS" "$DB_NAME" -e \
  "SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='shipping_companies' AND TABLE_SCHEMA='$DB_NAME' ORDER BY ORDINAL_POSITION;" 2>/dev/null
