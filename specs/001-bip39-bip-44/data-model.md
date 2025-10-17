# Data Model: Wallet Mnemonic Management (BIP39/BIP44)

**Feature**: `001-bip39-bip-44`
**Date**: 2025-10-15
**Status**: Design Complete

---

## Overview

This document defines the data entities and relationships for the secure hierarchical deterministic (HD) wallet system. The model supports BIP39 mnemonic management, BIP44 multi-account hierarchy, encrypted storage, and audit logging.

---

## Entity Relationship Diagram

```
┌──────────────┐
│    Wallet    │
└──────┬───────┘
       │ 1
       │ owns
       │ 1
       ▼
┌──────────────────┐
│ EncryptedMnemonic│
└──────────────────┘

┌──────────────┐
│    Wallet    │
└──────┬───────┘
       │ 1
       │ has
       │ 0..*
       ▼
┌──────────────┐       ┌──────────────┐
│   Account    │──────▶│   Address    │
└──────────────┘ 1  *  └──────────────┘
                 derives

┌──────────────┐
│    Wallet    │
└──────┬───────┘
       │ 1
       │ generates
       │ 0..*
       ▼
┌──────────────┐
│  AuditLogEntry │
└──────────────┘
```

---

## Core Entities

### 1. Wallet

Represents a hierarchical deterministic wallet created from a BIP39 mnemonic.

**Fields**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` (UUID) | Yes | Unique wallet identifier |
| `name` | `string` | No | User-friendly wallet name (default: "default") |
| `createdAt` | `timestamp` | Yes | Wallet creation timestamp (ISO 8601) |
| `lastAccessedAt` | `timestamp` | Yes | Last successful wallet access timestamp |
| `encryptedMnemonicPath` | `string` | Yes | USB file path to encrypted mnemonic |
| `usesPassphrase` | `boolean` | Yes | Whether wallet uses BIP39 passphrase (25th word) |
| `accounts` | `[]Account` | No | List of derived accounts |

**Validation Rules**:
- `id`: Must be valid UUID v4
- `name`: Max 64 characters, alphanumeric + spaces/hyphens
- `encryptedMnemonicPath`: Must be absolute path on USB storage
- `usesPassphrase`: If true, passphrase required for all wallet operations

**Example**:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "My Main Wallet",
  "createdAt": "2025-10-15T10:30:00Z",
  "lastAccessedAt": "2025-10-15T14:22:00Z",
  "encryptedMnemonicPath": "/media/usb/arcsign/wallets/default.wallet",
  "usesPassphrase": false,
  "accounts": []
}
```

---

### 2. EncryptedMnemonic

Represents the encrypted BIP39 mnemonic stored on USB.

**Fields**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `salt` | `[]byte` (16 bytes) | Yes | Argon2id salt (cryptographically random) |
| `nonce` | `[]byte` (12 bytes) | Yes | AES-GCM nonce (cryptographically random, unique per encryption) |
| `ciphertext` | `[]byte` (variable) | Yes | Encrypted mnemonic + 16-byte authentication tag |
| `argon2Time` | `uint32` | Yes | Argon2id time cost (iterations) |
| `argon2Memory` | `uint32` | Yes | Argon2id memory cost (KiB) |
| `argon2Threads` | `uint8` | Yes | Argon2id parallelism (threads) |
| `version` | `uint8` | Yes | Encryption format version (1 for Phase 1) |

**Storage Format** (binary serialization):
```
[version: 1 byte]
[argon2Time: 4 bytes, big-endian]
[argon2Memory: 4 bytes, big-endian]
[argon2Threads: 1 byte]
[salt: 16 bytes]
[nonce: 12 bytes]
[ciphertext: variable bytes (includes 16-byte auth tag)]
```

**Total Size**: 38 bytes overhead + ciphertext length

**Validation Rules**:
- `salt`: Must be 16 bytes (128 bits)
- `nonce`: Must be 12 bytes (96 bits)
- `argon2Time`: Min 3, max 10
- `argon2Memory`: Min 64*1024 (64 MiB), max 1024*1024 (1 GiB)
- `argon2Threads`: Min 1, max 16
- `version`: Must be 1 (for Phase 1)

**Example** (after deserialization):
```go
EncryptedMnemonic{
    Salt:          []byte{0x1a, 0x2b, ..., 0xf0},  // 16 bytes
    Nonce:         []byte{0x3c, 0x4d, ..., 0xe1},  // 12 bytes
    Ciphertext:    []byte{0x5e, 0x6f, ..., 0xd2},  // variable + 16 byte tag
    Argon2Time:    4,
    Argon2Memory:  262144,  // 256 MiB
    Argon2Threads: 4,
    Version:       1,
}
```

---

### 3. Account

Represents a BIP44 account within a wallet (m/44'/coin_type'/account').

**Fields**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `walletId` | `string` (UUID) | Yes | Parent wallet identifier |
| `accountIndex` | `uint32` | Yes | BIP44 account index (hardened) |
| `coinType` | `uint32` | Yes | BIP44 coin type (SLIP-44): 0=Bitcoin, 60=Ethereum, etc. |
| `name` | `string` | No | User-friendly account name (e.g., "Bitcoin Main", "Ethereum Savings") |
| `createdAt` | `timestamp` | Yes | Account creation timestamp |
| `nextAddressIndex` | `uint32` | Yes | Next unused address index for external chain (change=0) |
| `nextChangeIndex` | `uint32` | Yes | Next unused address index for internal chain (change=1) |
| `addresses` | `[]Address` | No | List of derived addresses |

**Derivation Path**: `m/44'/{coinType}'/{accountIndex}'`

**Validation Rules**:
- `accountIndex`: Max 100 (per spec assumption)
- `coinType`: Must be registered SLIP-44 coin type
- `nextAddressIndex`: Max 1000 (per spec assumption)
- `nextChangeIndex`: Max 1000 (per spec assumption)

**Common Coin Types** (SLIP-44):
| Coin | Coin Type | Derivation Path Example |
|------|-----------|------------------------|
| Bitcoin | 0 | m/44'/0'/0' |
| Ethereum | 60 | m/44'/60'/0' |
| Litecoin | 2 | m/44'/2'/0' |
| Dogecoin | 3 | m/44'/3'/0' |
| Solana | 501 | m/44'/501'/0' |

**Example**:
```json
{
  "walletId": "550e8400-e29b-41d4-a716-446655440000",
  "accountIndex": 0,
  "coinType": 0,
  "name": "Bitcoin Main",
  "createdAt": "2025-10-15T10:31:00Z",
  "nextAddressIndex": 5,
  "nextChangeIndex": 2,
  "addresses": []
}
```

---

### 4. Address

Represents a derived cryptocurrency address from a BIP44 path.

**Fields**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `accountId` | `string` | Yes | Parent account identifier (composite: walletId + accountIndex + coinType) |
| `change` | `uint32` | Yes | BIP44 change: 0=external (receive), 1=internal (change) |
| `addressIndex` | `uint32` | Yes | BIP44 address index |
| `derivationPath` | `string` | Yes | Full BIP44 derivation path (e.g., m/44'/0'/0'/0/0) |
| `address` | `string` | Yes | Public cryptocurrency address (format depends on coin type) |
| `publicKey` | `string` (hex) | Yes | Compressed public key (hex-encoded) |
| `createdAt` | `timestamp` | Yes | Address derivation timestamp |
| `label` | `string` | No | User-friendly address label |

**Derivation Path Format**: `m/44'/{coinType}'/{accountIndex}'/{change}/{addressIndex}`

**Validation Rules**:
- `change`: Must be 0 or 1 (per BIP44)
- `addressIndex`: Max 1000 (per spec assumption)
- `address`: Must be valid for coin type (checksum validation)
- `publicKey`: 33 bytes (compressed secp256k1 public key), hex-encoded (66 characters)

**Example** (Bitcoin):
```json
{
  "accountId": "550e8400-e29b-41d4-a716-446655440000_0_0",
  "change": 0,
  "addressIndex": 0,
  "derivationPath": "m/44'/0'/0'/0/0",
  "address": "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
  "publicKey": "0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798",
  "createdAt": "2025-10-15T10:32:00Z",
  "label": "First receive address"
}
```

---

### 5. AuditLogEntry

Represents a wallet operation logged for security monitoring.

**Fields**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` (UUID) | Yes | Unique log entry identifier |
| `walletId` | `string` (UUID) | Yes | Associated wallet identifier |
| `timestamp` | `timestamp` | Yes | Operation timestamp (ISO 8601, high precision) |
| `operation` | `string` (enum) | Yes | Operation type: WALLET_CREATE, WALLET_ACCESS, WALLET_RESTORE, ACCOUNT_CREATE, ADDRESS_DERIVE |
| `status` | `string` (enum) | Yes | Operation status: SUCCESS, FAILURE |
| `failureReason` | `string` | No | Failure reason (e.g., "wrong_password", "usb_unavailable") |
| `ipAddress` | `string` | No | Client IP address (if applicable, future API use) |
| `userAgent` | `string` | No | Client user agent (if applicable, future API use) |

**Operation Types**:
- `WALLET_CREATE`: New wallet created
- `WALLET_ACCESS`: Wallet accessed (mnemonic decrypted)
- `WALLET_RESTORE`: Wallet restored from mnemonic
- `ACCOUNT_CREATE`: New account added to wallet
- `ADDRESS_DERIVE`: New address derived from account

**Status Values**:
- `SUCCESS`: Operation completed successfully
- `FAILURE`: Operation failed (see failureReason)

**Common Failure Reasons**:
- `wrong_password`: Incorrect encryption password
- `wrong_mnemonic`: Invalid or incorrect mnemonic (restoration)
- `usb_unavailable`: USB storage device not found
- `usb_full`: USB storage device full
- `usb_disconnected`: USB removed during operation
- `rate_limited`: Too many failed attempts (5 per 15 minutes)
- `corrupted_data`: Encrypted data tampered or corrupted

**Validation Rules**:
- Audit log entries are **append-only** (no updates or deletes)
- Entries MUST NOT contain sensitive data (passwords, mnemonics, private keys, addresses, amounts)
- Entries MUST be tamper-evident (cryptographic signature or integrity check)

**Example**:
```json
{
  "id": "660e8400-e29b-41d4-a716-446655440001",
  "walletId": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2025-10-15T10:30:00.123456Z",
  "operation": "WALLET_CREATE",
  "status": "SUCCESS",
  "failureReason": null,
  "ipAddress": null,
  "userAgent": null
}
```

---

## Derived Data Structures

### PasswordAttemptTracker

Tracks failed password/mnemonic attempts for rate limiting (SR-009).

**In-Memory Structure** (not persisted):

| Field | Type | Description |
|-------|------|-------------|
| `walletId` | `string` (UUID) | Wallet identifier |
| `attemptTimestamps` | `[]timestamp` | List of failed attempt timestamps (max 5) |
| `lockoutUntil` | `timestamp` | Timestamp when lockout expires (nil if not locked) |

**Rate Limiting Logic**:
1. Track last 5 failed attempts with timestamps
2. If 5 failed attempts within 15 minutes → lockout
3. Lockout duration: Until 15 minutes from first failed attempt
4. Reset counter after 15 minutes from first attempt

**Example**:
```go
PasswordAttemptTracker{
    WalletId:          "550e8400-e29b-41d4-a716-446655440000",
    AttemptTimestamps: []time.Time{
        time.Parse("2025-10-15T10:20:00Z"),
        time.Parse("2025-10-15T10:21:00Z"),
        time.Parse("2025-10-15T10:22:00Z"),
        time.Parse("2025-10-15T10:23:00Z"),
        time.Parse("2025-10-15T10:24:00Z"),
    },
    LockoutUntil: time.Parse("2025-10-15T10:35:00Z"), // 15 min from first attempt
}
```

---

## State Transitions

### Wallet Lifecycle

```
┌─────────────┐
│   CREATED   │  (mnemonic generated, encrypted, stored on USB)
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  ACCESSIBLE │  (mnemonic decrypted with correct password)
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  LOCKED     │  (wallet closed, mnemonic cleared from memory)
└─────────────┘

Loop: ACCESSIBLE ↔ LOCKED (each wallet access)
```

**State Descriptions**:
- **CREATED**: Wallet exists on USB, mnemonic encrypted
- **ACCESSIBLE**: Mnemonic decrypted in memory, operations allowed
- **LOCKED**: Mnemonic not in memory, password required to access

### Account Lifecycle

```
┌─────────────┐
│   CREATED   │  (account added to wallet, no addresses yet)
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   ACTIVE    │  (addresses derived, account in use)
└─────────────┘
```

### Address Lifecycle

```
┌─────────────┐
│   DERIVED   │  (address generated from seed, stored)
└──────┬──────┘
       │
       ▼
┌─────────────┐
│    USED     │  (address used in transaction - external system tracking)
└─────────────┘
```

---

## Data Constraints

### Wallet

- Max 100 wallets per USB device (soft limit, user-configurable)
- Max 100 accounts per wallet (spec assumption FR-014)
- Wallet name uniqueness: Not enforced (UUIDs ensure uniqueness)

### Account

- Max 1000 addresses per account (spec assumption FR-014)
- Account index uniqueness: Per wallet + coin type combination

### Address

- Address index uniqueness: Per account + change combination
- Addresses must be derived sequentially (no gaps in address indices)

### AuditLog

- Max 10,000 entries per wallet (rolling log, oldest entries deleted)
- Min retention: 90 days (security monitoring requirement)

---

## Data Persistence

### USB Storage Structure

```
/media/usb/arcsign/
├── wallets/
│   ├── {wallet-id}.wallet       # EncryptedMnemonic (binary format, 0600)
│   └── {wallet-id}.meta.json    # Wallet metadata (JSON, 0600)
├── accounts/
│   ├── {wallet-id}_accounts.json # Account list (JSON, 0600)
│   └── {wallet-id}_addresses.json# Address list (JSON, 0600)
├── audit/
│   ├── {wallet-id}_audit.log    # Audit log (append-only, 0600)
│   └── {wallet-id}_audit.sig    # Audit log signature (0600)
└── .arcsign-version              # Format version (text, 0644)
```

### File Formats

**{wallet-id}.wallet**: Binary file (EncryptedMnemonic)
- Format: See EncryptedMnemonic storage format above

**{wallet-id}.meta.json**: JSON file (Wallet metadata)
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "My Main Wallet",
  "createdAt": "2025-10-15T10:30:00Z",
  "lastAccessedAt": "2025-10-15T14:22:00Z",
  "encryptedMnemonicPath": "/media/usb/arcsign/wallets/550e8400-e29b-41d4-a716-446655440000.wallet",
  "usesPassphrase": false
}
```

**{wallet-id}_accounts.json**: JSON file (Account list)
```json
{
  "accounts": [
    {
      "walletId": "550e8400-e29b-41d4-a716-446655440000",
      "accountIndex": 0,
      "coinType": 0,
      "name": "Bitcoin Main",
      "createdAt": "2025-10-15T10:31:00Z",
      "nextAddressIndex": 5,
      "nextChangeIndex": 2
    }
  ]
}
```

**{wallet-id}_addresses.json**: JSON file (Address list)
```json
{
  "addresses": [
    {
      "accountId": "550e8400-e29b-41d4-a716-446655440000_0_0",
      "change": 0,
      "addressIndex": 0,
      "derivationPath": "m/44'/0'/0'/0/0",
      "address": "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
      "publicKey": "0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798",
      "createdAt": "2025-10-15T10:32:00Z",
      "label": "First receive address"
    }
  ]
}
```

**{wallet-id}_audit.log**: Newline-delimited JSON (NDJSON) file
```
{"id":"660e8400-e29b-41d4-a716-446655440001","walletId":"550e8400-e29b-41d4-a716-446655440000","timestamp":"2025-10-15T10:30:00.123456Z","operation":"WALLET_CREATE","status":"SUCCESS","failureReason":null}
{"id":"660e8400-e29b-41d4-a716-446655440002","walletId":"550e8400-e29b-41d4-a716-446655440000","timestamp":"2025-10-15T10:31:00.234567Z","operation":"ACCOUNT_CREATE","status":"SUCCESS","failureReason":null}
```

---

## Security Considerations

### Data at Rest

- **EncryptedMnemonic**: Encrypted using Argon2id + AES-256-GCM (SR-001)
- **File Permissions**: 0600 (owner read/write only) for all wallet files
- **USB Storage**: Exclusively on USB, never on internal storage (SR-003)

### Data in Memory

- **Mnemonic**: Cleared immediately after use (SR-006)
- **Passwords**: Never stored, re-derived on each access (SR-002)
- **Private Keys**: Cleared immediately after derivation (SR-008)

### Data in Transit

- Phase 1: No network communication (CLI only)
- Future API: TLS 1.3, mutual authentication

### Audit Log Security

- **Append-Only**: No updates or deletes (tamper-evident)
- **No Sensitive Data**: No passwords, keys, addresses, amounts (SR-015)
- **Integrity Protection**: Cryptographic signature per log file (SR-016)

---

## Data Model Summary

| Entity | Storage | Encryption | Persistence |
|--------|---------|------------|-------------|
| Wallet | USB (JSON) | Metadata only | Permanent |
| EncryptedMnemonic | USB (Binary) | Argon2id + AES-256-GCM | Permanent |
| Account | USB (JSON) | None (no sensitive data) | Permanent |
| Address | USB (JSON) | None (public data) | Permanent |
| AuditLogEntry | USB (NDJSON) | None (no sensitive data) | 90-day retention |
| PasswordAttemptTracker | Memory | None | Transient (15-min window) |

---

**Data Model Status**: ✅ COMPLETE

Ready for Phase 1: API Contract Design.
