#!/bin/bash
# Migration: Add tenant_id to audit_logs table
# Run from /root/caprina: bash scripts/add-tenant-id-to-audit-logs.sh

DB_HOST="lavender-armadillo-743548.hostingersite.com"
DB_PORT="3306"
DB_USER="u144001284_caprina"
DB_PASS="Capitan@123456"
DB_NAME="u144001284_caprina"

echo "🔄 Checking audit_logs.tenant_id column..."

HAS_COL=$(mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" "-p$DB_PASS" "$DB_NAME" -sN -e \
  "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS \
   WHERE TABLE_NAME='audit_logs' AND COLUMN_NAME='tenant_id' AND TABLE_SCHEMA='$DB_NAME';" 2>/dev/null)

echo "tenant_id exists: $HAS_COL"

if [ "$HAS_COL" = "1" ]; then
  echo "✅ Column already exists — nothing to do!"
else
  echo "➕ Adding tenant_id column to audit_logs..."

  mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" "-p$DB_PASS" "$DB_NAME" -e \
    "ALTER TABLE audit_logs ADD COLUMN tenant_id INT DEFAULT NULL AFTER id;" 2>&1

  mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" "-p$DB_PASS" "$DB_NAME" -e \
    "ALTER TABLE audit_logs ADD INDEX idx_audit_logs_tenant_id (tenant_id);" 2>&1

  echo "✅ Migration done!"
fi

echo ""
echo "📋 Current columns in audit_logs:"
mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" "-p$DB_PASS" "$DB_NAME" -e \
  "SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS \
   WHERE TABLE_NAME='audit_logs' AND TABLE_SCHEMA='$DB_NAME' ORDER BY ORDINAL_POSITION;" 2>/dev/null
