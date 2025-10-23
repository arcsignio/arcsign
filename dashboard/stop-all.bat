@echo off
echo Stopping all ArcSign processes...
echo.

REM Kill all Node.js processes (Vite dev server)
taskkill /F /IM node.exe 2>nul
if %errorlevel% == 0 (
    echo ✓ Stopped frontend dev server
) else (
    echo • No frontend dev server running
)

REM Kill any running Tauri processes
taskkill /F /IM arcsign-dashboard.exe 2>nul
if %errorlevel% == 0 (
    echo ✓ Stopped Tauri application
) else (
    echo • No Tauri application running
)

echo.
echo All processes stopped.
echo You can now run: start-app.bat
pause
