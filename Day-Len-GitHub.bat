@echo off
chcp 65001 >nul
title Day Code Len GitHub - Mindnote
cd /d "%~dp0"

echo ======================================================
echo          DỰ ÁN: MINDNOTE - ĐẨY CODE LÊN GITHUB
echo ======================================================
echo.

:: Kiểm tra xem có thay đổi nào không
git status --porcelain > "%temp%\git_status.tmp"
for %%R in ("%temp%\git_status.tmp") do if %%~zR==0 (
    echo [THONG BAO] Khong co file nao thay doi can day len.
    del "%temp%\git_status.tmp"
    echo.
    echo Bam phim bat ky de thoat...
    pause >nul
    exit /b 0
)
del "%temp%\git_status.tmp"

:: Lấy thời gian hiện tại
set "NGAY=%date%"
set "GIO=%time:~0,8%"
set "DEFAULT_MSG=Cap nhat code: %NGAY% %GIO%"

echo Co file thay doi!
echo.
set /p "USER_MSG=Nhap ghi chu commit (Bam Enter de dung: '%DEFAULT_MSG%'): "

if "%USER_MSG%"=="" (
    set "COMMIT_MSG=%DEFAULT_MSG%"
) else (
    set "COMMIT_MSG=%USER_MSG%"
)

echo.
echo ------------------------------------------------------
echo Dang them file (git add)...
git add -A

echo Dang luu commit: "%COMMIT_MSG%"...
git commit -m "%COMMIT_MSG%"

echo.
echo Dang day len GitHub (git push origin main)...
git push origin main

if %errorlevel% equ 0 (
    echo.
    echo ======================================================
    echo  [THANH CONG] Code da duoc day len GitHub thanh cong!
    echo  Repo: https://github.com/khanhtruongnguyen/Mindnote
    echo ======================================================
) else (
    echo.
    echo ======================================================
    echo  [LOI] Day code that bai! Vui long kiem tra ket noi mang.
    echo ======================================================
)

echo.
echo Cua so se tu dong dong sau 5 giay...
timeout /t 5 >nul
