# Implementation Plan: ChainAdapter - Cross-Chain Transaction Interface

**Branch**: `006-chain-adapter` | **Date**: 2025-11-03 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/006-chain-adapter/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

ChainAdapter provides a unified interface for cross-chain transaction lifecycle operations (build/estimate/sign/broadcast/derive) that abstracts away blockchain-specific differences (address formats, nonce/sequence, gas/fee models, script/memo fields, chain IDs, encoding). The system accepts standardized transaction descriptions and outputs verifiable intermediate artifacts (reconstructible unsigned transactions, normalized fee estimates with bounds, trackable transaction hashes). Initial implementation covers Bitcoin (UTXO-based) and Ethereum (account-based with EIP-1559) using Go 1.21+ with dual RPC communication patterns (HTTP for one-time operations, WebSocket for real-time updates), multiple endpoint failover, and minimal state storage for broadcast idempotency.

## Technical Context

**Language/Version**: Go 1.21+ (per project constitution backend-first policy)
**Primary Dependencies**:
- Bitcoin: `btcd/btcutil`, `btcsuite/btcd` (PSBT, P2WPKH address generation)
- Ethereum: `go-ethereum` (EIP-1559 transactions, checksummed addresses, JSON-RPC)
- WebSocket: `gorilla/websocket` or Go standard library `net/http` WebSocket support
- BIP39/BIP44: `tyler-smith/go-bip39`, `btcsuite/btcd/chaincfg/chainhash` for derivation paths
- Testing: Go standard library `testing` package, `testify/assert` for assertions

**Storage**: File-based JSON or in-memory map for transaction hash lookup (no database dependency per constitution)
**Testing**: Go `testing` package with table-driven tests, mock RPC clients, mock signers, mock WebSocket connections
**Target Platform**: Cross-platform Go application (Linux, macOS, Windows) - CLI and library
**Project Type**: Single project (backend library + CLI interface)
**Performance Goals**:
- RPC response time tracking with <2s p95 for HTTP calls
- WebSocket reconnection <5s on disconnect
- Fee estimation <1s for real-time updates
- Address derivation <100ms per address

**Constraints**:
- No external database (constitution: USB-only storage)
- Idempotent broadcast operations (retry-safe)
- RPC failover must be transparent (<3s total including failover)
- WebSocket graceful degradation to HTTP polling
- 90%+ test coverage for adapter methods

**Scale/Scope**:
- 2 initial chain adapters (Bitcoin, Ethereum)
- Support for 10+ RPC endpoints per chain
- Handle 100+ concurrent transaction builds
- Monitor 1000+ transactions via WebSocket subscriptions
- Extensible to 10+ chains without core changes

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. Security-First Development ✓ PASS

- [x] Private keys NEVER leave secure zone → Sign method supports offline signing with external signer abstraction (FR-015, FR-016)
- [x] Sensitive data encrypted (Argon2id + AES-256-GCM) → Not directly handling encryption (delegated to existing wallet layer)
- [x] Multi-factor auth enforced → N/A for this adapter layer (handled by wallet application layer)
- [x] API credentials isolated to proxy service → RPC endpoints configurable, no hardcoded credentials (FR-042)
- [x] Logs MUST NOT contain sensitive data → Error messages do not expose keys/amounts, only classification and guidance (FR-037)
- [x] Secrets use environment variables → RPC endpoint configuration via config files or environment (TC-005)

**Status**: ✓ **PASS** - All security requirements met at adapter layer

### II. Test-Driven Development ✓ PASS

- [x] TDD Red-Green-Refactor cycle → Tests will be written before implementation (spec mandates this)
- [x] Unit + Integration + Contract tests → Comprehensive test requirements specified (FR-050, FR-051, FR-052, SC-009: 90%+ coverage)
- [x] Security tests for sensitive features → Signing, broadcasting, and key derivation will have dedicated security tests
- [x] All tests pass before commit → Standard Go testing workflow enforced

**Status**: ✓ **PASS** - Test requirements comprehensively specified

### III. Incremental Progress Over Big Bangs ✓ PASS

- [x] Feature broken into phases → User stories prioritized P1, P2, P3 with independent testability
- [x] Every commit runnable → Implementation will follow phased approach (Core → Integration → Polish)
- [x] Maximum 3 attempts per approach → Will be followed during implementation

**Status**: ✓ **PASS** - Incremental approach designed into spec

### IV. Composition Over Inheritance ✓ PASS

- [x] Interfaces and dependency injection → ChainAdapter is interface-based, supports DI for RPC/signers/storage (FR-050, FR-051, FR-052)
- [x] Single responsibility per module → Clear separation: adapter interface, RPC client, state store, each chain implementation
- [x] Avoid over-abstraction → Explicit implementations for Bitcoin and Ethereum without unnecessary abstraction layers

**Status**: ✓ **PASS** - Architecture follows composition principles

### V. Documentation-Driven Development ✓ PASS

- [x] SYSTEM_SPECIFICATION.md updated → This plan and spec serve as single source of truth
- [x] Architectural decisions documented → All design decisions captured in spec clarifications and requirements
- [x] API contracts documented before implementation → Phase 1 will generate contracts/

**Status**: ✓ **PASS** - Documentation-driven approach followed

### Architecture ✓ PASS

- [x] MVC separation → Clear layers: Models (entities like TransactionRequest), Services (adapter implementations), CLI (future)
- [x] Backend-first with Go → Go 1.21+ mandated (TC-001)
- [x] API service isolation → No direct third-party API key storage, RPC endpoints configured externally

**Status**: ✓ **PASS** - Architecture aligns with constitution

### Overall Gate Status: ✓ **PASS**

All constitutional requirements met. No violations requiring justification. Proceed to Phase 0 research.

## Project Structure

### Documentation (this feature)

```
specs/006-chain-adapter/
├── spec.md              # Feature specification (completed)
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (to be generated)
├── data-model.md        # Phase 1 output (to be generated)
├── quickstart.md        # Phase 1 output (to be generated)
├── contracts/           # Phase 1 output (to be generated)
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```
src/chainadapter/
├── adapter.go           # Core ChainAdapter interface definition
├── types.go             # Common types (TransactionRequest, FeeEstimate, etc.)
├── errors.go            # ErrorClassification and error types
├── registry.go          # Adapter registry for dynamic chain loading
│
├── rpc/
│   ├── client.go        # RPCClient interface and base implementation
│   ├── http_client.go   # HTTP RPC client with failover
│   ├── ws_client.go     # WebSocket RPC client with reconnection
│   └── health.go        # RPC endpoint health tracking
│
├── storage/
│   ├── tx_store.go      # TransactionStateStore interface
│   ├── memory_store.go  # In-memory implementation
│   └── file_store.go    # File-based JSON implementation
│
├── bitcoin/
│   ├── adapter.go       # Bitcoin ChainAdapter implementation
│   ├── builder.go       # Bitcoin transaction builder (PSBT)
│   ├── signer.go        # Bitcoin signing logic
│   ├── fee.go           # Bitcoin fee estimation
│   └── derive.go        # BIP44 address derivation for Bitcoin
│
├── ethereum/
│   ├── adapter.go       # Ethereum ChainAdapter implementation
│   ├── builder.go       # Ethereum transaction builder (EIP-1559)
│   ├── signer.go        # Ethereum signing logic
│   ├── fee.go           # Ethereum fee estimation with base fee
│   └── derive.go        # BIP44 address derivation for Ethereum
│
└── metrics/
    ├── metrics.go       # ChainMetrics interface
    └── prometheus.go    # Prometheus/StatsD integration

tests/
├── unit/
│   ├── adapter_test.go
│   ├── rpc_test.go
│   ├── storage_test.go
│   ├── bitcoin_test.go
│   └── ethereum_test.go
│
├── integration/
│   ├── bitcoin_integration_test.go
│   ├── ethereum_integration_test.go
│   └── failover_test.go
│
├── contract/
│   ├── idempotency_test.go
│   ├── fee_bounds_test.go
│   └── address_derivation_test.go
│
└── mocks/
    ├── mock_rpc.go
    ├── mock_signer.go
    └── mock_storage.go
```

**Structure Decision**: Single project structure (Option 1) selected because ChainAdapter is a backend library/service component. The structure follows Go standard layout with clear package boundaries:
- `src/chainadapter/`: Core interfaces and shared types
- `src/chainadapter/rpc/`: RPC communication layer (HTTP/WebSocket with failover)
- `src/chainadapter/storage/`: Transaction state persistence layer
- `src/chainadapter/bitcoin/`: Bitcoin-specific adapter implementation
- `src/chainadapter/ethereum/`: Ethereum-specific adapter implementation
- `src/chainadapter/metrics/`: Observability and metrics
- `tests/`: Comprehensive test coverage with mocks

## Complexity Tracking

*Fill ONLY if Constitution Check has violations that must be justified*

**No violations detected.** Constitution Check passed all gates. No complexity tracking required.
