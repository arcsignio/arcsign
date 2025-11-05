@echo off
REM ArcSign Build Script for Windows
REM Builds binaries for Windows, macOS, and Linux

setlocal enabledelayedexpansion

set VERSION=0.1.0
set BUILD_DIR=build
set CMD_PATH=./cmd/arcsign

echo ========================================
echo   ArcSign Build Script v%VERSION%
echo ========================================
echo.

REM Create build directory
if not exist %BUILD_DIR% mkdir %BUILD_DIR%

REM Clean previous builds
echo Cleaning previous builds...
del /Q %BUILD_DIR%\* 2>nul
echo [OK] Clean complete
echo.

REM Run tests
echo Running tests...
go test ./tests/... -v > %BUILD_DIR%\test-results.txt 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [OK] All tests passed
) else (
    echo [ERROR] Tests failed. Check %BUILD_DIR%\test-results.txt
    exit /b 1
)
echo.

REM Build for Windows (64-bit)
echo Building for Windows ^(amd64^)...
set GOOS=windows
set GOARCH=amd64
go build -ldflags "-s -w" -o %BUILD_DIR%\arcsign-windows-amd64.exe %CMD_PATH%
if %ERRORLEVEL% EQU 0 (
    echo [OK] Windows build complete
) else (
    echo [ERROR] Windows build failed
    exit /b 1
)
echo.

REM Build for macOS (Intel)
echo Building for macOS ^(amd64^)...
set GOOS=darwin
set GOARCH=amd64
go build -ldflags "-s -w" -o %BUILD_DIR%\arcsign-darwin-amd64 %CMD_PATH%
if %ERRORLEVEL% EQU 0 (
    echo [OK] macOS ^(Intel^) build complete
) else (
    echo [ERROR] macOS ^(Intel^) build failed
    exit /b 1
)
echo.

REM Build for macOS (Apple Silicon)
echo Building for macOS ^(arm64^)...
set GOOS=darwin
set GOARCH=arm64
go build -ldflags "-s -w" -o %BUILD_DIR%\arcsign-darwin-arm64 %CMD_PATH%
if %ERRORLEVEL% EQU 0 (
    echo [OK] macOS ^(Apple Silicon^) build complete
) else (
    echo [ERROR] macOS ^(Apple Silicon^) build failed
    exit /b 1
)
echo.

REM Build for Linux (64-bit)
echo Building for Linux ^(amd64^)...
set GOOS=linux
set GOARCH=amd64
go build -ldflags "-s -w" -o %BUILD_DIR%\arcsign-linux-amd64 %CMD_PATH%
if %ERRORLEVEL% EQU 0 (
    echo [OK] Linux build complete
) else (
    echo [ERROR] Linux build failed
    exit /b 1
)
echo.

REM Build for Linux (ARM64)
echo Building for Linux ^(arm64^)...
set GOOS=linux
set GOARCH=arm64
go build -ldflags "-s -w" -o %BUILD_DIR%\arcsign-linux-arm64 %CMD_PATH%
if %ERRORLEVEL% EQU 0 (
    echo [OK] Linux ^(ARM64^) build complete
) else (
    echo [ERROR] Linux ^(ARM64^) build failed
    exit /b 1
)
echo.

REM Generate SHA256 checksums
echo Generating SHA256 checksums...
cd %BUILD_DIR%
(for %%f in (arcsign-*) do (
    certutil -hashfile "%%f" SHA256 | findstr /v ":" | findstr /v "CertUtil"
    echo %%f
    echo.
)) > SHA256SUMS.txt
cd ..
echo [OK] Checksums generated
echo.

REM Summary
echo ========================================
echo   Build Summary
echo ========================================
echo.
echo Built binaries:
dir /B %BUILD_DIR%\arcsign-*
echo.
echo Checksums saved to: %BUILD_DIR%\SHA256SUMS.txt
echo.
echo [OK] All builds completed successfully!
echo.
echo Output directory: %BUILD_DIR%\
echo Test results: %BUILD_DIR%\test-results.txt
echo.

endlocal
