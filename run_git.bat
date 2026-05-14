@echo off
chcp 65001 >nul
node "%~dp0do_git.js"
echo.
echo === Done ===
pause
