@echo off
chcp 65001 >nul
cd /d "C:\Users\musta\Desktop\pro\Caprina-Orders الاصداؤ الاخير_2\Caprina-Orders"
git add artifacts/api-server/src/routes/finance-hub.ts
git add artifacts/api-server/src/routes/finance-suppliers.ts
git add artifacts/caprina/src/pages/finance-cash.tsx
git commit -m "fix: finance module - supplier delete safety, hub chart profit accuracy, cash register form reset"
git push
echo === Done ===
pause
