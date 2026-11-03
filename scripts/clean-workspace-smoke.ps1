[CmdletBinding()]
param(
    [switch]$SkipE2E
)

$ErrorActionPreference = 'Stop'
$root = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$scratch = Join-Path $root 'scratch\clean-workspace-smoke'
$archive = Join-Path $root 'scratch\clean-workspace-smoke.zip'

function Invoke-Checked([string]$Command, [string[]]$Arguments, [string]$WorkingDirectory) {
    & $Command @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "$Command $($Arguments -join ' ') failed with exit code $LASTEXITCODE."
    }
}

if (Test-Path -LiteralPath $scratch) {
    Remove-Item -LiteralPath $scratch -Recurse -Force
}
New-Item -ItemType Directory -Path (Split-Path -Parent $scratch) -Force | Out-Null
if (Test-Path -LiteralPath $archive) {
    Remove-Item -LiteralPath $archive -Force
}

# Use the committed tree deliberately: this validates that installation does not
# depend on a developer's node_modules, out/, webview dist/, or untracked files.
Push-Location -LiteralPath $root
try {
    Invoke-Checked 'git' @('archive', '--format=zip', '--output', $archive, 'HEAD') $root
} finally {
    Pop-Location
}
Expand-Archive -LiteralPath $archive -DestinationPath $scratch -Force
Remove-Item -LiteralPath $archive -Force

Push-Location -LiteralPath $scratch
try {
    Invoke-Checked 'npm.cmd' @('ci') $scratch
    Invoke-Checked 'npm.cmd' @('--prefix', 'webview-ui', 'ci') $scratch
    Invoke-Checked 'npm.cmd' @('run', 'lint') $scratch
    Invoke-Checked 'npm.cmd' @('run', 'check') $scratch
    Invoke-Checked 'npm.cmd' @('run', 'package:vsix') $scratch
    Invoke-Checked 'npm.cmd' @('run', 'package:vsix:install-smoke') $scratch
    if (-not $SkipE2E) {
        Invoke-Checked 'npm.cmd' @('run', 'test:e2e:vsix') $scratch
    }
} finally {
    Pop-Location
}

Write-Host "Clean-workspace smoke passed: $scratch" -ForegroundColor Green
Write-Host 'Scope: isolated checkout and dependencies on this Windows host; this is not clean-OS/VM acceptance.' -ForegroundColor Yellow
