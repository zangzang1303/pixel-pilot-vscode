[CmdletBinding()]
param(
  [string]$VsixPath,
  [string]$SmokeDirectory
)

$ErrorActionPreference = 'Stop'
$root = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
if ([string]::IsNullOrWhiteSpace($VsixPath)) {
  $VsixPath = Join-Path $root 'dist\pixel-pilot-vscode-1.1.0.vsix'
}
if ([string]::IsNullOrWhiteSpace($SmokeDirectory)) {
  $SmokeDirectory = Join-Path $root 'scratch\vsix-smoke'
}
$VsixPath = [System.IO.Path]::GetFullPath($VsixPath)
$SmokeDirectory = [System.IO.Path]::GetFullPath($SmokeDirectory)
if (-not (Test-Path -LiteralPath $VsixPath)) {
  throw "VSIX not found: $VsixPath. Run npm run package:vsix first."
}
if (-not (Get-Command code -ErrorAction SilentlyContinue)) {
  throw 'VS Code CLI (code) is required for this isolated install smoke test.'
}

$userData = Join-Path $SmokeDirectory 'user-data'
$extensions = Join-Path $SmokeDirectory 'extensions'
New-Item -ItemType Directory -Force -Path $userData, $extensions | Out-Null

& code --user-data-dir $userData --extensions-dir $extensions --install-extension $VsixPath --force
if ($LASTEXITCODE -ne 0) {
  throw "VS Code CLI could not install $VsixPath"
}

$expectedExtension = 'pixel-pilot-team.pixel-pilot-vscode'
$installed = & code --user-data-dir $userData --extensions-dir $extensions --list-extensions
if ($LASTEXITCODE -ne 0 -or -not ($installed -contains $expectedExtension)) {
  throw "VSIX install smoke failed: $expectedExtension is not listed in the isolated extensions directory."
}

$installedExtension = Get-ChildItem -LiteralPath $extensions -Directory |
  Where-Object { $_.Name -like "$expectedExtension-*" } |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1
if ($null -eq $installedExtension) {
  throw "VSIX install smoke failed: unable to locate installed files for $expectedExtension."
}
& node (Join-Path $root 'scripts\verify-installed-vsix.cjs') $installedExtension.FullName
if ($LASTEXITCODE -ne 0) {
  throw 'VSIX install smoke failed: bundled Sharp runtime is not usable.'
}

Write-Output "Isolated VSIX install and Sharp runtime smoke passed: $expectedExtension"
