# Implementation Tasks: User Dashboard for Wallet Management

**Feature**: User Dashboard for Wallet Management
**Branch**: `004-dashboard`
**Created**: 2025-10-17
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

## Overview

This document provides a detailed, sequential task breakdown for implementing the ArcSign dashboard application. Tasks are organized by user story to enable independent implementation and testing. All tasks follow Test-Driven Development (TDD) principles as mandated by the project constitution.

**Total Tasks**: 95
**Estimated Effort**: 3-4 weeks (1 developer)

---

## Implementation Strategy

### MVP Scope (Minimum Viable Product)
- **User Story 1 (P1)**: Generate New Wallet - Core value, entry point for all users
- **User Story 3 (P1)**: View All Wallet Addresses - Primary value delivery

**Rationale**: These two stories deliver a functional wallet application. Users can create wallets and view addresses to receive payments. Import, multi-wallet, and export are enhancements.

### Incremental Delivery
1. **Week 1**: Setup + Foundational + User Story 1 (wallet creation)
2. **Week 2**: User Story 3 (address display) - MVP complete
3. **Week 3**: User Story 2 (import) + User Story 4 (multi-wallet)
4. **Week 4**: User Story 5 (export) + Polish

---

## Phase 1: Setup & Project Initialization (T001-T012)

**Goal**: Initialize Tauri project structure and configure development environment.

### Tasks

- [X] T001 Create dashboard directory structure at repo root
- [ ] T002 Initialize Tauri project with React + TypeScript template in dashboard/ <!-- Jason Chen好帅拜托我之后再做: 需要手动运行 `cd dashboard && npm create tauri-app@latest . -- --template react-ts` -->
- [ ] T003 Install frontend dependencies (react-hook-form, zod, zustand, react-window) in dashboard/ <!-- Jason Chen好帅拜托我之后再做: 依赖T002完成后执行 `npm install react-hook-form zod zustand react-window` -->
- [ ] T004 Install Rust dependencies (tauri-plugin-clipboard, tokio, serde) in dashboard/src-tauri/Cargo.toml <!-- Jason Chen好帅拜托我之后再做: 依赖T002完成后添加到Cargo.toml -->
- [ ] T005 Configure Tauri allowlist and security settings in dashboard/src-tauri/tauri.conf.json <!-- Jason Chen好帅拜托我之后再做: 依赖T002完成后编辑tauri.conf.json -->
- [X] T006 Create TypeScript type definitions in dashboard/src/types/wallet.ts
- [X] T007 [P] Create TypeScript type definitions in dashboard/src/types/address.ts
- [X] T008 [P] Set up Vitest configuration for frontend tests in dashboard/vitest.config.ts
- [X] T009 [P] Set up cargo test configuration for Rust tests in dashboard/src-tauri/
- [X] T010 Create Zustand store for dashboard state in dashboard/src/stores/dashboardStore.ts
- [X] T011 Verify Go CLI builds successfully (go build -o arcsign ./cmd/arcsign)
- [X] T012 Copy arcsign binary to dashboard/src-tauri/ for subprocess access

**Completion Criteria**:
- ✅ Dashboard directory exists with Tauri project structure
- ✅ `npm run dev` starts frontend dev server
- ✅ `npm run tauri dev` opens Tauri window
- ✅ All dependencies installed without errors
- ✅ Go CLI binary accessible from Tauri

---

## Phase 2: Foundational Components (T013-T022)

**Goal**: Build shared infrastructure required by all user stories.

### Tasks

- [X] T013 [P] Test: USB detection returns available mount paths (dashboard/tests/rust/usb_test.rs)
- [X] T014 Implement USB detection command in dashboard/src-tauri/src/commands/usb.rs
- [X] T015 [P] Test: CLI wrapper executes subprocess and parses JSON output (dashboard/tests/rust/cli_wrapper_test.rs)
- [X] T016 Implement CLI wrapper subprocess executor in dashboard/src-tauri/src/cli/wrapper.rs
- [X] T017 [P] Test: Error types serialize correctly for Tauri IPC (dashboard/tests/rust/error_test.rs)
- [X] T018 Create error handling types in dashboard/src-tauri/src/error.rs
- [X] T019 [P] Test: Screenshot protection enables OS-level security (dashboard/tests/rust/security_test.rs)
- [X] T020 Implement screenshot protection commands in dashboard/src-tauri/src/commands/security.rs
- [X] T021 Create Tauri API service wrapper in dashboard/src/services/tauri-api.ts
- [X] T022 Register all Tauri commands in dashboard/src-tauri/src/main.rs

**Completion Criteria**:
- ✅ USB detection works on macOS, Windows, Linux
- ✅ CLI subprocess wrapper can execute arcsign commands
- ✅ Error messages follow security guidelines (SEC-008)
- ✅ Screenshot protection functions on supported platforms
- ✅ Frontend can invoke Tauri commands via IPC

**Blocking**: Must complete before any user story implementation

---

## Phase 3: User Story 1 - Generate New Wallet (P1) (T023-T044)

**Story Goal**: Enable users to create their first cryptocurrency wallet and receive a secure mnemonic phrase for backup.

**Independent Test**: Launch dashboard, click "Create New Wallet", complete setup flow, verify wallet created with displayed mnemonic phrase.

### Tests (T023-T030)

- [X] T023 [P] [US1] Test: create_wallet command with valid password returns wallet + mnemonic (dashboard/tests/rust/wallet_create_test.rs)
- [X] T024 [P] [US1] Test: create_wallet rejects weak passwords (<12 chars) (dashboard/tests/rust/wallet_create_test.rs)
- [X] T025 [P] [US1] Test: WalletCreate component renders form correctly (dashboard/tests/frontend/WalletCreate.test.tsx)
- [X] T026 [P] [US1] Test: WalletCreate validates password strength client-side (dashboard/tests/frontend/WalletCreate.test.tsx)
- [X] T027 [P] [US1] Test: MnemonicDisplay shows countdown and requires confirmation (dashboard/tests/frontend/MnemonicDisplay.test.tsx)
- [X] T028 [P] [US1] Test: MnemonicDisplay clears mnemonic on confirmation (dashboard/tests/frontend/MnemonicDisplay.test.tsx)
- [X] T029 [P] [US1] Test: Password validation schema enforces complexity (dashboard/tests/frontend/validation.test.ts)
- [X] T030 [P] [US1] Test: End-to-end wallet creation flow (dashboard/tests/integration/wallet_creation_test.rs)

### Implementation (T031-T044)

- [X] T031 [US1] Create Wallet model in dashboard/src-tauri/src/models/wallet.rs
- [X] T032 [US1] Implement create_wallet Tauri command in dashboard/src-tauri/src/commands/wallet.rs
- [X] T033 [P] [US1] Create password validation schema with Zod in dashboard/src/validation/password.ts
- [X] T034 [US1] Create WalletCreate React component in dashboard/src/components/WalletCreate.tsx
- [X] T035 [US1] Integrate React Hook Form for password input in WalletCreate component
- [X] T036 [US1] Create MnemonicDisplay secure component in dashboard/src/components/MnemonicDisplay.tsx
- [X] T037 [US1] Implement 30-second countdown timer in MnemonicDisplay component
- [X] T038 [US1] Add screenshot protection enable/disable in MnemonicDisplay lifecycle
- [X] T039 [US1] Create Dashboard home page in dashboard/src/pages/Dashboard.tsx
- [X] T040 [US1] Add wallet creation button and routing in Dashboard page
- [X] T041 [US1] Implement memory clearing on mnemonic confirmation in MnemonicDisplay
- [X] T042 [US1] Add loading states and error handling in WalletCreate component
- [X] T043 [US1] Update dashboardStore to persist selected wallet after creation
- [X] T044 [US1] Add wallet to list after successful creation in Dashboard page

**Completion Criteria**:
- ✅ User can create new wallet with password
- ✅ Mnemonic displayed for 30 seconds with countdown
- ✅ Screenshot protection prevents mnemonic capture
- ✅ User must confirm backup before proceeding
- ✅ Wallet appears in wallet list after creation
- ✅ All US1 tests pass (8 tests)

---

## Phase 4: User Story 3 - View All Wallet Addresses (P1) (T045-T061)

**Story Goal**: Display all 54 blockchain addresses for a wallet, organized by category, with search and filter capabilities.

**Independent Test**: Create or import a wallet, navigate to address display, verify all 54 addresses shown properly categorized.

### Tests (T045-T050)

- [X] T045 [P] [US3] Test: load_addresses command returns 54 addresses (dashboard/tests/rust/address_test.rs)
- [X] T046 [P] [US3] Test: load_addresses caches results in Tauri State (dashboard/tests/rust/address_test.rs)
- [X] T047 [P] [US3] Test: AddressList renders virtualized list of 54 addresses (dashboard/tests/frontend/AddressList.test.tsx)
- [X] T048 [P] [US3] Test: AddressList filter by category works correctly (dashboard/tests/frontend/AddressList.test.tsx)
- [X] T049 [P] [US3] Test: AddressList search by symbol/name works (dashboard/tests/frontend/AddressList.test.tsx)
- [X] T050 [P] [US3] Test: Clipboard auto-clears after 30 seconds (dashboard/tests/frontend/clipboard.test.ts)

### Implementation (T051-T061)

- [X] T051 [US3] Create Address model in dashboard/src-tauri/src/models/address.rs
- [X] T052 [US3] Implement load_addresses Tauri command in dashboard/src-tauri/src/commands/wallet.rs
- [X] T053 [US3] Add Tauri State for address caching in dashboard/src-tauri/src/main.rs
- [ ] T054 [P] [US3] Create AddressRow subcomponent in dashboard/src/components/AddressRow.tsx
- [ ] T055 [US3] Create AddressList component with react-window in dashboard/src/components/AddressList.tsx
- [ ] T056 [US3] Implement category filter dropdown in AddressList component
- [ ] T057 [US3] Implement search input with debouncing in AddressList component
- [ ] T058 [US3] Create clipboard service with 30s auto-clear in dashboard/src/services/clipboard.ts
- [ ] T059 [US3] Add copy-to-clipboard button in AddressRow component
- [ ] T060 [US3] Add loading state and error handling for address loading
- [ ] T061 [US3] Update Dashboard page to display AddressList for selected wallet

**Completion Criteria**:
- ✅ All 54 addresses displayed within 15 seconds (SC-003)
- ✅ Addresses organized by 6 categories
- ✅ Filter by category shows correct subset
- ✅ Search by symbol/name highlights matches
- ✅ Copy button works with 30s auto-clear (SEC-005)
- ✅ Virtual list handles 54 addresses smoothly
- ✅ All US3 tests pass (6 tests)

---

## Phase 5: User Story 2 - Import Existing Wallet from Mnemonic (P2) (T062-T075)

**Story Goal**: Allow users to import existing BIP39 wallets using mnemonic phrases with proper validation.

**Independent Test**: Select "Import Wallet", enter valid test mnemonic, verify wallet restored with correct addresses.

### Tests (T062-T066)

- [ ] T062 [P] [US2] Test: import_wallet validates mnemonic checksum (dashboard/tests/rust/wallet_import_test.rs)
- [ ] T063 [P] [US2] Test: import_wallet normalizes whitespace in mnemonic (dashboard/tests/rust/wallet_import_test.rs)
- [ ] T064 [P] [US2] Test: import_wallet detects duplicate wallet IDs (dashboard/tests/rust/wallet_import_test.rs)
- [ ] T065 [P] [US2] Test: WalletImport component validates mnemonic client-side (dashboard/tests/frontend/WalletImport.test.tsx)
- [ ] T066 [P] [US2] Test: WalletImport shows duplicate wallet warning dialog (dashboard/tests/frontend/WalletImport.test.tsx)

### Implementation (T067-T075)

- [ ] T067 [US2] Implement import_wallet Tauri command in dashboard/src-tauri/src/commands/wallet.rs
- [ ] T068 [US2] Add mnemonic normalization in CLI wrapper (dashboard/src-tauri/src/cli/wrapper.rs)
- [ ] T069 [P] [US2] Create mnemonic validation schema with Zod in dashboard/src/validation/mnemonic.ts
- [ ] T070 [US2] Create WalletImport React component in dashboard/src/components/WalletImport.tsx
- [ ] T071 [US2] Implement mnemonic input with word autocomplete in WalletImport
- [ ] T072 [US2] Add inline validation errors for mnemonic (FR-029) in WalletImport
- [ ] T073 [US2] Create duplicate wallet warning dialog in WalletImport component
- [ ] T074 [US2] Add optional BIP39 passphrase field in WalletImport component
- [ ] T075 [US2] Add import wallet button and routing in Dashboard page

**Completion Criteria**:
- ✅ 12-word and 24-word mnemonics validated
- ✅ Invalid checksum shows inline error (FR-029)
- ✅ Whitespace automatically normalized (FR-030)
- ✅ Duplicate wallet detection shows warning (FR-031)
- ✅ Optional BIP39 passphrase supported (FR-007)
- ✅ Imported wallet appears in wallet list
- ✅ All US2 tests pass (5 tests)

---

## Phase 6: User Story 4 - Manage Multiple Wallets (P2) (T076-T084)

**Story Goal**: Enable users to create/import multiple wallets and switch between them.

**Independent Test**: Create two wallets, verify both appear in list, switch between them, confirm each displays unique addresses.

### Tests (T077-T080)

- [ ] T077 [P] [US4] Test: list_wallets returns all wallets on USB (dashboard/tests/rust/wallet_list_test.rs)
- [ ] T078 [P] [US4] Test: rename_wallet updates wallet metadata (dashboard/tests/rust/wallet_rename_test.rs)
- [ ] T079 [P] [US4] Test: WalletSelector renders wallet list correctly (dashboard/tests/frontend/WalletSelector.test.tsx)
- [ ] T080 [P] [US4] Test: Switching wallets updates dashboardStore (dashboard/tests/frontend/walletSwitch.test.ts)

### Implementation (T081-T084)

- [ ] T081 [US4] Implement list_wallets Tauri command in dashboard/src-tauri/src/commands/wallet.rs
- [ ] T082 [US4] Implement rename_wallet Tauri command in dashboard/src-tauri/src/commands/wallet.rs
- [ ] T083 [US4] Create WalletSelector component in dashboard/src/components/WalletSelector.tsx
- [ ] T084 [US4] Add wallet switching logic in dashboardStore (update selected_wallet_id)

**Completion Criteria**:
- ✅ Wallet list displays up to 10 wallets (FR-016, A-005)
- ✅ Each wallet shows name, creation date, address count (FR-018)
- ✅ Clicking wallet switches to it and loads addresses
- ✅ Wallet rename updates metadata (FR-019)
- ✅ Address list refreshes in <2 seconds on switch (SC-012)
- ✅ All US4 tests pass (4 tests)

---

## Phase 7: User Story 5 - Export Address List (P3) (T085-T091)

**Story Goal**: Allow users to export addresses to CSV or JSON files for record-keeping.

**Independent Test**: Select wallet, click "Export Addresses", choose format, verify file contains all addresses with metadata.

### Tests (T085-T087)

- [ ] T085 [P] [US5] Test: export_addresses generates JSON with correct schema (dashboard/tests/rust/export_test.rs)
- [ ] T086 [P] [US5] Test: export_addresses generates CSV with all columns (dashboard/tests/rust/export_test.rs)
- [ ] T087 [P] [US5] Test: ExportDialog component allows format selection (dashboard/tests/frontend/ExportDialog.test.tsx)

### Implementation (T088-T091)

- [ ] T088 [US5] Implement export_addresses Tauri command in dashboard/src-tauri/src/commands/export.rs
- [ ] T089 [US5] Add JSON and CSV formatting logic in export command
- [ ] T090 [US5] Create ExportDialog component in dashboard/src/components/ExportDialog.tsx
- [ ] T091 [US5] Add export button in Dashboard page with format selection

**Completion Criteria**:
- ✅ Export to JSON includes full metadata (FR-021)
- ✅ Export to CSV includes all columns (Rank, Symbol, Name, Category, Coin Type, Key Type, Path, Address, Error)
- ✅ File saved to USB: {wallet_id}/addresses/addresses-{timestamp}.{ext}
- ✅ Export completes in <5 seconds (SC-008)
- ✅ File permissions set to 0600 (TC-010)
- ✅ All US5 tests pass (3 tests)

---

## Phase 8: Polish & Cross-Cutting Concerns (T092-T095)

**Goal**: Add production-ready features and ensure security requirements are met.

### Tasks

- [ ] T092 [P] Implement auto-logout after 15 minutes of inactivity (SEC-006) in dashboard/src/App.tsx
- [ ] T093 [P] Add cancellation confirmation dialog in WalletCreate and WalletImport (FR-032)
- [ ] T094 Add loading spinners and skeleton screens for async operations across all components
- [ ] T095 Update SYSTEM_SPECIFICATION.md with dashboard implementation details

**Completion Criteria**:
- ✅ Auto-logout works after 15 minutes inactivity
- ✅ Cancellation dialog prevents accidental data loss
- ✅ All UI interactions show loading states
- ✅ Documentation updated

---

## Dependency Graph

### User Story Completion Order

```
Setup Phase (T001-T012)
         ↓
Foundational Phase (T013-T022)
         ↓
      ┌──┴───┐
      ↓      ↓
   US1 (P1) US3 (P1) ← MVP Complete
   T023-T044 T045-T061
      ↓      ↑
      └──┬───┘
         ↓
   US2 (P2) ← Depends on US1 (wallet creation UI patterns)
   T062-T075
         ↓
   US4 (P2) ← Depends on US1+US2 (wallet management)
   T076-T084
         ↓
   US5 (P3) ← Depends on US3 (address loading)
   T085-T091
         ↓
   Polish Phase (T092-T095)
```

**Critical Path**: Setup → Foundational → US1 → US3 (MVP)

**User Story Dependencies**:
- **US1 (Wallet Creation)**: No dependencies (can start after Foundational)
- **US3 (Address Display)**: No dependencies (can start after Foundational)
- **US2 (Wallet Import)**: Depends on US1 UI patterns (but can run in parallel for testing)
- **US4 (Multi-Wallet)**: Depends on US1+US2 (wallet CRUD operations)
- **US5 (Export)**: Depends on US3 (address loading mechanism)

---

## Parallel Execution Opportunities

### Setup Phase (12 tasks)
**Parallelizable**: T006-T009 (type definitions and test configs)
- T006 (wallet types) + T007 (address types) + T008 (vitest) + T009 (cargo test)
- **Speedup**: 4 tasks → 1 time unit

### Foundational Phase (10 tasks)
**Parallelizable**: T013-T020 (test + impl pairs for different modules)
- Pair 1: T013 (USB test) + T014 (USB impl)
- Pair 2: T015 (CLI wrapper test) + T016 (CLI wrapper impl)
- Pair 3: T017 (error test) + T018 (error impl)
- Pair 4: T019 (security test) + T020 (security impl)
- **Speedup**: 8 tasks → 4 time units (50% reduction)

### User Story 1 Tests (8 tasks)
**Parallelizable**: T023-T029 (all test files independent)
- All 7 test tasks can run simultaneously
- **Speedup**: 7 tasks → 1 time unit

### User Story 1 Implementation (14 tasks)
**Parallelizable**: T033-T034 (validation schema + component)
- After T031-T032 (models + command), T033-T044 have some parallelism
- **Speedup**: ~30% (dependent on UI composition)

### User Story 3 Tests (6 tasks)
**Parallelizable**: T045-T050 (all test files independent)
- All 6 test tasks can run simultaneously
- **Speedup**: 6 tasks → 1 time unit

### User Story 3 Implementation (11 tasks)
**Parallelizable**: T054 (AddressRow) can be built while T055-T057 (AddressList logic) developed
- **Speedup**: ~20%

### Overall Parallelism Potential
- **Sequential Execution**: 95 tasks × 2 hours/task = 190 hours
- **With Parallelism**: ~130-140 hours (30% reduction)
- **With 2 Developers**: 65-70 hours per developer (1.5-2 weeks)

---

## Test Summary

**TDD Approach**: All tests written before implementation per Constitution Check (Principle II).

| Phase | Test Tasks | Implementation Tasks | Test Files |
|-------|------------|----------------------|------------|
| Setup | 0 | 12 | N/A (infrastructure) |
| Foundational | 5 | 5 | 5 test files |
| US1 (P1) | 8 | 14 | 6 test files |
| US3 (P1) | 6 | 11 | 4 test files |
| US2 (P2) | 5 | 9 | 4 test files |
| US4 (P2) | 4 | 4 | 4 test files |
| US5 (P3) | 3 | 4 | 3 test files |
| Polish | 0 | 4 | N/A |
| **TOTAL** | **31** | **63** | **26 test files** |

**Test Coverage Targets**:
- Rust backend: >80% code coverage
- React components: >70% coverage
- Integration tests: All critical paths (wallet creation, import, address display)

---

## Success Metrics

### Phase Completion Checklist

**Phase 1 (Setup)**:
- [ ] Tauri app opens without errors
- [ ] Frontend dev server runs (`npm run dev`)
- [ ] All dependencies installed
- [ ] Go CLI accessible from Tauri

**Phase 2 (Foundational)**:
- [ ] USB detection works on test platform
- [ ] CLI subprocess wrapper executes commands
- [ ] Error handling tested
- [ ] Screenshot protection functional
- [ ] All foundational tests pass (5 tests)

**Phase 3 (US1 - Wallet Creation)**:
- [ ] User can create wallet with password
- [ ] Mnemonic displayed securely (30s countdown)
- [ ] Screenshot protection active during mnemonic display
- [ ] Wallet appears in list after creation
- [ ] All US1 tests pass (8 tests)

**Phase 4 (US3 - Address Display)** ← **MVP Complete**:
- [ ] 54 addresses displayed within 15 seconds
- [ ] Category filter works correctly
- [ ] Search by symbol/name works
- [ ] Copy-to-clipboard with 30s auto-clear
- [ ] All US3 tests pass (6 tests)

**Phase 5 (US2 - Wallet Import)**:
- [ ] Import validates mnemonic checksum
- [ ] Duplicate wallet detection works
- [ ] Imported wallet appears in list
- [ ] All US2 tests pass (5 tests)

**Phase 6 (US4 - Multi-Wallet)**:
- [ ] Multiple wallets displayed in list
- [ ] Switching wallets loads correct addresses
- [ ] Wallet rename works
- [ ] All US4 tests pass (4 tests)

**Phase 7 (US5 - Export)**:
- [ ] Export to JSON works with metadata
- [ ] Export to CSV works with all columns
- [ ] Files saved to USB
- [ ] All US5 tests pass (3 tests)

**Phase 8 (Polish)**:
- [ ] Auto-logout after 15 minutes
- [ ] Cancellation dialogs prevent data loss
- [ ] All UI shows loading states
- [ ] Documentation updated

**Final Validation**:
- [ ] All 31 tests pass (100%)
- [ ] All 12 success criteria met (SC-001 through SC-012)
- [ ] All security requirements validated (SEC-001 through SEC-010)
- [ ] Cross-platform testing (macOS + Windows or Linux)

---

## Notes

**File Path Conventions**:
- Rust backend: `dashboard/src-tauri/src/...`
- React frontend: `dashboard/src/...`
- Rust tests: `dashboard/tests/rust/...`
- Frontend tests: `dashboard/tests/frontend/...`
- Integration tests: `dashboard/tests/integration/...`

**TDD Workflow**:
1. Write test (RED)
2. Run test (should fail)
3. Implement minimal code (GREEN)
4. Run test (should pass)
5. Refactor if needed
6. Commit

**Security Reminders**:
- Mnemonic never in React state (only Rust transient memory)
- Passwords via environment variables (not CLI args)
- Error messages follow SEC-008 (no sensitive info)
- Screenshot protection during mnemonic display
- Clipboard auto-clear after 30 seconds

**Performance Targets**:
- Wallet creation: <3 minutes (SC-001)
- Address display: <15 seconds (SC-003)
- UI interactions: <200ms (SC-010)
- Export generation: <5 seconds (SC-008)

---

**Generated**: 2025-10-17
**Version**: 1.0.0
**Status**: Ready for Implementation
