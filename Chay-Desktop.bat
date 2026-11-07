@echo off
chcp 65001 >nul
title Mindnote Desktop - Không Gian Ghi Chú Vô Tận
echo ========================================================
echo        MINDNOTE DESKTOP (LOCAL SSD EDITION)
echo   Chạy offline siêu tốc - Lưu trữ tại Documents\MindnoteVault
echo ========================================================
echo.

cd /d "%~dp0"

if not exist "dist\index.html" (
    echo [*] Dang dong goi ban Desktop lan dau (Vite build)...
    call npm.cmd run build
    if errorlevel 1 (
        echo [!] Loi trong qua trinh dong goi! Vui long kiem tra.
        pause
        exit /b 1
    )
    echo [*] Dong goi hoan tat!
    echo.
)

echo [*] Dang khoi dong ung dung Mindnote Desktop...
call npx.cmd electron .
