# FFI API Contract: C-Compatible Function Declarations

**Feature**: Backend Communication Architecture Upgrade
**Branch**: `005-go-cli-shared`
**Last Updated**: 2025-10-25

## Overview

This document defines the **exact C-compatible function signatures** that form the FFI boundary between Rust (Tauri frontend) and Go (shared library backend). Both sides MUST adhere to these declarations.

## Build Configuration

### Go Build Requirements

**CGO must be enabled** to compile shared library:

```bash
# Build shared library for current platform
CGO_ENABLED=1 go build -buildmode=c-shared -o libarcsign.so internal/lib/*.go

# Platform-specific outputs:
# - Windows: libarcsign.dll
# - macOS:   libarcsign.dylib
# - Linux:   libarcsign.so
```

**Build Flags**:
- `-buildmode=c-shared`: Generate C-compatible shared library
- `CGO_ENABLED=1`: Enable CGO for C interop

### Rust Build Requirements

Add to `dashboard/src-tauri/Cargo.toml`:

```toml
[dependencies]
libloading = "0.8"  # Dynamic library loading
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
```

## C Function Signatures

### 1. GetVersion

```c
// Returns library version information as JSON string
// Caller MUST call GoFree() on returned pointer
char* GetVersion();
```

**Memory Ownership**: Go allocates, Rust frees via GoFree

**Example Call**:
```rust
let version_ptr = unsafe { GetVersion() };
let version_json = unsafe { CStr::from_ptr(version_ptr).to_string_lossy().into_owned() };
unsafe { GoFree(version_ptr) };
```

---

### 2. CreateWallet

```c
// Creates new HD wallet from mnemonic
// params: JSON string (see data-model.md for schema)
// Returns: JSON result string (Caller MUST call GoFree)
char* CreateWallet(char* params);
```

**Parameter Format**: See `data-model.md` § CreateWallet Input

**Memory Ownership**:
- `params`: Rust allocates via `CString::new()`, Rust frees
- Return value: Go allocates via `C.CString()`, Rust frees via GoFree

**Example Call**:
```rust
let params = serde_json::json!({
    "walletName": "MyWallet",
    "mnemonic": "abandon abandon...",
    "password": "SecurePass123!",
    "usbPath": "/media/usb0"
});
let params_cstr = CString::new(params.to_string()).unwrap();
let result_ptr = unsafe { CreateWallet(params_cstr.as_ptr()) };
let result_json = unsafe { CStr::from_ptr(result_ptr).to_string_lossy().into_owned() };
unsafe { GoFree(result_ptr) };
```

---

### 3. ImportWallet

```c
// Imports existing wallet from mnemonic
// params: JSON string (see data-model.md for schema)
// Returns: JSON result string (Caller MUST call GoFree)
char* ImportWallet(char* params);
```

**Same memory contract as CreateWallet**

---

### 4. UnlockWallet

```c
// Authenticates and loads wallet into memory
// params: JSON string (see data-model.md for schema)
// Returns: JSON result string (Caller MUST call GoFree)
char* UnlockWallet(char* params);
```

**Same memory contract as CreateWallet**

---

### 5. GenerateAddresses

```c
// Derives addresses for specified blockchains
// params: JSON string (see data-model.md for schema)
// Returns: JSON result string with up to 54 addresses (Caller MUST call GoFree)
char* GenerateAddresses(char* params);
```

**Same memory contract as CreateWallet**

**Performance Note**: This function may take up to 2 seconds for 54 blockchains

---

### 6. ExportWallet

```c
// Exports wallet metadata (no private keys)
// params: JSON string (see data-model.md for schema)
// Returns: JSON result string (Caller MUST call GoFree)
char* ExportWallet(char* params);
```

**Same memory contract as CreateWallet**

---

### 7. RenameWallet

```c
// Changes wallet display name
// params: JSON string (see data-model.md for schema)
// Returns: JSON result string (Caller MUST call GoFree)
char* RenameWallet(char* params);
```

**Same memory contract as CreateWallet**

---

### 8. ListWallets

```c
// Enumerates all wallets on USB device
// params: JSON string (see data-model.md for schema)
// Returns: JSON result string with wallet array (Caller MUST call GoFree)
char* ListWallets(char* params);
```

**Same memory contract as CreateWallet**

---

### 9. GoFree

```c
// Frees Go-allocated memory
// ptr: Pointer returned by any FFI function
// Returns: void
void GoFree(char* ptr);
```

**CRITICAL**: Must be called for every non-null pointer returned by FFI functions

**Memory Safety**: Go implementation uses `C.free(unsafe.Pointer(ptr))`

---

## Go Implementation Template

### Export Function Pattern

All Go export functions follow this pattern:

```go
package main

import "C"
import (
    "encoding/json"
    "runtime/debug"
    "time"
    "log"
)

//export CreateWallet
func CreateWallet(params *C.char) *C.char {
    // Entry logging (FR-014)
    start := time.Now()
    defer func() {
        log.Printf("CreateWallet completed in %v", time.Since(start))
    }()

    // Panic recovery (prevents Rust process crash)
    defer func() {
        if r := recover(); r != nil {
            log.Printf("CreateWallet panicked: %v\n%s", r, debug.Stack())
        }
    }()

    // Convert C string to Go string
    paramsJson := C.GoString(params)

    // Parse JSON
    var input struct {
        WalletName string `json:"walletName"`
        Mnemonic   string `json:"mnemonic"`
        Password   string `json:"password"`
        UsbPath    string `json:"usbPath"`
    }
    if err := json.Unmarshal([]byte(paramsJson), &input); err != nil {
        return errorResponse("INVALID_INPUT", err.Error())
    }

    // Business logic here...
    result := map[string]interface{}{
        "success": true,
        "data": map[string]string{
            "walletId": "...",
            "walletName": input.WalletName,
            "createdAt": time.Now().Format(time.RFC3339),
        },
    }

    // Return JSON response
    resultJson, _ := json.Marshal(result)
    return C.CString(string(resultJson))
}

func errorResponse(code, message string) *C.char {
    response := map[string]interface{}{
        "success": false,
        "error": map[string]string{
            "code":    code,
            "message": message,
        },
    }
    resultJson, _ := json.Marshal(response)
    return C.CString(string(resultJson))
}
```

### GoFree Implementation

```go
//export GoFree
func GoFree(ptr *C.char) {
    defer func() {
        if r := recover(); r != nil {
            log.Printf("GoFree panicked (invalid pointer?): %v", r)
        }
    }()
    C.free(unsafe.Pointer(ptr))
}
```

---

## Rust Implementation Template

### Library Loading

```rust
use libloading::{Library, Symbol};
use std::ffi::{CStr, CString};
use std::os::raw::c_char;

pub struct WalletLibrary {
    lib: Library,
}

impl WalletLibrary {
    pub fn load() -> Result<Self, String> {
        #[cfg(target_os = "windows")]
        let lib_path = "libarcsign.dll";

        #[cfg(target_os = "macos")]
        let lib_path = "libarcsign.dylib";

        #[cfg(target_os = "linux")]
        let lib_path = "libarcsign.so";

        let lib = unsafe {
            Library::new(lib_path)
                .map_err(|e| format!("Failed to load library: {}", e))?
        };

        Ok(Self { lib })
    }

    pub fn get_version(&self) -> Result<String, String> {
        unsafe {
            let func: Symbol<unsafe extern "C" fn() -> *mut c_char> =
                self.lib.get(b"GetVersion")
                    .map_err(|e| format!("Function not found: {}", e))?;

            let result_ptr = func();
            if result_ptr.is_null() {
                return Err("GetVersion returned null".to_string());
            }

            let result_json = CStr::from_ptr(result_ptr)
                .to_string_lossy()
                .into_owned();

            // CRITICAL: Free Go-allocated memory
            let free_func: Symbol<unsafe extern "C" fn(*mut c_char)> =
                self.lib.get(b"GoFree").unwrap();
            free_func(result_ptr);

            Ok(result_json)
        }
    }

    pub fn create_wallet(&self, params: CreateWalletParams) -> Result<CreateWalletResponse, String> {
        unsafe {
            let func: Symbol<unsafe extern "C" fn(*const c_char) -> *mut c_char> =
                self.lib.get(b"CreateWallet")
                    .map_err(|e| format!("Function not found: {}", e))?;

            // Serialize params to JSON
            let params_json = serde_json::to_string(&params)
                .map_err(|e| format!("JSON serialization failed: {}", e))?;
            let params_cstr = CString::new(params_json)
                .map_err(|e| format!("CString conversion failed: {}", e))?;

            // Call FFI function
            let result_ptr = func(params_cstr.as_ptr());
            if result_ptr.is_null() {
                return Err("CreateWallet returned null".to_string());
            }

            let result_json = CStr::from_ptr(result_ptr)
                .to_string_lossy()
                .into_owned();

            // Free Go-allocated memory
            let free_func: Symbol<unsafe extern "C" fn(*mut c_char)> =
                self.lib.get(b"GoFree").unwrap();
            free_func(result_ptr);

            // Parse response
            let response: FfiResponse<CreateWalletResponse> = serde_json::from_str(&result_json)
                .map_err(|e| format!("JSON deserialization failed: {}", e))?;

            if response.success {
                Ok(response.data.unwrap())
            } else {
                Err(format!("{}: {}",
                    response.error.as_ref().unwrap().code,
                    response.error.as_ref().unwrap().message))
            }
        }
    }
}

// Cleanup library when dropped
impl Drop for WalletLibrary {
    fn drop(&mut self) {
        // Library automatically unloaded by libloading
        log::info!("WalletLibrary dropped, shared library unloaded");
    }
}
```

### Type Definitions

```rust
use serde::{Deserialize, Serialize};

#[derive(Serialize)]
pub struct CreateWalletParams {
    #[serde(rename = "walletName")]
    pub wallet_name: String,
    pub mnemonic: String,
    pub password: String,
    #[serde(rename = "usbPath")]
    pub usb_path: String,
}

#[derive(Deserialize)]
pub struct CreateWalletResponse {
    #[serde(rename = "walletId")]
    pub wallet_id: String,
    #[serde(rename = "walletName")]
    pub wallet_name: String,
    #[serde(rename = "createdAt")]
    pub created_at: String,
}

#[derive(Deserialize)]
pub struct FfiResponse<T> {
    pub success: bool,
    pub data: Option<T>,
    pub error: Option<FfiError>,
}

#[derive(Deserialize)]
pub struct FfiError {
    pub code: String,
    pub message: String,
}
```

---

## Error Handling Contract

### Panic Recovery (Go-side)

All export functions MUST wrap business logic with:

```go
defer func() {
    if r := recover(); r != nil {
        log.Printf("Function panicked: %v", r)
        // Return LIBRARY_PANIC error instead of crashing Rust
    }
}()
```

**Rationale**: Go panics would crash entire Rust process. Recovery prevents data loss.

### Error Propagation (Rust-side)

Rust MUST check for null pointers before dereferencing:

```rust
if result_ptr.is_null() {
    return Err("FFI function returned null".to_string());
}
```

---

## Thread Safety

**Single-threaded Queue**: Rust serializes all FFI calls through Tokio channel.

**Go-side**: No locking required (single-threaded access guaranteed by Rust)

```rust
lazy_static! {
    static ref WALLET_QUEUE: Mutex<Sender<WalletCommand>> = {
        let (tx, mut rx) = mpsc::channel(32);
        tokio::spawn(async move {
            while let Some(cmd) = rx.recv().await {
                tokio::task::spawn_blocking(move || {
                    // All FFI calls happen here sequentially
                });
            }
        });
        Mutex::new(tx)
    };
}
```

---

## Testing Contract

### Unit Testing Go Exports

Go exports can be tested without Rust by calling them from Go test code:

```go
func TestCreateWallet(t *testing.T) {
    params := `{"walletName":"test","mnemonic":"abandon abandon...","password":"test123","usbPath":"/tmp/usb"}`
    paramsC := C.CString(params)
    defer C.free(unsafe.Pointer(paramsC))

    resultC := CreateWallet(paramsC)
    defer GoFree(resultC)

    result := C.GoString(resultC)
    // Assert JSON response
}
```

### Contract Testing

Verify Rust-Go interop by testing:
1. **Memory leaks**: Run valgrind/asan on repeated calls
2. **Null handling**: Pass null pointers (should not crash)
3. **Large payloads**: Test 54-address generation response
4. **Panic recovery**: Trigger Go panic, verify error response

---

## Platform-Specific Considerations

### Windows

- DLL must be in same directory as executable OR in PATH
- Use `LoadLibraryW` under the hood (libloading handles this)

### macOS

- Dylib must have `@rpath` or absolute path
- May need codesigning: `codesign -s - libarcsign.dylib`

### Linux

- SO must be in LD_LIBRARY_PATH or executable directory
- Consider setting RPATH during build: `-ldflags "-r \$ORIGIN"`

---

## Security Audit Checklist

- [ ] All export functions have panic recovery
- [ ] No sensitive data logged (passwords, mnemonics)
- [ ] Memory zeroized after use (passwords, mnemonics)
- [ ] GoFree called for every non-null return
- [ ] Input validation before business logic
- [ ] Error messages do not leak implementation details

---

**Next Steps**:
1. Implement Go export functions in `internal/lib/exports.go` (Phase 2 tasks)
2. Implement Rust wrapper in `dashboard/src-tauri/src/lib/wallet.rs` (Phase 2 tasks)
3. Write contract tests (TDD Phase 3 tasks)
