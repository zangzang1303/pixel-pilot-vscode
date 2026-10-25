[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$pidFile = Join-Path $projectRoot '.pixelpilot_runtime\mock-invokeai.pid'

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
    Stop-Process -Id $process.Id
    Write-Host "Stopped mock InvokeAI (PID $savedPid)." -ForegroundColor Green
} else {
    Write-Host 'Mock InvokeAI is no longer running.' -ForegroundColor Yellow
}
Remove-Item -LiteralPath $pidFile -Force
