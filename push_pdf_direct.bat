@echo off
cd /d "C:\Users\musta\Desktop\pro\Caprina-Orders الاصداؤ الاخير_2\Caprina-Orders"
git add artifacts/caprina/src/pages/finance-sales.tsx
git commit -m "fix: export PDF directly without preview window using hidden iframe"
git push
pause
