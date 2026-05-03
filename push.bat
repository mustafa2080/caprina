@echo off
cd /d "C:\Users\musta\Desktop\pro\Caprina-Orders الاصداؤ الاخير_2\Caprina-Orders"
echo === git diff stat ===
git diff --stat
echo.
echo === check shipping-manifest specifically ===
git diff --name-only
echo.
echo === last commit ===
git log --oneline -3
pause
