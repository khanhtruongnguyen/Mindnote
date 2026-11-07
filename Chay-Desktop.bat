@echo off
title Mindnote Desktop
echo ========================================================
echo        MINDNOTE DESKTOP - LOCAL SSD EDITION
echo   Luu tru tren SSD tai: Documents\MindnoteVault
echo ========================================================
echo.

cd /d "%~dp0"

if not exist "node_modules\electron\dist\electron.exe" (
    echo [*] Dang cai dat thu vien can thiet...
    call npm.cmd install
)

if not exist "dist\index.html" (
    echo [*] Dang dong goi giao dien...
    call npm.cmd run build
)

echo [*] Dang khoi dong Mindnote Desktop...

if exist "node_modules\electron\dist\electron.exe" (
    start "" "node_modules\electron\dist\electron.exe" .
    exit /b 0
)

call npm.cmd run desktop
pause
