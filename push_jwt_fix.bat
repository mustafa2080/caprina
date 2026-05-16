@echo off
cd /d C:\Users\musta\Desktop\pro\CAPRIN~1\CAPRIN~1
node artifacts/api-server/build.mjs
git add artifacts/api-server/src/lib/auth.ts
git commit -m "fix: extend JWT expiry from 7d to 30d"
git push
echo Done!
pause
