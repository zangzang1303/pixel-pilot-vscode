[CmdletBinding()]
param(
    [switch]$SkipInstall,
    [switch]$NoMock,
    [switch]$Mock,
    [switch]$StartInvokeAI,
    [switch]$StartComfyUI,
    [switch]$NoLaunch
)

$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$runtimeDir = Join-Path $projectRoot '.pixelpilot_runtime'
$logDir = Join-Path $runtimeDir 'logs'
$mockPidFile = Join-Path $runtimeDir 'mock-invokeai.pid'
$invokePidFile = Join-Path $runtimeDir 'invokeai.pid'
if ($Mock -and $NoMock) {
    throw 'Choose either -Mock or -NoMock, not both.'
}

function Write-Step([string]$message) {
    Write-Host "`n[>] $message" -ForegroundColor Cyan
}

function Test-HttpEndpoint([string]$url) {
    try {
        $response = Invoke-WebRequest -Uri $url -Method Get -TimeoutSec 2 -UseBasicParsing
        return $response.StatusCode -ge 200 -and $response.StatusCode -lt 300
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
        Invoke-Npm @('ci')
    }
    if (-not (Test-Path -LiteralPath (Join-Path $projectRoot 'webview-ui\node_modules'))) {
        Write-Step 'Installing webview dependencies'
        Invoke-Npm @('--prefix', 'webview-ui', 'ci')
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
    $invokeRoot = if ($env:PIXELPILOT_INVOKEAI_HOME) { $env:PIXELPILOT_INVOKEAI_HOME } else { 'C:\AI\InvokeAI' }
    $invokeExecutable = Join-Path $invokeRoot '.venv\Scripts\invokeai-web.exe'
    if ($StartInvokeAI -and (Test-Path -LiteralPath $invokeLauncher) -and (Test-Path -LiteralPath $invokeExecutable)) {
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
    } elseif ($StartInvokeAI) {
        Write-Warning 'InvokeAI executable was not found. Set PIXELPILOT_INVOKEAI_HOME to the installed InvokeAI directory.'
    }
}

if (-not $invokeOnline -and $Mock -and -not $NoMock) {
    Write-Step 'InvokeAI is offline - starting the development mock server'
    $mockScript = Join-Path $projectRoot 'scripts\mock_invokeai.mjs'
    $existingMock = $null
    if (Test-Path -LiteralPath $mockPidFile) {
        $savedPid = (Get-Content -LiteralPath $mockPidFile -Raw).Trim()
        if ($savedPid -match '^\d+$') {
            $existingMock = Get-Process -Id ([int]$savedPid) -ErrorAction SilentlyContinue
            if ($existingMock) {
                $processInfo = Get-CimInstance Win32_Process -Filter "ProcessId = $savedPid" -ErrorAction SilentlyContinue
                if (-not $processInfo -or $processInfo.CommandLine -notlike "*$mockScript*") {
                    $existingMock = $null
                }
            }
        }
    }
    if (-not $existingMock) {
        $stdoutLog = Join-Path $logDir 'mock-invokeai.stdout.log'
        $stderrLog = Join-Path $logDir 'mock-invokeai.stderr.log'
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
    Write-Step 'Checking for ComfyUI Local GPU installation...'
    $comfyRoot = if ($env:PIXELPILOT_COMFYUI_HOME) { $env:PIXELPILOT_COMFYUI_HOME } else { 'C:\AI\ComfyUI' }
    $comfyFallback = if (Test-Path -LiteralPath (Join-Path $comfyRoot '.venv\Scripts\python.exe')) {
        Join-Path $projectRoot 'scripts\start_comfyui_local.cmd'
    } else {
        $null
    }
    $comfyCandidates = @(
        $env:PIXELPILOT_COMFYUI_LAUNCHER,
        'D:\Start_ComfyUI_PixelPilot.bat',
        'D:\ComfyUI_windows_portable\run_nvidia_gpu.bat',
        $comfyFallback
    ) | Where-Object { $_ -and (Test-Path -LiteralPath $_) }
    $comfyLauncher = $comfyCandidates | Select-Object -First 1
    if ($comfyLauncher) {
        Write-Step "Starting ComfyUI Local GPU server: $comfyLauncher"
        Start-Process -FilePath 'cmd.exe' -ArgumentList @('/c', "`"$comfyLauncher`"") -WorkingDirectory (Split-Path -Parent $comfyLauncher) -WindowStyle Hidden
        Write-Host "[OK] ComfyUI start command sent. Waiting for server to become ready..." -ForegroundColor Green
        for ($attempt = 0; $attempt -lt 40; $attempt++) {
            if (Test-HttpEndpoint 'http://127.0.0.1:8188/system_stats') { $comfyOnline = $true; break }
            Start-Sleep -Seconds 1
        }
        if ($comfyOnline) {
            Write-Host '[OK] ComfyUI is ready at http://127.0.0.1:8188' -ForegroundColor Green
        } else {
            Write-Warning 'ComfyUI is starting in background.'
        }
    } else {
        Write-Host '[--] ComfyUI was not found.' -ForegroundColor Yellow
    }
} else {
    Write-Host '[--] ComfyUI is offline. Use npm run start:gpu to start it when configured.' -ForegroundColor Yellow
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

Write-Host "`n[OK] Pixel Pilot development build is ready. Provider status is shown above." -ForegroundColor Green
Write-Host '  npm start            Build + status check + Extension Host' -ForegroundColor DarkGray
Write-Host '  npm run start:real   Try configured InvokeAI and ComfyUI servers' -ForegroundColor DarkGray
Write-Host '  npm run start:gpu    Try configured ComfyUI server' -ForegroundColor DarkGray
Write-Host '  npm run start:mock   Explicit development mock InvokeAI' -ForegroundColor DarkGray
Write-Host '  npm stop             Stop the managed mock server' -ForegroundColor DarkGray
