@echo off
echo ========================================
echo   Deploy: Fix Excel Import Empty Rows
echo ========================================
echo.

ssh root@76.13.133.112 "cd /root/caprina && git pull && echo '=== git pull done ===' && cd artifacts/api-server && node ./build.mjs && echo '=== build done ===' && pm2 restart caprina-api && echo '=== pm2 restarted ===' && pm2 status"

echo.
echo ========================================
echo   Done! Check caprina-os.com/import
echo ========================================
pause
