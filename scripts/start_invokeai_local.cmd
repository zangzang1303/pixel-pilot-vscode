@echo off
setlocal

set "INVOKE_ROOT=C:\AI\InvokeAI"
if defined PIXELPILOT_INVOKEAI_HOME set "INVOKE_ROOT=%PIXELPILOT_INVOKEAI_HOME%"

if not exist "%INVOKE_ROOT%\.venv\Scripts\invokeai-web.exe" (
  echo InvokeAI was not found at "%INVOKE_ROOT%".
  exit /b 1
)

"%INVOKE_ROOT%\.venv\Scripts\invokeai-web.exe" --root "%INVOKE_ROOT%"
endlocal
