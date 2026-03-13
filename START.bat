@echo off
title TFT Clash — Auto Setup
color 0A
cls

echo.
echo  ==============================================
echo    TFT CLASH  ^|  Auto Setup ^& Launch
echo  ==============================================
echo.

REM ── Step 1: Check Node.js ─────────────────────
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    color 0C
    echo  [ERROR] Node.js is not installed.
    echo.
    echo  You need Node.js v18 or higher.
    echo  Opening the download page now...
    echo.
    echo  After installing, run START.bat again.
    echo.
    pause
    start https://nodejs.org/en/download
    exit /b 1
)

for /f "tokens=*" %%i in ('node -v') do set NODE_VER=%%i
echo  [OK] Node.js %NODE_VER% detected

REM ── Step 2: Check npm ─────────────────────────
where npm >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    color 0C
    echo  [ERROR] npm not found. Reinstall Node.js.
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('npm -v') do set NPM_VER=%%i
echo  [OK] npm v%NPM_VER% detected
echo.

REM ── Step 3: Install dependencies ──────────────
if exist node_modules (
    echo  [OK] node_modules already exists — skipping install
) else (
    echo  Installing dependencies...
    echo  This only happens once. Give it ~30 seconds.
    echo  ──────────────────────────────────────────
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        color 0C
        echo.
        echo  [ERROR] npm install failed.
        echo  Check your internet connection and try again.
        pause
        exit /b 1
    )
    echo  [OK] Dependencies installed!
)

echo.
echo  ==============================================
echo    All good! Launching TFT Clash...
echo  ==============================================
echo.
echo  Local:  http://localhost:5173
echo.
echo  Press Ctrl+C to stop the server.
echo  ──────────────────────────────────────────
echo.

REM ── Step 4: Open browser after 2s, then start ─
start /b cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:5173"
call npm run dev

pause
