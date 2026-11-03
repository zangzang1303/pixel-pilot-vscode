$ErrorActionPreference = 'Stop'
[Environment]::SetEnvironmentVariable('ELECTRON_RUN_AS_NODE', $null, 'Process')
Remove-Item env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$profileRoot = Join-Path $projectRoot '.pixelpilot_runtime\cdp-profile'
$userData = Join-Path $profileRoot 'user-data'
$extDir = Join-Path $profileRoot 'extensions'
New-Item -ItemType Directory -Path $userData, $extDir -Force | Out-Null

$codePath = 'C:\Users\letua\AppData\Local\Programs\Microsoft VS Code\Code.exe'
$args = @(
    '--remote-debugging-port=9333',
    "--user-data-dir=$userData",
    "--extensions-dir=$extDir",
    "--extensionDevelopmentPath=$projectRoot",
    '--disable-workspace-trust',
    '--disable-extensions',
    '--skip-welcome',
    '--skip-release-notes',
    $projectRoot
)

Write-Host "Launching Code with CDP port 9333..."
$proc = Start-Process -FilePath $codePath -ArgumentList $args -PassThru
Write-Host "PID: $($proc.Id)"
for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Seconds 1
    try {
        $res = Invoke-RestMethod -Uri 'http://127.0.0.1:9333/json' -TimeoutSec 2 -ErrorAction Stop
        if ($res) {
            Write-Host "CDP ready on port 9333!"
            exit 0
        }
    } catch {}
}
Write-Error "Failed to connect to CDP port 9333."
exit 1

