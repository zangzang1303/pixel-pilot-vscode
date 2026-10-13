# scripts/setup_comfyui.ps1 - Automated Setup for ComfyUI Portable (NVIDIA GPU RTX 3050 Ti)
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "  PIXEL PILOT - CÀI ĐẶT COMFYUI LOCAL GPU (RTX 3050 Ti)" -ForegroundColor Yellow
Write-Host "  Toàn bộ công cụ AI: Tách nền, Upscale 4x, Inpaint Miễn Phí 100%" -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host ""

$installDir = "D:\ComfyUI_windows_portable"
$archivePath = "D:\ComfyUI_windows_portable_nvidia.7z"
$downloadUrl = "https://github.com/Comfy-Org/ComfyUI/releases/download/v0.39.0/ComfyUI_windows_portable_nvidia.7z"
$minSizeBytes = 1800000000 # ~1.8 GB

# 1. Kiểm tra phần cứng GPU
Write-Host "[1/5] Kiểm tra GPU NVIDIA..." -ForegroundColor Green
$gpu = Get-CimInstance Win32_VideoController | Where-Object { $_.Name -like "*NVIDIA*" } | Select-Object -First 1
if ($gpu) {
    $vramGb = [math]::Round($gpu.AdapterRAM / 1GB, 1)
    Write-Host "  -> Đã nhận diện: $($gpu.Name) ($vramGb GB VRAM)" -ForegroundColor Green
} else {
    Write-Host "  -> Không tìm thấy card NVIDIA. Hệ thống sẽ sử dụng CPU fallback." -ForegroundColor Yellow
}

# 2. Kiểm tra thư mục ComfyUI Portable
Write-Host ""
Write-Host "[2/5] Kiểm tra thư mục ComfyUI Portable..." -ForegroundColor Green
if (Test-Path "$installDir\run_nvidia_gpu.bat") {
    Write-Host "  -> ComfyUI Portable ĐÃ TỒN TẠI tại: $installDir" -ForegroundColor Green
} else {
    Write-Host "  -> Chưa có ComfyUI Portable tại: $installDir" -ForegroundColor Yellow

    # Kiểm tra xem file 7z đã được tải về trong D:\ hoặc Downloads chưa
    $downloadCandidate = @(
        $archivePath,
        "$env:USERPROFILE\Downloads\ComfyUI_windows_portable_nvidia.7z",
        "$env:USERPROFILE\Downloads\ComfyUI_windows_portable_nvidia_cu126.7z"
    ) | Where-Object { (Test-Path $_) -and ((Get-Item $_).Length -gt $minSizeBytes) } | Select-Object -First 1

    if ($downloadCandidate) {
        Write-Host "  -> Tìm thấy file nén đầy đủ có sẵn: $downloadCandidate" -ForegroundColor Green
        $archivePath = $downloadCandidate
    } else {
        $curSize = 0
        if (Test-Path $archivePath) {
            $curSize = (Get-Item $archivePath).Length
            $curMb = [math]::Round($curSize / 1MB, 1)
            Write-Host "  -> File hiện tại chưa đủ kích thước ($curMb MB / ~1910 MB). Đang tiếp tục tải (Resume)..." -ForegroundColor Yellow
        } else {
            Write-Host "  -> Đang tải ComfyUI Portable từ GitHub (~1.9GB)..." -ForegroundColor Cyan
        }
        Write-Host "  -> URL: $downloadUrl" -ForegroundColor Gray
        curl.exe -C - -L -o $archivePath $downloadUrl

        if ((Test-Path $archivePath) -and ((Get-Item $archivePath).Length -gt $minSizeBytes)) {
            Write-Host "  -> Tải hoàn tất: $archivePath" -ForegroundColor Green
        } else {
            Write-Host "  -> File tải về chưa hoàn tất. Bạn có thể dùng IDM/Trình duyệt để tải nhanh hơn:" -ForegroundColor Yellow
            Write-Host "     $downloadUrl" -ForegroundColor Cyan
            Write-Host "     Sau khi tải xong, hãy đặt vào: $archivePath rồi chạy lại script này." -ForegroundColor Gray
            Exit 1
        }
    }

    # Giải nén
    Write-Host "  -> Đang giải nén $archivePath vào D:\..." -ForegroundColor Cyan
    $winrar = "C:\Program Files\WinRAR\WinRAR.exe"
    if (Test-Path $winrar) {
        Write-Host "  -> Sử dụng WinRAR để giải nén an toàn..." -ForegroundColor Green
        & $winrar x -y -ibck $archivePath "D:\"
    } else {
        tar.exe -xf $archivePath -C "D:\"
    }
    Write-Host "  -> Giải nén thành công vào $installDir!" -ForegroundColor Green
}

# 3. Tải Model Upscale SOTA 4x-UltraSharp
Write-Host ""
Write-Host "[3/5] Cài đặt Model Upscale SOTA 4x-UltraSharp..." -ForegroundColor Green
$upscaleDir = "$installDir\ComfyUI\models\upscale_models"
if (!(Test-Path $upscaleDir)) {
    New-Item -ItemType Directory -Path $upscaleDir -Force | Out-Null
}

$ultraSharpModel = "$upscaleDir\4x-UltraSharp.pth"
if (!(Test-Path $ultraSharpModel)) {
    Write-Host "  -> Đang tải 4x-UltraSharp.pth (~67MB) cho tính năng Phóng to 2x/4x..." -ForegroundColor Cyan
    $modelUrl = "https://huggingface.co/lokcx/4x-Ultrasharp/resolve/main/4x-UltraSharp.pth"
    curl.exe -L -o $ultraSharpModel $modelUrl
    Write-Host "  -> Đã nạp model 4x-UltraSharp.pth thành công!" -ForegroundColor Green
} else {
    Write-Host "  -> Model 4x-UltraSharp.pth đã sẵn sàng!" -ForegroundColor Green
}

# 4. Liên kết với kho Model InvokeAI sẵn có trên D:\models
Write-Host ""
Write-Host "[4/5] Cấu hình chia sẻ kho model hiện có tại D:\models..." -ForegroundColor Green
$yamlPath = "$installDir\ComfyUI\extra_model_paths.yaml"
$yamlLines = @(
    "invokeai:",
    "    base_path: D:/",
    "    checkpoints: models",
    "    vae: models",
    "    loras: models",
    "    upscale_models: models"
)
$yamlLines | Set-Content -Path $yamlPath -Encoding UTF8
Write-Host "  -> Đã liên kết kho model D:\models vào ComfyUI!" -ForegroundColor Green

# 5. Tạo File Khởi Động 1-Click
Write-Host ""
Write-Host "[5/5] Tạo file khởi động nhanh..." -ForegroundColor Green
$startBat = "D:\Start_ComfyUI_PixelPilot.bat"
$batLines = @(
    "@echo off",
    "title ComfyUI Server - Pixel Pilot GPU Bridge",
    ('cd /d "' + $installDir + '"'),
    "echo ========================================================",
    "echo    Pixel Pilot Local GPU Server (RTX 3050 Ti)",
    "echo    ComfyUI URL: http://127.0.0.1:8188",
    "echo ========================================================",
    "call run_nvidia_gpu.bat --listen 127.0.0.1 --port 8188 --preview-method auto",
    "pause"
)
$batLines | Set-Content -Path $startBat -Encoding UTF8
Write-Host "  -> Đã tạo file khởi động 1-click tại: $startBat" -ForegroundColor Green

Write-Host ""
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "  CÀI ĐẶT THÀNH CÔNG! BÂY GIỜ BẠN CÓ THỂ BẮT ĐẦU:" -ForegroundColor Yellow
Write-Host "  1. Double click file: D:\Start_ComfyUI_PixelPilot.bat" -ForegroundColor White
Write-Host "  2. Mở Pixel Pilot trong VS Code -> Nút GPU sẽ sáng xanh!" -ForegroundColor White
Write-Host "  3. Thưởng thức toàn bộ công cụ AI: Tách nền, Upscale 4x miễn phí!" -ForegroundColor White
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host ""
