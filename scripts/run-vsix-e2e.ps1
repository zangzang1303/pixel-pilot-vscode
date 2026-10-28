[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$root = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$manifest = Get-Content -LiteralPath (Join-Path $root 'package.json') -Raw | ConvertFrom-Json
$extensionId = "$($manifest.publisher).$($manifest.name)"
$installedRoot = Join-Path $root ("scratch\vsix-smoke\extensions\{0}-{1}" -f $extensionId, $manifest.version)

& npm.cmd run package:vsix
if ($LASTEXITCODE -ne 0) { throw 'VSIX build failed before packaged E2E.' }
& npm.cmd run package:vsix:install-smoke
if ($LASTEXITCODE -ne 0) { throw 'VSIX install smoke failed before packaged E2E.' }
if (-not (Test-Path -LiteralPath (Join-Path $installedRoot 'package.json'))) {
  throw "Installed extension not found: $installedRoot"
}

$previousRoot = $env:PIXEL_PILOT_E2E_EXTENSION_ROOT
try {
  $env:PIXEL_PILOT_E2E_EXTENSION_ROOT = $installedRoot
  & node (Join-Path $root 'scripts\run-vscode-e2e.cjs')
  if ($LASTEXITCODE -ne 0) { throw 'Packaged VSIX Extension Host E2E failed.' }
} finally {
  if ($null -eq $previousRoot) {
    Remove-Item Env:PIXEL_PILOT_E2E_EXTENSION_ROOT -ErrorAction SilentlyContinue
  } else {
    $env:PIXEL_PILOT_E2E_EXTENSION_ROOT = $previousRoot
  }
}
