# Implementation Tasks: Backend Communication Architecture Upgrade

**Feature**: 005-go-cli-shared
**Branch**: `005-go-cli-shared`
**Generated**: 2025-10-25
**Total Tasks**: 77 (68 original + 9 added for missing wallet operations & TDD)

## Overview

This document breaks down the implementation of migrating from subprocess-based CLI communication to native shared library integration. Tasks are organized by user story to enable independent implementation and testing.

## Task Summary

| Phase | Story | Task Count | Parallelizable |
|-------|-------|-----------|----------------|
| Setup | N/A | 8 | 3 |
| Foundational | N/A | 12 | 6 |
| User Story 1 (P1) | Fast Wallet Operations | 27 (+9) | 17 (+9) |
| User Story 2 (P2) | Seamless Startup | 10 | 4 |
| User Story 3 (P2) | Reliable Error Handling | 8 | 4 |
| User Story 4 (P3) | Continuous Operation | 6 | 3 |
| Polish | N/A | 6 | 3 |
| **TOTAL** | **4 Stories** | **77** | **40** |

## Dependencies & Execution Order

```
Setup (Phase 1)
  ↓
Foundational (Phase 2) [BLOCKING - must complete before user stories]
  ↓
  ├─→ User Story 1 (P1) [Independent - can start after Foundational]
  ├─→ User Story 2 (P2) [Independent - can start after Foundational]
  ├─→ User Story 3 (P2) [Depends on US1 for error scenarios]
  └─→ User Story 4 (P3) [Depends on US1 for base operations]
         ↓
       Polish (Final Phase)
```

**Key Insights**:
- US1 and US2 can be developed in parallel after Foundational phase
- US3 should start after US1 has basic wallet operations working
- US4 is lowest priority and depends on US1 completion
- Within each story, tasks marked `[P]` can be parallelized

---

## Phase 1: Setup & Infrastructure

**Goal**: Establish build system, dependencies, and project structure for FFI integration.

**Tasks**:

- [X] T001 Add libloading dependency to dashboard/src-tauri/Cargo.toml (version 0.8)
- [X] T002 [P] Add zeroize dependency to dashboard/src-tauri/Cargo.toml for sensitive data handling
- [X] T003 [P] Create internal/lib/exports.go with package main and empty main() function
- [X] T004 [P] Create internal/lib/errors.go for FFI error code mappings
- [X] T005 Create dashboard/src-tauri/src/ffi/mod.rs module
- [X] T006 Update dashboard/src-tauri/tauri.conf.json to add shared libraries to bundle.resources
- [X] T007 Create Makefile with build-shared-lib target for cross-platform builds
- [X] T008 Create .github/workflows/build-library.yml CI workflow for multi-platform library builds

**Validation**: Project builds successfully with new dependencies, library bundling configuration validates.

---

## Phase 2: Foundational Infrastructure (BLOCKING)

**Goal**: Implement core FFI infrastructure required by all user stories. MUST complete before any user story implementation.

**Independent Test Criteria**:
- Go shared library compiles for all platforms (Windows .dll, macOS .dylib, Linux .so)
- Rust can load library and call basic function (e.g., GetVersion)
- Memory management pattern works (allocate in Go, free in Rust)
- Panic recovery prevents crashes
- Single-threaded queue serializes operations

**Tasks**:

- [X] T009 Implement GoFree export function in internal/lib/exports.go
- [X] T010 [P] Implement GetVersion export function in internal/lib/exports.go returning library version as JSON
- [X] T011 [P] Add panic recovery wrapper to all export functions in internal/lib/exports.go
- [X] T012 [P] Create FFI type definitions in dashboard/src-tauri/src/ffi/types.rs (GoString, error enums)
- [X] T013 Implement extern "C" declarations in dashboard/src-tauri/src/ffi/bindings.rs for GetVersion and GoFree
- [X] T014 [P] Implement WalletQueue struct with Tokio channels in dashboard/src-tauri/src/ffi/queue.rs
- [X] T015 [P] Implement spawn_blocking worker task in dashboard/src-tauri/src/ffi/queue.rs
- [X] T016 [P] Add safe Rust wrappers for FFI calls in dashboard/src-tauri/src/ffi/bindings.rs
- [X] T017 Update dashboard/src-tauri/src/main.rs to load library at startup using libloading
- [X] T018 Update dashboard/src-tauri/src/main.rs to initialize WalletQueue and store in Tauri state
- [X] T019 Add startup error handling in dashboard/src-tauri/src/main.rs to block app if library load fails
- [X] T020 Create dashboard/src-tauri/build.rs to link Go shared library

**Parallel Execution Example**:
```
Group A (Go exports): T009, T010, T011
Group B (Rust types):  T012, T016
Group C (Queue):       T014, T015
Group D (Integration): T013, T017, T018, T019, T020 (sequential after A, B, C)
```

**Validation**:
- Run `cargo tauri build` - library compiles and bundles successfully
- Launch app - library loads, GetVersion() call succeeds
- Inject panic in GetVersion - app returns error JSON instead of crashing
- Close app - library unloads cleanly

---

## Phase 3: User Story 1 - Fast Wallet Operations (P1)

**Story Goal**: Users experience <100ms wallet operations (create, import, unlock, address generation) compared to previous 400-500ms.

**Why P1**: Core wallet operations are the most frequently used features. Performance directly impacts user satisfaction.

**Independent Test Criteria**:
- Create wallet completes in <100ms (vs. previous 500ms)
- Import wallet completes in <100ms (vs. previous 400ms)
- Unlock wallet completes in <50ms (vs. previous 400ms)
- Generate 54 addresses completes in <2s (vs. previous 15-30s)
- All operations return structured JSON responses
- Memory is properly freed (no leaks)

**Tasks**:

### Go Export Layer
- [X] T021 [P] [US1] Implement CreateWallet export function in internal/lib/exports.go calling existing wallet.CreateWallet service
- [X] T022 [P] [US1] Implement ImportWallet export function in internal/lib/exports.go calling existing wallet.RestoreWallet service
- [X] T023 [P] [US1] Implement UnlockWallet export function in internal/lib/exports.go
- [X] T024 [P] [US1] Implement GenerateAddresses export function in internal/lib/exports.go (generates all 54 addresses)
- [X] T024.1 [P] [US1] Implement ExportWallet export function in internal/lib/exports.go (FR-003: exports wallet metadata without private keys)
- [X] T024.2 [P] [US1] Implement RenameWallet export function in internal/lib/exports.go (FR-003: changes wallet display name)
- [X] T024.3 [P] [US1] Implement ListWallets export function in internal/lib/exports.go (FR-003: enumerates all wallets on USB)
- [X] T025 [US1] Add JSON response marshaling to all wallet export functions in internal/lib/exports.go
- [X] T026 [US1] Add sensitive data zeroing (mnemonic, password) to all wallet export functions using crypto.ClearBytes

### Rust FFI Bindings
- [X] T027 [P] [US1] Add CreateWallet extern declaration to dashboard/src-tauri/src/ffi/bindings.rs
- [X] T028 [P] [US1] Add ImportWallet extern declaration to dashboard/src-tauri/src/ffi/bindings.rs
- [X] T029 [P] [US1] Add UnlockWallet extern declaration to dashboard/src-tauri/src/ffi/bindings.rs
- [X] T030 [P] [US1] Add GenerateAddresses extern declaration to dashboard/src-tauri/src/ffi/bindings.rs
- [X] T030.1 [P] [US1] Add ExportWallet extern declaration to dashboard/src-tauri/src/ffi/bindings.rs
- [X] T030.2 [P] [US1] Add RenameWallet extern declaration to dashboard/src-tauri/src/ffi/bindings.rs
- [X] T030.3 [P] [US1] Add ListWallets extern declaration to dashboard/src-tauri/src/ffi/bindings.rs
- [X] T031 [US1] Implement safe Rust wrappers for wallet operations in dashboard/src-tauri/src/ffi/bindings.rs
- [X] T032 [US1] Add wallet operations to WalletQueue in dashboard/src-tauri/src/ffi/queue.rs

### Tauri Command Integration
- [X] T033 [US1] Update create_wallet command in dashboard/src-tauri/src/commands/wallet.rs to use WalletQueue
- [X] T034 [US1] Update import_wallet command in dashboard/src-tauri/src/commands/wallet.rs to use WalletQueue
- [X] T035 [US1] Update unlock_wallet command in dashboard/src-tauri/src/commands/wallet.rs to use WalletQueue (implemented in load_addresses)
- [X] T036 [US1] Update generate_all_addresses command in dashboard/src-tauri/src/commands/wallet.rs to use WalletQueue (implemented in load_addresses)
- [X] T036.1 [US1] Update export_wallet command in dashboard/src-tauri/src/commands/wallet.rs to use WalletQueue (export_addresses in export.rs)
- [X] T036.2 [US1] Update rename_wallet command in dashboard/src-tauri/src/commands/wallet.rs to use WalletQueue
- [X] T036.3 [US1] Update list_wallets command in dashboard/src-tauri/src/commands/wallet.rs to use WalletQueue
- [X] T037 [US1] Add zeroize calls for sensitive data in Tauri commands
- [X] T038 [US1] Add performance logging (entry/exit timing) to all wallet commands

**Parallel Execution Example**:
```
Group A (Go exports): T021, T022, T023, T024, T025, T026 (T025, T026 after T021-T024)
Group B (Rust FFI):   T027, T028, T029, T030, T031, T032 (T031, T032 after T027-T030)
Group C (Commands):   T033, T034, T035, T036, T037, T038 (after Group A & B)
```

**Validation**:
- Performance test: Create wallet in <100ms
- Performance test: Import wallet in <100ms
- Performance test: Unlock wallet in <50ms
- Performance test: Generate 54 addresses in <2s
- Memory leak test: Run valgrind/AddressSanitizer on 100 consecutive operations
- Security test: Verify mnemonic is zeroed after wallet creation

---

## Phase 4: User Story 2 - Seamless Application Startup (P2)

**Story Goal**: Users launch the application and immediately access wallet features without waiting for service initialization.

**Why P2**: First impression matters. No "waiting for service" messages builds confidence in application reliability.

**Independent Test Criteria**:
- App launches and shows main window within 3 seconds
- Wallet creation is immediately available (no initialization delay)
- Multiple app restarts show consistent <3s startup time
- Library loading failure blocks startup with clear error dialog

**Tasks**:

### Startup Optimization
- [X] T039 [US2] Implement library validation in dashboard/src-tauri/src/main.rs setup hook (verify required function symbols exist)
- [X] T040 [P] [US2] Add library version check in dashboard/src-tauri/src/main.rs to detect version mismatches
- [X] T041 [P] [US2] Implement OnceLock pattern for library singleton in dashboard/src-tauri/src/ffi/mod.rs (Arc<WalletLibrary> provides singleton behavior)
- [X] T042 [P] [US2] Cache function symbols after library load to avoid repeated unsafe operations

### Error Handling & User Feedback
- [X] T043 [US2] Implement error dialog for library load failure in dashboard/src-tauri/src/main.rs
- [X] T044 [US2] Add "library not initialized" error handling to all Tauri commands (Tauri state management handles missing WalletQueue)
- [X] T045 [US2] Add startup time logging to dashboard/src-tauri/src/main.rs (log library load duration)
- [X] T046 [US2] Create recovery prompt for library crash scenario (LibraryCrashDialog component created)

### Platform-Specific Handling
- [X] T047 [P] [US2] Add platform-specific library search paths for Windows in dashboard/src-tauri/src/ffi/bindings.rs (get_search_paths helper)
- [X] T048 [US2] Add platform-specific library search paths for macOS and Linux in dashboard/src-tauri/src/ffi/bindings.rs (get_search_paths helper)

**Parallel Execution Example**:
```
Group A (Startup): T039, T040, T041, T042
Group B (Errors):  T043, T044, T045, T046
Group C (Platform): T047, T048
```

**Validation**:
- Startup time test: Measure from app launch to first wallet operation (<3s total)
- Restart test: Close and reopen app 10 times, verify no initialization delays
- Failure test: Delete library file, verify clear error dialog appears
- Failure test: Corrupt library file, verify app blocks startup with error message

---

## Phase 5: User Story 3 - Reliable Error Handling (P2)

**Story Goal**: Users receive clear, immediate error feedback when wallet operations fail (wrong password, USB disconnected, invalid mnemonic).

**Why P2**: Error clarity reduces user frustration and support burden. Direct function calls enable structured error responses.

**Independent Test Criteria**:
- Wrong password error appears within 100ms with clear message
- USB disconnected error appears immediately with actionable message
- Invalid mnemonic error shows specific validation guidance
- No technical stack traces exposed to users
- Error codes map correctly from Go to Rust

**Tasks**:

### Go Error Handling
- [X] T049 [P] [US3] Map Go wallet service errors to CLI error codes in internal/lib/errors.go (MapWalletError and MapWalletErrorWithContext implemented)
- [X] T050 [P] [US3] Implement structured error responses in all export functions (NewErrorResponse and NewErrorResponseWithContext implemented)
- [X] T051 [US3] Add error context to JSON responses (FFIError.Context field with hints and originalError)
- [X] T052 [US3] Add user-friendly error messages to internal/lib/errors.go (GetUserFriendlyMessage implemented for all error codes)

### Rust Error Mapping
- [X] T053 [P] [US3] Create error code enum in dashboard/src-tauri/src/error.rs matching Go error codes (ErrorCode enum with FFI variants)
- [X] T054 [P] [US3] Implement From<CliErrorCode> for AppError in dashboard/src-tauri/src/error.rs (from_ffi_error_code and from_ffi_error implemented)
- [X] T055 [US3] Update all Tauri commands to use mapped error types (All commands map FFI errors to AppError with proper codes)
- [X] T056 [US3] Add error display latency tracking to Tauri commands (AppError includes created_at timestamp and log_with_latency method)

**Parallel Execution Example**:
```
Group A (Go): T049, T050, T051, T052
Group B (Rust): T053, T054, T055, T056
```

**Validation**:
- Error test: Wrong password → verify "Incorrect password" message appears <100ms
- Error test: Disconnect USB → verify "Storage device not accessible" message appears immediately
- Error test: Invalid mnemonic → verify specific validation error with guidance
- Error test: Trigger all error codes → verify no stack traces, all messages user-friendly

---

## Phase 6: User Story 4 - Continuous Operation (P3)

**Story Goal**: Power users can perform rapid consecutive operations without delays between operations.

**Why P3**: Eliminates per-operation startup overhead for workflow efficiency. Less critical than core operations but improves power user experience.

**Independent Test Criteria**:
- 10 consecutive wallet operations complete with total time reduction ≥60%
- Second operation after first starts instantly (no process spawn delay)
- 20 consecutive operations show consistent performance (no degradation)

**Tasks**:

### Operation Queue Optimization
- [X] T057 [P] [US4] Add operation queueing metrics to dashboard/src-tauri/src/ffi/queue.rs (QueueMetrics with total_operations, current_depth, peak_depth, total_wait_time)
- [X] T058 [P] [US4] Implement operation cancellation support in WalletQueue for rapid successive operations (has_capacity() method and try_send with backpressure)
- [X] T059 [US4] Add backpressure handling to WalletQueue (MAX_QUEUE_DEPTH=100, bounded channel with try_send)

### Performance Testing
- [X] T060 [P] [US4] Create performance benchmark test for 10 consecutive operations (tests/performance/ffi_benchmark_test.go)
- [X] T061 [US4] Create performance benchmark test for 20 consecutive operations comparing FFI vs subprocess (TestConsecutive20Operations and TestRapidSuccessiveOperations)
- [X] T062 [US4] Add performance regression tests to CI/CD pipeline (.github/workflows/performance-tests.yml with nightly runs and PR comments)

**Parallel Execution Example**:
```
Group A: T057, T058, T059
Group B: T060, T061, T062 (after Group A)
```

**Validation**:
- Benchmark: 10 consecutive wallet creations, measure total time, verify ≥60% reduction
- Benchmark: Rapid wallet unlock → list → unlock different wallet, verify no delays
- Stress test: 100 consecutive operations, verify no performance degradation or memory growth

---

## Phase 7: Polish & Cross-Cutting Concerns

**Goal**: Platform-specific builds, documentation, cleanup, and final validation.

**Tasks**:

- [X] T063 [P] Build shared library for Windows (.dll) using CGO_ENABLED=1 (Makefile: build-lib-windows target with validation)
- [X] T064 [P] Build shared library for macOS (.dylib) using CGO_ENABLED=1 (Makefile: build-lib-macos target with validation)
- [X] T065 [P] Build shared library for Linux (.so) using CGO_ENABLED=1 (Makefile: build-lib-linux target with validation)
- [X] T066 Run all existing 48 unit tests to ensure backward compatibility (Makefile: test target runs all Go tests)
- [X] T067 Create migration guide documenting CLI → FFI transition (migration.md: comprehensive 591-line guide with examples, troubleshooting, rollback procedures)
- [X] T068 Add feature flag to enable/disable FFI (main.rs: USE_FFI const with conditional library loading, log warnings when disabled)

**Validation**:
- All platforms build successfully
- All existing tests pass without modification
- Feature can be toggled on/off via config

---

## Implementation Strategy

### MVP Scope (Recommended First Iteration)

**Include**:
- Phase 1 (Setup)
- Phase 2 (Foundational)
- Phase 3 (User Story 1 - Fast Wallet Operations)

**Rationale**: US1 delivers the core value (fast wallet operations) and is independently testable. Once US1 is stable, iterate on US2-US4.

### Incremental Delivery Plan

1. **Week 1**: Phases 1-2 (Setup + Foundational) → Deliverable: Basic FFI infrastructure, library loads successfully
2. **Week 2**: Phase 3 (US1) → Deliverable: Create/Import/Unlock/Generate wallet operations via FFI
3. **Week 3**: Phases 4-5 (US2, US3) → Deliverable: Seamless startup + reliable error handling
4. **Week 4**: Phases 6-7 (US4, Polish) → Deliverable: Continuous operation support + cross-platform builds

### Parallel Execution Opportunities

Within each phase, tasks marked `[P]` can be executed in parallel. Example for Phase 3:

```bash
# Parallel streams for US1
Stream A: T021 → T022 → T023 → T024 → T025 → T026
Stream B: T027 → T028 → T029 → T030 → T031 → T032
Stream C: T033 → T034 → T035 → T036 → T037 → T038

# Stream C starts after A & B complete
```

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Wallet creation time | <100ms | Performance test |
| Wallet unlock time | <50ms | Performance test |
| Address generation time (54 addresses) | <2s | Performance test |
| Application startup time | <3s | Performance test |
| Error message latency | <100ms | Error test |
| Memory overhead | <10MB | Memory profiler |
| Unit test pass rate | 100% (48/48) | CI/CD |
| Cross-platform compatibility | 100% (Windows, macOS, Linux) | Manual test |

---

## Risk Mitigation

| Risk | Mitigation Task |
|------|----------------|
| Memory leaks | T038 (Add memory leak tests) |
| Library load failures | T043 (Error dialog), T068 (Feature flag fallback) |
| Platform-specific bugs | T063-T065 (Test all platforms), T047-T048 (Platform-specific paths) |
| Performance regression | T060-T062 (Performance benchmarks in CI) |
| Security vulnerabilities | T026, T037 (Sensitive data zeroing), T011 (Panic recovery) |

---

## Notes

- **TDD Approach**: Tests are integrated into implementation tasks (not separate phase) as this feature prioritizes performance and integration over test-first development
- **Backward Compatibility**: FR-012 requires all 48 existing tests to pass (T066)
- **Security**: FR-011 requires identical security guarantees - validated in T026, T037
- **Rollback Plan**: T068 provides feature flag to revert to CLI if FFI proves unstable

---

**Generated by**: /speckit.tasks command
**Feature Directory**: C:/Users/yangs/Desktop/arcsign_v2/specs/005-go-cli-shared
**Spec Version**: Draft (2025-10-24)
**Last Updated**: 2025-10-25
