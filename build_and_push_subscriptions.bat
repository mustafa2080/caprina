@echo off
cd /d "C:\Users\musta\Desktop\pro\Caprina-Orders الاصداؤ الاخير_2\Caprina-Orders"

echo === [1/4] Building API Server ===
cd artifacts\api-server
node build.mjs
if %errorlevel% neq 0 ( echo API BUILD FAILED && pause && exit /b 1 )
echo API Build OK

echo === [2/4] Building Frontend ===
cd ..\caprina
call pnpm build
if %errorlevel% neq 0 ( echo FRONTEND BUILD FAILED && pause && exit /b 1 )
echo Frontend Build OK

echo === [3/4] Git Add and Commit ===
cd ..\..
git add -A
git commit -m "feat: auto-create admin user when creating tenant subscription"

echo === [4/4] Git Push ===
git push origin main

echo.
echo =====================================================
echo DONE! Now run this on the server:
echo cd /root/caprina ^&^& git fetch origin ^&^& git reset --hard origin/main ^&^& node artifacts/api-server/build.mjs ^&^& pm2 restart caprina-api ^&^& cp -r artifacts/caprina/dist/public/* /var/www/caprina-os/ ^&^& echo "DONE"
echo =====================================================
pause
