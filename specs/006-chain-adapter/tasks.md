# Implementation Tasks: ChainAdapter Cross-Chain Transaction Interface

**Feature Branch**: `006-chain-adapter`
**Date**: 2025-11-03
**Generated From**: [spec.md](./spec.md), [plan.md](./plan.md), [data-model.md](./data-model.md)

## Summary

ChainAdapter provides a unified interface for cross-chain transactions (build/estimate/sign/broadcast/derive) supporting Bitcoin (UTXO) and Ethereum (account-based with EIP-1559). Implementation follows TDD with 7 user stories prioritized P1-P3, organized for independent testability and incremental delivery.

**Tech Stack**: Go 1.21+, btcsuite/btcd (Bitcoin), go-ethereum (Ethereum), gorilla/websocket
**Testing**: Go testing + testify, 90%+ coverage target, contract tests mandatory
**MVP Scope**: User Stories 1-3 (P1) - Core transaction lifecycle

---

## Phase 1: Setup & Infrastructure

**Goal**: Initialize project structure, dependencies, and foundational components

### Setup Tasks

- [X] T001 Initialize Go module in src/chainadapter with go.mod
- [X] T002 [P] Install Bitcoin dependencies: btcsuite/btcd, btcutil, tyler-smith/go-bip39
- [X] T003 [P] Install Ethereum dependencies: go-ethereum (geth client library)
- [X] T004 [P] Install WebSocket dependency: gorilla/websocket
- [X] T005 [P] Install testing dependencies: testify/assert, testify/mock
- [X] T006 Create directory structure per plan.md in src/chainadapter/
- [X] T007 [P] Create .gitignore with Go patterns (vendor/, *.test, coverage.out)
- [X] T008 [P] Create Makefile with targets: test, build, coverage, lint

---

## Phase 2: Core Interfaces & Shared Components (Foundational)

**Goal**: Define core interfaces and shared infrastructure required by all user stories

**Why Foundational**: These components are dependencies for ALL user stories and MUST be completed first

### Interface Definition Tasks

- [X] T009 Define ChainAdapter interface in src/chainadapter/adapter.go (Build/Estimate/Sign/Broadcast/Derive methods)
- [X] T010 [P] Define core types in src/chainadapter/adapter.go (TransactionRequest, UnsignedTransaction, FeeEstimate, SignedTransaction, BroadcastReceipt, Address, Capabilities)
- [X] T011 [P] Define error types in src/chainadapter/error.go (ChainError, ErrorClassification: Retryable/NonRetryable/UserIntervention)
- [X] T012 [P] Define KeySource and Signer interfaces in src/chainadapter/keysource.go

### RPC Client Infrastructure Tasks

- [X] T013 Define RPCClient interface in src/chainadapter/rpc/client.go
- [X] T014 Implement HTTPRPCClient with failover in src/chainadapter/rpc/http.go
- [X] T015 Implement WebSocketRPCClient with reconnection in src/chainadapter/rpc/websocket.go
- [X] T016 [P] Implement endpoint health tracking in src/chainadapter/rpc/health.go

### State Storage Infrastructure Tasks

- [X] T017 Define TransactionStateStore interface in src/chainadapter/storage/store.go
- [X] T018 [P] Implement MemoryTxStore with sync.Map in src/chainadapter/storage/memory.go
- [X] T019 [P] Implement FileTxStore with JSON persistence in src/chainadapter/storage/file.go

### Test Infrastructure Tasks

- [X] T020 [P] Create MockRPCClient in tests/mocks/rpc_mock.go
- [X] T021 [P] Create MockSigner in tests/mocks/signer_mock.go
- [X] T022 [P] Create MockTxStore in tests/mocks/storage_mock.go

---

## Phase 3: User Story 1 - Unified Transaction Building (P1)

**Story Goal**: Build transactions for Bitcoin and Ethereum through unified interface

**Independent Test**: Build simple transfer on both chains, verify valid unsigned transactions

**Success Criteria**:
- Bitcoin: Produces valid unsigned PSBT
- Ethereum: Produces valid unsigned EIP-1559 transaction
- Unsupported features (e.g., Bitcoin memo) return NonRetryable error

### US1 Contract Tests

- [X] T023 [P] [US1] Write contract test TC-001 (Build Idempotency) in tests/contract/idempotency_test.go
- [X] T024 [P] [US1] Write contract test TC-003 (Error Classification) in tests/contract/error_classification_test.go

### US1 Bitcoin Implementation

- [X] T025 [US1] Implement BitcoinAdapter stub in src/chainadapter/bitcoin/adapter.go (ChainID, Capabilities methods)
- [X] T026 [US1] Implement Bitcoin transaction builder in src/chainadapter/bitcoin/builder.go (UTXO selection, PSBT creation)
- [X] T027 [US1] Unit test Bitcoin builder with mock RPC in tests/unit/bitcoin_test.go
- [X] T028 [US1] Implement Bitcoin Build() method in src/chainadapter/bitcoin/adapter.go
- [X] T029 [US1] Unit test Bitcoin Build() with various inputs in tests/unit/bitcoin_test.go

### US1 Ethereum Implementation

- [X] T030 [P] [US1] Implement EthereumAdapter stub in src/chainadapter/ethereum/adapter.go (ChainID, Capabilities methods)
- [X] T031 [P] [US1] Implement Ethereum transaction builder in src/chainadapter/ethereum/builder.go (nonce query, EIP-1559 tx creation)
- [X] T032 [P] [US1] Unit test Ethereum builder with mock RPC in tests/unit/ethereum_test.go
- [X] T033 [US1] Implement Ethereum Build() method in src/chainadapter/ethereum/adapter.go
- [X] T034 [US1] Unit test Ethereum Build() with various inputs in tests/unit/ethereum_test.go

### US1 Integration Tests

- [ ] T035 [US1] Integration test: Build Bitcoin transaction on regtest in tests/integration/bitcoin_integration_test.go
- [ ] T036 [US1] Integration test: Build Ethereum transaction on geth --dev in tests/integration/ethereum_integration_test.go
- [ ] T037 [US1] Verify contract tests TC-001 and TC-003 pass for both adapters

---

## Phase 4: User Story 2 - Fee Estimation with Confidence Bounds (P1)

**Story Goal**: Estimate fees with min/max bounds and confidence levels for both chains

**Independent Test**: Call estimate on multiple chains, verify bounds and confidence scores

**Success Criteria**:
- Returns MinFee ≤ Recommended ≤ MaxFee
- Confidence indicator 0-100%
- Normal conditions: narrow bounds (±10%), high confidence (>90%)
- Congestion: wider bounds (±30%), medium confidence (60-80%)

### US2 Contract Tests

- [X] T038 [P] [US2] Write contract test TC-004 (Fee Bounds Validation) in tests/contract/fee_bounds_test.go
- [X] T039 [P] [US2] Write contract test TC-005 (Estimate Idempotency) in tests/contract/fee_bounds_test.go

### US2 Bitcoin Fee Estimation

- [ ] T040 [US2] Implement Bitcoin fee estimator in src/chainadapter/bitcoin/fee.go (estimatesmartfee + mempool analysis)
- [ ] T041 [US2] Unit test Bitcoin fee estimator with mock RPC in tests/unit/bitcoin_test.go
- [ ] T042 [US2] Implement Bitcoin Estimate() method in src/chainadapter/bitcoin/adapter.go
- [ ] T043 [US2] Unit test Bitcoin Estimate() with various network conditions in tests/unit/bitcoin_test.go

### US2 Ethereum Fee Estimation

- [ ] T044 [P] [US2] Implement Ethereum fee estimator in src/chainadapter/ethereum/fee.go (EIP-1559 baseFee + eth_feeHistory)
- [ ] T045 [P] [US2] Unit test Ethereum fee estimator with mock RPC in tests/unit/ethereum_test.go
- [ ] T046 [US2] Implement Ethereum Estimate() method in src/chainadapter/ethereum/adapter.go
- [ ] T047 [US2] Unit test Ethereum Estimate() with various network conditions in tests/unit/ethereum_test.go

### US2 WebSocket Real-Time Fee Updates

- [ ] T048 [US2] Implement WebSocket fee subscription for Bitcoin in src/chainadapter/bitcoin/fee.go
- [ ] T049 [US2] Implement WebSocket fee subscription for Ethereum in src/chainadapter/ethereum/fee.go
- [ ] T050 [US2] Unit test WebSocket subscriptions with mock WebSocket in tests/unit/ethereum_test.go

### US2 Integration Tests

- [ ] T051 [US2] Integration test: Estimate Bitcoin fees on regtest in tests/integration/bitcoin_integration_test.go
- [ ] T052 [US2] Integration test: Estimate Ethereum fees on geth --dev in tests/integration/ethereum_integration_test.go
- [ ] T053 [US2] Verify contract tests TC-004 and TC-005 pass for both adapters

---

## Phase 5: User Story 3 - Idempotent Transaction Broadcasting (P1)

**Story Goal**: Safely retry broadcasts without double-spending via state store

**Independent Test**: Broadcast same signed tx multiple times, verify single on-chain tx with consistent hash

**Success Criteria**:
- First broadcast returns tx hash and receipt
- Retry returns same hash without error
- Already-confirmed tx returns confirmed status with block number

### US3 Contract Tests

- [X] T054 [P] [US3] Write contract test TC-002 (Broadcast Idempotency) in tests/contract/broadcast_idempotency_test.go
- [X] T055 [P] [US3] Write contract test TC-014 (Transaction Hash Lookup) in tests/contract/state_storage_test.go

### US3 Signing Implementation

- [ ] T056 [US3] Implement Bitcoin signing in src/chainadapter/bitcoin/signer.go
- [ ] T057 [US3] Implement Bitcoin Sign() method in src/chainadapter/bitcoin/adapter.go
- [ ] T058 [US3] Unit test Bitcoin Sign() with mock signer in tests/unit/bitcoin_test.go
- [ ] T059 [P] [US3] Implement Ethereum signing in src/chainadapter/ethereum/signer.go
- [ ] T060 [P] [US3] Implement Ethereum Sign() method in src/chainadapter/ethereum/adapter.go
- [ ] T061 [P] [US3] Unit test Ethereum Sign() with mock signer in tests/unit/ethereum_test.go

### US3 Broadcasting Implementation

- [ ] T062 [US3] Implement Bitcoin Broadcast() with state store check in src/chainadapter/bitcoin/adapter.go
- [ ] T063 [US3] Unit test Bitcoin Broadcast() idempotency in tests/unit/bitcoin_test.go
- [ ] T064 [P] [US3] Implement Ethereum Broadcast() with state store check in src/chainadapter/ethereum/adapter.go
- [ ] T065 [P] [US3] Unit test Ethereum Broadcast() idempotency in tests/unit/ethereum_test.go

### US3 Transaction Status Query

- [ ] T066 [US3] Implement Bitcoin QueryStatus() via HTTP RPC in src/chainadapter/bitcoin/adapter.go
- [ ] T067 [US3] Implement Bitcoin SubscribeStatus() via WebSocket in src/chainadapter/bitcoin/adapter.go
- [ ] T068 [P] [US3] Implement Ethereum QueryStatus() via HTTP RPC in src/chainadapter/ethereum/adapter.go
- [ ] T069 [P] [US3] Implement Ethereum SubscribeStatus() via WebSocket in src/chainadapter/ethereum/adapter.go

### US3 Integration Tests

- [ ] T070 [US3] Integration test: Sign and broadcast Bitcoin transaction in tests/integration/bitcoin_integration_test.go
- [ ] T071 [US3] Integration test: Sign and broadcast Ethereum transaction in tests/integration/ethereum_integration_test.go
- [ ] T072 [US3] Integration test: Retry broadcast 10 times, verify idempotency in tests/integration/failover_test.go
- [ ] T073 [US3] Verify contract tests TC-002 and TC-014 pass for both adapters

---

## Phase 6: User Story 4 - Address Derivation from Key Sources (P2)

**Story Goal**: Derive chain-specific addresses from BIP39 mnemonic, xpub, hardware wallet

**Independent Test**: Derive addresses for both chains from same mnemonic, verify correct paths and formats

**Success Criteria**:
- Bitcoin: Valid P2WPKH address for m/44'/0'/0'/0/0
- Ethereum: Valid checksummed 0x address for m/44'/60'/0'/0/0
- Same mnemonic produces same addresses as MetaMask/Bitcoin Core

### US4 Contract Tests

- [ ] T074 [P] [US4] Write contract test TC-006 (Derivation Determinism) in tests/contract/address_derivation_test.go
- [ ] T075 [P] [US4] Write contract test TC-007 (Cross-Wallet Compatibility) with BIP39 test vectors in tests/contract/address_derivation_test.go

### US4 Key Source Implementations

- [ ] T076 [P] [US4] Implement MnemonicKeySource with BIP39 in src/chainadapter/types.go
- [ ] T077 [P] [US4] Implement XPubKeySource in src/chainadapter/types.go
- [ ] T078 [P] [US4] Implement HardwareWalletKeySource stub in src/chainadapter/types.go

### US4 Bitcoin Derivation

- [ ] T079 [US4] Implement Bitcoin address derivation in src/chainadapter/bitcoin/derive.go (BIP44 path m/44'/0', P2WPKH encoding)
- [ ] T080 [US4] Implement Bitcoin Derive() method in src/chainadapter/bitcoin/adapter.go
- [ ] T081 [US4] Unit test Bitcoin Derive() with test mnemonic in tests/unit/bitcoin_test.go

### US4 Ethereum Derivation

- [ ] T082 [P] [US4] Implement Ethereum address derivation in src/chainadapter/ethereum/derive.go (BIP44 path m/44'/60', EIP-55 checksum)
- [ ] T083 [P] [US4] Implement Ethereum Derive() method in src/chainadapter/ethereum/adapter.go
- [ ] T084 [P] [US4] Unit test Ethereum Derive() with test mnemonic in tests/unit/ethereum_test.go

### US4 Integration Tests

- [ ] T085 [US4] Integration test: Derive Bitcoin addresses and compare with Bitcoin Core in tests/integration/bitcoin_integration_test.go
- [ ] T086 [US4] Integration test: Derive Ethereum addresses and compare with MetaMask in tests/integration/ethereum_integration_test.go
- [ ] T087 [US4] Verify contract tests TC-006 and TC-007 pass for both adapters

---

## Phase 7: User Story 5 - Capability Detection (P2)

**Story Goal**: Query chain capabilities to enable dynamic UI feature toggling

**Independent Test**: Query capabilities for each adapter, verify correct feature flags

**Success Criteria**:
- Ethereum returns {supportsEIP1559: true, supportsMemo: false}
- Bitcoin returns {supportsEIP1559: false, supportsRBF: true}
- Unsupported capabilities return false without error

### US5 Contract Tests

- [ ] T088 [P] [US5] Write contract test TC-015 (Capabilities Accuracy) in tests/contract/capabilities_test.go

### US5 Implementation

- [ ] T089 [US5] Implement Bitcoin Capabilities() in src/chainadapter/bitcoin/adapter.go
- [ ] T090 [US5] Implement Ethereum Capabilities() in src/chainadapter/ethereum/adapter.go
- [ ] T091 [P] [US5] Unit test Capabilities() for both adapters in tests/unit/adapter_test.go
- [ ] T092 [US5] Verify contract test TC-015 passes for both adapters

---

## Phase 8: User Story 6 - Offline Signing with Audit Trail (P2)

**Story Goal**: Sign transactions offline with human-readable audit payload

**Independent Test**: Build tx, serialize for signing, sign offline, verify signature

**Success Criteria**:
- Returns both human-readable (JSON) and binary signing payloads
- External signer produces valid signature
- Can reconstruct unsigned tx from signed tx for audit

### US6 Contract Tests

- [ ] T093 [P] [US6] Write contract test TC-010 (Signature Verification) in tests/contract/signing_test.go
- [ ] T094 [P] [US6] Write contract test TC-011 (Address Mismatch Rejection) in tests/contract/signing_test.go

### US6 Audit Payload Implementation

- [ ] T095 [US6] Add HumanReadable field serialization to Bitcoin UnsignedTransaction in src/chainadapter/bitcoin/builder.go
- [ ] T096 [US6] Add HumanReadable field serialization to Ethereum UnsignedTransaction in src/chainadapter/ethereum/builder.go
- [ ] T097 [US6] Implement signature verification in Bitcoin Sign() method in src/chainadapter/bitcoin/signer.go
- [ ] T098 [US6] Implement signature verification in Ethereum Sign() method in src/chainadapter/ethereum/signer.go

### US6 Integration Tests

- [ ] T099 [US6] Integration test: Offline signing workflow for Bitcoin in tests/integration/bitcoin_integration_test.go
- [ ] T100 [US6] Integration test: Offline signing workflow for Ethereum in tests/integration/ethereum_integration_test.go
- [ ] T101 [US6] Verify contract tests TC-010 and TC-011 pass for both adapters

---

## Phase 9: User Story 7 - Observable Metrics (P3)

**Story Goal**: Expose RPC health, transaction success rates, and timing metrics

**Independent Test**: Perform transactions, query metrics for response times and failure rates

**Success Criteria**:
- Returns average response time, success rate, last successful call timestamp
- Health check reports degraded status when threshold exceeded
- Prometheus/StatsD compatible metrics endpoint

### US7 Metrics Interface

- [ ] T102 [P] [US7] Define ChainMetrics interface in src/chainadapter/metrics/metrics.go
- [ ] T103 [P] [US7] Implement Prometheus exporter in src/chainadapter/metrics/prometheus.go

### US7 RPC Metrics Integration

- [ ] T104 [US7] Add metrics recording to HTTPRPCClient in src/chainadapter/rpc/http_client.go
- [ ] T105 [US7] Add metrics recording to WebSocketRPCClient in src/chainadapter/rpc/ws_client.go
- [ ] T106 [US7] Add metrics recording to Bitcoin adapter methods in src/chainadapter/bitcoin/adapter.go
- [ ] T107 [US7] Add metrics recording to Ethereum adapter methods in src/chainadapter/ethereum/adapter.go

### US7 Integration Tests

- [ ] T108 [US7] Integration test: Query metrics after RPC calls in tests/integration/metrics_test.go
- [ ] T109 [US7] Integration test: Verify health check detects degraded RPC in tests/integration/failover_test.go
- [ ] T110 [US7] Integration test: Export Prometheus metrics in tests/integration/metrics_test.go

---

## Phase 10: Polish & Cross-Cutting Concerns

**Goal**: RPC failover, WebSocket reconnection, adapter registry, documentation

### RPC Failover & WebSocket Tests

- [ ] T111 [P] Write contract test TC-008 (Transparent Failover) in tests/contract/rpc_failover_test.go
- [ ] T112 [P] Write contract test TC-009 (All Endpoints Exhausted) in tests/contract/rpc_failover_test.go
- [ ] T113 [P] Write contract test TC-012 (WebSocket Reconnection) in tests/contract/websocket_test.go
- [ ] T114 [P] Write contract test TC-013 (Graceful Degradation to HTTP) in tests/contract/websocket_test.go

### Adapter Registry

- [ ] T115 Implement adapter registry in src/chainadapter/registry.go (Register, Get, List methods)
- [ ] T116 Register Bitcoin and Ethereum adapters in registry
- [ ] T117 Unit test adapter registry in tests/unit/registry_test.go

### Configuration Management

- [ ] T118 Implement config loading from environment variables in src/chainadapter/config.go
- [ ] T119 Implement config loading from JSON file in src/chainadapter/config.go
- [ ] T120 Unit test config loading in tests/unit/config_test.go

### Documentation

- [ ] T121 [P] Write README.md with usage examples and API documentation
- [ ] T122 [P] Write CONTRIBUTING.md with development setup and testing instructions
- [ ] T123 [P] Generate godoc documentation for all public interfaces

### Final Validation

- [ ] T124 Run all 15 contract tests (TC-001 through TC-015) and verify 100% pass
- [ ] T125 Run code coverage analysis and verify ≥90% coverage
- [ ] T126 Run go vet and golangci-lint, fix all warnings
- [ ] T127 Integration test: Full transaction lifecycle (build → sign → broadcast → status) for both chains
- [ ] T128 Performance test: Verify RPC response times <2s p95, address derivation <100ms

---

## Task Dependencies & Execution Order

### Dependency Graph (by User Story)

```
Phase 1 (Setup) → Phase 2 (Foundational)
                       ↓
    ┌──────────────────┴──────────────────┐
    ↓                  ↓                   ↓
US1 (Build)    US2 (Estimate)      US3 (Broadcast)
    ↓                  ↓                   ↓
US4 (Derive)   US5 (Capabilities)  US6 (Signing Audit)
                                           ↓
                                    US7 (Metrics)
                                           ↓
                                  Phase 10 (Polish)
```

### Blocking Dependencies

- **Phase 2 MUST complete before any user story** (foundational interfaces required by all)
- **US1 MUST complete before US2** (Estimate depends on Build for transaction validation)
- **US1 and US2 MUST complete before US3** (Broadcast requires Build and fee calculation)
- **US3 MUST complete before US6** (Signing audit extends existing signing implementation)
- **All user stories SHOULD complete before US7** (Metrics observes all operations)

### Independent User Stories (Can Run in Parallel)

- **US4 (Derive)** is independent of US1-3 (only depends on Phase 2)
- **US5 (Capabilities)** is independent of all other stories (only depends on Phase 2)
- **US1, US2 have partial independence**: Bitcoin and Ethereum implementations within each story can run in parallel

---

## Parallel Execution Opportunities

### Within Phase 2 (Foundational)

Parallel tasks (different files):
- T010-T012 (types, errors - independent definitions)
- T014-T015 (HTTP and WebSocket RPC clients - independent implementations)
- T018-T019 (Memory and File storage - independent implementations)
- T020-T022 (All mock implementations - independent)

### Within User Story 1 (Build)

Parallel tasks after T025 completes:
- T026-T029 (Bitcoin builder) || T031-T034 (Ethereum builder)
- T035 (Bitcoin integration) || T036 (Ethereum integration)

### Within User Story 2 (Estimate)

Parallel tasks after T040 completes:
- T040-T043 (Bitcoin fees) || T044-T047 (Ethereum fees)
- T048 (Bitcoin WebSocket) || T049 (Ethereum WebSocket)
- T051 (Bitcoin integration) || T052 (Ethereum integration)

### Within User Story 3 (Broadcast)

Parallel tasks:
- T056-T058 (Bitcoin signing) || T059-T061 (Ethereum signing)
- T062-T063 (Bitcoin broadcast) || T064-T065 (Ethereum broadcast)
- T066-T067 (Bitcoin status) || T068-T069 (Ethereum status)
- T070 (Bitcoin integration) || T071 (Ethereum integration)

### Within Phase 10 (Polish)

Parallel tasks:
- T111-T114 (All contract tests - independent)
- T121-T123 (All documentation - independent)

---

## Implementation Strategy

### MVP Scope (Deploy First)

**Phase 1-5 (Tasks T001-T073)**: Core transaction lifecycle
- **User Story 1**: Build transactions
- **User Story 2**: Estimate fees
- **User Story 3**: Broadcast with idempotency

**Why**: These 3 P1 stories deliver end-to-end transaction functionality

### Incremental Delivery Milestones

1. **Milestone 1** (T001-T037): Can build transactions on both chains
2. **Milestone 2** (T038-T053): Can estimate fees with confidence bounds
3. **Milestone 3** (T054-T073): Can broadcast transactions safely (MVP complete)
4. **Milestone 4** (T074-T087): Can derive addresses from mnemonic
5. **Milestone 5** (T088-T092): UI can query capabilities
6. **Milestone 6** (T093-T101): Offline signing with audit trail
7. **Milestone 7** (T102-T110): Production observability
8. **Final** (T111-T128): Complete polish and validation

---

## Format Validation

✅ All tasks follow checklist format: `- [ ] [TaskID] [P?] [Story?] Description with file path`
✅ Sequential task IDs (T001-T128)
✅ [P] markers for parallelizable tasks (different files, no incomplete dependencies)
✅ [US1]-[US7] labels for user story tasks
✅ No story labels for Setup, Foundational, and Polish phases
✅ Clear file paths in each task description

---

## Summary

**Total Tasks**: 128
**MVP Tasks**: 73 (T001-T073, User Stories 1-3)
**Parallel Opportunities**: 45 tasks marked [P]
**Contract Tests**: 15 (TC-001 through TC-015, all mandatory)
**User Stories**: 7 (3x P1, 3x P2, 1x P3)
**Test Coverage Target**: ≥90%

**Suggested First Sprint**: Phase 1-3 (T001-T037) → Milestone 1: Build transactions
**Suggested MVP**: Phase 1-5 (T001-T073) → Milestone 3: Complete P1 user stories

All tasks are immediately executable with clear file paths and acceptance criteria aligned to spec.md requirements.
