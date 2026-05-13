@echo off
cd /d "C:\Users\musta\Desktop\pro\Caprina-Orders الاصداؤ الاخير_2\Caprina-Orders\artifacts\api-server"
echo === Building API Server ===
node build.mjs
echo.
echo === TypeCheck ===
node_modules\.bin\tsc -p tsconfig.json --noEmit
echo === Done ===
