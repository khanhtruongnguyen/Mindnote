@echo off
title Tao Shortcut Mindnote
cd /d "%~dp0"
echo ========================================================
echo        TAO SHORTCUT MINDNOTE NGOAI DESKTOP
echo ========================================================
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\create_shortcut.ps1"
echo.
pause
