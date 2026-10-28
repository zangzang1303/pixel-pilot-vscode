[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$pidFile = Join-Path $projectRoot '.pixelpilot_runtime\mock-invokeai.pid'
$mockScript = Join-Path $projectRoot 'scripts\mock_invokeai.mjs'

if (-not (Test-Path -LiteralPath $pidFile)) {
    Write-Host 'No Pixel Pilot managed mock server was found.' -ForegroundColor Yellow
    exit 0
}

$savedPid = (Get-Content -LiteralPath $pidFile -Raw).Trim()
if ($savedPid -notmatch '^\d+$') {
    Remove-Item -LiteralPath $pidFile -Force
    throw 'Invalid PID file removed. No process was stopped.'
}

$process = Get-Process -Id ([int]$savedPid) -ErrorAction SilentlyContinue
if ($process -and $process.ProcessName -eq 'node') {
    $processInfo = Get-CimInstance Win32_Process -Filter "ProcessId = $savedPid" -ErrorAction SilentlyContinue
    if (-not $processInfo -or $processInfo.CommandLine -notlike "*$mockScript*") {
        throw "PID $savedPid does not belong to this project's mock InvokeAI process. No process was stopped."
    }
    $verifiedProcess = [System.Diagnostics.Process]::GetProcessById([int]$savedPid)
    $verifiedProcess.Kill()
    $verifiedProcess.WaitForExit(5000) | Out-Null
    Write-Host "Stopped mock InvokeAI (PID $savedPid)." -ForegroundColor Green
} else {
    Write-Host 'Mock InvokeAI is no longer running.' -ForegroundColor Yellow
}
Remove-Item -LiteralPath $pidFile -Force
