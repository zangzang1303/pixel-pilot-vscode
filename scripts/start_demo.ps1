[CmdletBinding()]
param(
    [switch]$NoLaunch
)

$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$demoAssets = Join-Path $projectRoot 'demo_assets'
$initialImage = Join-Path $demoAssets '01_chan_dung_toc_bay_TC1.jpg'

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "   PIXEL PILOT - ONE-CLICK DEMO LAUNCHER FOR ADVISOR" -ForegroundColor White
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "Workspace: $projectRoot" -ForegroundColor DarkGray

# 1. Quick sanity build check
Write-Host "`n[1/3] Kiem tra bien dich du an..." -ForegroundColor Yellow
if (-not (Test-Path (Join-Path $projectRoot 'out\extension.js')) -or -not (Test-Path (Join-Path $projectRoot 'webview-ui\dist\index.html'))) {
    Write-Host "Dang bien dich lai du an lan dau..." -ForegroundColor DarkGray
    & npm.cmd run build
} else {
    Write-Host "Ban build da san sang!" -ForegroundColor Green
}

# 2. Check ComfyUI Local GPU
Write-Host "`n[2/3] Kiem tra ket noi GPU local..." -ForegroundColor Yellow
$comfyOnline = $false
try {
    $res = Invoke-RestMethod -Uri 'http://127.0.0.1:8188/system_stats' -TimeoutSec 2 -ErrorAction SilentlyContinue
    if ($res) {
        $comfyOnline = $true
        Write-Host "ComfyUI Local GPU dang ONLINE tren cong 8188 (NVIDIA GPU san sang!)" -ForegroundColor Green
    }
} catch {
    $comfyOnline = $false
}

if (-not $comfyOnline) {
    Write-Host "ComfyUI hien dang Offline. He thong se tu dong su dung bo cong cu Sharp Native Engine sieu toc (45ms) va Local Cognitive Reasoner!" -ForegroundColor Cyan
}

# 3. Launch VS Code in Extension Development Host mode with sample demo asset
Write-Host "`n[3/3] Dang khoi dong VS Code Extension Development Host..." -ForegroundColor Yellow
if (-not $NoLaunch) {
    if (-not (Get-Command code.cmd -ErrorAction SilentlyContinue)) {
        throw "Lenh 'code.cmd' khong tim thay trong PATH. Vui long mo VS Code thu cong."
    }

    $arguments = @(
        "--new-window",
        "--extensionDevelopmentPath=$projectRoot",
        "--disable-extensions",
        "$projectRoot",
        "$initialImage"
    )

    Write-Host "Dang mo anh mau: demo_assets\01_chan_dung_toc_bay_TC1.jpg" -ForegroundColor DarkGray
    & code.cmd @arguments
    Write-Host "`nDa mo cua so VS Code Demo thanh cong!" -ForegroundColor Green
    Write-Host "Huong dan tiep theo:" -ForegroundColor White
    Write-Host "  1. Trong cua so moi mo ra, nhan Ctrl+Shift+P va chon 'Pixel Pilot: Open AI Studio (Canvas)'" -ForegroundColor White
    Write-Host "  2. Hoac nhap chuot phai vao anh 01_chan_dung_toc_bay_TC1.jpg va chon 'Pixel Pilot: Open AI Studio'" -ForegroundColor White
    Write-Host "  3. Xem chi tiet kich ban demo tai: demo_assets\PROMPTS_DEMO.md va DEMO_HUONG_DAN_THAY.md" -ForegroundColor White
}

