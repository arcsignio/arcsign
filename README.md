# ArcSign

**Secure Hierarchical Deterministic (HD) Wallet with USB-Only Storage**

ArcSign is a command-line cryptocurrency wallet that implements BIP39/BIP44 standards for secure key management. It stores all sensitive data exclusively on USB drives, never on your computer's hard drive, providing an additional layer of security against malware and data theft.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Go Version](https://img.shields.io/badge/Go-1.21+-blue.svg)](https://golang.org/dl/)
[![Tests](https://img.shields.io/badge/tests-202%20passing-brightgreen.svg)]()

## Features

### Security First
- **USB-Only Storage**: All wallet data stored exclusively on removable USB drives
- **Military-Grade Encryption**: AES-256-GCM authenticated encryption
- **Memory-Hard KDF**: Argon2id with OWASP-recommended parameters (4 iterations, 256 MiB)
- **Rate Limiting**: Protection against brute-force attacks (3 attempts per minute)
- **Audit Logging**: Complete audit trail of all wallet operations
- **BIP39 Passphrase**: Optional 25th word for additional security layer

### Standards Compliance
- **BIP39**: Mnemonic phrase generation (12 or 24 words)
- **BIP32**: Hierarchical Deterministic key derivation
- **BIP44**: Multi-account hierarchy (m/44'/coin_type'/account'/change/address_index)
- **SLIP-44**: Standard coin type registry

### Cryptocurrency Support (54 Blockchains)

**v0.3.0 Extended Multi-Chain Support**
- **30 Base Chains** (v0.2.0): BTC, ETH, USDT, BNB, SOL, USDC, XRP, DOGE, ADA, TRX, AVAX, SHIB, DOT, LINK, MATIC, LTC, BCH, XLM, UNI, ATOM, ETC, XMR, FIL, HBAR, APT, VET, ALGO, NEAR, ZEC, DASH
- **6 Layer 2 Networks**: Arbitrum (ARB), Optimism (OP), Base (BASE), zkSync (ZKS), Linea (LINEA), Starknet (STRK)
- **4 Regional Chains**: Klaytn (KLAY), Cronos (CRO), HECO (HT), Harmony (ONE)
- **4 Cosmos Ecosystem**: Osmosis (OSMO), Juno (JUNO), Evmos (EVMOS), Secret Network (SCRT)
- **6 Alternative EVM**: Fantom (FTM), Celo (CELO), Moonbeam (GLMR), Metis (METIS), Gnosis (GNO), Wanchain (WAN)
- **4 Specialized Chains**: Kusama (KSM), ICON (ICX), Tezos (XTZ), Zilliqa (ZIL)

**Address Format Support**:
- P2PKH (Bitcoin), Keccak256 (Ethereum/EVM), Ed25519 (Solana, Tezos)
- Bech32 (Cosmos, Harmony, Zilliqa), SS58 (Kusama/Substrate)
- Base58Check (Bitcoin, Stellar, Ripple, Tezos), SHA3-256 (ICON)
- Schnorr signatures (Zilliqa), sr25519 (Kusama)
- SLIP-10 (Tezos), EIP-2645 (Starknet)

## Installation

### Prerequisites
- Go 1.21 or higher
- USB drive (minimum 10 MB free space)
- Windows, macOS, or Linux

### Build from Source

```bash
# Clone the repository
git clone https://github.com/yourusername/arcsign.git
cd arcsign

# Install dependencies
go mod download

# Build the binary
go build -o arcsign ./cmd/arcsign

# Verify installation
./arcsign version
```

## Quick Start

### 1. Create a New Wallet

```bash
./arcsign create
```

This interactive command will:
1. Detect your USB drive
2. Ask for a wallet name (optional)
3. Choose mnemonic length (12 or 24 words)
4. Set up BIP39 passphrase (optional, advanced)
5. Create a strong encryption password
6. Display your recovery mnemonic phrase

**⚠️ CRITICAL**: Write down your mnemonic phrase and store it safely offline!

### 2. Restore an Existing Wallet

```bash
./arcsign restore
```

This command allows you to:
- Load wallet metadata from USB
- Decrypt and view your mnemonic phrase
- Verify wallet information

### 3. Derive Cryptocurrency Addresses

```bash
./arcsign derive
```

Generate addresses for:
- Bitcoin (BTC)
- Ethereum (ETH)
- Custom account and address indexes

## Usage Examples

### Creating Your First Wallet

```
$ ./arcsign create

=== ArcSign Wallet Creation ===

Step 1: Detecting USB storage...
✓ USB device detected: D:\

Step 2: Enter wallet name (optional, press Enter to skip): My Crypto Wallet

Step 3: Choose mnemonic length:
  1) 12 words (recommended for most users)
  2) 24 words (maximum security)
Enter choice (1 or 2): 1

Step 4: BIP39 passphrase (advanced)
A BIP39 passphrase adds an extra layer of security.
⚠️  Warning: If you forget the passphrase, you cannot recover your wallet!
Use BIP39 passphrase? (y/N): N

Step 5: Set encryption password
Requirements:
  - At least 12 characters
  - At least 3 of: uppercase, lowercase, numbers, special characters

Enter password: ************
Confirm password: ************

Step 6: Creating wallet...
✓ Wallet created successfully!

═══════════════════════════════════════════════════════════
                  ⚠️  BACKUP YOUR MNEMONIC  ⚠️
═══════════════════════════════════════════════════════════

Write down these words in order and store them safely:

  abandon ability able about above absent absorb abstract absurd abuse access accident

═══════════════════════════════════════════════════════════

Wallet Information:
  ID: 3c3e0aba-91e1-44d4-8b29-ec066d5acf0b
  Name: My Crypto Wallet
  Created: 2025-10-16 15:30:45
  Storage: D:\

Your wallet is now ready to use!
```

### Deriving a Bitcoin Address

```
$ ./arcsign derive

=== ArcSign Address Derivation ===

Step 1: Detecting USB storage...
✓ USB device detected: D:\

Step 2: Enter wallet ID: 3c3e0aba-91e1-44d4-8b29-ec066d5acf0b

Step 3: Loading wallet...
✓ Wallet found!

Step 4: Enter encryption password to unlock wallet
Enter password (attempt 1/3): ************

✓ Wallet unlocked successfully!

Step 5: Select cryptocurrency
  1) Bitcoin (BTC)
  2) Ethereum (ETH)
Enter choice (1 or 2): 1

Step 6: Enter account index (default 0): 0
Step 7: Enter address index (default 0): 0

Step 8: Deriving address...
✓ Address derived successfully!

═══════════════════════════════════════════════════════════
                    BITCOIN ADDRESS
═══════════════════════════════════════════════════════════

  Address: 16XiVQeqbDsVPRNcCUCtKwiGhNsfhz8J1c

  Derivation Path: m/44'/0'/0'/0/0
  Coin: Bitcoin
  Account: 0
  Index: 0

═══════════════════════════════════════════════════════════

You can use this address to receive funds.
```

## Security Best Practices

### Password Requirements
- Minimum 12 characters
- Must contain at least 3 of:
  - Uppercase letters (A-Z)
  - Lowercase letters (a-z)
  - Numbers (0-9)
  - Special characters (!@#$%^&*)

### Mnemonic Phrase Storage
- ✅ Write it down on paper
- ✅ Store in a fireproof safe
- ✅ Consider metal backup solutions
- ✅ Keep multiple copies in different locations
- ❌ Never store digitally (no photos, no text files)
- ❌ Never share with anyone
- ❌ Never enter on websites or apps

### USB Drive Security
- Use a dedicated USB drive for wallet storage
- Keep the USB drive in a secure location
- Never insert the USB drive into untrusted computers
- Consider using a hardware-encrypted USB drive
- Make backup copies of wallet files

### BIP39 Passphrase (Advanced)
The BIP39 passphrase acts as a "25th word" that:
- Provides plausible deniability
- Creates entirely different wallets from the same mnemonic
- **MUST BE REMEMBERED** - if forgotten, wallet is permanently inaccessible
- Not stored anywhere - only you know it

## Architecture

### Storage Structure

```
USB_DRIVE/
└── {wallet-id}/
    ├── wallet.json           # Wallet metadata (unencrypted)
    ├── mnemonic.enc          # Encrypted mnemonic phrase
    └── audit.log             # Audit trail (NDJSON format)
```

### Encryption Scheme

```
Password
    ↓
Argon2id (4 iterations, 256 MiB, 4 threads)
    ↓
32-byte Encryption Key
    ↓
AES-256-GCM
    ↓
Encrypted Mnemonic
```

### Key Derivation Path (BIP44)

```
m / purpose' / coin_type' / account' / change / address_index

Examples:
- Bitcoin Address 0:  m/44'/0'/0'/0/0
- Bitcoin Address 1:  m/44'/0'/0'/0/1
- Ethereum Address 0: m/44'/60'/0'/0/0
- Bitcoin Account 1:  m/44'/0'/1'/0/0
```

## Development

### Running Tests

```bash
# Run all tests
go test ./tests/... -v

# Run unit tests only
go test ./tests/unit/... -v

# Run integration tests only
go test ./tests/integration/... -v

# Run with coverage
go test ./tests/... -cover
```

### Project Structure

```
arcsign/
├── cmd/
│   └── arcsign/           # CLI entry point
│       └── main.go
├── internal/
│   ├── models/            # Data models
│   ├── services/          # Business logic
│   │   ├── address/       # Address derivation
│   │   ├── bip39service/  # Mnemonic generation
│   │   ├── encryption/    # Encryption/decryption
│   │   ├── hdkey/         # BIP32 HD keys
│   │   ├── ratelimit/     # Rate limiting
│   │   ├── storage/       # USB I/O operations
│   │   └── wallet/        # Wallet management
│   └── utils/             # Utilities and validators
└── tests/
    ├── unit/              # Unit tests
    └── integration/       # Integration tests
```

## Technical Specifications

### Cryptography
- **Encryption**: AES-256-GCM (Galois/Counter Mode)
- **Key Derivation**: Argon2id
  - Iterations: 4
  - Memory: 256 MiB
  - Parallelism: 4 threads
  - Salt: 16 bytes (random per wallet)
- **Nonce**: 12 bytes (random per encryption)

### BIP Standards
- **BIP39**: Mnemonic code for generating deterministic keys
  - Wordlist: English (2048 words)
  - Entropy: 128 bits (12 words) or 256 bits (24 words)
  - PBKDF2-HMAC-SHA512 for seed generation
- **BIP32**: Hierarchical Deterministic Wallets
  - Secp256k1 elliptic curve
  - HMAC-SHA512 for key derivation
- **BIP44**: Multi-Account Hierarchy for Deterministic Wallets
  - Purpose: 44' (hardened)
  - Coin types: 0 (Bitcoin), 60 (Ethereum)

### Rate Limiting
- 3 failed password attempts per minute
- Sliding window implementation
- Automatic reset on successful authentication
- Audit logging of all attempts

## Troubleshooting

### "No USB storage device found"
- Ensure USB drive is properly inserted
- Check USB drive is formatted (FAT32, exFAT, or NTFS)
- Try a different USB port
- Run as administrator (Windows) or with sudo (Linux)

### "Wallet ID is incorrect"
- Verify you copied the complete wallet ID
- Check you're using the correct USB drive
- Wallet IDs are case-sensitive UUIDs

### "Rate limit exceeded"
- Wait 1 minute before retrying
- Ensure you're using the correct password
- Check CAPS LOCK is not enabled

### "Failed to derive path"
- Verify BIP39 passphrase is correct (if used)
- Check account and address indexes are valid numbers
- Ensure wallet was properly created

## FAQ

**Q: Can I use the same mnemonic in other wallets?**
A: Yes! Your mnemonic follows BIP39 standard and is compatible with any BIP39/BIP44 wallet (MetaMask, Ledger, Trezor, etc.).

**Q: What happens if I lose my USB drive?**
A: If you have your mnemonic phrase (and BIP39 passphrase if used), you can restore your wallet on a new USB drive. Without the mnemonic, funds are permanently inaccessible.

**Q: Can I use multiple USB drives?**
A: Yes, you can copy wallet folders between USB drives for backup. Ensure you copy the entire wallet folder.

**Q: Is my mnemonic stored encrypted?**
A: Yes, the mnemonic is encrypted with AES-256-GCM using a key derived from your password via Argon2id.

**Q: Can I add more cryptocurrencies?**
A: Yes! The architecture is extensible. See the `internal/services/address/` directory for implementation examples.

**Q: What's the difference between encryption password and BIP39 passphrase?**
- **Encryption Password**: Protects the encrypted mnemonic file on USB
- **BIP39 Passphrase**: Part of the seed generation process (creates different wallets)

## Roadmap

- [ ] Additional cryptocurrency support (Litecoin, Bitcoin Cash, etc.)
- [ ] Multi-signature wallet support
- [ ] Hardware wallet integration (Ledger, Trezor)
- [ ] Transaction signing capabilities
- [ ] GUI application
- [ ] Mobile app (iOS, Android)
- [ ] Shamir Secret Sharing for mnemonic backup

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

### Development Setup

```bash
git clone https://github.com/yourusername/arcsign.git
cd arcsign
go mod download
go test ./tests/... -v
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Security Disclosure

If you discover a security vulnerability, please email security@example.com. Do not open a public issue.

## Acknowledgments

- BIP39 implementation: [tyler-smith/go-bip39](https://github.com/tyler-smith/go-bip39)
- BIP32/BIP44: [btcsuite/btcd](https://github.com/btcsuite/btcd)
- Ethereum: [go-ethereum](https://github.com/ethereum/go-ethereum)
- Encryption: Go standard library `crypto`

## Disclaimer

This software is provided "as is", without warranty of any kind. Use at your own risk. The authors are not responsible for any loss of funds. Always test with small amounts first.

---

**Made with ❤️ for the crypto community**
