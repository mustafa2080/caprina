#!/bin/bash
# Migration: Add from_location and to_location columns to inventory_movements
# Run this on the server: bash scripts/run-migration.sh

DB_URL="${DATABASE_URL}"

if [ -z "$DB_URL" ]; then
  # Try to load from .env
  if [ -f /root/caprina/.env ]; then
    export $(grep -v '^#' /root/caprina/.env | xargs)
    DB_URL="${DATABASE_URL}"
  fi
fi

if [ -z "$DB_URL" ]; then
  echo "ERROR: DATABASE_URL not set"
  exit 1
fi

# Extract host, user, password, dbname from DATABASE_URL
# Format: mysql://user:pass@host:port/dbname
MYSQL_USER=$(echo $DB_URL | sed 's|mysql://||' | cut -d: -f1)
MYSQL_PASS=$(echo $DB_URL | sed 's|mysql://[^:]*:||' | cut -d@ -f1)
MYSQL_HOST=$(echo $DB_URL | sed 's|mysql://[^@]*@||' | cut -d: -f1)
MYSQL_PORT=$(echo $DB_URL | sed 's|mysql://[^@]*@[^:]*:||' | cut -d/ -f1)
MYSQL_DB=$(echo $DB_URL | sed 's|.*/||' | cut -d? -f1)

echo "Adding from_location and to_location columns..."

mysql -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" -p"$MYSQL_PASS" "$MYSQL_DB" <<EOF
ALTER TABLE inventory_movements
  ADD COLUMN IF NOT EXISTS from_location VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS to_location VARCHAR(255) NULL;
EOF

if [ $? -eq 0 ]; then
  echo "✅ Migration done!"
else
  # Try without IF NOT EXISTS (older MySQL)
  mysql -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" -p"$MYSQL_PASS" "$MYSQL_DB" <<EOF2
ALTER TABLE inventory_movements ADD COLUMN from_location VARCHAR(255) NULL;
ALTER TABLE inventory_movements ADD COLUMN to_location VARCHAR(255) NULL;
EOF2
  echo "✅ Migration done (fallback method)!"
fi
