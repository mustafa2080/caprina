#!/bin/bash
# Direct migration using hardcoded credentials
mysql -h lavender-armadillo-743548.hostingersite.com \
      -P 3306 \
      -u u144001284_caprina \
      -pCapitan@123456 \
      u144001284_caprina <<'EOF'
ALTER TABLE inventory_movements
  ADD COLUMN from_location VARCHAR(255) NULL,
  ADD COLUMN to_location VARCHAR(255) NULL;
EOF

STATUS=$?
if [ $STATUS -eq 0 ]; then
  echo "✅ Columns added successfully!"
elif echo "$?" | grep -q "Duplicate column"; then
  echo "✅ Columns already exist — nothing to do."
else
  # Check if columns already exist (MySQL error 1060 = duplicate column)
  mysql -h lavender-armadillo-743548.hostingersite.com \
        -P 3306 \
        -u u144001284_caprina \
        -pCapitan@123456 \
        u144001284_caprina -e "DESCRIBE inventory_movements;" | grep -E "from_location|to_location"
  if [ $? -eq 0 ]; then
    echo "✅ Columns already exist!"
  else
    echo "❌ Migration failed with status $STATUS"
  fi
fi

echo ""
echo "Current table structure:"
mysql -h lavender-armadillo-743548.hostingersite.com \
      -P 3306 \
      -u u144001284_caprina \
      -pCapitan@123456 \
      u144001284_caprina -e "DESCRIBE inventory_movements;"
