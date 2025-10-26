# Go-to-Rust FFI Integration Research
**Project**: arcSignv2 Shared Library Migration
**Feature**: 005-go-cli-shared
**Date**: 2025-10-24
**Target**: 5-10x performance improvement over subprocess CLI calls

---

## Executive Summary

This document captures research and architectural decisions for migrating from subprocess CLI calls to native shared library integration between Go 1.21+ backend (compiled with `-buildmode=c-shared`) and Rust 1.75+ Tauri frontend using FFI bindings. The design prioritizes security, performance, and cross-platform compatibility while maintaining identical behavior to the current implementation.

---

## Decision 1: FFI Library Loading Strategy

### Decision
**Use `libloading` crate for dynamic library loading in Rust**

### Rationale

1. **Memory Safety Guarantees**: libloading is the Rust FAQ officially endorsed method for dynamic library loading. It provides bindings around platform-specific loading primitives (dlopen on Unix, LoadLibrary on Windows) with significantly improved memory safety compared to raw FFI.

2. **Lifetime Enforcement**: The compiler ensures that loaded function symbols don't outlive the `Library` object they come from, preventing dangling function pointers that could cause crashes or undefined behavior.

3. **Cross-Platform Abstraction**: libloading provides a consistent API across Windows (.dll), macOS (.dylib), and Linux (.so), eliminating platform-specific conditional compilation for library loading logic.

4. **Error Handling**: While not perfect (dlerror is not MT-safe on some UNIX platforms), libloading provides better error reporting than raw dlopen/LoadLibrary calls.

5. **Industry Adoption**: Used by major Rust projects requiring dynamic loading, demonstrating production readiness.

### Alternatives Considered

1. **Raw dlopen/LoadLibrary**: Rejected due to lack of safety guarantees and platform-specific code duplication.

2. **Static Linking**: Would eliminate runtime loading but:
   - Increases binary size significantly
   - Prevents independent updates to Go library
   - Complicates build process (requires Go library rebuild for every Tauri compilation)
   - Not suitable for plugin architectures

3. **dlopen crate**: Less mature than libloading, smaller community, fewer safety guarantees.

### Implementation Notes

```rust
// Load library at Tauri app startup
use libloading::{Library, Symbol};

pub struct ArcSignLib {
    lib: Library,
}

impl ArcSignLib {
    pub fn new() -> Result<Self, String> {
        // Platform-specific library names handled by libloading
        #[cfg(target_os = "windows")]
        let lib_path = "arcsign.dll";

        #[cfg(target_os = "macos")]
        let lib_path = "libarcsign.dylib";

        #[cfg(target_os = "linux")]
        let lib_path = "libarcsign.so";

        let lib = unsafe {
            Library::new(lib_path)
                .map_err(|e| format!("Failed to load library: {}", e))?
        };

        Ok(ArcSignLib { lib })
    }
}
```

### Thread Safety Considerations

- Library loading from multiple threads requires absolute/relative paths (not search path)
- On FreeBSD and platforms where dlerror is not MT-safe, use `os::unix::Library::get_singlethreaded` for null pointer handling
- Use `Arc<Library>` for sharing library reference across threads
- Symbol lookups should be cached to avoid repeated unsafe operations

---

## Decision 2: Memory Management Across FFI Boundary

### Decision
**JSON string return pattern with explicit memory ownership transfer**

Use a hybrid approach:
- Go allocates and returns JSON strings via `C.CString`
- Rust receives, copies, and immediately frees the C string
- All complex data structures serialized as JSON
- Sensitive data (mnemonics, private keys) use secure memory patterns with explicit zeroing

### Rationale

1. **Safety First**: Explicit ownership transfer prevents memory leaks and use-after-free bugs. The pattern of "allocate in Go, copy in Rust, free immediately" is clear and verifiable.

2. **Simplicity**: JSON serialization handles complex data structures without defining C-compatible structs for every data type, reducing FFI surface area and ABI compatibility concerns.

3. **Debugging**: JSON strings are human-readable, making debugging FFI issues significantly easier than binary struct layouts.

4. **Security**: Sensitive data can be explicitly zeroed using Rust's `zeroize` crate and Go's secure memory patterns, ensuring cryptographic material doesn't linger in memory.

5. **Performance**: While JSON has overhead, for wallet operations (infrequent, high-latency crypto operations), the serialization cost is negligible compared to cryptographic operations. The 5-10x target is achievable by eliminating subprocess overhead, not micro-optimizing FFI calls.

### Alternatives Considered

1. **Direct Struct Passing**:
   - Rejected due to ABI compatibility concerns between Go and C
   - Requires complex C struct definitions
   - Version mismatches between Go and Rust struct definitions cause crashes
   - Harder to evolve API

2. **Protocol Buffers/MessagePack**:
   - Adds dependency complexity
   - Minimal performance benefit for infrequent operations
   - Less debuggable than JSON

3. **Error Code with Global State**:
   - Traditional C pattern (errno-like)
   - Rejected due to thread-safety concerns
   - Less expressive than JSON for complex error contexts

### Implementation Pattern

**Go Side (Export)**:
```go
//export GenerateWallet
func GenerateWallet(mnemonic *C.char) *C.char {
    defer func() {
        if mnemonic != nil {
            C.free(unsafe.Pointer(mnemonic))
        }
    }()

    result := struct {
        Success bool   `json:"success"`
        Data    string `json:"data,omitempty"`
        Error   string `json:"error,omitempty"`
    }{}

    // Wallet generation logic...

    jsonBytes, _ := json.Marshal(result)
    return C.CString(string(jsonBytes))
}

//export FreeString
func FreeString(s *C.char) {
    C.free(unsafe.Pointer(s))
}
```

**Rust Side (Consumer)**:
```rust
use libloading::{Library, Symbol};
use serde::{Deserialize, Serialize};
use zeroize::Zeroize;

#[derive(Deserialize)]
struct WalletResult {
    success: bool,
    data: Option<String>,
    error: Option<String>,
}

impl ArcSignLib {
    pub fn generate_wallet(&self, mnemonic: &str) -> Result<String, String> {
        unsafe {
            // Get function pointers
            let generate_wallet: Symbol<unsafe extern "C" fn(*const c_char) -> *mut c_char> =
                self.lib.get(b"GenerateWallet")
                    .map_err(|e| format!("Symbol not found: {}", e))?;

            let free_string: Symbol<unsafe extern "C" fn(*mut c_char)> =
                self.lib.get(b"FreeString")
                    .map_err(|e| format!("Symbol not found: {}", e))?;

            // Convert Rust string to C string
            let c_mnemonic = CString::new(mnemonic)
                .map_err(|e| format!("Invalid mnemonic: {}", e))?;

            // Call Go function
            let result_ptr = generate_wallet(c_mnemonic.as_ptr());

            // Convert C string to Rust string (copy)
            let result_str = CStr::from_ptr(result_ptr)
                .to_string_lossy()
                .into_owned();

            // Free C string immediately
            free_string(result_ptr);

            // Zeroize sensitive data
            let mut mnemonic_copy = mnemonic.to_string();
            mnemonic_copy.zeroize();

            // Parse JSON result
            let result: WalletResult = serde_json::from_str(&result_str)
                .map_err(|e| format!("JSON parse error: {}", e))?;

            if result.success {
                Ok(result.data.unwrap_or_default())
            } else {
                Err(result.error.unwrap_or("Unknown error".to_string()))
            }
        }
    }
}
```

### Security Considerations for Sensitive Data

1. **Use `zeroize` crate in Rust**: Ensures sensitive strings are securely wiped from memory using `core::ptr::write_volatile` and memory fences, preventing compiler optimizations from removing zeroing operations.

2. **Go Memory Zeroing**:
```go
func secureZeroMemory(b []byte) {
    for i := range b {
        b[i] = 0
    }
    runtime.KeepAlive(b) // Prevent GC from freeing before zeroing
}
```

3. **Minimize Sensitive Data Lifetime**:
   - Receive mnemonic from Tauri frontend
   - Pass to Go FFI immediately
   - Zero in both Rust and Go after use
   - Avoid storing in intermediate variables

4. **Memory Locking** (Future Enhancement):
   - Consider using `mlock` (Unix) / `VirtualLock` (Windows) to prevent sensitive pages from being swapped to disk
   - Requires additional privileges and complexity
   - Defer to Phase 2 unless required for security audit

### Memory Leak Prevention Checklist

- [ ] Every `C.CString` allocation has corresponding `C.free`
- [ ] Use `defer C.free(unsafe.Pointer(cs))` pattern consistently
- [ ] Never call C functions with inline `C.CString` (prevents freeing)
- [ ] Export `FreeString` helper from Go for Rust to call
- [ ] Rust copies C strings immediately, doesn't hold pointers
- [ ] Unit tests with Valgrind/LeakSanitizer to detect leaks

---

## Decision 3: Error Handling Pattern

### Decision
**JSON-based structured error responses with success flag and optional error field**

```json
{
  "success": true|false,
  "data": "...",         // Present only if success=true
  "error": "...",        // Present only if success=false
  "error_code": "..."    // Optional: machine-readable error code
}
```

### Rationale

1. **Expressiveness**: JSON allows rich error context (codes, messages, stack traces if needed) without C ABI limitations.

2. **Consistency**: Same pattern for all FFI functions reduces cognitive load and error-prone special casing.

3. **Debuggability**: Human-readable error messages in JSON simplify troubleshooting. Logs can capture full JSON responses.

4. **Forward Compatibility**: Adding new fields (e.g., `error_code`, `details`) doesn't break existing code due to JSON's flexibility.

5. **Type Safety**: Rust's `serde_json` ensures compile-time checked deserialization with proper error handling.

6. **No Global State**: Unlike errno-style patterns, errors are returned in-band, eliminating thread-safety concerns.

### Alternatives Considered

1. **Integer Error Codes + errno Pattern**:
   - Traditional C approach
   - Thread-unsafe without thread-local storage
   - Requires separate function to retrieve error message
   - Less expressive (no context beyond code)
   - Example: `int GenerateWallet(...); char* GetLastError();`

2. **Out Parameter for Error**:
   ```c
   char* GenerateWallet(const char* mnemonic, char** error_out);
   ```
   - Complex memory management (who frees what?)
   - Doesn't compose well with JSON data returns
   - Still requires JSON for complex errors

3. **Exceptions/Panics**:
   - **CRITICAL**: Never allow Go panics or Rust panics to cross FFI boundary
   - Causes undefined behavior and crashes
   - Must catch all panics in Go exports and Rust calls

### Implementation: Panic Safety

**Go Side**:
```go
//export GenerateWallet
func GenerateWallet(mnemonic *C.char) *C.char {
    // Catch panics and convert to error JSON
    defer func() {
        if r := recover(); r != nil {
            result := struct {
                Success bool   `json:"success"`
                Error   string `json:"error"`
            }{
                Success: false,
                Error:   fmt.Sprintf("Internal error: %v", r),
            }
            jsonBytes, _ := json.Marshal(result)
            return C.CString(string(jsonBytes))
        }
    }()

    // Normal execution...
}
```

**Rust Side**:
```rust
use std::panic::{catch_unwind, AssertUnwindSafe};

impl ArcSignLib {
    pub fn call_ffi_safe<F, R>(&self, f: F) -> Result<R, String>
    where
        F: FnOnce() -> Result<R, String>,
    {
        // Catch Rust panics before they cross FFI boundary
        catch_unwind(AssertUnwindSafe(f))
            .unwrap_or_else(|_| Err("FFI panic".to_string()))
    }
}
```

### Error Code Catalog (Future Enhancement)

For machine-readable error handling, define error code enum:

```rust
#[derive(Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ArcSignErrorCode {
    InvalidMnemonic,
    InvalidPassphrase,
    WalletAlreadyExists,
    InsufficientEntropy,
    FileSystemError,
    CryptoError,
    InternalError,
}
```

---

## Decision 4: Thread Safety

### Decision
**Thread-safe library with single-threaded FFI call execution**

- Go library exports must be safe for concurrent calls (use sync.Mutex where needed)
- Rust loads library once at startup using `Arc<Library>` for shared access
- FFI calls execute on Tauri's main thread or dedicated worker thread
- Avoid concurrent FFI calls to same function (queue if needed)

### Rationale

1. **Safety Over Performance**: Wallet operations are infrequent (user-initiated). Correctness trumps maximum concurrency.

2. **Go Runtime Constraints**: cgo calls pin goroutines to OS threads, causing thread proliferation under high concurrency. Single-threaded FFI calls avoid this.

3. **Library Loading**: libloading's thread safety is platform-dependent (dlerror issues on some UNIX systems). Loading once at startup eliminates runtime loading races.

4. **Simplicity**: Avoids complex locking strategies between Go and Rust. Clear ownership: one thread calls FFI at a time.

5. **Future Scaling**: If performance becomes an issue, profile first, then optimize. Premature complexity is avoided.

### Alternatives Considered

1. **Fully Concurrent FFI**:
   - Requires extensive locking in Go exports
   - cgo thread proliferation under load
   - Complex debugging of race conditions across FFI boundary
   - Minimal benefit for infrequent operations

2. **Process Pool** (like subprocess but with FFI):
   - Overengineered for wallet operations
   - Adds complexity without proven need

3. **Lock-Free Data Structures**:
   - Extremely complex across FFI boundary
   - No standard cross-language lock-free primitives
   - Not justified by performance requirements

### Implementation: Async Tauri Commands with Sync FFI

```rust
use tauri::State;
use tokio::sync::Mutex;

pub struct ArcSignLibState {
    lib: Arc<Mutex<ArcSignLib>>,
}

#[tauri::command]
async fn generate_wallet(
    mnemonic: String,
    state: State<'_, ArcSignLibState>,
) -> Result<String, String> {
    // Acquire lock (blocks if another FFI call in progress)
    let lib = state.lib.lock().await;

    // Execute FFI call on current thread
    tokio::task::block_in_place(|| {
        lib.generate_wallet(&mnemonic)
    })
}
```

### Go Export Thread Safety

```go
var (
    walletMutex sync.Mutex
)

//export GenerateWallet
func GenerateWallet(mnemonic *C.char) *C.char {
    walletMutex.Lock()
    defer walletMutex.Unlock()

    // Thread-safe execution
    // ...
}
```

### Testing Strategy

1. **Unit Tests**: Single-threaded FFI call correctness
2. **Integration Tests**: Sequential FFI calls (realistic user flow)
3. **Stress Tests**: Rapid sequential calls to detect memory leaks
4. **Future**: If concurrency added, use ThreadSanitizer and RaceSanitizer

---

## Decision 5: Cross-Platform Compilation

### Decision
**Platform-specific compilation with CI/CD build matrix**

Build artifacts:
- **Windows**: `arcsign.dll` (x86_64-pc-windows-msvc)
- **macOS**: `libarcsign.dylib` (x86_64-apple-darwin, aarch64-apple-darwin)
- **Linux**: `libarcsign.so` (x86_64-unknown-linux-gnu)

### Rationale

1. **Native Performance**: Each platform gets optimized binary (no cross-compilation performance penalties).

2. **Toolchain Simplicity**: Building on native platform avoids complex cross-compilation toolchain setup (MinGW for Windows, osxcross for macOS, etc.).

3. **Testing Accuracy**: Artifacts tested on platform they'll run on, avoiding subtle cross-compilation bugs.

4. **CI/CD Integration**: GitHub Actions provides free runners for all three platforms, making native builds straightforward.

5. **Go cgo Cross-Compilation Challenges**: cgo cross-compilation requires platform-specific C toolchains. Native builds eliminate this complexity.

### Alternatives Considered

1. **Cross-Compilation**:
   - Linux → Windows: Requires MinGW-w64, complex setup
   - Linux → macOS: Requires osxcross (unofficial, fragile)
   - Error-prone and hard to debug platform-specific issues
   - Only justified if CI/CD runners unavailable (not our case)

2. **Docker-Based Builds**:
   - Useful for Linux builds on non-Linux hosts
   - Adds Docker dependency and complexity
   - Defer unless needed

3. **Single Static Binary**:
   - Would require statically linking Go runtime into Tauri
   - Not supported by Go's c-shared buildmode
   - Huge binary size

### Build Process

**Go Library Compilation**:

```bash
# Windows (on Windows host)
set CGO_ENABLED=1
set GOOS=windows
set GOARCH=amd64
go build -buildmode=c-shared -o arcsign.dll cmd/arcsign/main.go

# macOS Intel (on macOS host)
CGO_ENABLED=1 GOOS=darwin GOARCH=amd64 \
  go build -buildmode=c-shared -o libarcsign.dylib cmd/arcsign/main.go

# macOS ARM (on macOS host)
CGO_ENABLED=1 GOOS=darwin GOARCH=arm64 \
  go build -buildmode=c-shared -o libarcsign.dylib cmd/arcsign/main.go

# Linux (on Linux host)
CGO_ENABLED=1 GOOS=linux GOARCH=amd64 \
  go build -buildmode=c-shared -o libarcsign.so cmd/arcsign/main.go
```

**Tauri Bundle Configuration**:

```json
// tauri.conf.json
{
  "bundle": {
    "resources": [
      "libs/arcsign.dll",      // Windows
      "libs/libarcsign.dylib", // macOS
      "libs/libarcsign.so"     // Linux
    ]
  }
}
```

**Runtime Library Discovery** (Rust):

```rust
use std::env;

fn get_library_path() -> PathBuf {
    let mut path = env::current_exe()
        .expect("Failed to get executable path")
        .parent()
        .expect("Failed to get parent directory")
        .to_path_buf();

    #[cfg(target_os = "windows")]
    path.push("arcsign.dll");

    #[cfg(target_os = "macos")]
    path.push("libarcsign.dylib");

    #[cfg(target_os = "linux")]
    path.push("libarcsign.so");

    path
}
```

### CI/CD GitHub Actions Workflow

```yaml
name: Build FFI Libraries

on: [push, pull_request]

jobs:
  build-windows:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with:
          go-version: '1.21'
      - name: Build Windows DLL
        run: |
          $env:CGO_ENABLED=1
          go build -buildmode=c-shared -o arcsign.dll cmd/arcsign/main.go
      - uses: actions/upload-artifact@v4
        with:
          name: arcsign-windows
          path: arcsign.dll

  build-macos:
    runs-on: macos-latest
    strategy:
      matrix:
        arch: [amd64, arm64]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with:
          go-version: '1.21'
      - name: Build macOS dylib
        run: |
          CGO_ENABLED=1 GOARCH=${{ matrix.arch }} \
            go build -buildmode=c-shared -o libarcsign-${{ matrix.arch }}.dylib cmd/arcsign/main.go
      - uses: actions/upload-artifact@v4
        with:
          name: arcsign-macos-${{ matrix.arch }}
          path: libarcsign-${{ matrix.arch }}.dylib

  build-linux:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with:
          go-version: '1.21'
      - name: Build Linux SO
        run: |
          CGO_ENABLED=1 go build -buildmode=c-shared -o libarcsign.so cmd/arcsign/main.go
      - uses: actions/upload-artifact@v4
        with:
          name: arcsign-linux
          path: libarcsign.so

  test-integration:
    needs: [build-windows, build-macos, build-linux]
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [windows-latest, macos-latest, ubuntu-latest]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/download-artifact@v4
      - name: Run FFI integration tests
        run: cargo test --release
```

### Versioning and Compatibility

1. **Semantic Versioning**: Go library and Rust bindings share version number
2. **Version Check Export**:
   ```go
   //export GetVersion
   func GetVersion() *C.char {
       return C.CString("1.0.0")
   }
   ```
3. **Startup Validation**: Rust checks Go library version on load
4. **Breaking Changes**: Major version bump requires Tauri rebuild

---

## Performance Optimization Techniques

### 1. Minimize FFI Calls

**Anti-Pattern**:
```rust
// 3 FFI calls
let wallet = lib.create_wallet(mnemonic);
let address = lib.get_address(wallet, 0);
let balance = lib.get_balance(address);
```

**Optimized**:
```rust
// 1 FFI call with batch operation
let result = lib.create_wallet_with_initial_addresses(mnemonic, address_count);
```

### 2. Batch Operations

Expose batch functions in Go that perform multiple operations and return aggregate JSON:

```go
//export GenerateAddresses
func GenerateAddresses(walletID *C.char, count C.int) *C.char {
    addresses := make([]string, count)
    for i := 0; i < int(count); i++ {
        addresses[i] = generateAddress(walletID, i)
    }
    // Return all addresses in single JSON response
}
```

### 3. Cache Function Pointers

**Anti-Pattern**:
```rust
// Look up symbol on every call
pub fn generate_wallet(&self, mnemonic: &str) -> Result<String, String> {
    let generate_wallet: Symbol<_> = self.lib.get(b"GenerateWallet")?; // ❌ Slow
    // ...
}
```

**Optimized**:
```rust
pub struct ArcSignLib {
    lib: Library,
    // Cache function pointers
    generate_wallet_fn: Symbol<unsafe extern "C" fn(*const c_char) -> *mut c_char>,
    free_string_fn: Symbol<unsafe extern "C" fn(*mut c_char)>,
}

impl ArcSignLib {
    pub fn new() -> Result<Self, String> {
        let lib = unsafe { Library::new(lib_path)? };

        // Load symbols once
        let generate_wallet_fn = unsafe {
            lib.get(b"GenerateWallet")?
        };
        let free_string_fn = unsafe {
            lib.get(b"FreeString")?
        };

        Ok(ArcSignLib { lib, generate_wallet_fn, free_string_fn })
    }

    pub fn generate_wallet(&self, mnemonic: &str) -> Result<String, String> {
        // Use cached function pointer ✅ Fast
        // ...
    }
}
```

### 4. Avoid Unnecessary String Conversions

Use byte slices where possible:

```rust
// If Go can accept byte slice instead of null-terminated string
let bytes = mnemonic.as_bytes();
let result = call_go_function(bytes.as_ptr(), bytes.len());
```

### 5. Profile Before Optimizing

Use tools to identify bottlenecks:
- **Rust**: `cargo flamegraph`
- **Go**: `go tool pprof`
- **System**: `perf` (Linux), Instruments (macOS)

Expected performance breakdown:
- Subprocess overhead (eliminated): ~50-100ms per call
- FFI overhead (new): ~1-10μs per call
- Crypto operations (unchanged): ~10-500ms depending on operation

**Target achieved**: Subprocess elimination alone provides 5-10x speedup for fast operations, with crypto operations seeing smaller relative gains.

---

## Security Considerations

### 1. Sensitive Data Handling

**Principle**: Minimize sensitive data lifetime and ensure secure erasure.

**Implementation**:

```rust
use zeroize::{Zeroize, ZeroizeOnDrop};

#[derive(Zeroize, ZeroizeOnDrop)]
struct SensitiveString(String);

impl SensitiveString {
    fn new(s: String) -> Self {
        SensitiveString(s)
    }

    fn as_str(&self) -> &str {
        &self.0
    }
}

// Automatically zeroed on drop
let mnemonic = SensitiveString::new(user_input);
let result = lib.generate_wallet(mnemonic.as_str())?;
// mnemonic zeroed here when it goes out of scope
```

**Go Side**:
```go
func secureZeroBytes(b []byte) {
    for i := range b {
        b[i] = 0
    }
    runtime.KeepAlive(b)
}

//export GenerateWallet
func GenerateWallet(mnemonic *C.char) *C.char {
    mnemonicBytes := []byte(C.GoString(mnemonic))
    defer secureZeroBytes(mnemonicBytes)

    // Use mnemonicBytes...
}
```

### 2. Input Validation

**Always validate inputs before FFI calls**:

```rust
pub fn generate_wallet(&self, mnemonic: &str) -> Result<String, String> {
    // Validate before crossing FFI boundary
    if mnemonic.is_empty() {
        return Err("Mnemonic cannot be empty".to_string());
    }

    if !mnemonic.is_ascii() {
        return Err("Mnemonic must be ASCII".to_string());
    }

    // Safe to call FFI now
    self.call_ffi_generate_wallet(mnemonic)
}
```

### 3. Prevent Format String Vulnerabilities

**Never pass user input directly to C string formatting**:

```go
// ❌ WRONG
log.Printf(userInput)

// ✅ CORRECT
log.Printf("%s", userInput)
```

### 4. Library Signature Verification (Future)

For production deployments:
1. Sign Go shared libraries with code signing certificate
2. Verify signature before loading in Rust
3. Detect tampering or malicious library replacement

```rust
#[cfg(target_os = "windows")]
fn verify_authenticode_signature(dll_path: &Path) -> Result<(), String> {
    // WinVerifyTrust API
    // Implementation details...
}
```

### 5. Sandboxing Considerations

- Go library runs in same process as Tauri (no process isolation)
- Consider Tauri's security context restrictions
- Avoid exposing unnecessary FFI functions (minimize attack surface)

---

## Industry Examples and References

### Ledger Live Architecture

**Source**: https://developers.ledger.com/docs/blockchain/getting-started/general-architecture

- **lib-ledger-core**: C++ library for blockchain operations
- **Bindings**: React Native bindings via ledger-core-react-native-bindings
- **Pattern**: Native library with JS/TS frontend (similar to our Go + Rust approach)
- **Takeaway**: Proven architecture for cryptocurrency wallet applications using FFI

### Trezor Suite

**Source**: https://github.com/trezor/trezor-suite (Issue #6558)

- Investigating migration from JS crypto libraries to native binaries (bcrypto)
- **Rationale**: Performance (10-100x faster) and security (native code harder to extract via devtools)
- **Takeaway**: Industry trend toward native libraries for performance-critical crypto operations

### Mozilla Firefox (Rust FFI in C++ codebase)

- Extensive use of Rust components via FFI in browser engine
- **Pattern**: Safe Rust internals with C-compatible FFI boundary
- **Takeaway**: Rust FFI is production-ready at massive scale

### Rustgo (Filippo Valsorda)

**Source**: https://words.filippo.io/rustgo/

- Near-zero overhead Go-to-Rust FFI for cryptography
- **Technique**: Eliminates cgo overhead using static linking and custom calling conventions
- **Takeaway**: Advanced optimization possible, but standard cgo/FFI sufficient for our use case

---

## Testing Strategy

### Unit Tests

**Rust Side**:
```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_wallet_success() {
        let lib = ArcSignLib::new().unwrap();
        let mnemonic = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
        let result = lib.generate_wallet(mnemonic);
        assert!(result.is_ok());
    }

    #[test]
    fn test_generate_wallet_invalid_mnemonic() {
        let lib = ArcSignLib::new().unwrap();
        let result = lib.generate_wallet("invalid");
        assert!(result.is_err());
    }
}
```

**Go Side**:
```go
func TestGenerateWallet(t *testing.T) {
    mnemonic := C.CString("abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about")
    defer C.free(unsafe.Pointer(mnemonic))

    result := GenerateWallet(mnemonic)
    defer FreeString(result)

    jsonStr := C.GoString(result)
    var response WalletResponse
    json.Unmarshal([]byte(jsonStr), &response)

    if !response.Success {
        t.Errorf("Expected success, got error: %s", response.Error)
    }
}
```

### Integration Tests

**End-to-End Workflow**:
```rust
#[test]
fn test_full_wallet_creation_workflow() {
    let lib = ArcSignLib::new().unwrap();

    // Generate mnemonic
    let mnemonic = lib.generate_mnemonic().unwrap();

    // Create wallet
    let wallet_id = lib.create_wallet(&mnemonic, "password").unwrap();

    // Generate addresses
    let addresses = lib.generate_addresses(&wallet_id, 5).unwrap();
    assert_eq!(addresses.len(), 5);

    // Export wallet
    let exported = lib.export_wallet(&wallet_id, "password").unwrap();
    assert!(exported.contains("wallet"));
}
```

### Memory Leak Detection

**Valgrind (Linux)**:
```bash
valgrind --leak-check=full --show-leak-kinds=all ./target/release/arcsign_test
```

**LeakSanitizer (Linux/macOS)**:
```bash
RUSTFLAGS="-Z sanitizer=leak" cargo test --target x86_64-unknown-linux-gnu
```

**Dr. Memory (Windows)**:
```cmd
drmemory -show_reachable -- .\target\release\arcsign_test.exe
```

### Performance Benchmarks

**Criterion.rs Benchmarks**:
```rust
use criterion::{black_box, criterion_group, criterion_main, Criterion};

fn bench_generate_wallet(c: &mut Criterion) {
    let lib = ArcSignLib::new().unwrap();
    let mnemonic = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

    c.bench_function("generate_wallet_ffi", |b| {
        b.iter(|| {
            lib.generate_wallet(black_box(mnemonic)).unwrap()
        })
    });
}

criterion_group!(benches, bench_generate_wallet);
criterion_main!(benches);
```

**Baseline Comparison** (subprocess vs FFI):
```rust
#[bench]
fn bench_subprocess_wallet_creation(b: &mut Bencher) {
    b.iter(|| {
        Command::new("arcsign")
            .args(&["generate-wallet", "--mnemonic", "..."])
            .output()
            .unwrap()
    });
}

#[bench]
fn bench_ffi_wallet_creation(b: &mut Bencher) {
    let lib = ArcSignLib::new().unwrap();
    b.iter(|| {
        lib.generate_wallet("...").unwrap()
    });
}
```

---

## Migration Checklist

- [ ] Create Go exports for all current CLI commands
- [ ] Implement panic recovery in all Go exports
- [ ] Export `FreeString` and `GetVersion` helper functions
- [ ] Implement Rust `libloading` wrapper with cached function pointers
- [ ] Add JSON serialization/deserialization for all FFI data types
- [ ] Integrate `zeroize` for sensitive data handling
- [ ] Write unit tests for each FFI function (Go and Rust)
- [ ] Write integration tests for complete workflows
- [ ] Set up CI/CD build matrix for Windows/macOS/Linux
- [ ] Add memory leak detection to CI pipeline
- [ ] Benchmark FFI vs subprocess performance
- [ ] Document all exported Go functions with examples
- [ ] Create Rust API documentation with safety notes
- [ ] Security audit: verify no sensitive data leaks in logs
- [ ] Test on all target platforms (Windows 10+, macOS 11+, Ubuntu 20.04+)
- [ ] Update Tauri configuration to bundle shared libraries
- [ ] Implement library version checking on startup
- [ ] Add fallback to subprocess if FFI fails to load
- [ ] Update error messages for user-friendly diagnostics
- [ ] Performance testing: verify 5-10x speedup target achieved
- [ ] Final security review before production deployment

---

## References

### Official Documentation
- [Go cgo documentation](https://pkg.go.dev/cmd/cgo)
- [Rust FFI documentation](https://doc.rust-lang.org/nomicon/ffi.html)
- [libloading crate](https://docs.rs/libloading/latest/libloading/)
- [Tauri FFI integration](https://tauri.app/)

### Key Resources
- [Go to Rust FFI Guide - Radu Matei](https://radu-matei.com/blog/from-go-to-rust-static-linking-ffi/)
- [Rust FFI Error Handling Patterns](https://rust-unofficial.github.io/patterns/idioms/ffi/errors.html)
- [zeroize crate for secure memory](https://docs.rs/zeroize/latest/zeroize/)
- [Cross-Compiling Go CGO Projects](https://dh1tw.de/2019/12/cross-compiling-golang-cgo-projects/)

### Industry Examples
- [Ledger Live Architecture](https://developers.ledger.com/docs/blockchain/getting-started/general-architecture)
- [Trezor Suite Native Crypto Libraries](https://github.com/trezor/trezor-suite/issues/6558)
- [Rustgo: Near-Zero Overhead FFI](https://words.filippo.io/rustgo/)

### Security Guidelines
- [Secure Rust Guidelines (ANSSI)](https://anssi-fr.github.io/rust-guide/05_memory.html)
- [Go Memory Management Best Practices](https://povilasv.me/go-memory-management-part-3/)

---

## Conclusion

The Go-to-Rust FFI architecture described in this document provides a robust, secure, and performant foundation for migrating from subprocess CLI calls to native shared library integration. Key decisions prioritize:

1. **Safety**: `libloading` for memory-safe dynamic loading, JSON for type-safe data exchange
2. **Security**: `zeroize` for sensitive data, input validation, panic recovery
3. **Simplicity**: Single-threaded FFI execution, platform-native builds, consistent error handling
4. **Performance**: Cached function pointers, batch operations, minimal FFI calls
5. **Maintainability**: Comprehensive testing, CI/CD automation, clear documentation

Expected outcomes:
- **5-10x performance improvement** for wallet operations (subprocess overhead eliminated)
- **Identical security guarantees** (same Go crypto code, enhanced memory zeroing)
- **Cross-platform support** (Windows, macOS, Linux via CI/CD build matrix)
- **Production readiness** (memory leak detection, integration tests, security audit checklist)

This research provides the technical foundation for implementing feature 005-go-cli-shared. All architectural decisions are documented with rationale, alternatives considered, and implementation guidance for the development team.
