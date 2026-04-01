@echo off
setlocal enabledelayedexpansion
title TFT Clash - Setup

echo ================================================
echo   TFT Clash - Auto Setup
echo ================================================
echo.

:: ── Step 1: Check/Install Node.js ─────────────────
echo [1/5] Checking Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Node.js not found. Installing via winget...
    winget install OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
    if %errorlevel% neq 0 (
        echo.
        echo ERROR: winget failed. Please install Node.js manually:
        echo   https://nodejs.org  ^(download LTS^)
        echo Then re-run this script.
        pause
        exit /b 1
    )
    echo Node.js installed. Refreshing PATH...
    call RefreshEnv.cmd >nul 2>&1
    :: fallback path refresh
    set "PATH=%PATH%;%ProgramFiles%\nodejs"
) else (
    echo Node.js found:
    node --version
)

:: ── Step 2: Install Claude Code ───────────────────
echo.
echo [2/5] Installing Claude Code...
npm install -g @anthropic-ai/claude-code
if %errorlevel% neq 0 (
    echo ERROR: Claude Code install failed. Check npm is working.
    pause
    exit /b 1
)
echo Claude Code installed OK.

:: ── Step 3: Copy .claude config ───────────────────
echo.
echo [3/5] Copying Claude config to %USERPROFILE%\.claude ...
set "BACKUP_DIR=%~dp0.claude-backup"
set "CLAUDE_DIR=%USERPROFILE%\.claude"

if not exist "%BACKUP_DIR%" (
    echo ERROR: .claude-backup folder not found next to this script.
    pause
    exit /b 1
)

if not exist "%CLAUDE_DIR%" mkdir "%CLAUDE_DIR%"

:: Copy each subfolder
for %%F in (rules agents skills commands) do (
    if exist "%BACKUP_DIR%\%%F" (
        xcopy /E /I /Y /Q "%BACKUP_DIR%\%%F" "%CLAUDE_DIR%\%%F" >nul
        echo   Copied %%F
    )
)

:: Copy settings.json
if exist "%BACKUP_DIR%\settings.json" (
    copy /Y "%BACKUP_DIR%\settings.json" "%CLAUDE_DIR%\settings.json" >nul
    echo   Copied settings.json
)

:: Copy project memory - build the correct path key from current location
:: The key is the project path with slashes replaced by dashes
set "PROJECT_PATH=%~dp0"
:: Remove trailing backslash
set "PROJECT_PATH=%PROJECT_PATH:~0,-1%"
:: Replace backslashes and colons with dashes for the folder key
set "KEY=%PROJECT_PATH:\=-%"
set "KEY=%KEY::=%"
set "KEY=%KEY: =-%"

set "MEMORY_DST=%CLAUDE_DIR%\projects\%KEY%"
if exist "%BACKUP_DIR%\tft-clash-memory" (
    if not exist "%MEMORY_DST%" mkdir "%MEMORY_DST%"
    xcopy /E /I /Y /Q "%BACKUP_DIR%\tft-clash-memory" "%MEMORY_DST%" >nul
    echo   Copied project memory to projects\%KEY%
)

echo Claude config installed.

:: ── Step 4: npm install ────────────────────────────
echo.
echo [4/5] Installing project dependencies ^(npm install^)...
cd /d "%~dp0"
npm install
if %errorlevel% neq 0 (
    echo ERROR: npm install failed.
    pause
    exit /b 1
)
echo Dependencies installed.

:: ── Step 5: Windows Developer Mode reminder ───────
echo.
echo [5/5] Windows permissions check...
echo.
echo ================================================
echo   MANUAL STEP REQUIRED
echo ================================================
echo   Claude Code needs Developer Mode enabled.
echo   Go to:
echo     Settings ^> System ^> For Developers
echo     Turn ON "Developer Mode"
echo.
echo   Also allow Claude Code through Windows Defender
echo   if it gets blocked the first time you run it.
echo ================================================
echo.

:: ── Done ──────────────────────────────────────────
echo.
echo ================================================
echo   ALL DONE! Next steps:
echo   1. Enable Developer Mode ^(see above^)
echo   2. Run:  npm run dev
echo      Then open http://localhost:5173
echo   3. Run:  claude
echo      To start Claude Code ^(login when prompted^)
echo ================================================
echo.
pause
