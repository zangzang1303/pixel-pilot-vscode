$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$runtimeDir = Join-Path $projectRoot '.pixelpilot_runtime'
$python = if ($env:PIXEL_PILOT_PYTHON) { $env:PIXEL_PILOT_PYTHON } else { 'D:\ComfyUI_windows_portable\python_embeded\python.exe' }
if (-not (Test-Path -LiteralPath $python)) { throw "Không tìm thấy Python ComfyUI: $python. Đặt PIXEL_PILOT_PYTHON tới python.exe phù hợp." }
New-Item -ItemType Directory -Path $runtimeDir -Force | Out-Null

if (-not (Test-Path -LiteralPath (Join-Path $runtimeDir 'onnxruntime\__init__.py'))) {
    & $python -m pip install --no-deps --target $runtimeDir 'onnxruntime==1.23.2'
    if ($LASTEXITCODE -ne 0) { throw 'Không cài được onnxruntime.' }
}

$modelPath = Join-Path $runtimeDir 'selfie_multiclass.onnx'
$expectedHash = '35EC1ECD9EE7F85073C99C00020B7F6751B69506EEACF683BC8665F6117F85B0'
if (-not (Test-Path -LiteralPath $modelPath)) {
    Invoke-WebRequest -Uri 'https://huggingface.co/senty-au/selfie_multiclass_256x256-ONNX/resolve/main/onnx/model.onnx' -OutFile $modelPath
}
$actualHash = (Get-FileHash -LiteralPath $modelPath -Algorithm SHA256).Hash
if ($actualHash -ne $expectedHash) { throw "Mã SHA-256 của mô hình không khớp: $actualHash" }
Write-Host "Đã sẵn sàng đổi màu chọn lọc: $modelPath"
