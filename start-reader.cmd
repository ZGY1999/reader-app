@echo off
setlocal

cd /d "%~dp0"

where npm.cmd >nul 2>&1
if errorlevel 1 (
  echo [reader-app-worktree] npm.cmd not found in PATH.
  pause
  exit /b 1
)

for /f %%P in ('powershell -NoProfile -ExecutionPolicy Bypass -Command "(Get-Process electron -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle } | Select-Object -First 1 -ExpandProperty Id)"') do set "ELECTRON_PID=%%P"

if defined ELECTRON_PID (
  echo [reader-app-worktree] Electron is already running with window process %ELECTRON_PID%.
  endlocal
  exit /b 0
)

for /f %%P in ('powershell -NoProfile -ExecutionPolicy Bypass -Command "(Get-NetTCPConnection -State Listen -LocalPort 5174 -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty OwningProcess)"') do set "VITE_PID=%%P"

if not defined VITE_PID (
  echo [reader-app-worktree] Starting Vite dev server on port 5174...
  start "reader-app-worktree-vite" /min powershell -NoProfile -ExecutionPolicy Bypass -Command "Set-Location '%~dp0'; npm.cmd run dev:vite"
) else (
  echo [reader-app-worktree] Reusing Vite dev server process %VITE_PID% on port 5174.
)

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$deadline = (Get-Date).AddSeconds(20);" ^
  "while ((Get-Date) -lt $deadline) {" ^
  "  if (Get-NetTCPConnection -State Listen -LocalPort 5174 -ErrorAction SilentlyContinue) { exit 0 }" ^
  "  Start-Sleep -Milliseconds 500" ^
  "}" ^
  "Write-Error 'Timed out waiting for Vite on port 5174.'; exit 1"
if errorlevel 1 (
  echo [reader-app-worktree] Vite dev server did not become ready.
  pause
  exit /b 1
)

echo [reader-app-worktree] Building Electron main/preload...
call npm.cmd run build:electron
if errorlevel 1 (
  echo [reader-app-worktree] Electron build failed.
  pause
  exit /b 1
)

echo [reader-app-worktree] Launching Electron...
start "reader-app-worktree-electron" /min powershell -NoProfile -ExecutionPolicy Bypass -Command "$env:NODE_ENV='development'; $env:VITE_DEV_SERVER_URL='http://127.0.0.1:5174'; Set-Location '%~dp0'; npx.cmd electron ."

echo [reader-app-worktree] Electron launch requested.
endlocal
