# ArcSign Architecture

## Overview

ArcSign is a hierarchical deterministic (HD) cryptocurrency wallet that implements BIP39/BIP44 standards with a focus on security through USB-only storage. This document provides a comprehensive overview of the system architecture, design decisions, and implementation details.

## Design Principles

### 1. Security First
- All sensitive data stored exclusively on USB drives
- Military-grade encryption (AES-256-GCM)
- Memory-hard key derivation (Argon2id)
- Rate limiting against brute-force attacks
- Comprehensive audit logging

### 2. Standards Compliance
- BIP39 for mnemonic generation
- BIP32 for hierarchical key derivation
- BIP44 for account hierarchy
- SLIP-44 for coin type registry (54 coins)
- SLIP-10 for Ed25519 HD derivation (Tezos)
- EIP-2645 for Starknet key derivation
- Cosmos ADR-028 for Bech32 encoding
- Substrate BIP39 for sr25519 (Kusama)

### 3. Multi-Chain Support
- 54 blockchains across 7 signature schemes
- Extensible formatter architecture
- Coin registry with metadata
- Support for ECDSA, Ed25519, sr25519, Schnorr

### 4. User Experience
- Interactive command-line interface
- Clear error messages and guidance
- Step-by-step workflows
- Progress indicators for long operations

### 5. Testability
- Test-driven development (TDD)
- 300+ automated tests
- Unit and integration test coverage
- Deterministic test fixtures

## System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         CLI Layer                            │
│  (cmd/arcsign/main.go)                                      │
│  - Command routing                                           │
│  - User interaction                                          │
│  - Input validation                                          │
└─────────────────┬───────────────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────────────┐
│                      Service Layer                           │
│  (internal/services/)                                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Wallet     │  │    BIP39     │  │   HD Key     │      │
│  │   Service    │  │   Service    │  │   Service    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Address    │  │  Encryption  │  │   Storage    │      │
│  │   Service    │  │   Service    │  │   Service    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│  ┌──────────────┐  ┌──────────────┐                         │
│  │ Rate Limiter │  │ Audit Logger │                         │
│  └──────────────┘  └──────────────┘                         │
└─────────────────┬───────────────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────────────┐
│                   Infrastructure Layer                       │
│  - File I/O (USB drives)                                    │
│  - Cryptographic primitives                                  │
│  - Platform-specific code                                    │
└─────────────────────────────────────────────────────────────┘
```

## Project Structure

```
arcsign/
├── cmd/
│   └── arcsign/              # CLI entry point
│       └── main.go           # Command routing and UI
│
├── internal/
│   ├── models/               # Data models
│   │   └── models.go         # Wallet, Mnemonic, Account, Address
│   │
│   ├── services/             # Business logic
│   │   ├── address/          # Address derivation
│   │   │   └── service.go    # Bitcoin, Ethereum address generation
│   │   │
│   │   ├── bip39service/     # Mnemonic generation
│   │   │   └── service.go    # BIP39 implementation
│   │   │
│   │   ├── encryption/       # Encryption/decryption
│   │   │   └── service.go    # AES-256-GCM + Argon2id
│   │   │
│   │   ├── hdkey/            # HD key derivation
│   │   │   └── service.go    # BIP32/BIP44 implementation
│   │   │
│   │   ├── ratelimit/        # Rate limiting
│   │   │   └── limiter.go    # Sliding window algorithm
│   │   │
│   │   ├── storage/          # USB I/O operations
│   │   │   ├── service.go    # Cross-platform storage
│   │   │   ├── storage_windows.go
│   │   │   └── storage_unix.go
│   │   │
│   │   └── wallet/           # Wallet management
│   │       └── service.go    # Create, restore, manage wallets
│   │
│   └── utils/                # Utilities and validators
│       ├── errors.go         # Custom error types
│       ├── validators.go     # Password, name validation
│       └── audit.go          # Audit logging
│
├── tests/
│   ├── unit/                 # Unit tests (180+ tests)
│   │   ├── bip32_test.go
│   │   ├── bip39_test.go
│   │   ├── encryption_test.go
│   │   ├── password_test.go
│   │   ├── ratelimit_test.go
│   │   ├── storage_test.go
│   │   ├── wallet_create_test.go
│   │   └── wallet_restore_test.go
│   │
│   └── integration/          # Integration tests (22+ tests)
│       ├── derive_address_test.go
│       └── wallet_lifecycle_test.go
│
├── go.mod                    # Go module definition
├── go.sum                    # Dependency checksums
├── README.md                 # User documentation
├── SECURITY.md               # Security documentation
└── ARCHITECTURE.md           # This file
```

## Component Design

### 1. CLI Layer (`cmd/arcsign/main.go`)

#### Responsibilities
- Parse command-line arguments
- Route to appropriate handlers
- Collect user input interactively
- Display formatted output
- Handle errors gracefully

#### Commands
```go
- create   → handleCreateWallet()
- restore  → handleRestoreWallet()
- derive   → handleDeriveAddress()
- version  → Display version info
- help     → Display usage info
```

#### Design Patterns
- **Command Pattern**: Each command is a separate handler function
- **Interactive UI**: Step-by-step user guidance
- **Input Validation**: Immediate feedback on invalid input

### 2. Wallet Service (`internal/services/wallet/service.go`)

#### Purpose
Central orchestrator for wallet operations.

#### Key Methods

```go
type WalletService struct {
    storagePath  string
    bip39Service *bip39service.BIP39Service
    rateLimiter  *ratelimit.RateLimiter
}

// CreateWallet generates a new wallet
func (s *WalletService) CreateWallet(
    name string,
    password string,
    wordCount int,
    usesPassphrase bool,
    bip39Passphrase string,
) (*models.Wallet, string, error)

// LoadWallet loads wallet metadata without decryption
func (s *WalletService) LoadWallet(walletID string) (*models.Wallet, error)

// RestoreWallet decrypts and retrieves mnemonic
func (s *WalletService) RestoreWallet(
    walletID string,
    password string,
) (string, error)
```

#### Workflow: Create Wallet

```
1. Validate password strength
2. Validate wallet name (if provided)
3. Generate random mnemonic (BIP39)
4. Derive seed from mnemonic + passphrase
5. Generate wallet ID (UUID v4)
6. Encrypt mnemonic with password
7. Create wallet directory structure
8. Write encrypted mnemonic to USB
9. Write wallet metadata to USB
10. Log audit event
11. Return wallet data + mnemonic
```

### 3. BIP39 Service (`internal/services/bip39service/service.go`)

#### Purpose
Mnemonic phrase generation and seed derivation.

#### Key Methods

```go
type BIP39Service struct{}

// GenerateMnemonic creates a new BIP39 mnemonic
func (s *BIP39Service) GenerateMnemonic(wordCount int) (string, error)

// ValidateMnemonic checks if mnemonic is valid BIP39
func (s *BIP39Service) ValidateMnemonic(mnemonic string) bool

// MnemonicToSeed derives 64-byte seed from mnemonic
func (s *BIP39Service) MnemonicToSeed(
    mnemonic string,
    passphrase string,
) ([]byte, error)
```

#### Implementation Details

**Entropy Generation**:
```go
- 12 words: 128 bits entropy + 4 bits checksum = 132 bits
- 24 words: 256 bits entropy + 8 bits checksum = 264 bits
- Source: crypto/rand (cryptographically secure)
```

**Seed Derivation**:
```go
- Algorithm: PBKDF2-HMAC-SHA512
- Iterations: 2048
- Salt: "mnemonic" + passphrase
- Output: 64 bytes (512 bits)
```

### 4. HD Key Service (`internal/services/hdkey/service.go`)

#### Purpose
BIP32/BIP44 hierarchical deterministic key derivation.

#### Key Methods

```go
type HDKeyService struct {
    params *chaincfg.Params
}

// NewMasterKey creates master key from BIP39 seed
func (s *HDKeyService) NewMasterKey(seed []byte) (*hdkeychain.ExtendedKey, error)

// DerivePath derives child key following BIP32 path
func (s *HDKeyService) DerivePath(
    key *hdkeychain.ExtendedKey,
    path string,
) (*hdkeychain.ExtendedKey, error)

// GetPublicKey extracts compressed public key (33 bytes)
func (s *HDKeyService) GetPublicKey(key *hdkeychain.ExtendedKey) ([]byte, error)

// GetPrivateKey extracts private key (32 bytes)
func (s *HDKeyService) GetPrivateKey(key *hdkeychain.ExtendedKey) ([]byte, error)

// GetExtendedPublicKey returns xpub string
func (s *HDKeyService) GetExtendedPublicKey(key *hdkeychain.ExtendedKey) (string, error)

// GetExtendedPrivateKey returns xprv string
func (s *HDKeyService) GetExtendedPrivateKey(key *hdkeychain.ExtendedKey) (string, error)
```

#### Path Derivation Algorithm

```go
// Parse path: "m/44'/0'/0'/0/0"
1. Remove "m/" prefix
2. Split by "/" → ["44'", "0'", "0'", "0", "0"]
3. For each component:
   a. Check for hardened (') suffix
   b. Parse numeric index
   c. If hardened: index = 0x80000000 + index
   d. Derive child: key.Derive(index)
4. Return final derived key
```

#### Hardened vs Non-Hardened

```
Hardened (index ≥ 2^31):
- Uses parent private key
- Cannot derive from xpub
- Notation: index' or index + 0x80000000
- Used for: purpose, coin_type, account

Non-Hardened (index < 2^31):
- Uses parent public key
- Can derive from xpub (watch-only)
- Notation: index
- Used for: change, address_index
```

### 5. Address Service (`internal/services/address/service.go`)

#### Purpose
Convert extended keys to cryptocurrency addresses across 54 blockchains.

#### Key Methods

```go
type AddressService struct {
    registry *coinregistry.Registry
}

// DeriveAddress is the universal address derivation method
func (s *AddressService) DeriveAddress(
    key *hdkeychain.ExtendedKey,
    formatterID string,
) (string, error)

// Specialized formatters (54 total)
func (s *AddressService) DeriveBitcoinAddress(key *hdkeychain.ExtendedKey) (string, error)
func (s *AddressService) DeriveEthereumAddress(key *hdkeychain.ExtendedKey) (string, error)
func (s *AddressService) DeriveStarknetAddress(key *hdkeychain.ExtendedKey) (string, error)
func (s *AddressService) DeriveCosmosAddress(key *hdkeychain.ExtendedKey, prefix string) (string, error)
func (s *AddressService) DeriveKusamaAddress(key *hdkeychain.ExtendedKey) (string, error)
func (s *AddressService) DeriveIconAddress(key *hdkeychain.ExtendedKey) (string, error)
func (s *AddressService) DeriveTezosAddress(key *hdkeychain.ExtendedKey) (string, error)
func (s *AddressService) DeriveZilliqaAddress(key *hdkeychain.ExtendedKey) (string, error)
// ... 46+ more formatters
```

#### Address Derivation Examples

**Bitcoin (P2PKH)**:
```
1. Get public key (33 bytes compressed)
2. RIPEMD160(SHA256(pubkey))
3. Add version byte (0x00 for mainnet)
4. Base58Check encode
5. Return address (starts with "1")
```

**Ethereum (Keccak256)**:
```
1. Get public key (65 bytes uncompressed)
2. Remove 0x04 prefix → 64 bytes
3. Keccak256 hash → 32 bytes
4. Take last 20 bytes
5. Add "0x" prefix
6. Return address (42 characters total)
```

**Starknet (EIP-2645 grindKey)**:
```
1. Get private key from BIP32 path
2. Apply grindKey algorithm (find valid Stark key)
3. Iterate: key = hash(key) until valid
4. Calculate Stark public key
5. Return address (0x + 64 hex chars)
```

**Cosmos/Harmony (Bech32)**:
```
1. Get public key (33 bytes compressed)
2. SHA256 hash
3. RIPEMD160 hash
4. Bech32 encode with prefix (osmo, juno, one, etc.)
5. Return address (starts with prefix)
```

**Kusama (sr25519 + SS58)**:
```
1. Use BIP32 key as sr25519 seed
2. Derive sr25519 keypair
3. SS58 encode with network format 2
4. Return address (starts with C-H, J)
```

**ICON (SHA3-256)**:
```
1. Get public key (65 bytes uncompressed)
2. Remove 0x04 prefix
3. SHA3-256 hash (FIPS 202 standard)
4. Take last 20 bytes
5. Return "hx" + hex
```

**Tezos (Ed25519 + SLIP-10)**:
```
1. Use BIP32 key as SLIP-10 seed
2. Derive Ed25519 key with path m/0'
3. Blake2b hash of public key
4. Base58Check encode with tz1 prefix
5. Return address (starts with "tz1")
```

**Zilliqa (Schnorr + Bech32)**:
```
1. Get secp256k1 private key
2. Derive public key with Schnorr
3. SHA256 hash, take last 20 bytes
4. Bech32 encode with "zil" prefix
5. Return address (starts with "zil1")
```

### 6. Coin Registry Service (`internal/services/coinregistry/registry.go`)

#### Purpose
Central registry for all supported cryptocurrency metadata and formatter routing.

#### Key Methods

```go
type Registry struct {
    coins       map[string]CoinMetadata
    byCoinType  map[uint32]CoinMetadata
    sortedCoins []CoinMetadata
}

// GetCoin returns metadata by symbol
func (r *Registry) GetCoin(symbol string) (*CoinMetadata, error)

// GetCoinByCoinType returns metadata by SLIP-44 coin type
func (r *Registry) GetCoinByCoinType(coinType uint32) (*CoinMetadata, error)

// ListCoins returns all coins sorted by market cap
func (r *Registry) ListCoins() []CoinMetadata

// GetSupportedChainCount returns total number of chains
func (r *Registry) GetSupportedChainCount() int
```

#### Coin Metadata Structure

```go
type CoinMetadata struct {
    Symbol        string         // BTC, ETH, KSM, etc.
    Name          string         // Bitcoin, Ethereum, Kusama
    CoinType      uint32         // SLIP-44 coin type
    FormatterID   string         // Formatter function identifier
    MarketCapRank int           // Ranking (for sorting)
    KeyType       KeyType       // secp256k1, Ed25519, sr25519
    Category      ChainCategory // Layer2, Regional, Cosmos, etc.
}
```

#### Supported Categories

```go
const (
    ChainCategoryBase       = "base"        // Original 30 chains
    ChainCategoryLayer2     = "layer2"      // Arbitrum, Optimism, Base, etc.
    ChainCategoryRegional   = "regional"    // Klaytn, Cronos, HECO, Harmony
    ChainCategoryCosmos     = "cosmos"      // Osmosis, Juno, Evmos, Secret
    ChainCategoryEVM        = "evm"         // Fantom, Celo, Moonbeam, etc.
    ChainCategorySubstrate  = "substrate"   // Kusama
    ChainCategoryCustom     = "custom"      // ICON, Tezos, Zilliqa
)
```

#### Signature Schemes

```go
const (
    KeyTypeSecp256k1 = "secp256k1" // Bitcoin, Ethereum, most chains
    KeyTypeEd25519   = "ed25519"   // Solana, Tezos
    KeyTypeSr25519   = "sr25519"   // Kusama, Polkadot
)
```

### 7. Encryption Service (`internal/services/encryption/service.go`)

#### Purpose
Encrypt and decrypt sensitive data with password-based keys.

#### Key Methods

```go
type EncryptionService struct{}

// Encrypt encrypts data with password
func (s *EncryptionService) Encrypt(
    plaintext []byte,
    password string,
) (ciphertext []byte, err error)

// Decrypt decrypts data with password
func (s *EncryptionService) Decrypt(
    ciphertext []byte,
    password string,
) (plaintext []byte, err error)
```

#### Encryption Format

```
┌──────────────────────────────────────────────────────────┐
│                   Encrypted Data Format                   │
├──────────────┬───────────────┬───────────────────────────┤
│ Salt         │ Nonce         │ Ciphertext + Auth Tag     │
│ (16 bytes)   │ (12 bytes)    │ (variable length)         │
└──────────────┴───────────────┴───────────────────────────┘
```

#### Encryption Workflow

```
1. Generate 16-byte random salt
2. Derive 32-byte key from password using Argon2id:
   - Time: 4 iterations
   - Memory: 256 MiB
   - Parallelism: 4
   - Salt: 16 bytes
3. Generate 12-byte random nonce
4. Encrypt plaintext with AES-256-GCM:
   - Key: 32 bytes from Argon2id
   - Nonce: 12 bytes
   - Output: ciphertext + 16-byte auth tag
5. Concatenate: salt || nonce || ciphertext+tag
6. Return encrypted data
```

#### Decryption Workflow

```
1. Parse encrypted data:
   - salt = first 16 bytes
   - nonce = next 12 bytes
   - ciphertext+tag = remaining bytes
2. Derive key from password + salt (Argon2id)
3. Decrypt with AES-256-GCM
4. Verify authentication tag
5. Return plaintext or error
```

### 7. Storage Service (`internal/services/storage/service.go`)

#### Purpose
Handle USB device detection and file I/O operations.

#### Key Methods

```go
// DetectUSBDevices returns list of USB drive paths
func DetectUSBDevices() ([]string, error)

// GetAvailableSpace returns free space on drive
func GetAvailableSpace(path string) (uint64, error)

// WriteFile atomically writes data to path
func WriteFile(path string, data []byte, perm os.FileMode) error

// ReadFile reads data from path
func ReadFile(path string) ([]byte, error)
```

#### Platform-Specific Implementation

**Windows** (`storage_windows.go`):
```go
// Uses gousbdrivedetector library
// Detects removable drives (type 2)
// Returns paths like "D:\", "E:\"
```

**Unix/Linux** (`storage_unix.go`):
```go
// Scans /media/{user}/ directories
// Filters for mounted filesystems
// Returns paths like "/media/user/USB_DRIVE"
```

#### Atomic File Write

```go
1. Create temporary file: "{path}.tmp"
2. Write data to temporary file
3. Set file permissions (0600 for sensitive data)
4. Call fsync() to flush to disk
5. Rename temporary file to final path (atomic operation)
6. If any step fails, delete temporary file
```

### 8. Rate Limiter (`internal/services/ratelimit/limiter.go`)

#### Purpose
Prevent brute-force password attacks with sliding window rate limiting.

#### Key Methods

```go
type RateLimiter struct {
    attempts map[string][]time.Time
    mu       sync.RWMutex
}

// AllowAttempt checks if attempt is allowed
func (r *RateLimiter) AllowAttempt(walletID string) bool

// ResetAttempts clears failed attempts (on success)
func (r *RateLimiter) ResetAttempts(walletID string)
```

#### Algorithm: Sliding Window

```
Configuration:
- Max attempts: 3
- Time window: 60 seconds

Logic:
1. Get current time
2. Load attempt history for wallet ID
3. Remove attempts older than 60 seconds
4. If remaining attempts < 3:
   a. Add current time to history
   b. Return true (allowed)
5. Else:
   a. Return false (rate limited)

On successful authentication:
- Call ResetAttempts() to clear history
```

### 9. Audit Logger (`internal/utils/audit.go`)

#### Purpose
Create tamper-evident logs of all wallet operations.

#### Log Format: NDJSON

```json
{"timestamp":"2025-10-16T15:30:45Z","event":"WALLET_CREATED","wallet_id":"abc123","details":{"word_count":12}}
{"timestamp":"2025-10-16T15:35:12Z","event":"RESTORE_SUCCESS","wallet_id":"abc123"}
{"timestamp":"2025-10-16T15:40:30Z","event":"RESTORE_FAILURE","wallet_id":"abc123","details":{"reason":"wrong_password"}}
```

#### Key Functions

```go
// LogEvent appends an audit event to log file
func LogEvent(
    logPath string,
    eventType string,
    walletID string,
    details map[string]interface{},
) error
```

#### Event Types

```
- WALLET_CREATED: New wallet created
- RESTORE_SUCCESS: Successful mnemonic decryption
- RESTORE_FAILURE: Failed password attempt
- (extensible for future events)
```

## Data Models (`internal/models/models.go`)

### Wallet

```go
type Wallet struct {
    ID              string    `json:"id"`              // UUID v4
    Name            string    `json:"name"`            // Optional
    CreatedAt       time.Time `json:"created_at"`
    LastAccessedAt  time.Time `json:"last_accessed_at"`
    WordCount       int       `json:"word_count"`      // 12 or 24
    UsesPassphrase  bool      `json:"uses_passphrase"` // BIP39 passphrase flag
}
```

### File Structure on USB

```
{USB_DRIVE}/
└── {wallet-id}/
    ├── wallet.json         # Wallet metadata (unencrypted)
    ├── mnemonic.enc        # Encrypted mnemonic phrase
    └── audit.log           # Audit trail (append-only NDJSON)
```

**wallet.json** example:
```json
{
  "id": "3c3e0aba-91e1-44d4-8b29-ec066d5acf0b",
  "name": "My Crypto Wallet",
  "created_at": "2025-10-16T15:30:45Z",
  "last_accessed_at": "2025-10-16T15:35:12Z",
  "word_count": 12,
  "uses_passphrase": false
}
```

## Data Flow Diagrams

### Wallet Creation Flow

```
User Input
    ↓
CLI (handleCreateWallet)
    ↓
WalletService.CreateWallet()
    ├─→ Validators.ValidatePassword()
    ├─→ Validators.ValidateWalletName()
    ├─→ BIP39Service.GenerateMnemonic()
    ├─→ EncryptionService.Encrypt()
    ├─→ StorageService.WriteFile()
    └─→ AuditLogger.LogEvent()
    ↓
Return wallet data + mnemonic to user
```

### Address Derivation Flow

```
User Input (wallet ID, password, coin, account, index)
    ↓
CLI (handleDeriveAddress)
    ↓
WalletService.LoadWallet()
    ↓
WalletService.RestoreWallet()
    ├─→ RateLimiter.AllowAttempt()
    ├─→ StorageService.ReadFile()
    ├─→ EncryptionService.Decrypt()
    └─→ RateLimiter.ResetAttempts() (on success)
    ↓
BIP39Service.MnemonicToSeed()
    ↓
HDKeyService.NewMasterKey()
    ↓
HDKeyService.DerivePath()
    ↓
AddressService.DeriveBitcoinAddress() / DeriveEthereumAddress()
    ↓
Display address to user
```

## Security Architecture

### Defense in Depth

```
Layer 1: Physical Security
- USB-only storage
- User controls physical access

Layer 2: Encryption
- AES-256-GCM authenticated encryption
- Argon2id memory-hard KDF

Layer 3: Authentication
- Strong password requirements
- Rate limiting (3 attempts/minute)

Layer 4: Audit
- Comprehensive logging
- Tamper-evident NDJSON format

Layer 5: Standards Compliance
- BIP39/BIP32/BIP44 implementations
- Audited cryptographic libraries
```

### Key Security Properties

1. **Confidentiality**: AES-256-GCM encryption
2. **Integrity**: GCM authentication tag
3. **Availability**: Rate limiting prevents DoS
4. **Non-repudiation**: Audit logging
5. **Forward secrecy**: Unique salt per wallet
6. **Hardened derivation**: Protects parent keys

## Testing Strategy

### Test Pyramid

```
         /\
        /  \
       /    \    5 Integration Tests (end-to-end workflows)
      /──────\
     /        \
    /          \  25 Integration Tests (multi-component)
   /────────────\
  /              \
 /                \ 270 Unit Tests (individual components)
/──────────────────\
```

### Test Coverage

**Unit Tests** (`tests/unit/`):
- BIP39 mnemonic generation and validation
- BIP32 key derivation and path parsing
- Encryption/decryption with Argon2id
- Password validation
- Rate limiting logic
- Storage I/O operations
- Wallet creation and restoration
- 54 blockchain address derivation tests
- Coin registry and metadata tests
- Advanced signature schemes (sr25519, Schnorr, SLIP-10)
- Multiple address formats (P2PKH, Keccak256, Bech32, SS58, SHA3-256)

**Integration Tests** (`tests/integration/`):
- Address derivation from wallet
- Multi-address generation (54 blockchains)
- BIP39 passphrase functionality
- Multi-account derivation
- End-to-end: create → restore → derive
- Multi-chain address generation
- Starknet EIP-2645 derivation
- Cosmos Bech32 encoding

### Test Fixtures

Deterministic test data for reproducibility:
```go
// Fixed seed for testing
testSeed := make([]byte, 64)
for i := range testSeed {
    testSeed[i] = byte(i % 256)
}

// Known mnemonics for testing
testMnemonic12 := "abandon ability able about above absent absorb abstract absurd abuse access accident"
testMnemonic24 := "abandon ability able about above absent absorb abstract absurd abuse access accident acoustic acquire across act action actor actress actual adapt add addict address"
```

## Performance Considerations

### Argon2id Tuning

```
Current parameters:
- Time: 4 iterations
- Memory: 256 MiB
- Threads: 4

Expected performance:
- Encryption: ~500ms per operation
- Decryption: ~500ms per operation

Trade-off:
- Higher values = more secure, slower
- Current values follow OWASP recommendations
- Acceptable for wallet operations (not real-time)
```

### Memory Usage

```
Typical operation:
- Argon2id: 256 MiB (temporary)
- Key material: <1 KB (cleared after use)
- HD derivation: <10 KB per key
- Total: ~260 MiB peak during encryption/decryption
```

### Disk I/O

```
Wallet creation:
- Write wallet.json: ~500 bytes
- Write mnemonic.enc: ~200 bytes
- Write audit.log: ~150 bytes per event
- Total: <1 KB per wallet

Atomic writes:
- fsync() calls ensure durability
- Trade latency for crash-safety
- Acceptable for infrequent operations
```

## Extension Points

### Adding New Cryptocurrencies

The architecture supports easy extension for new blockchains. Example workflow:

1. **Add Formatter to Address Service**:
```go
// internal/services/address/newcoin.go
func (s *AddressService) DeriveNewCoinAddress(
    key *hdkeychain.ExtendedKey,
) (string, error) {
    // Implement coin-specific address derivation
    // Can use secp256k1, Ed25519, sr25519, etc.
}
```

2. **Register in Coin Registry**:
```go
// internal/services/coinregistry/registry.go
r.addCoin(CoinMetadata{
    Symbol:        "NEW",
    Name:          "NewCoin",
    CoinType:      999,  // SLIP-44 coin type
    FormatterID:   "newcoin",
    MarketCapRank: 55,
    KeyType:       KeyTypeSecp256k1,
    Category:      models.ChainCategoryBase,
})
```

3. **Add Switch Case**:
```go
// internal/services/address/service.go
case "newcoin":
    return s.DeriveNewCoinAddress(key)
```

4. **Add Comprehensive Tests**:
```go
// tests/unit/newcoin_test.go
func TestDeriveNewCoinAddress_KnownVector(t *testing.T) {
    // Test with known mnemonic and expected address
}
func TestDeriveNewCoinAddress_Format(t *testing.T) {
    // Test address format validation
}
func TestDeriveNewCoinAddress_Determinism(t *testing.T) {
    // Test deterministic derivation
}
```

### Architecture Benefits

- **Extensibility**: Formatter pattern supports any blockchain
- **Testability**: Each formatter has isolated unit tests
- **Maintainability**: Centralized coin registry
- **Type Safety**: Strong typing with Go interfaces

### Future Enhancements

- **Transaction Signing**: Add signing service for Bitcoin, Ethereum
- **Multi-Signature**: Implement m-of-n signatures
- **Hardware Wallets**: Integrate with Ledger/Trezor
- **GUI**: Build graphical interface
- **Mobile**: Port to iOS/Android
- **Cloud Backup**: Optional encrypted cloud storage
- **Watch-Only Mode**: xpub support for balance tracking

## Deployment

### Build Process

```bash
# Windows
GOOS=windows GOARCH=amd64 go build -o arcsign.exe ./cmd/arcsign

# macOS
GOOS=darwin GOARCH=amd64 go build -o arcsign ./cmd/arcsign

# Linux
GOOS=linux GOARCH=amd64 go build -o arcsign ./cmd/arcsign
```

### Release Checklist

- [x] All tests passing (300+)
- [x] Security audit completed (self-audit)
- [x] Documentation updated
- [x] Version number incremented (v0.3.0)
- [x] CHANGELOG updated
- [x] 54 blockchains validated
- [ ] Build for all platforms
- [ ] Code signing (Windows/macOS)
- [ ] SHA256 checksums generated
- [ ] GitHub release created

## References

- [BIP39 Spec](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki)
- [BIP32 Spec](https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki)
- [BIP44 Spec](https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki)
- [SLIP-44](https://github.com/satoshilabs/slips/blob/master/slip-0044.md)
- [Argon2 RFC](https://datatracker.ietf.org/doc/html/rfc9106)
- [AES-GCM NIST](https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-38d.pdf)

---

**Last Updated**: 2025-10-17
**Version**: 0.3.0
**Supported Blockchains**: 54
**Maintainer**: ArcSign Development Team
