# Implementation Tasks: Extended Multi-Chain Support (v0.3.0)

**Feature**: Adding 24 new blockchains (54 total)
**Branch**: `003-name-bitcoin-symbol`
**Total Tasks**: 111
**Estimated Time**: 10-15 days

## Task Overview

| Phase | User Story | Task Count | Time Estimate |
|-------|------------|------------|---------------|
| Phase 1 | Setup | 7 tasks | 0.5 days |
| Phase 2 | Foundational | 10 tasks | 1 day |
| Phase 3 | US1 - Layer 2 Addresses (P1) | 24 tasks | 3-5 days |
| Phase 4 | US2 - Regional Chains (P2) | 13 tasks | 1.5 days |
| Phase 5 | US3 - Cosmos Ecosystem (P2) | 16 tasks | 1.5 days |
| Phase 6 | US4 - Alternative EVM (P3) | 14 tasks | 1 day |
| Phase 7 | US5 - Specialized Chains (P3) | 22 tasks | 4-5 days |
| Phase 8 | Polish & Integration | 5 tasks | 1 day |

---

## Phase 1: Setup (7 tasks)

**Goal**: Initialize project dependencies and testing infrastructure for v0.3.0

### Dependencies Installation

- [ ] T001 Install Starknet library with `go get github.com/NethermindEth/starknet.go@latest`
- [ ] T002 Install gnark-crypto library with `go get github.com/consensys/gnark-crypto@latest`
- [ ] T003 Install go-subkey library with `go get github.com/vedhavyas/go-subkey@latest`
- [ ] T004 Install tzgo library with `go get github.com/trilitech/tzgo@latest`
- [ ] T005 Install gozilliqa-sdk with `go get github.com/Zilliqa/gozilliqa-sdk/v3@latest`
- [ ] T006 Install btcutil bech32 library with `go get github.com/btcsuite/btcd/btcutil/bech32@latest`
- [ ] T007 Run `go mod tidy` to clean up dependencies in go.mod

---

## Phase 2: Foundational (10 tasks)

**Goal**: Extend core data models and registry to support 54 chains (blocking prerequisites for all user stories)

### Data Model Extensions

- [ ] T008 [P] Add ChainCategory enum to internal/models/address.go (UTXO, EVM_Mainnet, Layer2, Cosmos_SDK, Substrate, Custom)
- [ ] T009 [P] Add Category field to DerivedAddress struct in internal/models/address.go
- [ ] T010 Add GetByCategory method to AddressBook in internal/models/address.go

### Registry Extensions

- [ ] T011 [P] Add KeyType enum to internal/services/coinregistry/types.go (secp256k1, ed25519, sr25519)
- [ ] T012 [P] Add ChainCategory field to ChainMetadata in internal/services/coinregistry/types.go
- [ ] T013 Update CoinMetadata.Validate() to check Category field in internal/services/coinregistry/types.go

### Metrics & Error Handling

- [ ] T014 [P] Create GenerationMetrics struct in internal/lib/errors.go
- [ ] T015 [P] Create ChainMetric struct in internal/lib/errors.go
- [ ] T016 Add retry-once logic helper function to internal/services/address/service.go
- [ ] T017 Add GenerateMultiCoinAddresses retry wrapper in internal/services/address/service.go

---

## Phase 3: User Story 1 - Access Layer 2 Ecosystem Addresses (P1) - 24 tasks

**Story Goal**: Users can create wallets with addresses for 6 Layer 2 networks (Arbitrum, Optimism, Base, zkSync, Starknet, Linea)

**Independent Test**: User creates new wallet and immediately receives addresses for all 6 L2 chains. User can view these addresses grouped under "Layer 2 Networks" category.

### Layer 2 EVM Chains (Ethereum Formatter Reuse)

- [ ] T018 [P] [US1] Add Arbitrum (ARB, coin type 9001) to registry in internal/services/coinregistry/registry.go with ethereum formatter
- [ ] T019 [P] [US1] Add Optimism (OP, coin type 614) to registry in internal/services/coinregistry/registry.go with ethereum formatter
- [ ] T020 [P] [US1] Add Base (BASE, coin type 8453) to registry in internal/services/coinregistry/registry.go with ethereum formatter
- [ ] T021 [P] [US1] Add zkSync (ZKS, coin type 324) to registry in internal/services/coinregistry/registry.go with ethereum formatter
- [ ] T022 [P] [US1] Add Linea (LINEA, coin type 59144) to registry in internal/services/coinregistry/registry.go with ethereum formatter

### Starknet Formatter (NEW - Complex)

- [ ] T023 [US1] Write test TestDeriveStarknetAddress_KnownVector in tests/unit/starknet_test.go
- [ ] T024 [US1] Write test TestDeriveStarknetAddress_Determinism in tests/unit/starknet_test.go
- [ ] T025 [US1] Write test TestDeriveStarknetAddress_AddressFormat in tests/unit/starknet_test.go
- [ ] T026 [US1] Implement grindKey function (EIP-2645 grinding algorithm) in internal/services/address/starknet.go
- [ ] T027 [US1] Implement computeStarknetAddress function in internal/services/address/starknet.go
- [ ] T028 [US1] Implement DeriveStarknetAddress method in internal/services/address/starknet.go
- [ ] T029 [US1] Add Starknet (STRK, coin type 9004) to registry in internal/services/coinregistry/registry.go with starknet formatter
- [ ] T030 [US1] Add "starknet" case to deriveAddressByFormatter switch in internal/services/address/service.go
- [ ] T031 [US1] Run tests for Starknet formatter with `go test ./tests/unit/starknet_test.go -v`

### Integration Testing (US1)

- [ ] T032 [US1] Write integration test TestPhase1_Layer2_6Chains in tests/integration/multi_chain_54_test.go
- [ ] T033 [US1] Write integration test TestLayer2_PerformanceUnder3Seconds in tests/integration/multi_chain_54_test.go
- [ ] T034 [US1] Write contract test TestAddressFormat_Starknet in tests/contract/address_format_test.go
- [ ] T035 [US1] Run all Phase 1 tests with `go test ./tests/... -v -run TestPhase1`

### CLI Integration (US1)

- [ ] T036 [US1] Update wallet creation output to display Layer 2 category in cmd/arcsign/main.go
- [ ] T037 [US1] Add category grouping to list-addresses command in cmd/arcsign/main.go
- [ ] T038 [US1] Test wallet creation manually: `go run cmd/arcsign/main.go create --name "Phase1_Test"`
- [ ] T039 [US1] Verify 36 chains generated (30 existing + 6 Layer 2) in manual test
- [ ] T040 [US1] Update unit test TestRegistry_TotalChainCount to expect 36 chains in tests/unit/coinregistry_test.go
- [ ] T041 [US1] Run full test suite with `go test ./tests/... -v` and confirm all pass

---

## Phase 4: User Story 2 - Manage Regional Blockchain Assets (P2) - 13 tasks

**Story Goal**: Users can receive tokens from Asian exchanges and regional platforms (Klaytn, Cronos, HECO, Harmony)

**Independent Test**: User creates wallet, receives addresses for 4 regional chains, can accept KLAY from Korean exchange, CRO from Crypto.com, HT from Huobi.

### Regional EVM Chains (Ethereum Formatter Reuse)

- [ ] T042 [P] [US2] Add Klaytn (KLAY, coin type 8217) to registry in internal/services/coinregistry/registry.go with ethereum formatter
- [ ] T043 [P] [US2] Add Cronos (CRO, coin type 394) to registry in internal/services/coinregistry/registry.go with ethereum formatter
- [ ] T044 [P] [US2] Add HECO (HT, coin type 1010) to registry in internal/services/coinregistry/registry.go with ethereum formatter

### Harmony Formatter (NEW - Simple)

- [ ] T045 [US2] Write test TestDeriveHarmonyAddress_KnownVector in tests/unit/harmony_test.go
- [ ] T046 [US2] Write test TestDeriveHarmonyAddress_Bech32Format in tests/unit/harmony_test.go
- [ ] T047 [US2] Implement DeriveHarmonyAddress method in internal/services/address/harmony.go
- [ ] T048 [US2] Add Harmony (ONE, coin type 1023) to registry in internal/services/coinregistry/registry.go with harmony formatter
- [ ] T049 [US2] Add "harmony" case to deriveAddressByFormatter switch in internal/services/address/service.go
- [ ] T050 [US2] Run tests for Harmony formatter with `go test ./tests/unit/harmony_test.go -v`

### Integration Testing (US2)

- [ ] T051 [US2] Write integration test TestPhase2_Regional_4Chains in tests/integration/multi_chain_54_test.go
- [ ] T052 [US2] Write contract test TestAddressFormat_Harmony in tests/contract/address_format_test.go
- [ ] T053 [US2] Run all Phase 2 tests with `go test ./tests/... -v -run TestPhase2`
- [ ] T054 [US2] Update unit test TestRegistry_TotalChainCount to expect 40 chains in tests/unit/coinregistry_test.go

---

## Phase 5: User Story 3 - Access Cosmos Ecosystem Chains (P2) - 16 tasks

**Story Goal**: Users can participate in Cosmos IBC ecosystem (Osmosis DEX, Juno contracts, Evmos bridge, Secret Network privacy)

**Independent Test**: User creates wallet, receives 4 Cosmos addresses with correct Bech32 prefixes (osmo1, juno1, evmos1, secret1), can transfer ATOM via IBC.

### Cosmos Formatter Extension

- [ ] T055 [US3] Write test TestDeriveCosmosAddress_CustomPrefix in tests/unit/cosmos_test.go
- [ ] T056 [US3] Write test TestDeriveOsmosisAddress in tests/unit/cosmos_test.go
- [ ] T057 [US3] Write test TestDeriveJunoAddress in tests/unit/cosmos_test.go
- [ ] T058 [US3] Write test TestDeriveEvmosAddress_DualFormat in tests/unit/cosmos_test.go
- [ ] T059 [US3] Write test TestDeriveSecretAddress in tests/unit/cosmos_test.go
- [ ] T060 [US3] Refactor DeriveCosmosAddress to accept prefix parameter in internal/services/address/cosmos.go
- [ ] T061 [P] [US3] Implement DeriveOsmosisAddress method in internal/services/address/cosmos.go
- [ ] T062 [P] [US3] Implement DeriveJunoAddress method in internal/services/address/cosmos.go
- [ ] T063 [P] [US3] Implement DeriveEvmosAddress method (returns Cosmos format) in internal/services/address/cosmos.go
- [ ] T064 [P] [US3] Implement DeriveSecretAddress method in internal/services/address/cosmos.go
- [ ] T065 [US3] Add Osmosis (OSMO, coin type 118) to registry in internal/services/coinregistry/registry.go with osmosis formatter
- [ ] T066 [US3] Add Juno (JUNO, coin type 118) to registry in internal/services/coinregistry/registry.go with juno formatter
- [ ] T067 [US3] Add Evmos (EVMOS, coin type 60) to registry in internal/services/coinregistry/registry.go with evmos formatter
- [ ] T068 [US3] Add Secret Network (SCRT, coin type 529) to registry in internal/services/coinregistry/registry.go with secret formatter
- [ ] T069 [US3] Add formatter cases (osmosis, juno, evmos, secret) to deriveAddressByFormatter in internal/services/address/service.go
- [ ] T070 [US3] Update unit test TestRegistry_TotalChainCount to expect 44 chains in tests/unit/coinregistry_test.go

---

## Phase 6: User Story 4 - Support Alternative EVM Chains (P3) - 14 tasks

**Story Goal**: Users can interact with alternative EVM ecosystems (Fantom DeFi, Celo mobile, Moonbeam bridge, Metis, Gnosis)

**Independent Test**: User creates wallet, receives 5 alternative EVM addresses, can receive Celo mobile payments, bridge via Moonbeam.

### Alternative EVM Chains (Ethereum Formatter Reuse)

- [ ] T071 [P] [US4] Add Fantom (FTM, coin type 60) to registry in internal/services/coinregistry/registry.go with ethereum formatter
- [ ] T072 [P] [US4] Add Celo (CELO, coin type 52752) to registry in internal/services/coinregistry/registry.go with ethereum formatter
- [ ] T073 [P] [US4] Add Moonbeam (GLMR, coin type 1284) to registry in internal/services/coinregistry/registry.go with ethereum formatter
- [ ] T074 [P] [US4] Add Metis (METIS, coin type 1088) to registry in internal/services/coinregistry/registry.go with ethereum formatter
- [ ] T075 [P] [US4] Add Gnosis (GNO, coin type 700) to registry in internal/services/coinregistry/registry.go with ethereum formatter
- [ ] T076 [P] [US4] Add Wanchain (WAN, coin type 5718350) to registry in internal/services/coinregistry/registry.go with ethereum formatter

### Integration Testing (US4)

- [ ] T077 [US4] Write integration test TestPhase3_AlternativeEVM_6Chains in tests/integration/multi_chain_54_test.go
- [ ] T078 [US4] Write contract test to verify all alternative EVM addresses use 0x prefix in tests/contract/address_format_test.go
- [ ] T079 [US4] Run all Phase 3 EVM tests with `go test ./tests/... -v -run TestPhase3`
- [ ] T080 [US4] Update unit test TestRegistry_TotalChainCount to expect 50 chains in tests/unit/coinregistry_test.go
- [ ] T081 [US4] Test wallet creation manually with 50 chains: `go run cmd/arcsign/main.go create`
- [ ] T082 [US4] Verify generation time <13 seconds for 50 chains in manual test
- [ ] T083 [US4] Verify all alternative EVM addresses display correctly in list-addresses output
- [ ] T084 [US4] Run full test suite with `go test ./tests/... -v` and confirm all pass

---

## Phase 7: User Story 5 - Access Specialized Chain Addresses (P3) - 22 tasks

**Story Goal**: Users can access niche blockchain addresses (Kusama parachains, Tezos NFTs, Zilliqa sharding, ICON enterprise)

**Independent Test**: User creates wallet, receives 5 specialized addresses (KSM, XTZ, ZIL, WAN, ICX), can participate in Kusama crowdloans, mint Tezos NFTs.

### Kusama Formatter (NEW - Moderate)

- [ ] T085 [US5] Write test TestDeriveKusamaAddress_KnownVector in tests/unit/kusama_test.go
- [ ] T086 [US5] Write test TestDeriveKusamaAddress_SS58Format in tests/unit/kusama_test.go
- [ ] T087 [US5] Write test TestDeriveKusamaAddress_SubstrateBIP39 in tests/unit/kusama_test.go
- [ ] T088 [US5] Implement DeriveKusamaAddress method using go-subkey in internal/services/address/kusama.go
- [ ] T089 [US5] Add Kusama (KSM, coin type 434) to registry in internal/services/coinregistry/registry.go with kusama formatter
- [ ] T090 [US5] Add "kusama" case to deriveAddressByFormatter switch in internal/services/address/service.go
- [ ] T091 [US5] Run tests for Kusama formatter with `go test ./tests/unit/kusama_test.go -v`

### Tezos Formatter (NEW - Moderate)

- [ ] T092 [US5] Write test TestDeriveTezosAddress_KnownVector in tests/unit/tezos_test.go
- [ ] T093 [US5] Write test TestDeriveTezosAddress_TZ1Format in tests/unit/tezos_test.go
- [ ] T094 [US5] Implement DeriveTezosAddress method using tzgo in internal/services/address/tezos.go
- [ ] T095 [US5] Add Tezos (XTZ, coin type 1729) to registry in internal/services/coinregistry/registry.go with tezos formatter
- [ ] T096 [US5] Add "tezos" case to deriveAddressByFormatter switch in internal/services/address/service.go
- [ ] T097 [US5] Run tests for Tezos formatter with `go test ./tests/unit/tezos_test.go -v`

### Zilliqa Formatter (NEW - Simple)

- [ ] T098 [US5] Write test TestDeriveZilliqaAddress_KnownVector in tests/unit/zilliqa_test.go
- [ ] T099 [US5] Write test TestDeriveZilliqaAddress_Bech32ZIL1 in tests/unit/zilliqa_test.go
- [ ] T100 [US5] Implement DeriveZilliqaAddress method using gozilliqa-sdk in internal/services/address/zilliqa.go
- [ ] T101 [US5] Add Zilliqa (ZIL, coin type 313) to registry in internal/services/coinregistry/registry.go with zilliqa formatter
- [ ] T102 [US5] Add "zilliqa" case to deriveAddressByFormatter switch in internal/services/address/service.go
- [ ] T103 [US5] Run tests for Zilliqa formatter with `go test ./tests/unit/zilliqa_test.go -v`

### ICON Formatter (NEW - Simple)

- [ ] T104 [US5] Write test TestDeriveIconAddress_KnownVector in tests/unit/icon_test.go
- [ ] T105 [US5] Write test TestDeriveIconAddress_HXPrefix in tests/unit/icon_test.go
- [ ] T106 [US5] Implement DeriveIconAddress method using golang.org/x/crypto/sha3 in internal/services/address/icon.go
- [ ] T107 [US5] Add ICON (ICX, coin type 74 or 4801368) to registry in internal/services/coinregistry/registry.go with icon formatter
- [ ] T108 [US5] Add "icon" case to deriveAddressByFormatter switch in internal/services/address/service.go
- [ ] T109 [US5] Run tests for ICON formatter with `go test ./tests/unit/icon_test.go -v`

---

## Phase 8: Polish & Cross-Cutting Concerns (5 tasks)

**Goal**: Final integration, performance validation, upgrade path, documentation

### Final Integration

- [ ] T110 Write integration test TestAll54Chains_GenerateSuccessfully in tests/integration/multi_chain_54_test.go
- [ ] T111 Write integration test TestPerformance_Under15Seconds in tests/integration/multi_chain_54_test.go
- [ ] T112 Write integration test TestUpgrade_V02ToV03_Automatic in tests/integration/upgrade_v02_v03_test.go
- [ ] T113 Write integration test TestDeterminism_SameMnemonicSameAddresses in tests/integration/multi_chain_54_test.go
- [ ] T114 Update MULTI_COIN_ADDRESSES.md documentation with all 54 chains
- [ ] T115 Run final full test suite: `go test ./tests/... -v` (all 58+ tests must pass)

---

## Dependencies Between User Stories

```
Setup (Phase 1) → BLOCKS ALL
    ↓
Foundational (Phase 2) → BLOCKS ALL
    ↓
    ├─→ US1 (Layer 2) [P1] → Independent
    ├─→ US2 (Regional) [P2] → Independent
    ├─→ US3 (Cosmos) [P2] → Independent
    ├─→ US4 (Alternative EVM) [P3] → Independent
    └─→ US5 (Specialized) [P3] → Independent
         ↓
    All User Stories → Polish (Phase 8)
```

**Key Insights**:
- Phases 1 and 2 are **blocking** - must complete before any user story
- User Stories 1-5 are **independent** - can be implemented in parallel after foundational work
- Phase 8 (Polish) depends on **all** user stories completing

---

## Parallel Execution Opportunities

### After Phase 2 (Foundational), these user stories can run in parallel:

**Parallel Track A** (Layer 2 - P1):
- Tasks T018-T041 (US1) - 24 tasks, 3-5 days
- Team Member 1 can focus on Starknet formatter (complex)

**Parallel Track B** (Regional - P2):
- Tasks T042-T054 (US2) - 13 tasks, 1.5 days
- Team Member 2 can implement Harmony formatter + regional EVM chains

**Parallel Track C** (Cosmos - P2):
- Tasks T055-T070 (US3) - 16 tasks, 1.5 days
- Team Member 3 can extend Cosmos formatter for 4 IBC chains

**Parallel Track D** (Alternative EVM - P3):
- Tasks T071-T084 (US4) - 14 tasks, 1 day
- Team Member 4 can add 6 alternative EVM chains (simple registry additions)

**Parallel Track E** (Specialized - P3):
- Tasks T085-T109 (US5) - 22 tasks, 4-5 days
- Team Member 5 can implement 4 new formatters (Kusama, Tezos, Zilliqa, ICON)

**Estimated Parallel Timeline**:
- Phase 1 (Setup): 0.5 days (sequential)
- Phase 2 (Foundational): 1 day (sequential)
- **Phases 3-7 (User Stories): 5 days in parallel** (vs 13 days sequential)
- Phase 8 (Polish): 1 day (sequential after all stories)
- **Total with parallelization**: 7.5 days (vs 15 days sequential)

---

## Implementation Strategy

### MVP Scope (Minimum Viable Product)

**Recommended MVP**: User Story 1 (Layer 2) Only
- Tasks: T001-T041 (41 tasks total including setup/foundational)
- Chains: 36 total (30 existing + 6 Layer 2)
- Timeline: 5 days
- Value: Addresses most urgent user demand (Arbitrum, Optimism, Base are top requested chains)

**MVP Validation**:
- [ ] Wallet creation generates 36 chains in <10 seconds
- [ ] Starknet formatter works correctly (most complex new formatter)
- [ ] Layer 2 addresses display in dedicated category
- [ ] v0.2.0 wallets continue to work (backward compatibility)

### Incremental Delivery Plan

1. **Sprint 1 (MVP)**: US1 - Layer 2 (Tasks T001-T041) → Deploy v0.3.0-rc1
2. **Sprint 2**: US2 + US3 - Regional + Cosmos (Tasks T042-T070) → Deploy v0.3.0-rc2
3. **Sprint 3**: US4 + US5 - Alternative + Specialized (Tasks T071-T109) → Deploy v0.3.0-rc3
4. **Sprint 4**: Polish + Final Validation (Tasks T110-T115) → Deploy v0.3.0

---

## Testing Strategy

### Test Organization by Story

**User Story 1 (Layer 2)**:
- Unit tests: starknet_test.go (3 tests)
- Integration tests: TestPhase1_Layer2_6Chains, TestLayer2_PerformanceUnder3Seconds
- Contract tests: TestAddressFormat_Starknet

**User Story 2 (Regional)**:
- Unit tests: harmony_test.go (2 tests)
- Integration tests: TestPhase2_Regional_4Chains
- Contract tests: TestAddressFormat_Harmony

**User Story 3 (Cosmos)**:
- Unit tests: cosmos_test.go (5 tests for prefix variations)
- Integration tests: TestPhase2_Cosmos_4Chains
- Contract tests: TestAddressFormat_Cosmos (verify all prefixes)

**User Story 4 (Alternative EVM)**:
- Integration tests: TestPhase3_AlternativeEVM_6Chains
- Contract tests: Verify all use 0x Ethereum format

**User Story 5 (Specialized)**:
- Unit tests: kusama_test.go (3), tezos_test.go (2), zilliqa_test.go (2), icon_test.go (2)
- Integration tests: TestPhase3_Specialized_4Chains
- Contract tests: TestAddressFormat_Kusama, TestAddressFormat_Tezos, TestAddressFormat_Zilliqa, TestAddressFormat_ICON

**Cross-Story (Phase 8)**:
- Integration: TestAll54Chains_GenerateSuccessfully, TestPerformance_Under15Seconds, TestUpgrade_V02ToV03_Automatic, TestDeterminism_SameMnemonicSameAddresses

### Test Execution Commands

```bash
# Run tests for specific user story
go test ./tests/unit/starknet_test.go -v              # US1
go test ./tests/unit/harmony_test.go -v               # US2
go test ./tests/unit/cosmos_test.go -v                # US3
go test ./tests/unit/kusama_test.go -v                # US5
go test ./tests/unit/tezos_test.go -v                 # US5
go test ./tests/unit/zilliqa_test.go -v               # US5
go test ./tests/unit/icon_test.go -v                  # US5

# Run integration tests by phase
go test ./tests/integration/... -v -run TestPhase1    # US1
go test ./tests/integration/... -v -run TestPhase2    # US2+US3
go test ./tests/integration/... -v -run TestPhase3    # US4+US5

# Run all tests (final validation)
go test ./tests/... -v

# Run with coverage
go test ./tests/... -v -coverprofile=coverage.out
go tool cover -html=coverage.out
```

---

## Task Format Validation

✅ All tasks follow checklist format: `- [ ] [TaskID] [P?] [Story?] Description with file path`
✅ Task IDs are sequential (T001-T115)
✅ Parallelizable tasks marked with [P]
✅ User story tasks labeled with [US1]-[US5]
✅ Setup and Foundational tasks have NO story label
✅ File paths included in all implementation tasks

---

## Next Steps

1. **Review and approve this task breakdown**
2. **Select implementation approach**:
   - Sequential: Follow Phase 1 → Phase 8 in order (15 days)
   - Parallel: Assign user stories to team members (7.5 days)
   - MVP-first: Implement only US1 Layer 2 (5 days), iterate based on feedback
3. **Run `/speckit.implement` to begin execution** (processes tasks.md and executes based on user story structure)
4. **Track progress** using task checkboxes (mark `- [x]` when complete)
5. **Validate each user story independently** using "Independent Test" criteria before moving to next story

**Recommended**: Start with MVP (US1 only) to validate approach, then parallelize remaining stories.
