param(
    [switch]$SkipInstall
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Frontend = Join-Path $Root "frontend"
$BackendPython = Join-Path $Root ".venv\Scripts\python.exe"
$BackendLog = Join-Path $Root "backend-server.log"
$FrontendLog = Join-Path $Root "frontend-server.log"

Set-Location $Root

function Test-Port {
    param([int]$Port)
    $connection = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    return [bool]$connection
}

function Start-AppProcess {
    param(
        [string]$Title,
        [string]$Command
    )

    Start-Process -FilePath "powershell.exe" -ArgumentList @(
        "-NoExit",
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        "`$Host.UI.RawUI.WindowTitle = '$Title'; $Command"
    ) -WorkingDirectory $Root
}

Write-Host ""
Write-Host "Quant Committee AI launcher" -ForegroundColor Cyan
Write-Host "Project: $Root"
Write-Host ""

if (-not (Test-Path $BackendPython)) {
    Write-Host "Creating Python virtual environment..." -ForegroundColor Yellow
    python -m venv ".venv"
}

if (-not $SkipInstall) {
    Write-Host "Checking backend dependencies..." -ForegroundColor Yellow
    & $BackendPython -m pip install -r "backend\requirements.txt"

    if (-not (Test-Path (Join-Path $Frontend "node_modules"))) {
        Write-Host "Installing frontend dependencies..." -ForegroundColor Yellow
        Push-Location $Frontend
        npm.cmd install
        Pop-Location
    }
}

if (Test-Port 8000) {
    Write-Host "Backend already appears to be running on http://127.0.0.1:8000" -ForegroundColor Green
} else {
    Write-Host "Starting backend on http://127.0.0.1:8000" -ForegroundColor Green
    Start-AppProcess `
        -Title "Quant Committee AI - Backend" `
        -Command "Set-Location '$Root'; & '$BackendPython' -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 *> '$BackendLog'"
}

if (Test-Port 3000) {
    Write-Host "Frontend already appears to be running on http://localhost:3000" -ForegroundColor Green
} else {
    Write-Host "Starting frontend on http://localhost:3000" -ForegroundColor Green
    Start-AppProcess `
        -Title "Quant Committee AI - Frontend" `
        -Command "Set-Location '$Frontend'; npm.cmd run dev -- --port 3000 *> '$FrontendLog'"
}

Write-Host ""
Write-Host "Opening http://localhost:3000" -ForegroundColor Cyan
Start-Process "http://localhost:3000"

Write-Host ""
Write-Host "Leave the backend and frontend windows open while using the app."
Write-Host "Close those windows to stop the app."
Write-Host ""
Read-Host "Press Enter to close this launcher window"

