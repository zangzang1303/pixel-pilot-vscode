@echo off
setlocal
cd /d "%~dp0"
title PIXEL PILOT - TRINH KHOI DONG DEMO HOI DONG / THAY HUONG DAN
echo ============================================================
echo   DANG KHOI DONG PIXEL PILOT DEMO LAUNCHER
echo ============================================================
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start_demo.ps1"
if errorlevel 1 (
  echo.
  echo [LOI] Khong the khoi dong demo. Vui long kiem tra thong bao tren.
  pause
)
endlocal
