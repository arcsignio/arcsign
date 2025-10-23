@echo off
echo ========================================
echo  ArcSign Dashboard - Development Mode
echo ========================================
echo.

cd /d "%~dp0"

REM 啟動前先清理所有 Node 進程
echo Cleaning up any existing processes...
taskkill /F /IM node.exe 2>nul
timeout /t 1 /nobreak >nul

echo Starting Tauri application...
echo (Frontend dev server will start automatically)
echo.
echo Press Ctrl+C to stop
echo ========================================
echo.

REM 設置 trap 在腳本終止時執行清理
REM 運行 Tauri (這會自動啟動 Vite)
npm run tauri dev

REM 腳本結束後自動清理
echo.
echo ========================================
echo Cleaning up processes...
taskkill /F /IM node.exe 2>nul
taskkill /F /IM arcsign-dashboard.exe 2>nul
echo Done! All processes stopped.
echo ========================================
pause
