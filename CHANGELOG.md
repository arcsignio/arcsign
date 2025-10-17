# Changelog

All notable changes to ArcSign will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2025-10-16

### Added

#### Core Functionality
- **Wallet Creation**: Create new HD wallets with BIP39 mnemonic phrases
  - Support for 12-word and 24-word mnemonics
  - Optional BIP39 passphrase (25th word) support
  - Strong password requirements (12+ chars, complexity rules)
  - USB-only storage (no data on hard drive)

- **Wallet Restoration**: Decrypt and view mnemonic phrases
  - Password-protected mnemonic decryption
  - Rate limiting (3 attempts per minute)
  - Comprehensive audit logging
  - Automatic rate limit reset on success

- **Address Derivation**: Generate cryptocurrency addresses
  - Bitcoin (BTC) P2PKH addresses
  - Ethereum (ETH) native addresses
  - BIP44 compliant derivation paths
  - Multi-account and multi-address support
  - Interactive address generation UI

#### Security Features
- **Encryption**: AES-256-GCM authenticated encryption
- **Key Derivation**: Argon2id with OWASP-recommended parameters
  - 4 iterations
  - 256 MiB memory
  - 4 threads parallelism
- **Rate Limiting**: Sliding window algorithm to prevent brute-force attacks
- **Audit Logging**: NDJSON format for tamper-evident logging
- **Atomic File Operations**: Crash-safe file writes with fsync

#### Standards Compliance
- **BIP39**: Mnemonic code for generating deterministic keys
- **BIP32**: Hierarchical Deterministic Wallets
- **BIP44**: Multi-Account Hierarchy for Deterministic Wallets
- **SLIP-44**: Coin type registry (Bitcoin=0, Ethereum=60)

#### CLI Commands
- `arcsign create`: Interactive wallet creation
- `arcsign restore`: Decrypt and view mnemonic
- `arcsign derive`: Generate cryptocurrency addresses
- `arcsign version`: Display version information
- `arcsign help`: Show usage information

#### Documentation
- **README.md**: Comprehensive user documentation with examples
- **SECURITY.md**: Security policy, threat model, and best practices
- **ARCHITECTURE.md**: Detailed technical architecture and design
- **USER_GUIDE.md**: Step-by-step guide with common use cases
- **LICENSE**: MIT License
- **CHANGELOG.md**: This file

#### Build System
- Cross-platform build scripts (Linux/macOS: `build.sh`, Windows: `build.bat`)
- Support for Windows (amd64), macOS (amd64/arm64), Linux (amd64/arm64)
- Automated testing before builds
- SHA256 checksum generation

#### Testing
- 202+ automated tests (unit + integration)
- Comprehensive test coverage for all components
- Integration tests for end-to-end workflows
- Test-driven development approach

### Technical Details

#### Project Structure
```
arcsign/
├── cmd/arcsign/              # CLI entry point
├── internal/
│   ├── models/               # Data models
│   ├── services/             # Business logic
│   │   ├── address/          # Address derivation
│   │   ├── bip39service/     # Mnemonic generation
│   │   ├── encryption/       # Encryption service
│   │   ├── hdkey/            # HD key derivation
│   │   ├── ratelimit/        # Rate limiting
│   │   ├── storage/          # USB I/O
│   │   └── wallet/           # Wallet management
│   └── utils/                # Utilities
├── tests/
│   ├── unit/                 # Unit tests
│   └── integration/          # Integration tests
├── build.sh                  # Unix build script
├── build.bat                 # Windows build script
└── docs/                     # Documentation
```

#### Dependencies
- `github.com/tyler-smith/go-bip39`: BIP39 implementation
- `github.com/btcsuite/btcd`: Bitcoin libraries (BIP32/BIP44)
- `github.com/ethereum/go-ethereum`: Ethereum address derivation
- `golang.org/x/crypto`: Argon2id key derivation
- `golang.org/x/term`: Secure password input
- `github.com/SonarBeserk/gousbdrivedetector`: USB detection (Windows)

#### Supported Platforms
- Windows 10/11 (amd64)
- macOS 10.15+ (Intel and Apple Silicon)
- Linux (amd64, arm64)

### Performance
- Wallet creation: ~500ms (due to Argon2id)
- Wallet restoration: ~500ms (due to Argon2id)
- Address derivation: <100ms
- Memory usage: ~260 MiB peak during encryption

### Known Limitations
- No transaction signing (address generation only)
- Limited to Bitcoin and Ethereum (extensible architecture)
- CLI-only interface (no GUI)
- No hardware wallet integration
- Memory attacks possible (data in RAM)

### Security Considerations
- Sensitive data stored exclusively on USB drives
- No wallet data written to hard drive
- Password-protected encrypted mnemonics
- Rate limiting prevents brute-force attacks
- Comprehensive audit trail
- Follows security best practices (OWASP guidelines)

## [0.3.0] - 2025-10-17

### Added

#### Extended Multi-Chain Support (54 Blockchains)
- **6 Layer 2 Networks**: Arbitrum, Optimism, Base, zkSync, Linea, Starknet
  - EIP-2645 Starknet grindKey derivation
  - Full Ethereum-compatible L2 support
- **4 Regional Chains**: Klaytn, Cronos, HECO, Harmony
  - Bech32 encoding for Harmony (one1... prefix)
  - EVM compatibility for all regional chains
- **4 Cosmos Ecosystem**: Osmosis, Juno, Evmos, Secret Network
  - Cosmos ADR-028 Bech32 encoding
  - Chain-specific prefixes (osmo, juno, evmos, secret)
- **6 Alternative EVM Chains**: Fantom, Celo, Moonbeam, Metis, Gnosis, Wanchain
- **4 Specialized Chains**: Kusama, ICON, Tezos, Zilliqa
  - sr25519 signatures (Kusama)
  - SS58 encoding (Kusama)
  - SHA3-256 hashing (ICON)
  - SLIP-10 Ed25519 derivation (Tezos)
  - Blake2b hashing (Tezos)
  - Schnorr signatures (Zilliqa)

#### New Cryptographic Standards
- **SLIP-10**: Ed25519 hierarchical deterministic key derivation
- **EIP-2645**: Starknet key derivation with grindKey
- **Cosmos ADR-028**: Bech32 address encoding
- **Substrate BIP39**: sr25519 signature scheme
- **SS58**: Substrate address format
- **Blake2b**: Tezos address hashing

#### Infrastructure
- Coin registry with metadata for all 54 blockchains
- Market cap ranking system
- Chain categories (Layer 2, Regional, Cosmos, EVM, Specialized)
- Key type classification (secp256k1, Ed25519, sr25519)
- Formatter pattern for extensibility

### Changed
- Updated dependencies to support new cryptography
  - Added `github.com/cosmos/cosmos-sdk` v0.50.11
  - Added `github.com/vedhavyas/go-subkey` v1.0.4
  - Added `github.com/ChainSafe/go-schnorrkel` v1.1.0
  - Added `github.com/anyproto/go-slip10` v1.0.0
  - Added `blockwatch.cc/tzgo` v1.18.4
  - Added `github.com/Zilliqa/gozilliqa-sdk` v1.2.0
  - Downgraded `github.com/btcsuite/btcd` to v0.22.1 for compatibility

### Technical Details
- **Total Chains**: 54 blockchains across 7 signature schemes
- **Signature Schemes**: ECDSA (secp256k1), Ed25519, sr25519, Schnorr
- **Address Formats**: P2PKH, Keccak256, Bech32, SS58, Base58Check, SHA3-256
- **Test Coverage**: 300+ tests (270+ unit, 30+ integration)

### Performance
- Multi-chain derivation: <100ms per address
- No performance degradation with additional chains
- Efficient registry lookup with O(1) access

## [0.2.0] - 2025-10-16

### Added

#### Multi-Chain Support (30 Blockchains)
- Extended from 2 to 30 supported cryptocurrencies
- Added 28 major blockchains:
  - **Smart Contract Platforms**: BNB, SOL, ADA, TRX, AVAX, DOT, MATIC, ATOM, NEAR
  - **Stablecoins**: USDT, USDC
  - **DeFi Tokens**: SHIB, LINK, UNI
  - **Major Coins**: XRP, DOGE, LTC, BCH, XLM, ETC, XMR, FIL, HBAR, APT, VET, ALGO, ZEC, DASH

#### Enhanced Address Derivation
- Ed25519 support for Solana and other chains
- Multiple derivation patterns (BIP44, Ed25519)
- Chain-specific address formatters
- Comprehensive test suite for all chains

## [Unreleased]

### Planned Features
- Transaction signing capabilities (Bitcoin, Ethereum)
- Transaction broadcasting
- Hardware wallet integration (Ledger, Trezor)
- Multi-signature wallet support
- Graphical user interface (GUI)
- Mobile applications (iOS, Android)
- Shamir Secret Sharing for mnemonic backup
- Watch-only wallet mode (xpub)
- Address book functionality
- QR code generation for addresses
- Balance checking via RPC

### Planned Improvements
- Faster key derivation (caching, optimization)
- Enhanced USB detection (more platforms)
- Localization (multiple languages)
- Accessibility improvements
- Performance optimizations

## Version History

### Version Numbering
ArcSign follows [Semantic Versioning](https://semver.org/):
- **MAJOR**: Incompatible API changes
- **MINOR**: New functionality (backwards-compatible)
- **PATCH**: Bug fixes (backwards-compatible)

### Release Types
- **Stable**: Production-ready releases (e.g., 1.0.0)
- **Beta**: Feature-complete, testing phase (e.g., 0.9.0-beta)
- **Alpha**: Early development, experimental (e.g., 0.1.0-alpha)
- **Release Candidate**: Pre-release testing (e.g., 1.0.0-rc1)

### Support Policy
- **Latest Major Version**: Full support (bug fixes, security updates, features)
- **Previous Major Version**: Security updates only (6 months)
- **Older Versions**: Unsupported (upgrade recommended)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines.

### Reporting Issues
- Security vulnerabilities: security@example.com
- Bug reports: GitHub Issues
- Feature requests: GitHub Issues
- Questions: GitHub Discussions

### Development
- Language: Go 1.21+
- Testing: `go test ./tests/... -v`
- Building: `./build.sh` or `build.bat`
- Code style: `gofmt`, `golint`

## License

ArcSign is released under the MIT License. See [LICENSE](LICENSE) for details.

## Acknowledgments

### Open Source Libraries
- [tyler-smith/go-bip39](https://github.com/tyler-smith/go-bip39) - BIP39 implementation
- [btcsuite/btcd](https://github.com/btcsuite/btcd) - Bitcoin libraries
- [ethereum/go-ethereum](https://github.com/ethereum/go-ethereum) - Ethereum libraries
- [golang/crypto](https://golang.org/x/crypto) - Cryptographic primitives

### Standards
- Bitcoin Improvement Proposals (BIPs)
- OWASP Password Storage Cheat Sheet
- NIST Cryptographic Standards

### Community
- Bitcoin and Ethereum developer communities
- Open source contributors
- Security researchers

## Disclaimer

This software is provided "as is", without warranty of any kind, express or implied. The authors are not responsible for any loss of funds. Always test with small amounts first and maintain proper backups of your mnemonic phrases.

**⚠️ Important**:
- Never share your mnemonic phrase with anyone
- Always verify addresses before sending funds
- Test recovery procedures before storing significant funds
- Keep multiple backups in secure locations

---

**Project**: ArcSign - Secure HD Wallet
**Latest Version**: 0.3.0
**Release Date**: 2025-10-17
**License**: MIT
**Website**: https://github.com/yourusername/arcsign
