$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$runtimeDir = Join-Path $projectRoot '.pixelpilot_runtime'
$pythonCandidates = if ($env:PIXEL_PILOT_PYTHON) {
    @($env:PIXEL_PILOT_PYTHON)
} else {
    @('C:\AI\ComfyUI\.venv\Scripts\python.exe', 'D:\ComfyUI_windows_portable\python_embeded\python.exe')
}
$python = $pythonCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (-not $python) { throw 'ComfyUI Python was not found. Set PIXEL_PILOT_PYTHON to the correct python.exe.' }
New-Item -ItemType Directory -Path $runtimeDir -Force | Out-Null

if (-not (Test-Path -LiteralPath (Join-Path $runtimeDir 'onnxruntime\__init__.py'))) {
    $pipPython = $python
    $pathPython = (Get-Command python.exe -ErrorAction SilentlyContinue).Source
    if ($pathPython) {
        $runtimeAbi = & $python -c 'import sys; print(sys.version_info.major, sys.version_info.minor)'
        if ($LASTEXITCODE -ne 0) { throw 'Could not query the ComfyUI Python ABI.' }
        $pathAbi = & $pathPython -c 'import sys; print(sys.version_info.major, sys.version_info.minor)'
        if ($LASTEXITCODE -ne 0) { throw 'Could not query the system Python ABI.' }
        if ($runtimeAbi -eq $pathAbi) { $pipPython = $pathPython }
    }
    & $pipPython -m pip install --no-deps --target $runtimeDir 'onnxruntime==1.23.2'
    if ($LASTEXITCODE -ne 0) { throw 'Could not install onnxruntime.' }
}

$previousPythonPath = $env:PYTHONPATH
try {
    $env:PYTHONPATH = $runtimeDir
    $installedVersion = & $python -c 'import onnxruntime; print(onnxruntime.__version__)'
    if ($LASTEXITCODE -ne 0) { throw 'ComfyUI Python could not import the pinned onnxruntime package.' }
    if ($installedVersion -ne '1.23.2') { throw "Expected onnxruntime 1.23.2, got $installedVersion" }
} finally {
    $env:PYTHONPATH = $previousPythonPath
}

$modelPath = Join-Path $runtimeDir 'selfie_multiclass.onnx'
$expectedHash = '35EC1ECD9EE7F85073C99C00020B7F6751B69506EEACF683BC8665F6117F85B0'
if (-not (Test-Path -LiteralPath $modelPath)) {
    Invoke-WebRequest -Uri 'https://huggingface.co/senty-au/selfie_multiclass_256x256-ONNX/resolve/main/onnx/model.onnx' -OutFile $modelPath
}
$actualHash = (Get-FileHash -LiteralPath $modelPath -Algorithm SHA256).Hash
if ($actualHash -ne $expectedHash) { throw "Recolor model SHA-256 does not match the pinned hash: $actualHash" }
Write-Host "ONNX mask is ready: $modelPath"
Write-Host 'Full recolor also requires ComfyUI RemoveBackground and a foreground model. Verify with provider:smoke:local.'
