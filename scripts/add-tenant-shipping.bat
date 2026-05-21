@echo off
echo Running shipping_companies tenant migration...

mysql -h lavender-armadillo-743548.hostingersite.com -P 3306 -u u144001284_caprina -pCapitan@123456 u144001284_caprina -e "ALTER TABLE shipping_companies ADD COLUMN IF NOT EXISTS tenant_id INT NULL AFTER id; SELECT COLUMN_NAME, COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='shipping_companies' AND TABLE_SCHEMA='u144001284_caprina';"

echo Done!
pause
