#!/bin/bash

# ArcSign Download Files Preparation Script
# This script copies built application files to the landing page downloads directory

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DOWNLOADS_DIR="$PROJECT_ROOT/landing-page/downloads"
BUILD_DIR="$PROJECT_ROOT/dashboard/src-tauri/target/release/bundle"

echo "🚀 Preparing ArcSign download files..."

# Create downloads directory if it doesn't exist
mkdir -p "$DOWNLOADS_DIR"

# Function to copy and rename file
copy_file() {
    local source="$1"
    local dest="$2"

    if [ -f "$source" ]; then
        cp "$source" "$dest"
        echo "✅ Copied: $(basename "$dest")"

        # Show file size
        ls -lh "$dest" | awk '{print "   Size:", $5}'
    else
        echo "⚠️  Not found: $source"
    fi
}

# Copy macOS builds
echo ""
echo "📦 macOS Builds:"
echo "----------------"

# Apple Silicon (ARM64)
if [ -f "$BUILD_DIR/macos/"*"_aarch64.dmg" ]; then
    copy_file "$BUILD_DIR/macos/"*"_aarch64.dmg" "$DOWNLOADS_DIR/ArcSign-macOS-ARM64.dmg"
fi

# Intel (x86_64) - if exists
if [ -f "$BUILD_DIR/macos/"*"_x64.dmg" ]; then
    copy_file "$BUILD_DIR/macos/"*"_x64.dmg" "$DOWNLOADS_DIR/ArcSign-macOS-Intel.dmg"
fi

# Windows builds
echo ""
echo "🪟 Windows Builds:"
echo "------------------"

if [ -f "$BUILD_DIR/msi/"*".msi" ]; then
    copy_file "$BUILD_DIR/msi/"*".msi" "$DOWNLOADS_DIR/ArcSign-Windows-x64.msi"
else
    echo "⚠️  Windows MSI not found (build on Windows or use cross-compilation)"
fi

if [ -f "$BUILD_DIR/nsis/"*".exe" ]; then
    copy_file "$BUILD_DIR/nsis/"*".exe" "$DOWNLOADS_DIR/ArcSign-Windows-x64-Setup.exe"
else
    echo "⚠️  Windows NSIS installer not found"
fi

# Linux builds
echo ""
echo "🐧 Linux Builds:"
echo "----------------"

if [ -f "$BUILD_DIR/deb/"*".deb" ]; then
    copy_file "$BUILD_DIR/deb/"*".deb" "$DOWNLOADS_DIR/ArcSign-Linux-x64.deb"
else
    echo "⚠️  Linux DEB not found (build on Linux or use cross-compilation)"
fi

if [ -f "$BUILD_DIR/appimage/"*".AppImage" ]; then
    copy_file "$BUILD_DIR/appimage/"*".AppImage" "$DOWNLOADS_DIR/ArcSign-Linux-x64.AppImage"
else
    echo "⚠️  Linux AppImage not found"
fi

# Create checksums
echo ""
echo "🔒 Generating SHA256 checksums..."
echo "-----------------------------------"
cd "$DOWNLOADS_DIR"

if command -v shasum &> /dev/null; then
    shasum -a 256 ArcSign-* > SHA256SUMS 2>/dev/null || true
    echo "✅ Checksums saved to SHA256SUMS"
    cat SHA256SUMS
elif command -v sha256sum &> /dev/null; then
    sha256sum ArcSign-* > SHA256SUMS 2>/dev/null || true
    echo "✅ Checksums saved to SHA256SUMS"
    cat SHA256SUMS
fi

cd "$PROJECT_ROOT"

echo ""
echo "✨ Done! Download files prepared in:"
echo "   $DOWNLOADS_DIR"
echo ""
echo "📊 Summary:"
ls -lh "$DOWNLOADS_DIR" | grep -E "ArcSign|SHA256" || echo "   No files found"

echo ""
echo "💡 Next steps:"
echo "   1. Update landing-page/index.html download links"
echo "   2. Test download links locally"
echo "   3. Deploy to production server"
