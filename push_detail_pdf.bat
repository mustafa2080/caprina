@echo off
cd /d "C:\Users\musta\Desktop\pro\Caprina-Orders الاصداؤ الاخير_2\Caprina-Orders"
git add artifacts/caprina/src/pages/finance-sale-detail.tsx
git commit -m "fix: export PDF in sale detail uses hidden iframe - no preview window"
git push
pause
