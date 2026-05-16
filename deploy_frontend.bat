@echo off
cd /d C:\Users\musta\Desktop\pro\CAPRIN~1\CAPRIN~1

echo Building frontend...
cd artifacts\caprina
call npx vite build --outDir ../../dist/caprina 2>nul
cd ..\..

echo Adding and committing...
git add artifacts/caprina/src/pages/shipping-manifest.tsx
git commit -m "fix: use s.total instead of displayGroups.length in print stats"
git push

echo.
echo === Deploy to server ===
ssh root@76.13.133.112 "cd /root/caprina && git pull"

echo Done!
pause
