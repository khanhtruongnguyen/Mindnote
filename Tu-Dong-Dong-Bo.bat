@echo off
chcp 65001 >nul
title Tu Dong Dong Bo GitHub - Mindnote
cd /d "%~dp0"

echo ======================================================
echo    TỰ ĐỘNG THEO DÕI VÀ ĐỒNG BỘ LÊN GITHUB (MINDNOTE)
echo    (Bạn có thể thu nhỏ cửa sổ này xuống taskbar)
echo ======================================================
echo Dang theo doi cac file trong thu muc moi 30 giay...
echo Nhan Ctrl + C neu muon dung lai.
echo.

:loop
git status --porcelain > "%temp%\git_status.tmp" 2>nul
for %%R in ("%temp%\git_status.tmp") do if not %%~zR==0 (
    echo [%time:~0,8%] Phat hien thay doi! Dang day code len GitHub...
    git add -A
    git commit -m "Auto sync: %date% %time:~0,8%"
    git push origin main
    echo [%time:~0,8%] Hoan tat dong bo len GitHub!
    echo.
)
del "%temp%\git_status.tmp" 2>nul
timeout /t 30 >nul
goto loop
