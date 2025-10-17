# Research: Technical Dependencies for BIP39/BIP44 Wallet Implementation

**Feature**: Wallet Mnemonic Management (BIP39/BIP44)
**Branch**: `001-bip39-bip-44`
**Date**: 2025-10-15
**Researcher**: Claude Code (speckit.plan automated research)
**Status**: Complete

---

## Table of Contents

1. [BIP39/BIP32/BIP44 Go Libraries](#1-bip39bip32bip44-go-libraries)
2. [Argon2id Key Derivation and AES-256-GCM Encryption](#2-argon2id-key-derivation-and-aes-256-gcm-encryption)
3. [USB Storage I/O and File Operations](#3-usb-storage-io-and-file-operations)
4. [Consolidated Decisions](#4-consolidated-decisions)
5. [Next Steps](#5-next-steps)

---

## 1. BIP39/BIP32/BIP44 Go Libraries

### 1.1 Executive Summary

This section evaluates Go libraries for implementing BIP39 (mnemonic generation), BIP32 (HD key derivation), and BIP44 (multi-account hierarchy). The recommended approach combines `github.com/tyler-smith/go-bip39` for BIP39, `github.com/btcsuite/btcd/btcutil/hdkeychain` for BIP32, and manual implementation of BIP44 derivation paths.

### 1.2 Recommended Libraries

#### BIP39: `github.com/tyler-smith/go-bip39`

- **Package**: https://pkg.go.dev/github.com/tyler-smith/go-bip39
- **Version**: v1.1.0
- **License**: MIT

**Key Features**:
- Full BIP39 compliance with test vectors
- 12/24-word mnemonic support (128-256 bit entropy)
- Optional BIP39 passphrase support (25th word)
- Checksum validation
- Multi-language support

**API Example**:
```go
// Generate 24-word mnemonic
entropy, _ := bip39.NewEntropy(256)
mnemonic, _ := bip39.NewMnemonic(entropy)

// Validate mnemonic
valid := bip39.IsMnemonicValid(mnemonic)

// Generate seed with optional passphrase
seed := bip39.NewSeed(mnemonic, passphrase)
defer clearBytes(seed)
```

#### BIP32: `github.com/btcsuite/btcd/btcutil/hdkeychain`

- **Package**: https://pkg.go.dev/github.com/btcsuite/btcd/btcutil/hdkeychain
- **Version**: v1.1.4
- **License**: ISC

**Key Features**:
- Production-grade (battle-tested since 2013)
- Hardware-accelerated secp256k1
- Hardened/non-hardened derivation
- Memory clearing (`Zero()` method)
- Extended key serialization (xprv/xpub)

**API Example**:
```go
// Create master key from seed
masterKey, _ := hdkeychain.NewMaster(seed, &chaincfg.MainNetParams)
defer masterKey.Zero()

// Derive child key (hardened)
childKey, _ := masterKey.Derive(hdkeychain.HardenedKeyStart + 44)
defer childKey.Zero()
```

#### BIP44: Manual Implementation

**Approach**: Implement BIP44 derivation paths using BIP32 primitives.

**Rationale**:
- BIP44 is a convention, not an algorithm
- Simple 5-level hierarchy: `m/44'/coin_type'/account'/change/address_index`
- Full control, no additional dependencies

**Implementation Pattern**:
```go
func DeriveBIP44Address(seed []byte, coinType, account, change, addressIndex uint32) (*hdkeychain.ExtendedKey, error) {
    masterKey, _ := hdkeychain.NewMaster(seed, &chaincfg.MainNetParams)
    defer masterKey.Zero()

    path := []uint32{
        hdkeychain.HardenedKeyStart + 44,      // purpose'
        hdkeychain.HardenedKeyStart + coinType, // coin_type'
        hdkeychain.HardenedKeyStart + account,  // account'
        change,                                 // change
        addressIndex,                           // address_index
    }

    key := masterKey
    for _, index := range path {
        key, _ = key.Derive(index)
    }
    return key, nil
}
```

**Common Coin Types** (SLIP-44):
- Bitcoin: 0 → `m/44'/0'/0'/0/0`
- Ethereum: 60 → `m/44'/60'/0'/0/0`
- Litecoin: 2 → `m/44'/2'/0'/0/0`

### 1.3 Alternatives Considered

| Alternative | Decision | Rationale |
|------------|----------|-----------|
| `cosmos/go-bip39` | Secondary option | Prefer original `tyler-smith` library; use as replacement if dependency issues arise |
| `tyler-smith/go-bip32` | Not recommended | Less mature than btcsuite; fewer production deployments |
| `libsecp256k1` (CGO) | Rejected | Cross-compilation complexity; pure Go preferred for portability |
| `FactomProject/go-bip44` | Not needed | BIP44 is simple enough to implement directly |

### 1.4 Best Practices

**Entropy Generation**:
```go
// ALWAYS use crypto/rand (NEVER math/rand)
entropy, err := bip39.NewEntropy(256) // 24 words = maximum security
```

**Memory Security**:
```go
seed := bip39.NewSeed(mnemonic, passphrase)
defer clearBytes(seed)

masterKey, _ := hdkeychain.NewMaster(seed, &chaincfg.MainNetParams)
defer masterKey.Zero() // Built-in clearing
```

**Mnemonic Validation**:
```go
// Normalize input
mnemonic = strings.Join(strings.Fields(mnemonic), " ")
mnemonic = strings.ToLower(mnemonic)

// Validate checksum
if !bip39.IsMnemonicValid(mnemonic) {
    return errors.New("invalid mnemonic checksum")
}
```

**Hardened Derivation** (BIP44 requirement):
```go
// First 3 levels MUST be hardened (purpose', coin_type', account')
// Last 2 levels MUST NOT be hardened (change, address_index)
```

### 1.5 Testing Strategy

- Validate against official BIP39/BIP32/BIP44 test vectors
- Cross-validate with MetaMask, Ledger, Trezor
- Memory clearing verification (heap profiling)
- Entropy quality testing (statistical randomness)

---

## 2. Argon2id Key Derivation and AES-256-GCM Encryption

### 2.1 Executive Summary

This section evaluates encryption libraries for securing mnemonics using Argon2id key derivation and AES-256-GCM authenticated encryption. The recommended approach uses `golang.org/x/crypto/argon2` (official Go extended library) and Go's standard library `crypto/aes` + `crypto/cipher` for AES-256-GCM.

### 2.2 Recommended Libraries

#### Argon2id: `golang.org/x/crypto/argon2`

- **Package**: https://pkg.go.dev/golang.org/x/crypto/argon2
- **Installation**: `go get golang.org/x/crypto/argon2`
- **License**: BSD-3-Clause (Go license)

**Features**:
- Pure Go implementation (no CGO)
- Direct parameter control (time, memory, parallelism)
- RFC 9106 compliant (Argon2id variant)

#### AES-256-GCM: Go Standard Library

- **Package**: `crypto/aes` + `crypto/cipher`
- **Installation**: Built-in (no installation needed)

**Features**:
- Hardware-accelerated (AES-NI)
- Authenticated encryption (AEAD)
- Zero external dependencies

### 2.3 Recommended Parameters

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| **Time Cost** | 4 iterations | ~2-3 seconds on modern hardware; OWASP-compliant |
| **Memory Cost** | 256 MiB | GPU/ASIC resistant; desktop-friendly |
| **Parallelism** | 4 threads | Leverages multi-core CPUs |
| **Salt Size** | 16 bytes | OWASP minimum; prevents rainbow tables |
| **Key Length** | 32 bytes | Matches AES-256 key size |

**Go Constants**:
```go
const (
    Argon2Time    = 4          // iterations
    Argon2Memory  = 256 * 1024 // 256 MiB in KiB
    Argon2Threads = 4          // threads
    Argon2KeyLen  = 32         // 256-bit key
    Argon2SaltLen = 16         // 128-bit salt
)
```

### 2.4 Implementation Pattern

**Encryption Flow**:
```go
func EncryptMnemonic(mnemonic, password string) (*EncryptedData, error) {
    // 1. Generate salt
    salt := make([]byte, 16)
    rand.Read(salt)

    // 2. Derive key using Argon2id
    key := argon2.IDKey([]byte(password), salt, 4, 256*1024, 4, 32)
    defer clearBytes(key)

    // 3. Create AES-256 cipher
    block, _ := aes.NewCipher(key)
    gcm, _ := cipher.NewGCM(block)

    // 4. Generate nonce
    nonce := make([]byte, 12)
    rand.Read(nonce)

    // 5. Encrypt and authenticate
    plaintext := []byte(mnemonic)
    ciphertext := gcm.Seal(nil, nonce, plaintext, nil)
    defer clearBytes(plaintext)

    return &EncryptedData{
        Salt:       salt,
        Nonce:      nonce,
        Ciphertext: ciphertext, // Includes 16-byte auth tag
    }, nil
}
```

**Decryption Flow**:
```go
func DecryptMnemonic(encrypted *EncryptedData, password string) (string, error) {
    // 1. Re-derive key
    key := argon2.IDKey([]byte(password), encrypted.Salt, 4, 256*1024, 4, 32)
    defer clearBytes(key)

    // 2. Create cipher
    block, _ := aes.NewCipher(key)
    gcm, _ := cipher.NewGCM(block)

    // 3. Decrypt and verify
    plaintext, err := gcm.Open(nil, encrypted.Nonce, encrypted.Ciphertext, nil)
    if err != nil {
        return "", errors.New("wrong password or corrupted data")
    }
    defer clearBytes(plaintext)

    return string(plaintext), nil
}
```

### 2.5 Storage Format

Binary serialization for USB storage:

```
[Salt: 16 bytes][Nonce: 12 bytes][Ciphertext + Auth Tag: variable + 16 bytes]
```

**Total Size**: 44 bytes overhead + mnemonic length

**Serialization**:
```go
func SerializeEncryptedData(data *EncryptedData) []byte {
    result := make([]byte, 0, len(data.Salt)+len(data.Nonce)+len(data.Ciphertext))
    result = append(result, data.Salt...)
    result = append(result, data.Nonce...)
    result = append(result, data.Ciphertext...)
    return result
}

func DeserializeEncryptedData(serialized []byte) (*EncryptedData, error) {
    if len(serialized) < 28 {
        return nil, errors.New("invalid encrypted data")
    }
    return &EncryptedData{
        Salt:       serialized[0:16],
        Nonce:      serialized[16:28],
        Ciphertext: serialized[28:],
    }, nil
}
```

### 2.6 Memory Security Best Practices

**Always Use `[]byte` for Sensitive Data** (never `string`):
```go
// GOOD
password := []byte("user-password")
defer clearBytes(password)

// BAD (string is immutable)
password := "user-password" // Persists in memory until GC
```

**Explicit Zeroing Function**:
```go
func clearBytes(b []byte) {
    for i := range b {
        b[i] = 0
    }
    runtime.KeepAlive(b) // Prevent compiler optimization
}
```

**Use `defer` for Automatic Cleanup**:
```go
key := argon2.IDKey(password, salt, 4, 256*1024, 4, 32)
defer clearBytes(key) // Executes even on panic
```

### 2.7 Alternatives Considered

| Alternative | Decision | Rationale |
|------------|----------|-----------|
| `alexedwards/argon2id` | Rejected | Prefer official `golang.org/x/crypto`; less control over parameters |
| `libsodium` (CGO) | Rejected | CGO dependency complicates cross-compilation; pure Go preferred |
| AES-CBC + HMAC | Rejected | GCM provides AEAD (safer); no padding oracle risk |
| ChaCha20-Poly1305 | Rejected for Phase 1 | Spec requires AES-256-GCM; viable alternative for future |

### 2.8 Security Checklist

- [ ] All passwords, keys, mnemonics stored as `[]byte` (not `string`)
- [ ] All sensitive byte slices explicitly zeroed using `clearBytes()`
- [ ] `defer clearBytes()` used immediately after allocation
- [ ] `runtime.KeepAlive()` prevents compiler optimization
- [ ] Minimize conversions between `[]byte` and `string`
- [ ] Test memory clearing using heap profiler

---

## 3. USB Storage I/O and File Operations

### 3.1 Executive Summary

This section evaluates cross-platform USB storage detection and secure file operations. The recommended approach uses `github.com/SonarBeserk/gousbdrivedetector` for USB detection, `golang.org/x/sys` for disk space checking, and Go's standard library for atomic file writes with secure permissions.

### 3.2 Recommended Libraries and Approaches

#### USB Detection: `github.com/SonarBeserk/gousbdrivedetector`

- **Package**: https://pkg.go.dev/github.com/SonarBeserk/gousbdrivedetector
- **Installation**: `go get github.com/SonarBeserk/gousbdrivedetector`
- **License**: MIT

**Features**:
- Cross-platform (Linux, macOS, Windows)
- Simple API (single function returns USB mount paths)
- No CGO dependencies

**Platform Behavior**:
- Linux: Returns `/media/usb`, `/mnt/usb`, etc.
- macOS: Returns `/Volumes/USBDrive`, etc.
- Windows: Returns `E:\`, `F:\`, etc.

**API Example**:
```go
import "github.com/SonarBeserk/gousbdrivedetector/usbdrivedetector"

devices, err := usbdrivedetector.Detect()
if err != nil {
    return fmt.Errorf("USB detection failed: %w", err)
}
```

#### Disk Space Checking: `golang.org/x/sys`

**Unix/Linux/macOS** (`golang.org/x/sys/unix`):
```go
import "golang.org/x/sys/unix"

var stat unix.Statfs_t
unix.Statfs(path, &stat)
availableSpace := stat.Bavail * uint64(stat.Bsize)
```

**Windows** (`golang.org/x/sys/windows`):
```go
import "golang.org/x/sys/windows"

var freeBytesAvailable uint64
windows.GetDiskFreeSpaceEx(
    windows.StringToUTF16Ptr(path),
    &freeBytesAvailable,
    nil, nil,
)
```

#### Atomic File Write: Go Standard Library

**Temp-File-Then-Rename Pattern**:
```go
func AtomicWriteFile(filename string, data []byte, perm os.FileMode) error {
    dir := filepath.Dir(filename)

    // Create temp file in same directory (same filesystem)
    tmpFile, _ := os.CreateTemp(dir, ".wallet-tmp-*")
    tmpPath := tmpFile.Name()
    defer os.Remove(tmpPath)

    // Write data
    tmpFile.Write(data)

    // Sync to disk (CRITICAL for USB)
    tmpFile.Sync()

    // Set permissions
    tmpFile.Chmod(perm)
    tmpFile.Close()

    // Atomic rename
    return os.Rename(tmpPath, filename)
}
```

**Why This Works**:
- `os.Rename()` is atomic on same filesystem (Unix + Windows)
- File never in partially-written state
- Prevents corruption on crashes, power loss, USB removal

### 3.3 File Permissions

**Recommended**: 0600 (owner read/write only)

```go
// Create file with secure permissions
file, _ := os.OpenFile(filename, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0600)

// Or set permissions on existing file
os.Chmod(filename, 0600)
```

**Rationale**:
- Prevents other users from reading wallet files
- Security best practice (same as SSH private keys)
- Required by security audit tools (gosec)

### 3.4 Error Handling

**Custom Error Types**:
```go
var (
    ErrUSBNotFound      = errors.New("USB storage device not found")
    ErrUSBNotAvailable  = errors.New("USB storage device not available")
    ErrUSBFull          = errors.New("USB storage device is full")
    ErrUSBPermission    = errors.New("permission denied accessing USB device")
    ErrUSBDisconnected  = errors.New("USB disconnected during operation")
)
```

**Error Detection**:
```go
func DetectUSBError(err error) error {
    if os.IsNotExist(err) {
        return ErrUSBDisconnected
    }
    if os.IsPermission(err) {
        return ErrUSBPermission
    }

    var errno syscall.Errno
    if errors.As(err, &errno) {
        switch errno {
        case syscall.ENOSPC:
            return ErrUSBFull
        case syscall.EROFS:
            return ErrUSBPermission
        case syscall.ENODEV:
            return ErrUSBDisconnected
        }
    }
    return err
}
```

**User-Friendly Messages**:
```go
func UserFriendlyError(err error) string {
    switch {
    case errors.Is(err, ErrUSBNotFound):
        return "USB storage device not detected. Please insert a USB drive and try again."
    case errors.Is(err, ErrUSBFull):
        return "USB storage device is full. Please free up space or use a different USB drive."
    case errors.Is(err, ErrUSBPermission):
        return "Permission denied accessing USB device. Please check device is not write-protected."
    case errors.Is(err, ErrUSBDisconnected):
        return "USB storage device disconnected during operation. Please reconnect the device and try again."
    default:
        return fmt.Sprintf("USB error: %v", err)
    }
}
```

### 3.5 Best Practices

**USB Device Selection**:
- Auto-select if single device detected
- Prompt user if multiple devices found
- Clear error if no devices found

**File Naming Convention**:
```
/media/usb/arcsign/
├── wallets/
│   ├── default.wallet         # Encrypted (0600)
│   └── default.wallet.sha256  # Checksum (optional)
├── audit/
│   └── audit.log              # Audit log
└── .arcsign-version           # Metadata
```

**Handling USB Removal**:
```go
// Pre-check: USB available
if !IsUSBAvailable(usbPath) {
    return ErrUSBNotAvailable
}

// Perform operation
err := AtomicWriteFile(...)

// Post-check: USB still available
if !IsUSBAvailable(usbPath) {
    log.Warn("USB disconnected after operation")
}
```

### 3.6 Alternatives Considered

| Alternative | Decision | Rationale |
|------------|----------|-----------|
| `google/gousb` (Low-level USB) | Rejected | Too low-level; requires libusb (CGO); wallet only needs file system access |
| `fsnotify` (Filesystem Watcher) | Rejected for Phase 1 | More complex; unreliable on Windows for USB; polling is simpler |
| Parsing `df` command | Rejected | Fragile (output varies by OS/locale); slower; security risk |
| `google/renameio` | Rejected | Does not work on Windows; cross-platform support mandatory |

### 3.7 Testing Requirements

**Test on Real USB Devices**:
- Test on Linux, macOS, Windows
- Test disk full scenario
- Test USB removal during write
- Test permission errors
- Test multiple USB devices

---

## 4. Consolidated Decisions

### 4.1 Dependencies

**go.mod Configuration**:
```go
module github.com/yourusername/arcsign

go 1.21

require (
    // BIP39/BIP32/BIP44
    github.com/tyler-smith/go-bip39 v1.1.0
    github.com/btcsuite/btcd/btcutil/hdkeychain v1.1.4
    github.com/btcsuite/btcd/chaincfg v1.1.4

    // Encryption
    golang.org/x/crypto v0.17.0 // Argon2id

    // USB Storage
    github.com/SonarBeserk/gousbdrivedetector v0.0.0-latest
    golang.org/x/sys v0.15.0 // Disk space checking
)
```

### 4.2 Technical Context Resolution

All "NEEDS CLARIFICATION" items from plan.md Technical Context are now resolved:

| Item | Decision |
|------|----------|
| **BIP39/BIP32/BIP44 libraries** | `tyler-smith/go-bip39` + `btcsuite/hdkeychain` + manual BIP44 |
| **Argon2id implementation** | `golang.org/x/crypto/argon2` (time=4, memory=256MiB, threads=4) |
| **AES-256-GCM** | Go standard library (`crypto/aes` + `crypto/cipher`) |
| **USB Storage I/O** | `gousbdrivedetector` + `golang.org/x/sys` + atomic writes |

### 4.3 Security Decisions

| Decision | Implementation |
|----------|----------------|
| **Mnemonic Length** | 24 words (256-bit entropy) for maximum security |
| **Encryption Parameters** | Argon2id (4 iterations, 256 MiB, 4 threads) + AES-256-GCM |
| **File Permissions** | 0600 (owner read/write only) |
| **Memory Security** | Explicit zeroing with `clearBytes()` + `runtime.KeepAlive()` |
| **Atomic Writes** | Temp-file-then-rename pattern with `Sync()` for USB |
| **Error Handling** | Custom error types with user-friendly messages |

### 4.4 Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| **Pure Go (No CGO)** | Cross-platform compatibility; easier builds; simpler audits |
| **Modular Libraries** | Prefer battle-tested components with large communities over monolithic libraries |
| **Manual BIP44** | BIP44 is simple convention; manual implementation gives full control |
| **Standard Library First** | Use standard library where possible to minimize dependencies |

---

## 5. Next Steps

### 5.1 Phase 1: Data Model Design

Generate `data-model.md` with entities:
- Wallet (ID, encrypted mnemonic reference, creation date)
- Mnemonic (encrypted data, salt, nonce, Argon2id parameters)
- Account (BIP44 account index, coin type)
- Address (derivation path, public key, address string)
- AuditLog (timestamp, operation, status)

### 5.2 Phase 1: API Contracts

Generate OpenAPI contracts for (future API):
- `POST /wallets` - Create wallet
- `POST /wallets/{id}/restore` - Restore wallet
- `GET /wallets/{id}/accounts` - List accounts
- `POST /wallets/{id}/accounts/{accountId}/addresses` - Derive address
- `GET /wallets/{id}/audit-log` - View audit log

### 5.3 Phase 1: Quickstart Guide

Generate `quickstart.md` for developers:
- Development environment setup
- Installing Go dependencies
- Running tests
- Building CLI
- Creating/restoring wallets
- Security considerations

### 5.4 Phase 1: Agent Context Update

Run `.specify/scripts/bash/update-agent-context.sh claude` to:
- Add technology stack to Claude context
- Include BIP39/BIP32/BIP44 libraries
- Include Argon2id + AES-256-GCM encryption
- Include USB storage dependencies

### 5.5 Phase 2: Implementation (via /speckit.tasks)

After Phase 1 design artifacts are complete, run `/speckit.tasks` to generate implementation tasks following TDD workflow.

---

**Research Status**: ✅ COMPLETE

All NEEDS CLARIFICATION items resolved. Ready to proceed to Phase 1: Design & Contracts.
