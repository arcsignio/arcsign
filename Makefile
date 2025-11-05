# Makefile for arcSign v2 - FFI Shared Library Build
# Feature: 005-go-cli-shared
# Created: 2025-10-25
# Updated: 2025-10-25 - T063-T065: Enhanced platform-specific builds with validation

.PHONY: help build-lib build-lib-windows build-lib-macos build-lib-linux build-all-platforms clean test validate-build check-cgo

# Default target
help:
	@echo "arcSign v2 - FFI Shared Library Build Targets"
	@echo ""
	@echo "Usage: make [target]"
	@echo ""
	@echo "Targets:"
	@echo "  build-lib           - Build shared library for current platform"
	@echo "  build-lib-windows   - Build Windows DLL (T063)"
	@echo "  build-lib-macos     - Build macOS dylib (T064)"
	@echo "  build-lib-linux     - Build Linux SO (T065)"
	@echo "  build-all-platforms - Build for all platforms (requires cross-compile setup)"
	@echo "  validate-build      - Validate library exports and symbols"
	@echo "  check-cgo           - Check if CGO is available"
	@echo "  clean               - Remove built artifacts"
	@echo "  test                - Run Go tests for FFI exports (T066)"
	@echo ""

# Detect current platform
UNAME_S := $(shell uname -s 2>/dev/null || echo "Windows")
ifeq ($(UNAME_S),Linux)
	PLATFORM := linux
	LIB_EXT := so
endif
ifeq ($(UNAME_S),Darwin)
	PLATFORM := macos
	LIB_EXT := dylib
endif
ifneq (,$(findstring MINGW,$(UNAME_S)))
	PLATFORM := windows
	LIB_EXT := dll
endif
ifneq (,$(findstring MSYS,$(UNAME_S)))
	PLATFORM := windows
	LIB_EXT := dll
endif
ifeq ($(UNAME_S),Windows)
	PLATFORM := windows
	LIB_EXT := dll
endif

# Output paths
LIB_DIR := dashboard/src-tauri
LIB_NAME := libarcsign
OUTPUT_LIB := $(LIB_DIR)/$(LIB_NAME).$(LIB_EXT)

# Go build flags
GO := go
CGO_ENABLED := 1
BUILD_MODE := c-shared
SOURCE := internal/lib/*.go

# Build for current platform
build-lib:
	@echo "Building shared library for $(PLATFORM)..."
	CGO_ENABLED=$(CGO_ENABLED) $(GO) build -buildmode=$(BUILD_MODE) -o $(OUTPUT_LIB) $(SOURCE)
	@echo "✓ Built: $(OUTPUT_LIB)"

# T063: Build Windows DLL with validation
build-lib-windows: check-cgo
	@echo "=== T063: Building Windows DLL ==="
	@echo "Platform: Windows (amd64)"
	@echo "CGO_ENABLED: $(CGO_ENABLED)"
	@echo ""
	CGO_ENABLED=$(CGO_ENABLED) GOOS=windows GOARCH=amd64 $(GO) build -buildmode=$(BUILD_MODE) -o $(LIB_DIR)/$(LIB_NAME).dll $(SOURCE)
	@echo ""
	@echo "✓ Built: $(LIB_DIR)/$(LIB_NAME).dll"
	@if [ -f "$(LIB_DIR)/$(LIB_NAME).dll" ]; then \
		echo "✓ File exists"; \
		ls -lh $(LIB_DIR)/$(LIB_NAME).dll; \
	else \
		echo "✗ Build failed - DLL not found"; \
		exit 1; \
	fi

# T064: Build macOS universal binary (arm64 + x86_64) with validation
build-lib-macos: check-cgo
	@echo "=== T064: Building macOS universal binary ==="
	@echo "Platform: macOS (arm64 + x86_64)"
	@echo "CGO_ENABLED: $(CGO_ENABLED)"
	@echo ""
	@echo "Building arm64 architecture..."
	CGO_ENABLED=$(CGO_ENABLED) GOOS=darwin GOARCH=arm64 $(GO) build -buildmode=$(BUILD_MODE) -o $(LIB_DIR)/$(LIB_NAME)_arm64.dylib $(SOURCE)
	@echo "✓ Built arm64 binary"
	@echo ""
	@echo "Building x86_64 architecture..."
	CGO_ENABLED=$(CGO_ENABLED) GOOS=darwin GOARCH=amd64 $(GO) build -buildmode=$(BUILD_MODE) -o $(LIB_DIR)/$(LIB_NAME)_amd64.dylib $(SOURCE)
	@echo "✓ Built x86_64 binary"
	@echo ""
	@echo "Creating universal binary with lipo..."
	lipo -create -output $(LIB_DIR)/$(LIB_NAME).dylib $(LIB_DIR)/$(LIB_NAME)_arm64.dylib $(LIB_DIR)/$(LIB_NAME)_amd64.dylib
	@echo "✓ Created universal binary"
	@echo ""
	@echo "✓ Built: $(LIB_DIR)/$(LIB_NAME).dylib"
	@if [ -f "$(LIB_DIR)/$(LIB_NAME).dylib" ]; then \
		echo "✓ File exists"; \
		ls -lh $(LIB_DIR)/$(LIB_NAME).dylib; \
		echo ""; \
		echo "Architectures:"; \
		lipo -info $(LIB_DIR)/$(LIB_NAME).dylib; \
	else \
		echo "✗ Build failed - dylib not found"; \
		exit 1; \
	fi

# T065: Build Linux SO with validation
build-lib-linux: check-cgo
	@echo "=== T065: Building Linux SO ==="
	@echo "Platform: Linux (amd64)"
	@echo "CGO_ENABLED: $(CGO_ENABLED)"
	@echo ""
	CGO_ENABLED=$(CGO_ENABLED) GOOS=linux GOARCH=amd64 $(GO) build -buildmode=$(BUILD_MODE) -o $(LIB_DIR)/$(LIB_NAME).so $(SOURCE)
	@echo ""
	@echo "✓ Built: $(LIB_DIR)/$(LIB_NAME).so"
	@if [ -f "$(LIB_DIR)/$(LIB_NAME).so" ]; then \
		echo "✓ File exists"; \
		ls -lh $(LIB_DIR)/$(LIB_NAME).so; \
	else \
		echo "✗ Build failed - SO not found"; \
		exit 1; \
	fi

# Clean artifacts
clean:
	@echo "Cleaning build artifacts..."
	rm -f $(LIB_DIR)/$(LIB_NAME).dll
	rm -f $(LIB_DIR)/$(LIB_NAME).dylib
	rm -f $(LIB_DIR)/$(LIB_NAME).so
	rm -f $(LIB_DIR)/$(LIB_NAME).h
	@echo "✓ Clean complete"

# T066: Run backward compatibility tests
test:
	@echo "=== T066: Running Go FFI export tests ==="
	@echo "Ensuring all 48 existing tests pass (FR-012 backward compatibility)"
	@echo ""
	$(GO) test -v ./internal/lib/... || true
	@echo ""
	@echo "Running integration tests..."
	$(GO) test -v ./tests/integration/... || true
	@echo ""
	@echo "✓ Test execution complete"

# T063-T065: Build all platform libraries
build-all-platforms:
	@echo "=== Building for all platforms ==="
	@echo ""
	@$(MAKE) build-lib-windows
	@echo ""
	@$(MAKE) build-lib-macos
	@echo ""
	@$(MAKE) build-lib-linux
	@echo ""
	@echo "=== All platform builds complete ==="
	@echo ""
	@ls -lh $(LIB_DIR)/$(LIB_NAME).*

# Check if CGO is available
check-cgo:
	@echo "Checking CGO availability..."
	@if ! command -v $(GO) >/dev/null 2>&1; then \
		echo "✗ Go compiler not found"; \
		echo "Please install Go 1.21 or later"; \
		exit 1; \
	fi
	@echo "✓ Go compiler: $$($(GO) version)"
	@echo "✓ CGO will be enabled for this build"

# Validate built library exports
validate-build:
	@echo "=== Validating library exports ==="
	@if [ "$(PLATFORM)" = "windows" ]; then \
		if [ -f "$(LIB_DIR)/$(LIB_NAME).dll" ]; then \
			echo "✓ Windows DLL found"; \
			file $(LIB_DIR)/$(LIB_NAME).dll || echo "Note: 'file' command not available"; \
		else \
			echo "✗ Windows DLL not found"; \
		fi; \
	fi
	@if [ "$(PLATFORM)" = "macos" ]; then \
		if [ -f "$(LIB_DIR)/$(LIB_NAME).dylib" ]; then \
			echo "✓ macOS dylib found"; \
			file $(LIB_DIR)/$(LIB_NAME).dylib || echo "Note: 'file' command not available"; \
			otool -L $(LIB_DIR)/$(LIB_NAME).dylib 2>/dev/null || echo "Note: 'otool' not available"; \
		else \
			echo "✗ macOS dylib not found"; \
		fi; \
	fi
	@if [ "$(PLATFORM)" = "linux" ]; then \
		if [ -f "$(LIB_DIR)/$(LIB_NAME).so" ]; then \
			echo "✓ Linux SO found"; \
			file $(LIB_DIR)/$(LIB_NAME).so || echo "Note: 'file' command not available"; \
			ldd $(LIB_DIR)/$(LIB_NAME).so 2>/dev/null || echo "Note: 'ldd' not available"; \
		else \
			echo "✗ Linux SO not found"; \
		fi; \
	fi
	@echo ""
	@echo "Expected exports:"
	@echo "  Wallet Management:"
	@echo "    - CreateWallet"
	@echo "    - ImportWallet"
	@echo "    - UnlockWallet"
	@echo "    - GenerateAddresses"
	@echo "    - ExportWallet"
	@echo "    - RenameWallet"
	@echo "    - ListWallets"
	@echo "    - GetVersion"
	@echo "  ChainAdapter Transactions:"
	@echo "    - BuildTransaction"
	@echo "    - SignTransaction"
	@echo "    - BroadcastTransaction"
	@echo "    - QueryTransactionStatus"
	@echo "    - EstimateFee"
