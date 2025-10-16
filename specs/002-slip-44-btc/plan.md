# Implementation Plan: Multi-Cryptocurrency Address Generation with SLIP-44 Support

**Branch**: `002-slip-44-btc` | **Date**: 2025-10-16 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-slip-44-btc/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Extend ArcSign wallet to automatically generate and store receiving addresses for 30-50 mainstream cryptocurrencies during wallet creation. Addresses are derived using BIP44 paths (`m/44'/coin_type'/0'/0/0`) for each SLIP-44 registered coin type and stored in plaintext JSON format in the wallet metadata file. This eliminates the need for users to repeatedly derive addresses, providing instant access to addresses for Bitcoin, Ethereum, Litecoin, XRP, and 26-46 other popular coins. The system builds on existing v0.1.0 HD wallet infrastructure.

## Technical Context

**Language/Version**: Go 1.21+ (backend-first per constitution, already established in v0.1.0)
**Primary Dependencies**:
- BIP39/BIP32/BIP44: NEEDS CLARIFICATION (coin-specific address formatters beyond BTC/ETH)
- SLIP-44 Registry: NEEDS CLARIFICATION (source and maintenance strategy for 30-50 coin metadata)
- Market Cap Ranking: NEEDS CLARIFICATION (data source for sorting coins by popularity)

**Storage**: File-based JSON (wallet metadata extends existing wallet.json structure)
**Testing**: Go standard testing package (`testing`), table-driven tests, BIP44 test vectors
**Target Platform**: Cross-platform desktop (Linux, macOS, Windows) with USB support (same as v0.1.0)

**Project Type**: Single backend project (CLI, extending existing ArcSign codebase)
**Performance Goals**:
- Wallet creation with 30-50 addresses: <10 seconds total
- Address lookup by symbol/index: <100ms
- Individual coin address derivation: <200ms per coin

**Constraints**:
- Memory: Minimal overhead (addresses stored, not derived on-the-fly)
- USB requirement: Extends existing v0.1.0 USB-only storage
- File size: Wallet metadata增加 2-4 KB (acceptable per spec assumptions)
- Offline-capable: No network dependency for address generation

**Scale/Scope**:
- 30-50 supported coin types at launch
- Single address per coin (account 0, change 0, address index 0)
- Extends existing 4 CLI commands + adds 2 new commands (`list-addresses`, `get-address`)
- Estimated ~1.5K-2K LOC (coin registry, multi-coin derivation, display logic)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. Security-First Development (NON-NEGOTIABLE)

- [x] Private keys/mnemonics never leave USB secure zone (encryption at rest) - **Inherited from v0.1.0**: Mnemonics already encrypted with Argon2id + AES-256-GCM
- [x] Sensitive data encrypted - **N/A for this feature**: Addresses are public keys (stored plaintext per spec FR-003)
- [x] Multi-factor auth enforced - **Inherited from v0.1.0**: Application password + Wallet password already implemented
- [x] API service isolation - **N/A**: No external APIs in this feature
- [x] Logs must not contain sensitive data - **Compliant**: Addresses are public, derivation errors logged without exposing keys
- [x] Secrets via environment/OS store - **Inherited from v0.1.0**: Password handling already compliant

**Status**: ✅ PASS - Feature extends v0.1.0 security model. Addresses are intentionally plaintext (public keys).

### II. Test-Driven Development (NON-NEGOTIABLE)

- [x] Red-Green-Refactor cycle mandated - **Will enforce**: Each coin formatter must have test before implementation
- [x] Unit + integration + contract tests required - **Planned**: BIP44 test vectors for each coin, integration tests for multi-coin generation
- [x] Security tests for security-sensitive features - **N/A**: No new security boundaries (reuses v0.1.0 encryption)

**Status**: ✅ PASS - TDD workflow will be enforced in Phase 2 (tasks.md generation)

### III. Incremental Progress Over Big Bangs

- [x] Feature broken into 3-5 phases - **Planned**: 3 user stories (P1: generate, P2: list, P3: get specific)
- [x] Each phase compilable, testable, revertible - **Design**: P1 MVP is independently functional
- [x] 3-attempt rule with fallback documentation - **Acknowledged**: Will follow if formatter implementation blocks

**Status**: ✅ PASS - Feature already decomposed incrementally in spec.md (P1/P2/P3)

### IV. Composition Over Inheritance

- [x] Interfaces and dependency injection preferred - **Design**: `CoinFormatter` interface per coin type
- [x] Single responsibility per module - **Planned**: Separate `coinregistry/` package for SLIP-44 metadata
- [x] No over-abstraction - **Design**: Each coin uses specific formatter (no generalized "universal" formatter)

**Status**: ✅ PASS - Architecture will enforce composition (coin formatters as strategy pattern)

### V. Documentation-Driven Development

- [x] Architectural decisions documented before implementation - **This document** (plan.md before code)
- [x] API contracts documented before implementation - **Planned**: contracts/ will define CLI command interfaces
- [x] SYSTEM_SPECIFICATION.md update after deployment - **Deferred**: Post-deployment task

**Status**: ✅ PASS - Documentation workflow followed (spec → plan → contracts → implementation)

### Architecture Alignment

- [x] MVC separation - **Extends v0.1.0**: Model (wallet entities), Services (multi-coin derivation), CLI (new list/get commands)
- [x] Backend-first (Go) - **Compliant**: Pure Go implementation
- [x] API service isolation - **N/A**: No external APIs

**Status**: ✅ PASS - Feature adheres to established MVC architecture

### Overall Gate Evaluation

**RESULT**: ✅ **PASS** - All constitutional requirements satisfied. Proceed to Phase 0 research.

---

## Post-Design Constitution Check (Phase 1 Complete)

*Re-evaluation after completing research, data model, contracts, and quickstart design.*

**Date**: 2025-10-16 | **Phase**: 1 Complete

### Phase 0 & Phase 1 Deliverables

✅ **research.md** (Phase 0): Resolved 3 NEEDS CLARIFICATION items
- SLIP-44 Registry: Use SatoshiLabs GitHub, embed as static data
- Address Formatters: Hybrid approach (reuse BTC/ETH, add XRP/Stellar/Solana/TRON)
- Market Cap Ranking: CoinGecko API one-time snapshot, embed sorted data

✅ **data-model.md** (Phase 1): Complete entity definitions
- CoinMetadata: SLIP-44 coin metadata with formatter ID and market cap rank
- DerivedAddress: Single address with symbol, address, coinType, path
- AddressBook: Collection of 30-50 derived addresses
- Wallet (extended): Added optional `addressBook` field for v0.2.0+

✅ **contracts/cli-commands.md** (Phase 1): CLI command specifications
- Modified `create`: Generates 30-50 addresses automatically
- New `list-addresses`: Display all addresses sorted by market cap
- New `get-address`: Display specific address by symbol or coin type

✅ **quickstart.md** (Phase 1): TDD developer guide
- Step-by-step implementation roadmap (15-day timeline)
- TDD examples for coin registry, formatters, wallet integration
- Testing strategies (unit, integration, contract tests)

### Constitutional Re-evaluation

#### I. Security-First Development (NON-NEGOTIABLE)

- [x] Private keys/mnemonics never leave USB secure zone - **Unchanged**: Still encrypted at rest ✅
- [x] Sensitive data encrypted - **Unchanged**: Addresses are public keys (plaintext is safe) ✅
- [x] Multi-factor auth enforced - **Unchanged**: Application + Wallet passwords ✅
- [x] API service isolation - **NEW**: CoinGecko API used ONLY for developer one-time setup (not runtime) ✅
- [x] Logs must not contain sensitive data - **Design**: Addresses logged (public data), errors logged without keys ✅
- [x] Secrets via environment/OS store - **Unchanged**: No new secrets introduced ✅

**Status**: ✅ PASS - All security requirements remain satisfied. New CoinGecko API usage is developer-only (not production runtime).

#### II. Test-Driven Development (NON-NEGOTIABLE)

- [x] Red-Green-Refactor cycle mandated - **Design**: quickstart.md provides TDD examples for all tasks ✅
- [x] Unit + integration + contract tests required - **Design**: 3 test layers planned
  - Unit tests: coin registry, formatters, wallet extension
  - Integration tests: end-to-end wallet creation with multi-coin addresses
  - Contract tests: BIP44 test vectors for 30-50 coins ✅
- [x] Security tests for security-sensitive features - **N/A**: No new security boundaries ✅

**Status**: ✅ PASS - TDD workflow fully documented in quickstart.md with concrete examples.

#### III. Incremental Progress Over Big Bangs

- [x] Feature broken into 3-5 phases - **Design**: Implementation roadmap defines 6 phases
  - Phase 1: Foundation (coin registry, models)
  - Phase 2: Bitcoin-compatible formatters (LTC, DOGE, BCH)
  - Phase 3: New coin formatters (XRP, Stellar, TRON, Solana)
  - Phase 4: Wallet integration (modify CreateWallet)
  - Phase 5: CLI commands (list-addresses, get-address)
  - Phase 6: Testing & polish ✅
- [x] Each phase compilable, testable, revertible - **Design**: Each phase builds on previous, fully testable ✅
- [x] 3-attempt rule with fallback documentation - **Acknowledged**: Will follow if implementation blocks ✅

**Status**: ✅ PASS - Feature decomposed into 6 incremental phases (15-day timeline).

#### IV. Composition Over Inheritance

- [x] Interfaces and dependency injection preferred - **Design**: Strategy pattern for formatters
  ```go
  type AddressFormatter interface {
      Format(key *hdkeychain.ExtendedKey) (string, error)
  }
  ```
  Each coin has dedicated formatter (bitcoin, ethereum, ripple, stellar, etc.) ✅
- [x] Single responsibility per module - **Design**: Separate packages
  - `coinregistry/`: SLIP-44 metadata management
  - `address/`: Coin-specific formatters (one file per coin family)
  - `models/`: Data entities only (no business logic) ✅
- [x] No over-abstraction - **Design**: No "universal" formatter, each coin uses specific implementation ✅

**Status**: ✅ PASS - Composition via strategy pattern, single responsibility enforced.

#### V. Documentation-Driven Development

- [x] Architectural decisions documented before implementation - **Completed**: This plan.md + research.md ✅
- [x] API contracts documented before implementation - **Completed**: contracts/cli-commands.md defines all interfaces ✅
- [x] SYSTEM_SPECIFICATION.md update after deployment - **Deferred**: Post-Phase 6 task ✅

**Status**: ✅ PASS - All documentation completed before code implementation.

### Architecture Alignment

- [x] MVC separation - **Design**: Clean separation maintained
  - Models: `wallet.go`, `address.go` (data entities)
  - Services: `coinregistry/`, `address/`, `wallet/` (business logic)
  - CLI: `cmd/arcsign/main.go` (user interface) ✅
- [x] Backend-first (Go) - **Unchanged**: Pure Go implementation ✅
- [x] API service isolation - **Design**: CoinGecko API only for developer setup (not embedded in binary) ✅

**Status**: ✅ PASS - MVC architecture preserved, backend-first approach maintained.

### Risk Assessment & Mitigation

**Risk 1**: Some coin formatters may be complex (Monero, Cardano, Polkadot)
- **Mitigation**: Phase 3 separates high-effort coins, can defer to post-MVP if blocked
- **Impact**: Low (can launch with 20-30 coins instead of 50)

**Risk 2**: Wallet creation time may exceed 10 seconds with 50 coins
- **Mitigation**: Parallel derivation optimization (documented in quickstart.md)
- **Fallback**: Reduce coin count to meet performance target

**Risk 3**: BIP44 test vectors may not exist for all 50 coins
- **Mitigation**: Use official wallet implementations as reference (Trezor, Ledger)
- **Fallback**: Document limitations in contract tests

### Overall Gate Evaluation (Post-Design)

**RESULT**: ✅ **PASS** - All constitutional requirements remain satisfied after completing design phase.

**Key Decisions**:
1. SLIP-44 registry embedded as static data (no runtime network calls)
2. Hybrid formatter strategy (reuse existing, add targeted new formatters)
3. CoinGecko API for developer-only one-time setup (not production dependency)
4. 6-phase incremental implementation (15-day timeline)
5. TDD workflow fully documented with concrete examples

**Ready to Proceed**: Implementation phase (Phase 2) can begin immediately using quickstart.md guide.

## Project Structure

### Documentation (this feature)

```
specs/002-slip-44-btc/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

Extends existing v0.1.0 structure:

```
cmd/arcsign/
└── main.go                      # Extend with list-addresses, get-address commands

internal/
├── models/
│   └── wallet.go                # Extend Wallet with AddressBook field
├── services/
│   ├── bip39service/            # Existing (reuse)
│   ├── hdkey/                   # Existing (reuse for multi-coin derivation)
│   ├── address/                 # Extend with multi-coin formatters
│   │   ├── service.go           # Existing Bitcoin/Ethereum
│   │   ├── bitcoin.go           # Extend for variants (BCH, LTC)
│   │   ├── ethereum.go          # Extend for ERC-20 chains
│   │   ├── ripple.go            # NEW: XRP address formatter
│   │   ├── stellar.go           # NEW: Stellar address formatter
│   │   ├── monero.go            # NEW: Monero address formatter
│   │   └── ... (20-40 more)     # NEW: Additional coin formatters
│   ├── coinregistry/            # NEW: SLIP-44 metadata + market cap ranking
│   │   ├── registry.go          # Coin metadata (symbol, name, coinType, formatter)
│   │   └── marketcap.go         # Market cap ranking for sort order
│   ├── storage/                 # Existing (reuse for wallet.json updates)
│   └── wallet/                  # Extend CreateWallet to batch-generate addresses
│       └── service.go
└── lib/
    └── errors.go                # Extend with coin-specific errors

tests/
├── contract/
│   └── slip44_vectors_test.go   # NEW: BIP44 test vectors for 30-50 coins
├── integration/
│   └── multicoin_test.go        # NEW: End-to-end multi-coin generation
└── unit/
    ├── coinregistry_test.go     # NEW: Registry lookup tests
    └── address_formatters_test.go # NEW: Per-coin formatter tests
```

**Structure Decision**: Single Go project extending v0.1.0. New `coinregistry/` service package manages SLIP-44 metadata and coin formatters. Each supported cryptocurrency gets a dedicated formatter in `address/` service. Wallet metadata (wallet.json) schema extends to include `addressBook` array field.

## Complexity Tracking

*Fill ONLY if Constitution Check has violations that must be justified*

**No violations detected.** All constitutional requirements are satisfied.
