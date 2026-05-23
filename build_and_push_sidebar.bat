@echo off
cd /d "C:\Users\musta\Desktop\pro\Caprina-Orders الاصداؤ الاخير_2\Caprina-Orders\artifacts\caprina"
call npm run build
cd /d "C:\Users\musta\Desktop\pro\Caprina-Orders الاصداؤ الاخير_2\Caprina-Orders"
git add -A
git commit -m "improve sidebar: bigger icons (42px), larger labels (13.5px), colored sub-items with glassmorphism"
git push origin main
echo Done!
