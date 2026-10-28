@echo off
setlocal

if exist "D:\Start_ComfyUI_PixelPilot.bat" (
  call "D:\Start_ComfyUI_PixelPilot.bat"
  exit /b 0
)

if exist "D:\ComfyUI_windows_portable\python_embeded\python.exe" (
  cd /d "D:\ComfyUI_windows_portable"
  "D:\ComfyUI_windows_portable\python_embeded\python.exe" -s ComfyUI\main.py --listen 127.0.0.1 --port 8188 --lowvram --preview-method auto
  exit /b 0
)

set "COMFY_ROOT=C:\AI\ComfyUI"
if defined PIXELPILOT_COMFYUI_HOME set "COMFY_ROOT=%PIXELPILOT_COMFYUI_HOME%"

if not exist "%COMFY_ROOT%\.venv\Scripts\python.exe" (
  echo ComfyUI Python environment was not found at "%COMFY_ROOT%".
  exit /b 1
)

cd /d "%COMFY_ROOT%"
"%COMFY_ROOT%\.venv\Scripts\python.exe" main.py --listen 127.0.0.1 --port 8188 --lowvram --preview-method auto
endlocal
