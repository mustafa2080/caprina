@echo off
cd /d "C:\Users\musta\Desktop\pro\Caprina-Orders الاصداؤ الاخير_2\Caprina-Orders\artifacts\api-server"
echo === Building API Server ===
node build.mjs
echo Build done.
cd /d "C:\Users\musta\Desktop\pro\Caprina-Orders الاصداؤ الاخير_2\Caprina-Orders"
echo === Git Add & Commit ===
git add -A
git commit -m "feat: add sale orders module (B2B) with warehouse + invoice links"
echo === Git Push ===
git push
echo === Done ===
pause
