@echo off
chcp 65001 >nul
title Day Nhanh 1-Click - Mindnote
cd /d "%~dp0"

echo Dang kiem tra thay doi...
git status --porcelain > "%temp%\git_status.tmp"
for %%R in ("%temp%\git_status.tmp") do if %%~zR==0 (
    echo [THONG BAO] Khong co file nao thay doi.
    del "%temp%\git_status.tmp"
    timeout /t 2 >nul
    exit /b 0
)
del "%temp%\git_status.tmp"

set "NGAY=%date%"
set "GIO=%time:~0,8%"

echo Dang day toan bo code len GitHub...
git add -A
git commit -m "Auto sync: %NGAY% %GIO%"
git push origin main

if %errorlevel% equ 0 (
    echo [THANH CONG] Da day code len GitHub!
) else (
    echo [LOI] Co loi xay ra khi day code.
    pause
)
timeout /t 3 >nul
