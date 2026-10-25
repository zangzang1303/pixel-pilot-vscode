@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start_pixel_pilot.ps1"
if errorlevel 1 (
  echo.
  echo Pixel Pilot could not start. Review the error above.
  pause
)
endlocal
