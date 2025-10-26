# Data Model: FFI Function Signatures & Schemas

**Feature**: Backend Communication Architecture Upgrade
**Branch**: `005-go-cli-shared`
**Last Updated**: 2025-10-25

## Overview

This document defines the complete data model for the FFI (Foreign Function Interface) boundary between the Rust Tauri frontend and Go shared library backend. All data crosses the FFI boundary as JSON strings to ensure type safety and debuggability.

## Memory Management Contract

**Pattern**: Go-allocates + explicit GoFree

- All Go export functions return `*C.char` (heap-allocated JSON strings)
- Rust MUST call `GoFree(ptr)` after reading the string
- Go internally uses `C.CString()` which requires manual free
- Failure to call GoFree results in memory leaks

**Example**:
```rust
let result_ptr = unsafe { CreateWallet(params_cstr) };
let result_json = unsafe { CStr::from_ptr(result_ptr).to_string_lossy().into_owned() };
unsafe { GoFree(result_ptr) }; // CRITICAL: Must free Go-allocated memory
```

## Common Types

### Success Response

```json
{
  "success": true,
  "data": { /* operation-specific payload */ }
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": { /* optional context */ }
  }
}
```

### Error Codes

| Code | Description | HTTP Equivalent |
|------|-------------|----------------|
| `INVALID_INPUT` | Malformed input parameters | 400 Bad Request |
| `WALLET_NOT_FOUND` | Wallet does not exist | 404 Not Found |
| `WALLET_ALREADY_EXISTS` | Wallet name collision | 409 Conflict |
| `INVALID_MNEMONIC` | BIP39 validation failed | 400 Bad Request |
| `INVALID_PASSWORD` | Authentication failed | 401 Unauthorized |
| `STORAGE_ERROR` | USB I/O failure | 500 Internal Server Error |
| `ENCRYPTION_ERROR` | Cryptographic operation failed | 500 Internal Server Error |
| `LIBRARY_PANIC` | Unrecoverable Go panic | 500 Internal Server Error |
| `INVALID_BLOCKCHAIN` | Unknown blockchain identifier | 400 Bad Request |

## Core FFI Functions

### 1. GetVersion

**Purpose**: Library version check (health probe)

**Signature**:
```c
char* GetVersion();
```

**Input**: None

**Output**:
```json
{
  "success": true,
  "data": {
    "version": "0.2.0",
    "buildTime": "2025-10-25T10:30:00Z",
    "goVersion": "1.21.5"
  }
}
```

**Errors**: None (always succeeds)

---

### 2. CreateWallet

**Purpose**: Create new HD wallet from mnemonic

**Signature**:
```c
char* CreateWallet(char* params);
```

**Input**:
```json
{
  "walletName": "MyWallet",
  "mnemonic": "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about",
  "password": "SecurePass123!",
  "usbPath": "/media/usb0"
}
```

**Input Constraints**:
- `walletName`: 1-50 chars, alphanumeric + spaces/hyphens
- `mnemonic`: Valid BIP39 12/15/18/21/24-word phrase
- `password`: Min 8 chars (validated by existing Go logic)
- `usbPath`: Valid USB mount point

**Output**:
```json
{
  "success": true,
  "data": {
    "walletId": "550e8400-e29b-41d4-a716-446655440000",
    "walletName": "MyWallet",
    "createdAt": "2025-10-25T10:30:00Z"
  }
}
```

**Errors**:
- `WALLET_ALREADY_EXISTS`: walletName exists on USB
- `INVALID_MNEMONIC`: BIP39 checksum failed
- `STORAGE_ERROR`: USB write failed
- `ENCRYPTION_ERROR`: AES-GCM encryption failed

**Performance Target**: <100ms (FR-005)

---

### 3. ImportWallet

**Purpose**: Import existing wallet from mnemonic

**Signature**:
```c
char* ImportWallet(char* params);
```

**Input**:
```json
{
  "walletName": "ImportedWallet",
  "mnemonic": "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about",
  "password": "SecurePass123!",
  "usbPath": "/media/usb0"
}
```

**Output**:
```json
{
  "success": true,
  "data": {
    "walletId": "550e8400-e29b-41d4-a716-446655440000",
    "walletName": "ImportedWallet",
    "importedAt": "2025-10-25T10:30:00Z"
  }
}
```

**Errors**: Same as CreateWallet

**Performance Target**: <100ms (US1 acceptance criteria)

---

### 4. UnlockWallet

**Purpose**: Authenticate and load wallet into memory

**Signature**:
```c
char* UnlockWallet(char* params);
```

**Input**:
```json
{
  "walletName": "MyWallet",
  "password": "SecurePass123!",
  "usbPath": "/media/usb0"
}
```

**Output**:
```json
{
  "success": true,
  "data": {
    "walletId": "550e8400-e29b-41d4-a716-446655440000",
    "walletName": "MyWallet",
    "unlockedAt": "2025-10-25T10:30:00Z"
  }
}
```

**Errors**:
- `WALLET_NOT_FOUND`: No wallet.json found on USB
- `INVALID_PASSWORD`: Decryption failed
- `STORAGE_ERROR`: USB read failed

**Performance Target**: <50ms (US1 acceptance criteria)

---

### 5. GenerateAddresses

**Purpose**: Derive addresses for all 54 supported blockchains

**Signature**:
```c
char* GenerateAddresses(char* params);
```

**Input**:
```json
{
  "walletId": "550e8400-e29b-41d4-a716-446655440000",
  "blockchains": [
    "bitcoin",
    "ethereum",
    "tezos"
    // ... up to 54 blockchain identifiers
  ]
}
```

**Input Constraints**:
- `walletId`: Must be currently unlocked
- `blockchains`: Array of 1-54 blockchain identifiers (see SLIP-44 registry)

**Output**:
```json
{
  "success": true,
  "data": {
    "addresses": [
      {
        "blockchain": "bitcoin",
        "address": "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
        "derivationPath": "m/44'/0'/0'/0/0"
      },
      {
        "blockchain": "ethereum",
        "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
        "derivationPath": "m/44'/60'/0'/0/0"
      }
      // ... up to 54 addresses
    ],
    "generatedAt": "2025-10-25T10:30:00Z"
  }
}
```

**Errors**:
- `WALLET_NOT_FOUND`: walletId not unlocked
- `INVALID_BLOCKCHAIN`: Unknown blockchain identifier
- `ENCRYPTION_ERROR`: Key derivation failed

**Performance Target**: <2s for all 54 blockchains (FR-006)

---

### 6. ExportWallet

**Purpose**: Export wallet metadata (without private keys)

**Signature**:
```c
char* ExportWallet(char* params);
```

**Input**:
```json
{
  "walletName": "MyWallet",
  "usbPath": "/media/usb0",
  "format": "json"
}
```

**Output**:
```json
{
  "success": true,
  "data": {
    "walletName": "MyWallet",
    "walletId": "550e8400-e29b-41d4-a716-446655440000",
    "createdAt": "2025-10-25T10:30:00Z",
    "addressBook": {
      "bitcoin": {
        "name": "BTC Main",
        "symbol": "BTC",
        "addresses": ["1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa"]
      }
    }
  }
}
```

**Errors**:
- `WALLET_NOT_FOUND`: Wallet does not exist
- `STORAGE_ERROR`: USB read failed

---

### 7. RenameWallet

**Purpose**: Change wallet display name

**Signature**:
```c
char* RenameWallet(char* params);
```

**Input**:
```json
{
  "walletName": "OldName",
  "newWalletName": "NewName",
  "usbPath": "/media/usb0"
}
```

**Output**:
```json
{
  "success": true,
  "data": {
    "walletId": "550e8400-e29b-41d4-a716-446655440000",
    "oldName": "OldName",
    "newName": "NewName",
    "renamedAt": "2025-10-25T10:30:00Z"
  }
}
```

**Errors**:
- `WALLET_NOT_FOUND`: Old wallet name does not exist
- `WALLET_ALREADY_EXISTS`: New wallet name conflicts
- `STORAGE_ERROR`: USB write failed

---

### 8. ListWallets

**Purpose**: Enumerate all wallets on USB device

**Signature**:
```c
char* ListWallets(char* params);
```

**Input**:
```json
{
  "usbPath": "/media/usb0"
}
```

**Output**:
```json
{
  "success": true,
  "data": {
    "wallets": [
      {
        "walletId": "550e8400-e29b-41d4-a716-446655440000",
        "walletName": "MyWallet",
        "createdAt": "2025-10-25T10:30:00Z"
      },
      {
        "walletId": "660e8400-e29b-41d4-a716-446655440111",
        "walletName": "TradingWallet",
        "createdAt": "2025-10-24T15:20:00Z"
      }
    ]
  }
}
```

**Errors**:
- `STORAGE_ERROR`: USB not accessible or invalid path

---

### 9. GoFree

**Purpose**: Free Go-allocated memory

**Signature**:
```c
void GoFree(char* ptr);
```

**Input**: C string pointer returned by any other FFI function

**Output**: None (void function)

**Errors**: None (panic recovery handles invalid pointers)

**Critical**: MUST be called after every FFI function that returns `char*`

---

## Thread Safety

**Single-threaded Queue**: All wallet operations are serialized through a Tokio channel. The Go library does NOT need internal locking.

**Rust-side Implementation**:
```rust
lazy_static! {
    static ref WALLET_QUEUE: Mutex<Sender<WalletCommand>> = {
        let (tx, mut rx) = mpsc::channel(32);
        tokio::spawn(async move {
            while let Some(cmd) = rx.recv().await {
                tokio::task::spawn_blocking(move || {
                    // Execute FFI call here
                });
            }
        });
        Mutex::new(tx)
    };
}
```

## Security Considerations

1. **Password Handling**: Passwords are transmitted as plain JSON strings across FFI but:
   - Immediately encrypted using Argon2id + AES-256-GCM
   - Zeroized after use in Go using `runtime.memclrNoHeapPointers`
   - Never logged or persisted

2. **Mnemonic Protection**: Mnemonics follow same pattern as passwords

3. **Error Messages**: Must NOT leak sensitive data (no mnemonic fragments, password hints, or raw crypto errors in user-facing messages)

## Logging Contract

**FR-014 Requirement**: Log entry/exit with timing only

**Go-side Implementation**:
```go
func CreateWallet(params *C.char) *C.char {
    start := time.Now()
    defer func() {
        log.Printf("CreateWallet completed in %v", time.Since(start))
    }()
    // ... implementation
}
```

**Excluded from Logs**:
- Password values
- Mnemonic phrases
- Private keys
- Decrypted wallet data

## Validation Rules

All input validation occurs **Go-side** before business logic:

1. **JSON Schema Validation**: Ensure required fields present
2. **BIP39 Validation**: Mnemonic checksum verification
3. **Path Validation**: USB path exists and is writable
4. **Name Validation**: Wallet names match regex `^[a-zA-Z0-9 -]{1,50}$`

## Testing Schemas

For unit tests, mock responses should follow these exact schemas. See `quickstart.md` for test execution instructions.

---

**Next Steps**:
1. Review this data model with team
2. Generate corresponding Rust type definitions (see `contracts/ffi-api.md`)
3. Implement Go export functions matching these signatures (Phase 2 tasks)
