# Quickstart Guide: FFI Development & Debugging

**Feature**: Backend Communication Architecture Upgrade
**Branch**: `005-go-cli-shared`
**Last Updated**: 2025-10-25

## Overview

This guide helps developers quickly build, test, and debug the Go shared library and Rust Tauri integration. It follows Test-Driven Development (TDD) principles as required by the project constitution.

---

## Prerequisites

### Required Tools

| Tool | Version | Purpose | Install Command |
|------|---------|---------|----------------|
| Go | 1.21+ | Shared library compilation | [Download](https://go.dev/dl/) |
| Rust | 1.75+ | Tauri backend | `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \| sh` |
| Node.js | 18+ | Tauri frontend | [Download](https://nodejs.org/) |
| CGO | Enabled | C interop | Set `CGO_ENABLED=1` |
| GCC/Clang | Latest | C compiler | `apt install build-essential` (Linux) |

### Platform-Specific Setup

#### Windows
```powershell
# Install MinGW for CGO
choco install mingw

# Verify CGO works
go env CGO_ENABLED  # Should output: 1
```

#### macOS
```bash
# Xcode Command Line Tools (includes Clang)
xcode-select --install

# Verify CGO works
go env CGO_ENABLED  # Should output: 1
```

#### Linux
```bash
# Install build essentials
sudo apt-get update
sudo apt-get install build-essential

# Verify CGO works
go env CGO_ENABLED  # Should output: 1
```

---

## Project Structure

```
arcsign_v2/
├── internal/
│   └── lib/
│       ├── exports.go       # FFI export functions (NEW)
│       └── exports_test.go  # FFI unit tests (NEW)
├── dashboard/
│   └── src-tauri/
│       ├── src/
│       │   └── lib/
│       │       ├── wallet.rs       # Rust FFI wrapper (NEW)
│       │       └── wallet_test.rs  # Contract tests (NEW)
│       └── Cargo.toml
└── specs/005-go-cli-shared/
    ├── data-model.md      # FFI schemas
    ├── contracts/ffi-api.md  # C declarations
    └── quickstart.md      # This file
```

---

## Build Process

### Step 1: Build Go Shared Library

```bash
# Navigate to project root
cd arcsign_v2

# Build shared library (platform-specific output)
CGO_ENABLED=1 go build -buildmode=c-shared -o libarcsign.so internal/lib/*.go

# Platform-specific outputs:
# Windows: libarcsign.dll
# macOS:   libarcsign.dylib
# Linux:   libarcsign.so
```

**Verify Build**:
```bash
# Check library exports symbols
nm -g libarcsign.so | grep -E "(CreateWallet|GetVersion|GoFree)"

# Expected output:
# 00000000001234a0 T CreateWallet
# 00000000001234b0 T GetVersion
# 00000000001234c0 T GoFree
```

### Step 2: Copy Library to Tauri Directory

```bash
# Copy to Tauri resources (so it's bundled with app)
cp libarcsign.so dashboard/src-tauri/

# Or on Windows:
copy libarcsign.dll dashboard\src-tauri\
```

### Step 3: Build Tauri Application

```bash
cd dashboard

# Install frontend dependencies
npm install

# Build and run in development mode
npm run tauri dev

# Or build production binary
npm run tauri build
```

---

## Test-Driven Development Workflow

### TDD Cycle (Red-Green-Refactor)

Following the constitutional TDD requirement:

#### Phase 1: Red (Write Failing Test)

**Example**: Test `CreateWallet` FFI function

```go
// internal/lib/exports_test.go
package lib

import "C"
import (
    "encoding/json"
    "testing"
    "unsafe"
)

func TestCreateWallet_Success(t *testing.T) {
    // Arrange: Prepare test input
    params := map[string]string{
        "walletName": "TestWallet",
        "mnemonic":   "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about",
        "password":   "TestPass123!",
        "usbPath":    "/tmp/test_usb",
    }
    paramsJson, _ := json.Marshal(params)
    paramsC := C.CString(string(paramsJson))
    defer C.free(unsafe.Pointer(paramsC))

    // Act: Call FFI function
    resultC := CreateWallet(paramsC)
    defer GoFree(resultC)

    // Assert: Verify response
    result := C.GoString(resultC)
    var response FfiResponse
    err := json.Unmarshal([]byte(result), &response)
    if err != nil {
        t.Fatalf("Failed to parse response: %v", err)
    }

    if !response.Success {
        t.Errorf("Expected success=true, got %v", response.Success)
    }

    // This test WILL FAIL initially (Red phase)
}

// Run test (should fail)
// go test ./internal/lib -v -run TestCreateWallet_Success
```

**Expected Output (Red)**:
```
--- FAIL: TestCreateWallet_Success (0.00s)
    exports_test.go:25: Expected success=true, got false
FAIL
```

#### Phase 2: Green (Implement Minimal Code)

```go
// internal/lib/exports.go
package lib

import "C"
import (
    "encoding/json"
    "time"
)

//export CreateWallet
func CreateWallet(params *C.char) *C.char {
    // Minimal implementation to pass test
    paramsJson := C.GoString(params)

    var input struct {
        WalletName string `json:"walletName"`
        Mnemonic   string `json:"mnemonic"`
        Password   string `json:"password"`
        UsbPath    string `json:"usbPath"`
    }
    json.Unmarshal([]byte(paramsJson), &input)

    // Return success response
    result := map[string]interface{}{
        "success": true,
        "data": map[string]string{
            "walletId":   "test-id-123",
            "walletName": input.WalletName,
            "createdAt":  time.Now().Format(time.RFC3339),
        },
    }

    resultJson, _ := json.Marshal(result)
    return C.CString(string(resultJson))
}
```

**Run Test Again**:
```bash
go test ./internal/lib -v -run TestCreateWallet_Success

# Expected output (Green):
# --- PASS: TestCreateWallet_Success (0.00s)
# PASS
```

#### Phase 3: Refactor (Improve Code Quality)

```go
// Refactor: Add panic recovery, logging, proper error handling
//export CreateWallet
func CreateWallet(params *C.char) *C.char {
    start := time.Now()
    defer func() {
        log.Printf("CreateWallet completed in %v", time.Since(start))
    }()

    defer func() {
        if r := recover(); r != nil {
            log.Printf("CreateWallet panicked: %v", r)
        }
    }()

    // ... implementation with proper business logic
}
```

**Verify Tests Still Pass**:
```bash
go test ./internal/lib -v
# All tests should still pass after refactoring
```

---

## Running Tests

### Go Unit Tests (FFI Exports)

```bash
# Run all tests in internal/lib
go test ./internal/lib -v

# Run specific test
go test ./internal/lib -v -run TestCreateWallet

# Run with coverage
go test ./internal/lib -cover -coverprofile=coverage.out

# View coverage report
go tool cover -html=coverage.out
```

### Rust Contract Tests (FFI Integration)

```bash
cd dashboard/src-tauri

# Run all Rust tests
cargo test

# Run specific test module
cargo test wallet_test

# Run with output
cargo test -- --nocapture
```

### Manual Integration Test

```bash
# Build both components
CGO_ENABLED=1 go build -buildmode=c-shared -o libarcsign.so internal/lib/*.go
cp libarcsign.so dashboard/src-tauri/

cd dashboard
npm run tauri dev

# Then manually test in UI:
# 1. Click "Create Wallet"
# 2. Verify operation completes in <100ms
# 3. Check logs for "CreateWallet completed in XXms"
```

---

## Debugging

### Go-side Debugging

#### Enable Detailed Logging

```go
// internal/lib/exports.go
import "log"

func init() {
    log.SetFlags(log.LstdFlags | log.Lshortfile)
}

//export CreateWallet
func CreateWallet(params *C.char) *C.char {
    log.Printf("CreateWallet called with params: %s", C.GoString(params))
    // ... implementation
}
```

**View Logs**:
```bash
# Logs appear in Tauri dev console
npm run tauri dev

# Or redirect to file
npm run tauri dev 2>&1 | tee debug.log
```

#### Debug Memory Issues

```bash
# Run with race detector
go test ./internal/lib -race

# Run with memory sanitizer (requires CGO)
go test ./internal/lib -msan

# Check for memory leaks with valgrind
valgrind --leak-check=full ./your_test_binary
```

### Rust-side Debugging

#### Enable FFI Call Tracing

```rust
// dashboard/src-tauri/src/lib/wallet.rs
use log::{info, error};

impl WalletLibrary {
    pub fn create_wallet(&self, params: CreateWalletParams) -> Result<CreateWalletResponse, String> {
        info!("FFI: Calling CreateWallet with params: {:?}", params);

        unsafe {
            let start = std::time::Instant::now();
            let result = self.call_ffi_function(...);
            info!("FFI: CreateWallet completed in {:?}", start.elapsed());
            result
        }
    }
}
```

**View Logs**:
```bash
# Set log level
RUST_LOG=debug npm run tauri dev
```

#### Debug Library Loading Issues

```rust
// dashboard/src-tauri/src/lib/wallet.rs
pub fn load() -> Result<Self, String> {
    let lib_paths = [
        "libarcsign.so",
        "./libarcsign.so",
        "../libarcsign.so",
        "/usr/local/lib/libarcsign.so",
    ];

    for path in &lib_paths {
        match unsafe { Library::new(path) } {
            Ok(lib) => {
                println!("Successfully loaded library from: {}", path);
                return Ok(Self { lib });
            }
            Err(e) => {
                println!("Failed to load from {}: {}", path, e);
            }
        }
    }

    Err("Could not load shared library from any path".to_string())
}
```

---

## Performance Testing

### Measure Operation Latency

#### Go-side Timing

```go
//export CreateWallet
func CreateWallet(params *C.char) *C.char {
    start := time.Now()
    defer func() {
        elapsed := time.Since(start)
        log.Printf("CreateWallet: %v", elapsed)

        // Assert performance target
        if elapsed > 100*time.Millisecond {
            log.Printf("WARNING: CreateWallet exceeded 100ms target: %v", elapsed)
        }
    }()
    // ... implementation
}
```

#### Rust-side Timing

```rust
pub fn create_wallet(&self, params: CreateWalletParams) -> Result<CreateWalletResponse, String> {
    let start = std::time::Instant::now();
    let result = unsafe { /* FFI call */ };
    let elapsed = start.elapsed();

    info!("CreateWallet latency: {:?}", elapsed);

    if elapsed.as_millis() > 100 {
        warn!("CreateWallet exceeded 100ms target: {:?}", elapsed);
    }

    result
}
```

### Benchmark Tests

```go
// internal/lib/exports_test.go
func BenchmarkCreateWallet(b *testing.B) {
    params := createTestParams()
    paramsC := C.CString(params)
    defer C.free(unsafe.Pointer(paramsC))

    b.ResetTimer()
    for i := 0; i < b.N; i++ {
        resultC := CreateWallet(paramsC)
        GoFree(resultC)
    }
}

// Run benchmark
// go test ./internal/lib -bench=BenchmarkCreateWallet -benchmem
```

**Expected Output**:
```
BenchmarkCreateWallet-8    10000    95432 ns/op    2048 B/op    12 allocs/op
```

---

## Common Issues & Solutions

### Issue 1: "undefined reference to `GoFree`"

**Cause**: Go exports not visible to linker

**Solution**:
```bash
# Ensure exports are marked with //export comment
//export GoFree
func GoFree(ptr *C.char) { ... }

# Rebuild with verbose output
CGO_ENABLED=1 go build -v -buildmode=c-shared -o libarcsign.so internal/lib/*.go
```

### Issue 2: "library not found" at runtime

**Cause**: Shared library not in search path

**Solution**:
```bash
# Add to LD_LIBRARY_PATH (Linux)
export LD_LIBRARY_PATH=$LD_LIBRARY_PATH:/path/to/library

# Or copy to system library directory
sudo cp libarcsign.so /usr/local/lib/
sudo ldconfig

# Or set RPATH during build (Linux/macOS)
go build -ldflags "-r \$ORIGIN" -buildmode=c-shared ...
```

### Issue 3: Segmentation fault / Memory corruption

**Cause**: Forgot to call GoFree or double-free

**Solution**:
```rust
// Pattern: Call GoFree exactly once per FFI call
let result_ptr = unsafe { CreateWallet(params) };
let result = unsafe { CStr::from_ptr(result_ptr).to_string_lossy().into_owned() };
unsafe { GoFree(result_ptr) }; // CRITICAL: Call exactly once

// Do NOT call GoFree again on result_ptr
```

### Issue 4: Tests pass but UI crashes

**Cause**: Thread safety issue (concurrent FFI calls)

**Solution**:
```rust
// Use single-threaded queue (see contracts/ffi-api.md)
lazy_static! {
    static ref WALLET_QUEUE: Mutex<Sender<WalletCommand>> = { ... };
}

// All FFI calls go through queue
pub async fn create_wallet(&self, params: CreateWalletParams) -> Result<...> {
    let (tx, rx) = oneshot::channel();
    WALLET_QUEUE.lock().unwrap().send(WalletCommand::Create { params, tx }).await;
    rx.await.unwrap()
}
```

---

## Testing Checklist

Before submitting code, verify:

- [ ] All Go unit tests pass (`go test ./internal/lib -v`)
- [ ] All Rust contract tests pass (`cargo test`)
- [ ] No memory leaks detected (`go test -msan`)
- [ ] Performance targets met (see benchmarks)
- [ ] Manual UI test passes (create/import/unlock wallet)
- [ ] Logs contain no sensitive data (passwords, mnemonics)
- [ ] All FFI functions have panic recovery
- [ ] GoFree called for every non-null return

---

## Next Steps

1. **Phase 1**: Setup dependencies (T001-T008)
2. **Phase 2**: Implement core FFI functions following TDD cycle (T009-T020)
3. **Phase 3**: Implement user story features (T021-T063)
4. **Phase 4**: Performance testing & optimization (T064-T068)

**Refer to**: `specs/005-go-cli-shared/tasks.md` for detailed task breakdown

---

## Resources

- **FFI API Contract**: `specs/005-go-cli-shared/contracts/ffi-api.md`
- **Data Model**: `specs/005-go-cli-shared/data-model.md`
- **Task Breakdown**: `specs/005-go-cli-shared/tasks.md`
- **Go CGO Documentation**: https://pkg.go.dev/cmd/cgo
- **libloading Crate**: https://docs.rs/libloading/latest/libloading/
- **Tauri FFI Examples**: https://tauri.app/v1/guides/building/

---

**Questions?** Check the `contracts/ffi-api.md` for memory management patterns or consult the team.
