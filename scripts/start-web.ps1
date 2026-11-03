[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$runtime = Join-Path $projectRoot '.pixelpilot_runtime'
$url = 'http://127.0.0.1:4173/api/health'

& npm.cmd run build
if ($LASTEXITCODE -ne 0) { throw 'Web build failed.' }

try {
  $health = Invoke-RestMethod -Uri $url -TimeoutSec 2
  if ($health.ok) {
    Write-Host 'Pixel Pilot Web is already running at http://127.0.0.1:4173/'
    exit 0
  }
} catch { }

New-Item -ItemType Directory -Path $runtime -Force | Out-Null
$process = Start-Process -FilePath 'node.exe' -ArgumentList 'scripts/web-app.cjs' `
  -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru `
  -RedirectStandardOutput (Join-Path $runtime 'web.stdout.log') `
  -RedirectStandardError (Join-Path $runtime 'web.stderr.log')
Set-Content -LiteralPath (Join-Path $runtime 'web.pid') -Value $process.Id -Encoding ascii

for ($attempt = 0; $attempt -lt 30; $attempt++) {
  try {
    $health = Invoke-RestMethod -Uri $url -TimeoutSec 2
    if ($health.ok) {
      Write-Host 'Pixel Pilot Web ready: http://127.0.0.1:4173/'
      Write-Host "ComfyUI online: $($health.comfyOnline)"
      exit 0
    }
  } catch { }
  Start-Sleep -Milliseconds 250
}
throw "Web server did not start. See $runtime\web.stderr.log"
