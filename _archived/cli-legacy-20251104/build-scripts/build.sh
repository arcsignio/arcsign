#!/bin/bash

# ArcSign Build Script
# Builds binaries for Windows, macOS, and Linux

set -e

VERSION="0.1.0"
BUILD_DIR="build"
CMD_PATH="./cmd/arcsign"

echo "========================================"
echo "  ArcSign Build Script v${VERSION}"
echo "========================================"
echo ""

# Create build directory
mkdir -p ${BUILD_DIR}

# Clean previous builds
echo "Cleaning previous builds..."
rm -f ${BUILD_DIR}/*
echo "✓ Clean complete"
echo ""

# Run tests
echo "Running tests..."
go test ./tests/... -v > ${BUILD_DIR}/test-results.txt 2>&1
if [ $? -eq 0 ]; then
    echo "✓ All tests passed"
else
    echo "❌ Tests failed. Check ${BUILD_DIR}/test-results.txt"
    exit 1
fi
echo ""

# Build for Windows (64-bit)
echo "Building for Windows (amd64)..."
GOOS=windows GOARCH=amd64 go build -ldflags "-s -w" -o ${BUILD_DIR}/arcsign-windows-amd64.exe ${CMD_PATH}
if [ $? -eq 0 ]; then
    SIZE=$(du -h ${BUILD_DIR}/arcsign-windows-amd64.exe | cut -f1)
    echo "✓ Windows build complete (${SIZE})"
else
    echo "❌ Windows build failed"
    exit 1
fi
echo ""

# Build for macOS (Intel)
echo "Building for macOS (amd64)..."
GOOS=darwin GOARCH=amd64 go build -ldflags "-s -w" -o ${BUILD_DIR}/arcsign-darwin-amd64 ${CMD_PATH}
if [ $? -eq 0 ]; then
    SIZE=$(du -h ${BUILD_DIR}/arcsign-darwin-amd64 | cut -f1)
    echo "✓ macOS (Intel) build complete (${SIZE})"
else
    echo "❌ macOS (Intel) build failed"
    exit 1
fi
echo ""

# Build for macOS (Apple Silicon)
echo "Building for macOS (arm64)..."
GOOS=darwin GOARCH=arm64 go build -ldflags "-s -w" -o ${BUILD_DIR}/arcsign-darwin-arm64 ${CMD_PATH}
if [ $? -eq 0 ]; then
    SIZE=$(du -h ${BUILD_DIR}/arcsign-darwin-arm64 | cut -f1)
    echo "✓ macOS (Apple Silicon) build complete (${SIZE})"
else
    echo "❌ macOS (Apple Silicon) build failed"
    exit 1
fi
echo ""

# Build for Linux (64-bit)
echo "Building for Linux (amd64)..."
GOOS=linux GOARCH=amd64 go build -ldflags "-s -w" -o ${BUILD_DIR}/arcsign-linux-amd64 ${CMD_PATH}
if [ $? -eq 0 ]; then
    SIZE=$(du -h ${BUILD_DIR}/arcsign-linux-amd64 | cut -f1)
    echo "✓ Linux build complete (${SIZE})"
else
    echo "❌ Linux build failed"
    exit 1
fi
echo ""

# Build for Linux (ARM64)
echo "Building for Linux (arm64)..."
GOOS=linux GOARCH=arm64 go build -ldflags "-s -w" -o ${BUILD_DIR}/arcsign-linux-arm64 ${CMD_PATH}
if [ $? -eq 0 ]; then
    SIZE=$(du -h ${BUILD_DIR}/arcsign-linux-arm64 | cut -f1)
    echo "✓ Linux (ARM64) build complete (${SIZE})"
else
    echo "❌ Linux (ARM64) build failed"
    exit 1
fi
echo ""

# Generate SHA256 checksums
echo "Generating SHA256 checksums..."
cd ${BUILD_DIR}
if command -v sha256sum &> /dev/null; then
    sha256sum arcsign-* > SHA256SUMS.txt
elif command -v shasum &> /dev/null; then
    shasum -a 256 arcsign-* > SHA256SUMS.txt
else
    echo "⚠️  Warning: No SHA256 tool found (sha256sum or shasum)"
fi
cd ..
echo "✓ Checksums generated"
echo ""

# Summary
echo "========================================"
echo "  Build Summary"
echo "========================================"
echo ""
echo "Built binaries:"
ls -lh ${BUILD_DIR}/arcsign-* | awk '{print "  " $9 " (" $5 ")"}'
echo ""
echo "Checksums:"
if [ -f ${BUILD_DIR}/SHA256SUMS.txt ]; then
    cat ${BUILD_DIR}/SHA256SUMS.txt | while read line; do
        echo "  $line"
    done
fi
echo ""
echo "✓ All builds completed successfully!"
echo ""
echo "Output directory: ${BUILD_DIR}/"
echo "Test results: ${BUILD_DIR}/test-results.txt"
echo ""
