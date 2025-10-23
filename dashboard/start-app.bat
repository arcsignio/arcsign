@echo off
echo ========================================
echo  ArcSign Dashboard - Development Mode
echo ========================================
echo.
echo Starting Tauri application...
echo (This will start both frontend and backend)
echo.
echo First time? This may take 5-10 minutes to compile.
echo Subsequent runs will be faster.
echo.
echo Press Ctrl+C to stop the application
echo ========================================
echo.

cd /d "%~dp0"
npm run tauri dev
