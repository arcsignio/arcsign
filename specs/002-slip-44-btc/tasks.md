# Tasks: Multi-Cryptocurrency Address Generation with SLIP-44 Support

**Input**: Design documents from `/specs/002-slip-44-btc/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/cli-commands.md, quickstart.md

**Tests**: This feature follows TDD (Test-Driven Development) - all tests MUST be written FIRST and FAIL before implementation (per constitution requirement).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions
- **Project**: Go monolith at repository root
- **Code**: `internal/models/`, `internal/services/`, `cmd/arcsign/`
- **Tests**: `tests/unit/`, `tests/integration/`, `tests/contract/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and dependency management

- [ ] T001 Install required Go dependencies: `github.com/stellar/go/keypair`, `github.com/gagliardetto/solana-go`
- [ ] T002 [P] Create directory structure `internal/services/coinregistry/` and `internal/models/address.go`
- [ ] T003 [P] Create test directory structure `tests/contract/` for BIP44 test vectors

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Coin Registry Foundation

- [ ] T004 Write test for CoinMetadata struct in tests/unit/coinregistry_test.go (RED: should fail)
- [ ] T005 Implement CoinMetadata type in internal/services/coinregistry/types.go
- [ ] T006 Write test for Registry.GetCoinBySymbol in tests/unit/coinregistry_test.go (RED: should fail)
- [ ] T007 Implement Registry struct and GetCoinBySymbol in internal/services/coinregistry/registry.go
- [ ] T008 Write test for Registry.GetAllCoinsSortedByMarketCap in tests/unit/coinregistry_test.go (RED: should fail)
- [ ] T009 Implement GetAllCoinsSortedByMarketCap method in internal/services/coinregistry/registry.go
- [ ] T010 Populate static coin registry with 30 initial coins (BTC, ETH, LTC, DOGE, etc.) in internal/services/coinregistry/registry.go

### Data Models Foundation

- [ ] T011 Write test for DerivedAddress struct in tests/unit/address_model_test.go (RED: should fail)
- [ ] T012 Implement DerivedAddress type in internal/models/address.go
- [ ] T013 Write test for AddressBook struct in tests/unit/address_model_test.go (RED: should fail)
- [ ] T014 Implement AddressBook type in internal/models/address.go
- [ ] T015 Write test for Wallet extension with AddressBook in tests/unit/wallet_model_test.go (RED: should fail)
- [ ] T016 Extend Wallet struct with optional AddressBook field in internal/models/wallet.go

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Pre-generate Multi-Coin Addresses on Wallet Creation (Priority: P1) 🎯 MVP

**Goal**: Automatically generate and store addresses for 30-50 cryptocurrencies during wallet creation, eliminating need for repeated derivation

**Independent Test**: Create a wallet using `arcsign create` and verify `wallet.json` contains `addressBook` array with 30+ addresses for different coins (BTC, ETH, XRP, etc.) in plaintext format

### Tests for User Story 1

**NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T017 [P] [US1] Write BIP44 test vector for Bitcoin address derivation in tests/contract/slip44_vectors_test.go (RED)
- [ ] T018 [P] [US1] Write BIP44 test vector for Ethereum address derivation in tests/contract/slip44_vectors_test.go (RED)
- [ ] T019 [P] [US1] Write BIP44 test vector for Litecoin address derivation in tests/contract/slip44_vectors_test.go (RED)
- [ ] T020 [P] [US1] Write integration test for multi-coin wallet creation in tests/integration/multicoin_test.go (RED)

### Address Formatters Implementation (Bitcoin-Compatible)

- [ ] T021 [P] [US1] Write test for Litecoin address formatter in tests/unit/address_formatters_test.go (RED: should fail)
- [ ] T022 [US1] Extend Bitcoin formatter to support Litecoin network parameters in internal/services/address/bitcoin.go
- [ ] T023 [P] [US1] Write test for Dogecoin address formatter in tests/unit/address_formatters_test.go (RED: should fail)
- [ ] T024 [US1] Extend Bitcoin formatter to support Dogecoin network parameters in internal/services/address/bitcoin.go
- [ ] T025 [P] [US1] Write test for Dash address formatter in tests/unit/address_formatters_test.go (RED: should fail)
- [ ] T026 [US1] Extend Bitcoin formatter to support Dash network parameters in internal/services/address/bitcoin.go

### Address Formatters Implementation (Ethereum-Compatible)

- [ ] T027 [P] [US1] Write test for Polygon (MATIC) address formatter in tests/unit/address_formatters_test.go (RED: should fail)
- [ ] T028 [US1] Verify Ethereum formatter works for Polygon (reuse internal/services/address/ethereum.go)
- [ ] T029 [P] [US1] Write test for Binance Smart Chain (BNB) address formatter in tests/unit/address_formatters_test.go (RED: should fail)
- [ ] T030 [US1] Verify Ethereum formatter works for BSC (reuse internal/services/address/ethereum.go)
- [ ] T031 [P] [US1] Write test for Avalanche (AVAX) address formatter in tests/unit/address_formatters_test.go (RED: should fail)
- [ ] T032 [US1] Verify Ethereum formatter works for Avalanche (reuse internal/services/address/ethereum.go)
- [ ] T033 [P] [US1] Write test for Ethereum Classic (ETC) address formatter in tests/unit/address_formatters_test.go (RED: should fail)
- [ ] T034 [US1] Verify Ethereum formatter works for ETC (reuse internal/services/address/ethereum.go)

### Address Formatters Implementation (New Coin Types - High Priority)

- [ ] T035 [US1] Write test for Ripple (XRP) address formatter with known test vector in tests/unit/address_formatters_test.go (RED: should fail)
- [ ] T036 [US1] Implement DeriveRippleAddress method in internal/services/address/ripple.go
- [ ] T037 [US1] Write test for Stellar (XLM) address formatter with known test vector in tests/unit/address_formatters_test.go (RED: should fail)
- [ ] T038 [US1] Implement DeriveStellarAddress method in internal/services/address/stellar.go
- [ ] T039 [US1] Write test for TRON (TRX) address formatter with known test vector in tests/unit/address_formatters_test.go (RED: should fail)
- [ ] T040 [US1] Implement DeriveTronAddress method in internal/services/address/tron.go
- [ ] T041 [US1] Write test for Solana (SOL) address formatter with known test vector in tests/unit/address_formatters_test.go (RED: should fail)
- [ ] T042 [US1] Implement DeriveSolanaAddress method in internal/services/address/solana.go

### Address Formatters Implementation (New Coin Types - Medium Priority)

- [ ] T043 [P] [US1] Write test for Bitcoin Cash (BCH) address formatter in tests/unit/address_formatters_test.go (RED: should fail)
- [ ] T044 [US1] Implement DeriveBitcoinCashAddress method (CashAddr format) in internal/services/address/bitcoincash.go
- [ ] T045 [P] [US1] Write test for Zcash (ZEC) address formatter in tests/unit/address_formatters_test.go (RED: should fail)
- [ ] T046 [US1] Implement DeriveZcashAddress method in internal/services/address/zcash.go
- [ ] T047 [P] [US1] Write test for Cosmos (ATOM) address formatter in tests/unit/address_formatters_test.go (RED: should fail)
- [ ] T048 [US1] Implement DeriveCosmosAddress method (Bech32 format) in internal/services/address/cosmos.go

### Multi-Coin Address Generation Service

- [ ] T049 [US1] Write test for GenerateMultiCoinAddresses in tests/unit/address_service_test.go (RED: should fail)
- [ ] T050 [US1] Implement GenerateMultiCoinAddresses method in internal/services/address/service.go
- [ ] T051 [US1] Write test for address generation failure handling in tests/unit/address_service_test.go (RED: should fail)
- [ ] T052 [US1] Implement graceful failure handling (log errors, continue with remaining coins) in internal/services/address/service.go

### Wallet Service Integration

- [ ] T053 [US1] Write test for CreateWallet with multi-coin address generation in tests/unit/wallet_service_test.go (RED: should fail)
- [ ] T054 [US1] Modify CreateWallet to call GenerateMultiCoinAddresses in internal/services/wallet/service.go
- [ ] T055 [US1] Write test for wallet JSON serialization with AddressBook in tests/unit/wallet_service_test.go (RED: should fail)
- [ ] T056 [US1] Update wallet.json storage to include addressBook field in internal/services/wallet/service.go
- [ ] T057 [US1] Write test for audit logging of address generation events in tests/unit/wallet_service_test.go (RED: should fail)
- [ ] T058 [US1] Add audit logging for successful and failed address generation in internal/services/wallet/service.go

### CLI Integration for User Story 1

- [ ] T059 [US1] Write test for CLI create command displaying address generation summary in tests/integration/cli_create_test.go (RED: should fail)
- [ ] T060 [US1] Modify handleCreateWallet to display address generation summary in cmd/arcsign/main.go
- [ ] T061 [US1] Update CLI output to show successful and failed coin counts with error details in cmd/arcsign/main.go

### Performance Optimization for User Story 1

- [ ] T062 [US1] Write performance test for wallet creation with 30 coins (<10 seconds) in tests/integration/performance_test.go
- [ ] T063 [US1] Optimize address generation if needed (consider parallel derivation) in internal/services/address/service.go

**Checkpoint**: At this point, User Story 1 should be fully functional - wallets are created with 30+ pre-generated addresses

---

## Phase 4: User Story 2 - View All Generated Addresses (Priority: P2)

**Goal**: Enable users to view all cryptocurrency addresses that were pre-generated during wallet creation, sorted by market cap

**Independent Test**: Run `arcsign list-addresses --wallet-id <uuid>` and verify it displays all addresses sorted by market cap (BTC first, ETH second, etc.) without requiring password

### Tests for User Story 2

- [ ] T064 [P] [US2] Write unit test for ListAddresses success case in tests/unit/wallet_service_test.go (RED: should fail)
- [ ] T065 [P] [US2] Write unit test for ListAddresses with v0.1.0 wallet (no AddressBook) in tests/unit/wallet_service_test.go (RED: should fail)
- [ ] T066 [P] [US2] Write unit test for ListAddresses sorted by market cap in tests/unit/wallet_service_test.go (RED: should fail)
- [ ] T067 [P] [US2] Write integration test for end-to-end list-addresses command in tests/integration/cli_list_test.go (RED: should fail)

### Implementation for User Story 2

- [ ] T068 [US2] Implement ListAddresses method in internal/services/wallet/service.go
- [ ] T069 [US2] Add validation for AddressBook existence (detect v0.1.0 wallets) in internal/services/wallet/service.go
- [ ] T070 [US2] Implement handleListAddresses CLI command in cmd/arcsign/main.go
- [ ] T071 [US2] Add argument parsing for --wallet-id and -w short form in cmd/arcsign/main.go
- [ ] T072 [US2] Implement table formatter for address display with columns (rank, symbol, name, address, path) in cmd/arcsign/main.go
- [ ] T073 [US2] Add error handling for wallet not found, USB not detected, and missing AddressBook in cmd/arcsign/main.go
- [ ] T074 [US2] Update main help text to include list-addresses command in cmd/arcsign/main.go
- [ ] T075 [US2] Implement --help flag for list-addresses command in cmd/arcsign/main.go
- [ ] T076 [US2] Add audit logging for LIST_ADDRESSES operation in internal/services/wallet/service.go

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently - addresses can be listed

---

## Phase 5: User Story 3 - Display Specific Coin Address (Priority: P3)

**Goal**: Enable users to quickly retrieve address for a specific cryptocurrency by symbol or SLIP-44 index

**Independent Test**: Run `arcsign get-address --wallet-id <uuid> --coin BTC` and verify it returns only the Bitcoin address without requiring password

### Tests for User Story 3

- [ ] T077 [P] [US3] Write unit test for GetAddress by symbol in tests/unit/wallet_service_test.go (RED: should fail)
- [ ] T078 [P] [US3] Write unit test for GetAddress by SLIP-44 coin type in tests/unit/wallet_service_test.go (RED: should fail)
- [ ] T079 [P] [US3] Write unit test for GetAddress coin not found error in tests/unit/wallet_service_test.go (RED: should fail)
- [ ] T080 [P] [US3] Write unit test for GetAddress invalid symbol error in tests/unit/wallet_service_test.go (RED: should fail)
- [ ] T081 [P] [US3] Write integration test for end-to-end get-address command in tests/integration/cli_get_test.go (RED: should fail)

### Implementation for User Story 3

- [ ] T082 [US3] Implement GetAddressBySymbol method in internal/services/wallet/service.go
- [ ] T083 [US3] Implement GetAddressByCoinType method in internal/services/wallet/service.go
- [ ] T084 [US3] Implement handleGetAddress CLI command in cmd/arcsign/main.go
- [ ] T085 [US3] Add argument parsing for --wallet-id, --coin, --coin-type and short forms in cmd/arcsign/main.go
- [ ] T086 [US3] Add validation to prevent both --coin and --coin-type being used simultaneously in cmd/arcsign/main.go
- [ ] T087 [US3] Add validation to require at least one of --coin or --coin-type in cmd/arcsign/main.go
- [ ] T088 [US3] Implement address display formatter with coin details (symbol, name, address, path, type, rank) in cmd/arcsign/main.go
- [ ] T089 [US3] Add error handling for coin not found and invalid symbol in cmd/arcsign/main.go
- [ ] T090 [US3] Update main help text to include get-address command in cmd/arcsign/main.go
- [ ] T091 [US3] Implement --help flag for get-address command in cmd/arcsign/main.go
- [ ] T092 [US3] Add audit logging for GET_ADDRESS operation in internal/services/wallet/service.go

**Checkpoint**: All user stories should now be independently functional - addresses can be created, listed, and retrieved individually

---

## Phase 6: Additional Coin Support (Optional - Can be deferred)

**Purpose**: Add high-effort coin formatters (Cardano, Polkadot, Monero) to expand from 30 to 50 coins

- [ ] T093 [P] Write test for Cardano (ADA) address formatter in tests/unit/address_formatters_test.go (RED: should fail)
- [ ] T094 Implement DeriveCardanoAddress method (Bech32 with payment + stake keys) in internal/services/address/cardano.go
- [ ] T095 [P] Write test for Polkadot (DOT) address formatter in tests/unit/address_formatters_test.go (RED: should fail)
- [ ] T096 Implement DerivePolkadotAddress method (SS58 encoding) in internal/services/address/polkadot.go
- [ ] T097 [P] Write test for Monero (XMR) address formatter in tests/unit/address_formatters_test.go (RED: should fail)
- [ ] T098 Implement DeriveMoneroAddress method (CryptoNote with view + spend keys) in internal/services/address/monero.go
- [ ] T099 Add 10-20 more coins to coin registry to reach 50 total in internal/services/coinregistry/registry.go
- [ ] T100 Update BIP44 test vectors for all additional coins in tests/contract/slip44_vectors_test.go

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T101 [P] Add comprehensive error messages with suggestions for all error cases in internal/lib/errors.go
- [ ] T102 [P] Add performance benchmarks for address generation and lookup in tests/integration/benchmark_test.go
- [ ] T103 [P] Update SYSTEM_SPECIFICATION.md with feature documentation
- [ ] T104 Verify all audit log entries are being written correctly in tests/integration/audit_test.go
- [ ] T105 Run quickstart.md validation (verify all TDD examples work)
- [ ] T106 [P] Add backward compatibility tests for v0.1.0 wallets in tests/integration/compatibility_test.go
- [ ] T107 Code review and refactoring for consistency across all formatters
- [ ] T108 Security review: verify addresses stored as public keys (plaintext) and private keys never logged
- [ ] T109 [P] Performance testing: verify wallet creation with 30 coins < 10 seconds
- [ ] T110 [P] Performance testing: verify address lookup < 100ms
- [ ] T111 Final integration test: create wallet, list addresses, get specific address, verify all data matches

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-5)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3)
- **Additional Coins (Phase 6)**: Optional, can start after US1 complete
- **Polish (Phase 7)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - No dependencies on US1 (reads same data)
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - No dependencies on US1/US2 (reads same data)

**NOTE**: All user stories read from `wallet.json` created by US1, but US2 and US3 do NOT depend on US1 for implementation - they can be built and tested independently using mock wallet data.

### Within Each User Story

- Tests MUST be written and FAIL before implementation (TDD - Red-Green-Refactor)
- Address formatters can be implemented in parallel (different files)
- Bitcoin-compatible and Ethereum-compatible formatters are quick wins (reuse existing code)
- New coin formatters (XRP, Stellar, TRON, Solana) require more effort
- Service layer integration depends on formatters being complete
- CLI commands depend on service layer

### Parallel Opportunities

- **Phase 1 (Setup)**: All tasks can run in parallel
- **Phase 2 (Foundational)**: Coin registry and data models can be implemented in parallel
- **User Story 1**:
  - All test writing tasks (T017-T020) can run in parallel
  - All Bitcoin-compatible formatter tests (T021, T023, T025) can run in parallel
  - All Ethereum-compatible formatter tests (T027, T029, T031, T033) can run in parallel
  - All new coin formatter implementations can run in parallel (T036, T038, T040, T042, etc.)
- **User Story 2**: All test tasks (T064-T067) can run in parallel
- **User Story 3**: All test tasks (T077-T081) can run in parallel
- **Phase 6 (Additional Coins)**: All coin formatter tests and implementations can run in parallel
- **Phase 7 (Polish)**: Most tasks can run in parallel

---

## Parallel Example: User Story 1 (Address Formatters)

```bash
# Launch all Bitcoin-compatible formatter tests together:
Task: "Write test for Litecoin address formatter in tests/unit/address_formatters_test.go"
Task: "Write test for Dogecoin address formatter in tests/unit/address_formatters_test.go"
Task: "Write test for Dash address formatter in tests/unit/address_formatters_test.go"

# Launch all new coin formatter implementations together (after tests written):
Task: "Implement DeriveRippleAddress method in internal/services/address/ripple.go"
Task: "Implement DeriveStellarAddress method in internal/services/address/stellar.go"
Task: "Implement DeriveTronAddress method in internal/services/address/tron.go"
Task: "Implement DeriveSolanaAddress method in internal/services/address/solana.go"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T003)
2. Complete Phase 2: Foundational (T004-T016) - CRITICAL
3. Complete Phase 3: User Story 1 (T017-T063)
4. **STOP and VALIDATE**: Create a test wallet, verify `wallet.json` contains 30+ addresses
5. Deploy/demo if ready

**Estimated Time**: 8-10 days (following quickstart.md TDD workflow)

### Incremental Delivery

1. Complete Setup + Foundational (T001-T016) → Foundation ready (2-3 days)
2. Add User Story 1 (T017-T063) → Test independently → Deploy/Demo (MVP with 30 coins) (5-7 days)
3. Add User Story 2 (T064-T076) → Test independently → Deploy/Demo (2-3 days)
4. Add User Story 3 (T077-T092) → Test independently → Deploy/Demo (2-3 days)
5. Optionally add Phase 6 for 50 coins (T093-T100) (3-5 days)
6. Polish Phase 7 (T101-T111) (2-3 days)

**Total Estimated Time**: 15-20 days for full feature (30 coins), 20-25 days for 50 coins

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together (T001-T016)
2. Once Foundational is done:
   - **Developer A**: Bitcoin-compatible formatters (T021-T026)
   - **Developer B**: Ethereum-compatible formatters (T027-T034)
   - **Developer C**: New coin formatters - XRP, Stellar (T035-T038)
   - **Developer D**: New coin formatters - TRON, Solana (T039-T042)
   - **Developer E**: Medium priority formatters (T043-T048)
3. Integrate all formatters into multi-coin service (T049-T052)
4. Complete wallet integration and CLI (T053-T063)
5. User Stories 2 and 3 can be built in parallel by different developers (T064-T092)

---

## Task Summary

**Total Tasks**: 111
- Phase 1 (Setup): 3 tasks
- Phase 2 (Foundational): 13 tasks
- Phase 3 (User Story 1 - P1): 47 tasks (including 25 formatter tasks, 15 tests)
- Phase 4 (User Story 2 - P2): 13 tasks (including 4 tests)
- Phase 5 (User Story 3 - P3): 16 tasks (including 5 tests)
- Phase 6 (Additional Coins): 8 tasks (optional)
- Phase 7 (Polish): 11 tasks

**Test Tasks**: 44 (following TDD - all written before implementation)
- Contract/BIP44 test vectors: 4 tasks
- Unit tests: 35 tasks
- Integration tests: 5 tasks

**Parallel Opportunities**: 60+ tasks can run in parallel within their phases

**MVP Scope** (Recommended): Phases 1-3 only (63 tasks, ~10 days)
- Delivers core value: wallets created with 30 pre-generated addresses
- User Story 1 is fully functional and independently testable
- User Stories 2 and 3 can be added incrementally after MVP launch

---

## Notes

- [P] tasks = different files, no dependencies, can run in parallel
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable
- **TDD REQUIRED**: All tests MUST FAIL before implementation (Red-Green-Refactor cycle)
- Verify tests fail before implementing (constitution requirement)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Address formatters are the most parallelizable work (30+ independent files)
- Bitcoin/Ethereum-compatible coins are low effort (reuse existing formatters)
- New coin types (XRP, Stellar, TRON, Solana) are medium effort
- High-effort coins (Cardano, Polkadot, Monero) are optional for MVP
