# Quickstart Guide: ArcSign Wallet (BIP39/BIP44)

**Feature**: `001-bip39-bip-44`
**Date**: 2025-10-15
**Status**: Implementation Ready

---

## Overview

This guide helps developers set up their environment, install dependencies, run tests, and build the ArcSign secure wallet CLI for BIP39/BIP44 wallet management.

---

## Prerequisites

### System Requirements

- **Operating System**: Linux, macOS, or Windows
- **Go Version**: 1.21 or later
- **USB Storage**: At least 10 MB free space
- **Memory**: At least 1 GB free RAM (for Argon2id encryption)

### Required Tools

- Go toolchain (`go` command)
- Git (for dependency management)
- Make (optional, for build automation)
- USB storage device (for encrypted wallet storage)

---

## Quick Start (5 Minutes)

### 1. Clone Repository

```bash
cd /Users/jnr350/Desktop/Yansiang/arcSignv2
```

### 2. Install Dependencies

```bash
# Install BIP39/BIP32/BIP44 libraries
go get github.com/tyler-smith/go-bip39@v1.1.0
go get github.com/btcsuite/btcd/btcutil/hdkeychain@v1.1.4
go get github.com/btcsuite/btcd/chaincfg@v1.1.4

# Install encryption libraries
go get golang.org/x/crypto@v0.17.0

# Install USB storage libraries
go get github.com/SonarBeserk/gousbdrivedetector@latest
go get golang.org/x/sys@v0.15.0

# Install multi-coin address libraries (v0.2.0+)
go get github.com/ethereum/go-ethereum/crypto@latest
go get github.com/stellar/go/keypair@latest
go get github.com/gagliardetto/solana-go@latest

# Verify dependencies
go mod tidy
go mod verify
```

### 3. Run Tests

```bash
# Run all tests
go test ./...

# Run tests with coverage
go test -cover ./...

# Run specific test suite
go test ./internal/services/bip39/...

# Run with verbose output
go test -v ./...
```

### 4. Build CLI

```bash
# Build for current platform
go build -o bin/arcsign ./cmd/arcsign

# Build with optimization (production)
go build -ldflags="-s -w" -o bin/arcsign ./cmd/arcsign

# Cross-compile for other platforms
GOOS=linux GOARCH=amd64 go build -o bin/arcsign-linux-amd64 ./cmd/arcsign
GOOS=darwin GOARCH=amd64 go build -o bin/arcsign-darwin-amd64 ./cmd/arcsign
GOOS=windows GOARCH=amd64 go build -o bin/arcsign-windows-amd64.exe ./cmd/arcsign
```

### 5. Run CLI

```bash
# Create new wallet (automatically generates 24+ crypto addresses)
./bin/arcsign wallet create --name "My Wallet"

# Restore wallet from mnemonic
./bin/arcsign wallet restore --mnemonic "word1 word2 ... word24"

# List wallets
./bin/arcsign wallet list

# View all auto-generated addresses (v0.2.0+)
./bin/arcsign address list-all --wallet-id <uuid>

# Get specific coin address (v0.2.0+)
./bin/arcsign address get --wallet-id <uuid> --coin BTC

# Derive custom address
./bin/arcsign address derive --wallet-id <uuid> --coin-type 0

# View audit log
./bin/arcsign audit log --wallet-id <uuid>
```

---

## Development Workflow

### Project Structure

```
/Users/jnr350/Desktop/Yansiang/arcSignv2/
├── cmd/
│   └── arcsign/            # CLI entry point
│       └── main.go
├── internal/
│   ├── models/             # Data entities
│   ├── services/           # Business logic
│   │   ├── bip39/          # BIP39 mnemonic generation/validation
│   │   ├── bip32/          # BIP32 HD key derivation
│   │   ├── bip44/          # BIP44 multi-account hierarchy
│   │   ├── crypto/         # Argon2id + AES-256-GCM encryption
│   │   ├── storage/        # USB file operations
│   │   ├── audit/          # Audit log management
│   │   ├── coinregistry/   # SLIP-44 coin metadata registry (v0.2.0+)
│   │   └── address/        # Multi-coin address formatters (v0.2.0+)
│   │       ├── service.go      # Core address service
│   │       ├── bitcoin.go      # Bitcoin-compatible formatters
│   │       ├── stellar.go      # Stellar (XLM) formatter
│   │       ├── solana.go       # Solana (SOL) formatter
│   │       ├── tron.go         # TRON (TRX) formatter
│   │       ├── ripple.go       # Ripple (XRP) formatter
│   │       └── cosmos.go       # Cosmos (ATOM) formatter
│   ├── cli/                # CLI commands
│   └── lib/                # Shared utilities
├── tests/
│   ├── contract/           # BIP39/32/44/SLIP-44 test vectors
│   ├── integration/        # End-to-end workflows
│   └── unit/               # Unit tests for each service
├── docs/                   # Feature documentation
│   └── MULTI_COIN_ADDRESSES.md  # Multi-coin feature guide (v0.2.0+)
├── specs/
│   └── 001-bip39-bip-44/   # This feature's documentation
├── go.mod
└── go.sum
```

### Test-Driven Development (TDD) Workflow

**Required by ArcSign Constitution (Principle II)**

1. **Write Test First (Red)**:
   ```bash
   # Create test file
   touch tests/unit/bip39_test.go

   # Write failing test
   go test ./tests/unit/bip39_test.go
   # Expected: FAIL (function not implemented)
   ```

2. **Implement Minimal Code (Green)**:
   ```bash
   # Implement just enough to pass test
   # Edit internal/services/bip39/generator.go

   go test ./tests/unit/bip39_test.go
   # Expected: PASS
   ```

3. **Refactor**:
   ```bash
   # Improve code quality without breaking tests
   go test ./tests/unit/bip39_test.go
   # Expected: PASS (still passing after refactor)
   ```

4. **Repeat** for next feature

### Running Test Suites

**Unit Tests** (test individual functions):
```bash
# BIP39 mnemonic generation
go test ./tests/unit/bip39_test.go -v

# Argon2id encryption
go test ./tests/unit/crypto_test.go -v

# USB storage operations
go test ./tests/unit/storage_test.go -v
```

**Contract Tests** (validate against BIP39/BIP32/BIP44 test vectors):
```bash
# BIP39 official test vectors
go test ./tests/contract/bip39_vectors_test.go -v

# BIP44 derivation paths
go test ./tests/contract/bip44_vectors_test.go -v
```

**Integration Tests** (end-to-end workflows):
```bash
# Full wallet lifecycle
go test ./tests/integration/wallet_lifecycle_test.go -v

# Encryption/decryption roundtrip
go test ./tests/integration/encryption_test.go -v

# Multi-coin address generation performance (v0.2.0+)
go test ./tests/integration/performance_test.go -v
```

**Security Tests** (memory clearing, randomness quality):
```bash
# Memory clearing verification
go test ./tests/security/memory_test.go -v

# Entropy quality
go test ./tests/security/entropy_test.go -v
```

**Performance Benchmarks** (v0.2.0+):
```bash
# Benchmark wallet creation with multi-coin addresses
go test -bench=BenchmarkWalletCreation -benchtime=3x ./tests/integration/performance_test.go

# Expected: < 10 seconds per wallet creation with 24+ addresses
```

### Code Quality Checks

**Linting**:
```bash
# Install golangci-lint
go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest

# Run linter
golangci-lint run ./...

# Fix auto-fixable issues
golangci-lint run --fix ./...
```

**Security Scanning**:
```bash
# Install gosec
go install github.com/securego/gosec/v2/cmd/gosec@latest

# Run security scan
gosec ./...

# Scan with verbose output
gosec -fmt=json -out=security-report.json ./...
```

**Code Coverage**:
```bash
# Generate coverage report
go test -coverprofile=coverage.out ./...

# View coverage in browser
go tool cover -html=coverage.out

# Check coverage percentage
go tool cover -func=coverage.out | grep total
```

---

## CLI Usage Examples

### Wallet Management

**Create New Wallet**:
```bash
# Basic usage (24-word mnemonic, no passphrase)
./bin/arcsign wallet create

# With custom name
./bin/arcsign wallet create --name "Bitcoin Savings"

# With BIP39 passphrase (25th word)
./bin/arcsign wallet create --passphrase "my-secret-passphrase"

# 12-word mnemonic (not recommended, use 24 words)
./bin/arcsign wallet create --mnemonic-length 12
```

**Restore Wallet from Mnemonic**:
```bash
# Interactive mode (prompts for mnemonic)
./bin/arcsign wallet restore

# From file (for automation)
./bin/arcsign wallet restore --mnemonic-file mnemonic.txt

# With BIP39 passphrase
./bin/arcsign wallet restore --passphrase "my-secret-passphrase"
```

**List Wallets**:
```bash
# List all wallets on USB
./bin/arcsign wallet list

# JSON output (for scripting)
./bin/arcsign wallet list --output json
```

**Unlock/Lock Wallet**:
```bash
# Unlock wallet (decrypt mnemonic into memory)
./bin/arcsign wallet unlock --wallet-id <uuid>

# Lock wallet (clear mnemonic from memory)
./bin/arcsign wallet lock --wallet-id <uuid>
```

### Multi-Coin Address Generation (v0.2.0+)

**Automatic Address Generation**:
Starting with v0.2.0, ArcSign automatically generates addresses for 24+ cryptocurrencies during wallet creation:

```bash
# Create wallet - addresses are generated automatically
./bin/arcsign wallet create --name "Multi-Coin Wallet"

# Output shows:
# Multi-Coin Addresses:
#   ✓ Generated 24 cryptocurrency addresses
#
#   Sample addresses (sorted by market cap):
#     1. Bitcoin (BTC): 1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa
#     2. Ethereum (ETH): 0x742d35Cc6634C0532925a3b844Bc9e759...
#     3. Tether (USDT): 0x742d35Cc6634C0532925a3b844Bc9e759...
#     4. BNB (BNB): 0x742d35Cc6634C0532925a3b844Bc9e759...
#     5. Solana (SOL): 7EcDhSYGxXyscszYEp35KHN8vvw3svAuLK...
#     ... and 19 more
```

**List All Addresses**:
```bash
# View all auto-generated addresses
./bin/arcsign address list-all --wallet-id <uuid>

# JSON output (for scripting)
./bin/arcsign address list-all --wallet-id <uuid> --output json
```

**Get Specific Coin Address**:
```bash
# Get Bitcoin address
./bin/arcsign address get --wallet-id <uuid> --coin BTC

# Get Ethereum address
./bin/arcsign address get --wallet-id <uuid> --coin ETH

# Get Solana address
./bin/arcsign address get --wallet-id <uuid> --coin SOL
```

**Supported Cryptocurrencies** (24 coins):
- Bitcoin (BTC), Ethereum (ETH), Tether (USDT), BNB (BNB)
- Solana (SOL), USD Coin (USDC), XRP (XRP), Dogecoin (DOGE)
- TRON (TRX), Avalanche (AVAX), Shiba Inu (SHIB), Chainlink (LINK)
- Polygon (MATIC), Litecoin (LTC), Bitcoin Cash (BCH), Stellar (XLM)
- Uniswap (UNI), Cosmos (ATOM), Ethereum Classic (ETC), Dash (DASH)
- Zcash (ZEC), and more...

For full details, see [docs/MULTI_COIN_ADDRESSES.md](../../docs/MULTI_COIN_ADDRESSES.md)

### Account Management

**Create Account**:
```bash
# Bitcoin account (coin type 0)
./bin/arcsign account create --wallet-id <uuid> --coin-type 0 --name "Bitcoin Main"

# Ethereum account (coin type 60)
./bin/arcsign account create --wallet-id <uuid> --coin-type 60 --name "Ethereum Savings"

# Litecoin account (coin type 2)
./bin/arcsign account create --wallet-id <uuid> --coin-type 2
```

**List Accounts**:
```bash
# List all accounts for wallet
./bin/arcsign account list --wallet-id <uuid>
```

### Address Derivation

**Derive Address**:
```bash
# Derive next external (receive) address
./bin/arcsign address derive --wallet-id <uuid> --account-id <composite-id>

# Derive internal (change) address
./bin/arcsign address derive --wallet-id <uuid> --account-id <composite-id> --change 1

# With custom label
./bin/arcsign address derive --wallet-id <uuid> --account-id <composite-id> --label "Payment from Alice"
```

**List Addresses**:
```bash
# List all addresses for account
./bin/arcsign address list --wallet-id <uuid> --account-id <composite-id>

# Filter by change type
./bin/arcsign address list --wallet-id <uuid> --account-id <composite-id> --change 0
```

### Audit Log

**View Audit Log**:
```bash
# View last 100 entries
./bin/arcsign audit log --wallet-id <uuid>

# View specific range
./bin/arcsign audit log --wallet-id <uuid> --limit 50 --offset 100

# Filter by operation type
./bin/arcsign audit log --wallet-id <uuid> --operation WALLET_ACCESS

# Filter by status
./bin/arcsign audit log --wallet-id <uuid> --status FAILURE
```

---

## Troubleshooting

### Common Issues

**1. USB Storage Not Detected**

**Error**:
```
USB storage device not detected. Please insert a USB drive and try again.
```

**Solution**:
- Ensure USB drive is inserted and mounted
- Linux: Check `/media/` or `/mnt/`
- macOS: Check `/Volumes/`
- Windows: Check drive letters (E:\, F:\, etc.)
- Run: `./bin/arcsign usb detect` to manually detect USB devices

**2. USB Storage Full**

**Error**:
```
USB storage device is full. Please free up space or use a different USB drive.
```

**Solution**:
- Delete unnecessary files from USB
- Use a larger USB drive
- Check disk space: `./bin/arcsign usb status`

**3. Wrong Password**

**Error**:
```
Authentication failed: wrong password or corrupted data
```

**Solution**:
- Verify you're entering the correct encryption password
- Note: NOT the BIP39 passphrase (25th word)
- Check for caps lock
- After 5 failed attempts, wait 15 minutes

**4. Rate Limited**

**Error**:
```
Too many failed attempts. Please wait 15 minutes before trying again.
```

**Solution**:
- Wait until lockout expires
- Check remaining lockout time: `./bin/arcsign wallet status --wallet-id <uuid>`
- Lockout resets 15 minutes from first failed attempt

**5. Invalid Mnemonic**

**Error**:
```
Invalid mnemonic: checksum failed
```

**Solution**:
- Verify all words are spelled correctly
- Ensure words are from BIP39 English word list (2048 words)
- Check for extra spaces or line breaks
- Word list: https://github.com/bitcoin/bips/blob/master/bip-0039/english.txt

**6. Build Errors**

**Error**:
```
missing go.sum entry for module providing package
```

**Solution**:
```bash
go mod tidy
go mod verify
```

**Error**:
```
undefined: argon2.IDKey
```

**Solution**:
```bash
go get golang.org/x/crypto/argon2@latest
```

**7. Test Failures**

**Error**:
```
TestBIP39Vectors FAIL: seed mismatch
```

**Solution**:
- Ensure you're using correct BIP39 implementation
- Verify passphrase is empty for test vectors (unless specified)
- Check test vector source: https://github.com/bitcoin/bips/blob/master/bip-0039/bip-0039-test-vectors.json

**8. Multi-Coin Address Generation Partial Failure (v0.2.0+)**

**Error**:
```
⚠️ Multi-Coin Addresses:
  Generated 20 addresses successfully (4 failed)
```

**Explanation**:
- This is a non-fatal warning, not an error
- Wallet creation succeeds even if some formatters fail
- Some cryptocurrencies require specialized libraries not yet implemented
- Examples: Cardano (ADA), Polkadot (DOT), Monero (XMR), Filecoin (FIL)

**Solution**:
- No action needed - your wallet is fully functional
- Successfully generated addresses are ready to use
- Failed addresses can be derived manually: `./bin/arcsign address derive --coin-type <type>`
- Check audit log for details: `./bin/arcsign audit log --wallet-id <uuid>`

**9. Coin Not Found in AddressBook**

**Error**:
```
address not found for symbol: ADA
```

**Solution**:
- Check which coins were successfully generated: `./bin/arcsign address list-all --wallet-id <uuid>`
- See supported coins list in [docs/MULTI_COIN_ADDRESSES.md](../../docs/MULTI_COIN_ADDRESSES.md)
- Derive unsupported coins manually: `./bin/arcsign address derive --wallet-id <uuid> --coin-type 1815`
- Coin type reference: https://github.com/satoshilabs/slips/blob/master/slip-0044.md

---

## Security Considerations

### Password Requirements

**Encryption Password** (for encrypted storage):
- Minimum 12 characters
- At least 3 of: uppercase, lowercase, digits, symbols
- Not a dictionary word
- Not reused from other accounts

**BIP39 Passphrase** (25th word, optional):
- Any string (including empty)
- Adds extra security layer
- **WARNING**: Lost passphrase = lost wallet (irrecoverable)

### Backup Strategy

**Critical: Backup Your Mnemonic**:
1. Write down mnemonic phrase on paper (never digital)
2. Store in secure location (fireproof safe, safety deposit box)
3. Consider multiple copies in different locations
4. Never share mnemonic with anyone
5. Never store mnemonic in:
   - Cloud storage (Dropbox, Google Drive, etc.)
   - Email
   - Screenshots
   - Text files on computer
   - Password managers (unless encrypted with strong master password)

**Backup Checklist**:
- [ ] Mnemonic phrase written on paper
- [ ] Stored in secure location
- [ ] BIP39 passphrase recorded separately (if used)
- [ ] Encryption password memorized or stored securely
- [ ] USB drive has copy of encrypted wallet
- [ ] Test restore process with small amount first

### USB Storage Security

**Best Practices**:
- Use dedicated USB drive for wallets (not shared with other data)
- Encrypt entire USB drive (OS-level encryption: LUKS, FileVault, BitLocker)
- Store USB drive in secure location when not in use
- Never leave USB drive inserted in unattended computer
- Regularly backup USB contents to second USB drive (keep offline)

**File Permissions**:
- All wallet files: 0600 (owner read/write only)
- Directory permissions: 0700 (owner read/write/execute only)
- Verify: `ls -la /media/usb/arcsign/`

---

## Development Tips

### Debugging

**Enable Debug Logging**:
```bash
# Set log level
export ARCSIGN_LOG_LEVEL=debug

# Run with verbose output
./bin/arcsign wallet create --verbose
```

**Inspect Encrypted Files**:
```bash
# View file metadata
file /media/usb/arcsign/wallets/<wallet-id>.wallet

# Check file permissions
ls -la /media/usb/arcsign/wallets/<wallet-id>.wallet

# View hex dump (for debugging serialization)
hexdump -C /media/usb/arcsign/wallets/<wallet-id>.wallet | head -n 5
```

**Memory Profiling** (verify memory clearing):
```bash
# Run with memory profiling
go test -memprofile=mem.prof ./tests/security/memory_test.go

# Inspect heap
go tool pprof mem.prof
> top
> list clearBytes
```

### Performance Tuning

**Benchmark Argon2id Parameters**:
```bash
# Run encryption benchmark
go test -bench=BenchmarkArgon2id -benchtime=10x ./tests/unit/crypto_test.go

# Expected: 1-2 seconds per operation on modern hardware
```

**Profile CPU Usage**:
```bash
# Generate CPU profile
go test -cpuprofile=cpu.prof -bench=. ./...

# Analyze profile
go tool pprof cpu.prof
> top
> list DeriveBIP44Address
```

### CI/CD Integration

**GitHub Actions Example** (`.github/workflows/test.yml`):
```yaml
name: Test
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-go@v4
        with:
          go-version: '1.21'
      - run: go mod download
      - run: go test -v -cover ./...
      - run: golangci-lint run ./...
      - run: gosec ./...
```

---

## Next Steps

### Phase 2: Implementation

After completing Phase 1 design (this document), run:

```bash
# Generate implementation tasks
/speckit.tasks
```

This will create `tasks.md` with test-driven implementation tasks broken down by user story.

### Phase 3: Testing

Follow TDD workflow:
1. Write unit tests (Red)
2. Implement minimal code (Green)
3. Refactor
4. Repeat

### Phase 4: Deployment

Build and distribute CLI:
```bash
# Build for all platforms
make build-all

# Create release artifacts
make release

# Test on each platform
make test-release
```

---

## Additional Resources

### Specifications

- **BIP39**: https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki
- **BIP32**: https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki
- **BIP44**: https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki
- **SLIP-44 Coin Types**: https://github.com/satoshilabs/slips/blob/master/slip-0044.md

### Multi-Coin Address Generation (v0.2.0+)

- **Multi-Coin Addresses Feature Guide**: [docs/MULTI_COIN_ADDRESSES.md](../../docs/MULTI_COIN_ADDRESSES.md)
- **Supported Cryptocurrencies**: 24+ coins with automatic address generation
- **Address Formatters**: Bitcoin, Ethereum, Ripple, Stellar, Solana, TRON, Cosmos, and more

### Go Documentation

- **tyler-smith/go-bip39**: https://pkg.go.dev/github.com/tyler-smith/go-bip39
- **btcsuite/hdkeychain**: https://pkg.go.dev/github.com/btcsuite/btcd/btcutil/hdkeychain
- **golang.org/x/crypto/argon2**: https://pkg.go.dev/golang.org/x/crypto/argon2
- **ethereum/go-ethereum/crypto**: https://pkg.go.dev/github.com/ethereum/go-ethereum/crypto
- **stellar/go/keypair**: https://pkg.go.dev/github.com/stellar/go/keypair
- **gagliardetto/solana-go**: https://pkg.go.dev/github.com/gagliardetto/solana-go

### Security Resources

- **OWASP Cryptographic Storage**: https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html
- **RFC 9106 (Argon2)**: https://datatracker.ietf.org/doc/html/rfc9106
- **NIST SP 800-38D (AES-GCM)**: https://csrc.nist.gov/publications/detail/sp/800-38d/final

---

**Quickstart Status**: ✅ COMPLETE

Ready for Phase 1 completion: Agent context update and final Constitution Check.
