[CmdletBinding()]
param(
    [switch]$SkipInstall,
    [switch]$NoMock,
    [switch]$StartComfyUI,
    [switch]$NoLaunch
)

$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$runtimeDir = Join-Path $projectRoot '.pixelpilot_runtime'
$logDir = Join-Path $runtimeDir 'logs'
$mockPidFile = Join-Path $runtimeDir 'mock-invokeai.pid'
$invokePidFile = Join-Path $runtimeDir 'invokeai.pid'

function Write-Step([string]$message) {
    Write-Host "`n[>] $message" -ForegroundColor Cyan
}

function Test-HttpEndpoint([string]$url) {
    try {
        $response = Invoke-WebRequest -Uri $url -Method Get -TimeoutSec 2 -UseBasicParsing
        return $response.StatusCode -ge 200 -and $response.StatusCode -lt 500
    } catch {
        return $false
    }
}

function Invoke-Npm([string[]]$arguments) {
    & npm.cmd @arguments
    if ($LASTEXITCODE -ne 0) {
        throw "npm $($arguments -join ' ') failed with exit code $LASTEXITCODE."
    }
}

Set-Location -LiteralPath $projectRoot
Write-Host '============================================================' -ForegroundColor DarkCyan
Write-Host ' PIXEL PILOT - ONE-CLICK DEVELOPMENT START' -ForegroundColor White
Write-Host '============================================================' -ForegroundColor DarkCyan
Write-Host "Workspace: $projectRoot" -ForegroundColor DarkGray

if (-not (Get-Command node.exe -ErrorAction SilentlyContinue)) {
    throw 'Node.js was not found in PATH. Install Node.js 20 LTS or newer.'
}
if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
    throw 'npm was not found in PATH.'
}

if (-not $SkipInstall) {
    if (-not (Test-Path -LiteralPath (Join-Path $projectRoot 'node_modules'))) {
        Write-Step 'Installing extension dependencies'
        Invoke-Npm @('install')
    }
    if (-not (Test-Path -LiteralPath (Join-Path $projectRoot 'webview-ui\node_modules'))) {
        Write-Step 'Installing webview dependencies'
        Invoke-Npm @('--prefix', 'webview-ui', 'install')
    }
}

Write-Step 'Building extension and webview'
Invoke-Npm @('run', 'build')
New-Item -ItemType Directory -Path $logDir -Force | Out-Null

$invokeOnline = Test-HttpEndpoint 'http://127.0.0.1:9090/api/v1/app/version'
if ($invokeOnline) {
    Write-Host '[OK] InvokeAI is online at http://127.0.0.1:9090' -ForegroundColor Green
} else {
    $invokeLauncher = Join-Path $projectRoot 'scripts\start_invokeai_local.cmd'
    if (Test-Path -LiteralPath $invokeLauncher) {
        Write-Step 'InvokeAI is offline - starting the local InvokeAI server'
        $stdoutLog = Join-Path $logDir 'invokeai.stdout.log'
        $stderrLog = Join-Path $logDir 'invokeai.stderr.log'
        $invokeProcess = Start-Process -FilePath 'cmd.exe' -ArgumentList @('/c', "`"$invokeLauncher`"") -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput $stdoutLog -RedirectStandardError $stderrLog -PassThru
        Set-Content -LiteralPath $invokePidFile -Value $invokeProcess.Id -Encoding ascii
        for ($attempt = 0; $attempt -lt 60; $attempt++) {
            if (Test-HttpEndpoint 'http://127.0.0.1:9090/api/v1/app/version') { $invokeOnline = $true; break }
            Start-Sleep -Seconds 1
        }
        if ($invokeOnline) {
            Write-Host '[OK] Local InvokeAI is ready at http://127.0.0.1:9090' -ForegroundColor Green
        } else {
            Write-Warning "Local InvokeAI did not start. See logs in $logDir"
        }
    }
}

if (-not $invokeOnline -and -not $NoMock) {
    Write-Step 'InvokeAI is offline - starting the development mock server'
    $existingMock = $null
    if (Test-Path -LiteralPath $mockPidFile) {
        $savedPid = (Get-Content -LiteralPath $mockPidFile -Raw).Trim()
        if ($savedPid -match '^\d+$') {
            $existingMock = Get-Process -Id ([int]$savedPid) -ErrorAction SilentlyContinue
        }
    }
    if (-not $existingMock) {
        $stdoutLog = Join-Path $logDir 'mock-invokeai.stdout.log'
        $stderrLog = Join-Path $logDir 'mock-invokeai.stderr.log'
        $mockScript = Join-Path $projectRoot 'scripts\mock_invokeai.mjs'
        $mockProcess = Start-Process -FilePath 'node.exe' -ArgumentList @("`"$mockScript`"") -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput $stdoutLog -RedirectStandardError $stderrLog -PassThru
        Set-Content -LiteralPath $mockPidFile -Value $mockProcess.Id -Encoding ascii
    }
    for ($attempt = 0; $attempt -lt 20; $attempt++) {
        if (Test-HttpEndpoint 'http://127.0.0.1:9090/api/v1/app/version') { $invokeOnline = $true; break }
        Start-Sleep -Milliseconds 250
    }
    if ($invokeOnline) {
        Write-Host '[OK] Mock InvokeAI is ready (development UI only).' -ForegroundColor Green
    } else {
        Write-Warning "Mock server did not start. See logs in $logDir"
    }
} elseif (-not $invokeOnline) {
    Write-Warning 'InvokeAI is offline. The extension can still use ComfyUI, Runware, or offline tools.'
}

$comfyOnline = Test-HttpEndpoint 'http://127.0.0.1:8188/system_stats'
if ($comfyOnline) {
    Write-Host '[OK] ComfyUI is online at http://127.0.0.1:8188' -ForegroundColor Green
} elseif ($StartComfyUI) {
    Write-Step 'Starting ComfyUI Local GPU'
    $comfyCandidates = @(
        $env:PIXELPILOT_COMFYUI_LAUNCHER,
        (Join-Path $projectRoot 'scripts\start_comfyui_local.cmd'),
        'D:\Start_ComfyUI_PixelPilot.bat',
        'D:\ComfyUI_windows_portable\run_nvidia_gpu.bat'
    ) | Where-Object { $_ -and (Test-Path -LiteralPath $_) }
    $comfyLauncher = $comfyCandidates | Select-Object -First 1
    if ($comfyLauncher) {
        Start-Process -FilePath 'cmd.exe' -ArgumentList @('/c', "`"$comfyLauncher`"") -WorkingDirectory (Split-Path -Parent $comfyLauncher) -WindowStyle Hidden
        Write-Host "[OK] ComfyUI start command sent: $comfyLauncher" -ForegroundColor Green
    } else {
        Write-Warning 'ComfyUI was not found. Run scripts\setup_comfyui.bat first.'
    }
} else {
    Write-Host '[--] ComfyUI is offline (optional). Use npm run start:gpu to start it.' -ForegroundColor Yellow
}

if (-not $NoLaunch) {
    Write-Step 'Opening VS Code Extension Development Host'
    if (-not (Get-Command code.cmd -ErrorAction SilentlyContinue)) {
        throw 'The code command was not found in PATH.'
    }
    & code.cmd --new-window --extensionDevelopmentPath=$projectRoot --disable-extensions $projectRoot
    if ($LASTEXITCODE -ne 0) {
        throw "Could not open VS Code Extension Development Host (exit code $LASTEXITCODE)."
    }
}

Write-Host "`n[OK] Pixel Pilot is ready." -ForegroundColor Green
Write-Host '  npm start            Build + mock when needed + Extension Host' -ForegroundColor DarkGray
Write-Host '  npm run start:real   Never start the mock server' -ForegroundColor DarkGray
Write-Host '  npm run start:gpu    Also try to start ComfyUI' -ForegroundColor DarkGray
Write-Host '  npm stop             Stop the managed mock server' -ForegroundColor DarkGray
