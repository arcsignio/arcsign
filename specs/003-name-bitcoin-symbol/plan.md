# Implementation Plan: Extended Multi-Chain Support (v0.3.0)

**Branch**: `003-name-bitcoin-symbol` | **Date**: 2025-10-17 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/003-name-bitcoin-symbol/spec.md`

## Summary

Extend ArcSign wallet from 30 to 54 supported blockchains by adding 24 new chains across Layer 2 networks (Arbitrum, Optimism, Base, zkSync, Starknet, Linea), regional chains (Klaytn, Cronos, HECO, Harmony), Cosmos ecosystem (Osmosis, Juno, Evmos, Secret Network), alternative EVM chains (Fantom, Celo, Moonbeam, Metis, Gnosis), and specialized chains (Kusama, Tezos, Zilliqa, Wanchain, ICON).

**Technical Approach**: Reuse existing Ethereum formatter for 18 EVM-compatible chains, extend Cosmos formatter for 4 IBC chains, implement 6 new formatters (Starknet, Harmony, Kusama, Tezos, Zilliqa, ICON) using ecosystem-standard libraries. Scale data model to support 100-150 total chains. Implement retry-once failure handling with detailed metrics and error logging. Automatic address generation for v0.2.0 wallet upgrades on first access.

## Technical Context

**Language/Version**: Go 1.21+
**Primary Dependencies**:
- Existing: github.com/btcsuite/btcutil, github.com/ethereum/go-ethereum/crypto, github.com/tyler-smith/go-bip39
- New formatters: NEEDS CLARIFICATION (starknet.go vs caigo, go-substrate-rpc-client, go-tezos, gozilliqa-sdk, harmony-go, icon-go)
**Storage**: USB-only JSON files (wallet metadata with AddressBook), no database
**Testing**: Go standard testing (tests/ directory with unit/, integration/, contract/ subdirectories)
**Target Platform**: Cross-platform CLI (macOS, Linux, Windows)
**Project Type**: Single project (CLI wallet application)
**Performance Goals**:
- Generate all 54 chain addresses in <15 seconds during wallet creation
- Generate 24 new chain addresses in <10 seconds during v0.2.0 upgrade
- Per-chain address lookup <100ms
**Constraints**:
- USB-only storage (cold wallet), no network dependencies during address generation
- Wallet file size <25 KB (accommodates 150 chains)
- Deterministic address generation (same mnemonic → same addresses)
- Graceful failure handling (95% success rate minimum)
**Scale/Scope**:
- 54 chains in v0.3.0 (24 new + 30 existing)
- Data model designed for 100-150 total chains (~5 years growth)
- 6 new address formatters + reuse of 2 existing formatters
- 18 chains reuse Ethereum formatter, 4 chains reuse Cosmos formatter

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. Security-First Development ✅ PASS

- [x] Private keys/mnemonics remain in encrypted USB storage (no changes to v0.2.0 encryption)
- [x] Generated addresses are public data (safe to store in plaintext AddressBook)
- [x] No new API credentials required (offline address generation)
- [x] Logs will NOT contain private keys, only chain symbols and public addresses
- [x] New formatter libraries will be vetted for security (ecosystem-standard libraries preferred per clarification)
- [x] Error logging includes chain symbol and error type, but no sensitive key material

**Justification**: This feature extends address generation only. All security measures from v0.1.0/v0.2.0 (Argon2id encryption, USB-only storage, dual password protection) remain unchanged.

### II. Test-Driven Development ✅ PASS

- [x] TDD workflow will be followed: Write tests for each new formatter BEFORE implementation
- [x] Unit tests for each of 6 new formatters (Starknet, Harmony, Kusama, Tezos, Zilliqa, ICON)
- [x] Integration tests for multi-chain generation with 54 chains
- [x] Contract tests for address format validation (verify against chain-specific standards)
- [x] Security tests for deterministic generation (same seed → same addresses)

**Approach**: Red-Green-Refactor cycle for each formatter. Start with test fixtures containing known mnemonic seeds and expected addresses from official chain documentation.

### III. Incremental Progress Over Big Bangs ✅ PASS

- [x] 3-phase implementation: Phase 1 (Layer 2, 6 chains) → Phase 2 (Regional + Cosmos, 8 chains) → Phase 3 (Alternative EVM + Specialized, 10 chains)
- [x] Each phase will be committed separately with passing tests
- [x] Rollback-safe: Each phase can be reverted independently
- [x] Maximum 3 attempts per formatter approach (document and switch if blocked)

**Phasing Strategy**: Prioritize P1 (Layer 2) for immediate value, then P2 (Regional + Cosmos), finally P3 (Alternative + Specialized).

### IV. Composition Over Inheritance ✅ PASS

- [x] Address formatters use interface-based design (existing pattern from v0.2.0)
- [x] Each formatter is a standalone service with single responsibility
- [x] Dependency injection for formatter registry (no inheritance hierarchies)
- [x] Avoid over-abstraction: Each chain's unique requirements handled explicitly

**Design**: AddressService interface with pluggable formatters. Each formatter (DeriveStarknetAddress, DeriveKusamaAddress, etc.) is an independent function.

### V. Documentation-Driven Development ✅ PASS

- [x] Architecture decisions documented before implementation (this plan + research.md)
- [x] API contracts defined before implementation (contracts/ directory)
- [x] Data model documented before coding (data-model.md)
- [x] Quickstart guide created for developer onboarding (quickstart.md)

**Deliverables**: research.md (Phase 0), data-model.md + contracts/ + quickstart.md (Phase 1), updated CLAUDE.md agent context.

### Architecture ✅ PASS

- [x] MVC separation maintained: Models (Chain Metadata, AddressBook), Services (AddressService, formatters), CLI (wallet creation/display commands)
- [x] Backend-first (Go): All address generation logic in Go services
- [x] API service isolation: N/A (no external API calls for address generation)

**No violations. All constitutional principles satisfied.**

## Project Structure

### Documentation (this feature)

```
specs/003-name-bitcoin-symbol/
├── spec.md              # Feature specification (completed with clarifications)
├── plan.md              # This file (/speckit.plan output)
├── research.md          # Phase 0: Library selection, formatter research
├── data-model.md        # Phase 1: Chain Metadata, AddressBook extensions
├── quickstart.md        # Phase 1: Developer implementation guide
├── contracts/           # Phase 1: CLI command contracts
│   └── cli-commands.md  # Extended wallet creation, list-addresses, upgrade behavior
└── tasks.md             # Phase 2: Task breakdown (/speckit.tasks - NOT created yet)
```

### Source Code (repository root)

```
internal/
├── models/
│   ├── address.go       # [EXTEND] Add chain category field to DerivedAddress
│   └── wallet.go        # [NO CHANGE] AddressBook already supports variable chain count
├── services/
│   ├── address/
│   │   ├── service.go       # [EXTEND] Add 6 new formatter methods
│   │   ├── starknet.go      # [NEW] Starknet address formatter
│   │   ├── harmony.go       # [NEW] Harmony Bech32 one1 formatter
│   │   ├── kusama.go        # [NEW] Kusama sr25519 Substrate formatter
│   │   ├── tezos.go         # [NEW] Tezos tz1 ed25519 formatter
│   │   ├── zilliqa.go       # [NEW] Zilliqa Bech32 zil1 formatter
│   │   └── icon.go          # [NEW] ICON hx-prefixed formatter
│   ├── coinregistry/
│   │   ├── registry.go      # [EXTEND] Add 24 new chain metadata entries
│   │   └── types.go         # [EXTEND] Add ChainCategory enum
│   └── wallet/
│       └── service.go       # [EXTEND] Add upgrade detection logic
├── lib/
│   └── errors.go            # [EXTEND] Add metrics tracking structure
└── cmd/
    └── arcsign/
        └── main.go          # [EXTEND] Add upgrade notification, metrics display

tests/
├── unit/
│   ├── starknet_test.go     # [NEW] Starknet formatter tests
│   ├── harmony_test.go      # [NEW] Harmony formatter tests
│   ├── kusama_test.go       # [NEW] Kusama formatter tests
│   ├── tezos_test.go        # [NEW] Tezos formatter tests
│   ├── zilliqa_test.go      # [NEW] Zilliqa formatter tests
│   ├── icon_test.go         # [NEW] ICON formatter tests
│   └── coinregistry_test.go # [EXTEND] Test 54 chains
├── integration/
│   ├── multi_chain_54_test.go       # [NEW] Test all 54 chains generation
│   └── upgrade_v02_v03_test.go      # [NEW] Test v0.2.0→v0.3.0 upgrade
└── contract/
    └── address_format_test.go       # [EXTEND] Validate new chain address formats
```

**Structure Decision**: Single project structure maintained from v0.1.0/v0.2.0. All changes are extensions to existing internal/ packages. New files created only for 6 new formatters. Tests follow existing three-tier structure (unit/integration/contract).

## Complexity Tracking

*No violations to justify - all Constitution Check items passed.*
