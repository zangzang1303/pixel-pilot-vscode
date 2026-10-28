[CmdletBinding()]
param(
  [string]$OutputDirectory
)

$ErrorActionPreference = 'Stop'

$root = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
if ([string]::IsNullOrWhiteSpace($OutputDirectory)) {
  $OutputDirectory = Join-Path $root 'dist'
}
$packageJsonPath = Join-Path $root 'package.json'
$packageJson = Get-Content -LiteralPath $packageJsonPath -Raw | ConvertFrom-Json
$stageRoot = Join-Path $root '.vsix-stage'
$extensionRoot = Join-Path $stageRoot 'extension'
$outputDirectory = [System.IO.Path]::GetFullPath($OutputDirectory)
$vsixPath = Join-Path $outputDirectory ("{0}-{1}.vsix" -f $packageJson.name, $packageJson.version)

function Copy-RequiredPath([string]$relativePath) {
  $source = Join-Path $root $relativePath
  if (-not (Test-Path -LiteralPath $source)) {
    throw "Required VSIX input is missing: $relativePath"
  }
  $destination = Join-Path $extensionRoot $relativePath
  $destinationParent = Split-Path -Parent $destination
  New-Item -ItemType Directory -Force -Path $destinationParent | Out-Null
  Copy-Item -LiteralPath $source -Destination $destination -Recurse -Force
}

if (Test-Path -LiteralPath $stageRoot) {
  Remove-Item -LiteralPath $stageRoot -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $extensionRoot, $outputDirectory | Out-Null

foreach ($path in @('out', 'webview-ui/dist', 'media', 'scripts', 'README.md', 'START_PIXEL_PILOT.cmd', 'package.json')) {
  Copy-RequiredPath $path
}

# Include exactly the production dependency tree. This is needed for Sharp's
# native binary and avoids shipping development tooling in the VSIX.
$productionPaths = & npm.cmd ls --omit=dev --all --parseable 2>$null
if ($LASTEXITCODE -ne 0) {
  throw 'Unable to resolve the production dependency tree with npm ls.'
}
foreach ($dependencyPath in $productionPaths | Select-Object -Skip 1) {
  $fullDependencyPath = [System.IO.Path]::GetFullPath($dependencyPath)
  $nodeModulesRoot = Join-Path $root 'node_modules'
  if (-not $fullDependencyPath.StartsWith($nodeModulesRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Dependency path is outside node_modules: $fullDependencyPath"
  }
  $relativeDependencyPath = $fullDependencyPath.Substring($root.Length).TrimStart('\', '/')
  Copy-RequiredPath $relativeDependencyPath
}

$vsixManifest = @"
<?xml version="1.0" encoding="utf-8"?>
<PackageManifest Version="2.0.0" xmlns="http://schemas.microsoft.com/developer/vsx-schema/2011">
  <Metadata>
    <Identity Id="$($packageJson.name)" Version="$($packageJson.version)" Publisher="$($packageJson.publisher)" />
    <DisplayName>$($packageJson.displayName)</DisplayName>
    <Description xml:space="preserve">$($packageJson.description)</Description>
  </Metadata>
  <Installation>
    <InstallationTarget Id="Microsoft.VisualStudio.Code" />
  </Installation>
  <Dependencies />
  <Assets>
    <Asset Type="Microsoft.VisualStudio.Code.Manifest" Path="extension/package.json" Addressable="true" />
  </Assets>
</PackageManifest>
"@
$contentTypes = @"
<?xml version="1.0" encoding="utf-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="json" ContentType="application/json" />
  <Default Extension="js" ContentType="application/javascript" />
  <Default Extension="map" ContentType="application/json" />
  <Default Extension="html" ContentType="text/html" />
  <Default Extension="css" ContentType="text/css" />
  <Default Extension="svg" ContentType="image/svg+xml" />
  <Default Extension="png" ContentType="image/png" />
  <Default Extension="node" ContentType="application/octet-stream" />
  <Default Extension="xml" ContentType="application/xml" />
  <Default Extension="md" ContentType="text/markdown" />
</Types>
"@
Set-Content -LiteralPath (Join-Path $stageRoot 'extension.vsixmanifest') -Value $vsixManifest -Encoding utf8
Set-Content -LiteralPath (Join-Path $stageRoot '[Content_Types].xml') -Value $contentTypes -Encoding utf8

if (Test-Path -LiteralPath $vsixPath) {
  Remove-Item -LiteralPath $vsixPath -Force
}
$zipPath = "$vsixPath.zip"
if (Test-Path -LiteralPath $zipPath) {
  Remove-Item -LiteralPath $zipPath -Force
}
Compress-Archive -Path (Join-Path $stageRoot '*') -DestinationPath $zipPath -CompressionLevel Optimal
Move-Item -LiteralPath $zipPath -Destination $vsixPath

$archive = [System.IO.Compression.ZipFile]::OpenRead($vsixPath)
try {
  $entryNames = $archive.Entries.FullName | ForEach-Object { $_ -replace '\\', '/' }
  foreach ($requiredEntry in @('[Content_Types].xml', 'extension.vsixmanifest', 'extension/package.json', 'extension/out/extension.js', 'extension/webview-ui/dist/index.html', 'extension/node_modules/sharp/package.json')) {
    if (-not ($entryNames -contains $requiredEntry)) {
      throw "VSIX validation failed; missing $requiredEntry"
    }
  }
} finally {
  $archive.Dispose()
}

Remove-Item -LiteralPath $stageRoot -Recurse -Force
Write-Output "Created and structurally verified VSIX: $vsixPath"
