# Implementation Plan: Backend Communication Architecture Upgrade

**Branch**: `005-go-cli-shared` | **Date**: 2025-10-25 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/005-go-cli-shared/spec.md`

## Summary

Migrate desktop application's backend communication from subprocess-based CLI to native Go shared library integration via FFI (Foreign Function Interface). This eliminates process spawn overhead, achieving 5-10x performance improvements for wallet operations (target: <100ms wallet creation, <2s for 54 address generation). Uses JSON-over-FFI pattern with libloading (Rust) and CGO (Go) for cross-platform compatibility. Aligns with industry standards from Ledger Live and Trezor Suite architectures.

**Key Technical Decisions** (from [research.md](./research.md)):
1. **Library Loading**: libloading crate for memory-safe dynamic loading (Decision 1)
2. **Memory Management**: JSON string return pattern with explicit Go-allocates + GoFree ownership transfer (Decision 2)
3. **Error Handling**: Structured JSON responses with panic recovery (Decision 3)
4. **Thread Safety**: Single-threaded FFI execution queue using Tokio channels (Decision 4)
5. **Cross-Platform**: Native compilation per platform via CI/CD build matrix (Decision 5)

## Technical Context

**Language/Version**:
- Go 1.21+ (backend shared library, `-buildmode=c-shared`)
- Rust 1.75+ (Tauri backend FFI wrapper)
- TypeScript 5.0+ (Tauri frontend, unchanged)

**Primary Dependencies**:
- **Go**: Existing wallet libraries (BIP39, BIP44, Argon2id, AES-256-GCM)
- **Rust**: libloading 0.8 (dynamic library loading), serde_json 1.0 (JSON parsing), zeroize (secure memory)
- **Build**: CGO enabled (`CGO_ENABLED=1`), GCC/Clang for C compilation

**Storage**: USB-only JSON files (unchanged from current implementation)

**Testing**:
- Go: `go test` for FFI export unit tests
- Rust: `cargo test` for contract/integration tests
- Manual: Tauri dev mode for end-to-end validation

**Target Platform**:
- Windows 10+ (x86_64-pc-windows-msvc, libarcsign.dll)
- macOS 11+ (x86_64/aarch64-apple-darwin, libarcsign.dylib)
- Linux Ubuntu 20.04+ (x86_64-unknown-linux-gnu, libarcsign.so)

**Project Type**: Desktop application (Tauri) with Go backend library

**Performance Goals**:
- Wallet creation: <100ms (FR-005, 5x improvement from 500ms baseline)
- Wallet unlock: <50ms (US1 acceptance, 8x improvement from 400ms)
- 54 address generation: <2s (FR-006, 7-15x improvement from 15-30s)
- Application startup: <3s total with no service initialization delay (SC-003)
- Error feedback: <100ms from occurrence (SC-004)

**Constraints**:
- Zero memory increase (±10MB tolerance, SC-005)
- Maintain 100% behavioral compatibility (FR-003, SC-006, SC-007)
- Security guarantees identical to current implementation (FR-011)
- Support all existing platforms without behavioral differences (SC-008)

**Scale/Scope**:
- 9 FFI export functions (GetVersion, CreateWallet, ImportWallet, UnlockWallet, GenerateAddresses, ExportWallet, RenameWallet, ListWallets, GoFree)
- 7 wallet operations migrated from CLI to FFI
- 48 existing unit tests must pass unchanged (SC-007)
- Manual test checklist fully compatible (SC-006)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### ✅ I. Security-First Development (NON-NEGOTIABLE)

- [x] **Private Keys Protection**: Keys remain in USB secure zone, never cross FFI boundary (maintained from current impl)
- [x] **Encryption**: Argon2id + AES-256-GCM maintained (no changes to crypto stack, FR-011)
- [x] **Multi-Factor Auth**: Application password + Wallet password enforced (unchanged)
- [x] **API Isolation**: N/A (this feature does not involve external APIs)
- [x] **Logging Security**: FR-014 mandates entry/exit timing only, explicitly excludes passwords/mnemonics
- [x] **Secret Storage**: Environment variables/OS Secret Store (unchanged)

**Justification**: FFI migration is an internal architecture change that preserves all existing security boundaries. Sensitive data (mnemonics, passwords) still encrypted immediately after crossing FFI boundary using same algorithms. Added security: `zeroize` crate in Rust + secure memory zeroing in Go reduce sensitive data lifetime compared to subprocess text parsing.

### ✅ II. Test-Driven Development (NON-NEGOTIABLE)

- [x] **Red-Green-Refactor**: Required by spec, enforced in tasks.md (see "TDD Compliance" below)
- [x] **Test Coverage**: Unit (Go exports) + Integration (Rust FFI) + Contract (end-to-end) tests (Phase 3)
- [x] **Security Tests**: Memory leak detection (Valgrind/LeakSanitizer), panic recovery tests, sensitive data zeroing verification
- [x] **Pre-Commit Tests**: SC-007 mandates all 48 existing tests pass; new FFI tests added to CI pipeline

**TDD Compliance**: Each implementation task (T021-T063) MUST be preceded by test task. Example pattern:
- T021.0: Write test for CreateWallet export (Red - fails because function doesn't exist)
- T021: Implement CreateWallet export (Green - minimal implementation passes test)
- T021.1: Refactor CreateWallet with logging, panic recovery (Refactor - tests still pass)

### ✅ III. Incremental Progress Over Big Bangs

- [x] **Phased Implementation**: 7 phases in tasks.md (Setup → Foundational → US1-US4 → Polish → Testing)
- [x] **Compilable Units**: Each phase deliverable is buildable and testable independently
- [x] **Revertibility**: Git branch `005-go-cli-shared` allows rollback; feature flag for CLI vs FFI runtime selection (Phase 7)
- [x] **3-Attempt Rule**: Documented in research.md (e.g., considered 3 memory management patterns, selected JSON-over-FFI)

**Phase Breakdown**:
1. **Phase 1** (T001-T008): Dependencies, buildable but no FFI functions
2. **Phase 2** (T009-T020): Core FFI infrastructure, testable with GetVersion/GoFree
3. **Phase 3** (T021-T038): US1 wallet operations, independently testable
4. **Phases 4-6** (T039-T063): US2-US4 features, each independently verifiable
5. **Phase 7** (T064-T068): Performance testing, backward compatibility verification

### ✅ IV. Composition Over Inheritance

- [x] **Interfaces**: Rust WalletLibrary struct with trait-based design; Go exports use interface-based wallet service
- [x] **Single Responsibility**: Each FFI function has one purpose (e.g., CreateWallet only creates, doesn't unlock)
- [x] **Avoid Over-Abstraction**: JSON-over-FFI pattern is explicit and debuggable (rejected complex struct-passing patterns)

**Architecture**:
- Rust `WalletLibrary` struct composes `Library` (from libloading) without inheritance
- Go exports are functions (not methods), composition via function pointers cached in Rust
- Dependency injection: Tauri `State<WalletLibrary>` injected into commands

### ✅ V. Documentation-Driven Development

- [x] **API Contracts**: [data-model.md](./data-model.md) defines all FFI schemas before implementation
- [x] **C Declarations**: [contracts/ffi-api.md](./contracts/ffi-api.md) specifies exact function signatures
- [x] **Quickstart**: [quickstart.md](./quickstart.md) documents build, test, and debug workflows
- [x] **Architectural Decisions**: [research.md](./research.md) justifies all technical choices with alternatives considered

**Single Source of Truth**: This plan.md + spec.md form the contract for implementation. All tasks in tasks.md reference these documents.

---

## Project Structure

### Documentation (this feature)

```
specs/005-go-cli-shared/
├── plan.md              # This file (Phase 0 output)
├── spec.md              # Feature specification (input)
├── research.md          # Phase 0 output (technical decisions)
├── data-model.md        # Phase 1 output (FFI schemas) ✅ COMPLETE
├── contracts/ffi-api.md # Phase 1 output (C declarations) ✅ COMPLETE
├── quickstart.md        # Phase 1 output (dev guide) ✅ COMPLETE
└── tasks.md             # Phase 2 output (68 implementation tasks) ✅ COMPLETE
```

### Source Code (repository root)

**Selected Structure**: Tauri desktop application (existing structure extended)

```
arcsign_v2/
├── internal/
│   └── lib/
│       ├── exports.go           # NEW: FFI export functions (T009-T024)
│       └── exports_test.go      # NEW: Go unit tests for exports
│
├── dashboard/
│   ├── src/                     # TypeScript frontend (unchanged)
│   └── src-tauri/
│       ├── src/
│       │   ├── commands/        # Existing Tauri commands (MODIFY: T025-T037)
│       │   ├── lib/
│       │   │   ├── wallet.rs           # NEW: Rust FFI wrapper (T011-T015)
│       │   │   └── wallet_test.rs      # NEW: Contract tests
│       │   ├── services/        # Existing services (MODIFY: T025-T037)
│       │   └── main.rs          # MODIFY: Load library at startup (T016-T020)
│       ├── Cargo.toml           # MODIFY: Add libloading, zeroize deps (T001-T002)
│       └── libarcsign.{dll,dylib,so}  # Bundled Go library (CI/CD output)
│
└── tests/                       # Existing tests (MUST PASS: SC-007)
```

**Structure Decision**:

This is a **desktop application** feature modifying existing Tauri architecture. We extend (not replace) the current structure:

1. **Go Side** (`internal/lib/`): New exports.go file contains FFI functions. Existing wallet logic in `internal/wallet/` is reused unchanged.

2. **Rust Side** (`dashboard/src-tauri/src/lib/`): New wallet.rs module wraps libloading. Existing services in `dashboard/src-tauri/src/services/` are refactored to call FFI instead of spawning subprocess.

3. **Frontend** (`dashboard/src/`): Zero changes required. TypeScript still calls same Tauri commands; only backend implementation changes.

**Why Not Option 1 (Single Project)**: This is not a pure backend project; it's a Tauri desktop app with separate frontend/backend concerns.

**Why Not Option 3 (Mobile + API)**: This is desktop-only (Windows/macOS/Linux), not mobile.

**Rationale for Chosen Structure**: Minimizes file changes. Existing tests remain valid because public APIs (Tauri commands) unchanged. Only internal implementation (subprocess → FFI) modified.

---

## Complexity Tracking

*This section is intentionally left empty - no constitutional violations require justification.*

All constitutional principles are satisfied without compromise:
- Security-First: Maintained
- TDD: Enforced via test tasks
- Incremental Progress: 7-phase breakdown
- Composition: Struct-based design, no inheritance
- Documentation-Driven: Complete Phase 1 artifacts before implementation

---

## Implementation Phases

### Phase 0: Research & Planning ✅ COMPLETE

**Outputs**:
- [research.md](./research.md): 5 technical decisions documented
- [plan.md](./plan.md): This file (technical context, constitution check, structure)
- [data-model.md](./data-model.md): 9 FFI function schemas
- [contracts/ffi-api.md](./contracts/ffi-api.md): C-compatible declarations, memory patterns
- [quickstart.md](./quickstart.md): Build/test/debug instructions

**Status**: All Phase 0 artifacts complete. Ready for Phase 1 (Setup tasks).

---

### Phase 1: Setup & Infrastructure (T001-T008)

**Goal**: Install dependencies, verify build environment

**Deliverable**: `cargo build` succeeds with libloading, Go library compiles with `-buildmode=c-shared`

**Dependencies**: None (foundational)

**Tasks**:
- T001: Add libloading 0.8 to Cargo.toml
- T002: Add zeroize for secure memory
- T003-T004: Verify CGO_ENABLED=1, test Go c-shared build
- T005-T008: Platform verification (Windows DLL, macOS dylib, Linux SO)

**Exit Criteria**:
- [ ] `CGO_ENABLED=1 go build -buildmode=c-shared` succeeds on all platforms
- [ ] `cargo build` in dashboard/src-tauri succeeds with new dependencies
- [ ] No compile errors

---

### Phase 2: Foundational Infrastructure (T009-T020) 🔒 BLOCKING

**Goal**: Implement core FFI plumbing (library loading, memory management, error handling)

**Deliverable**: Rust can load Go library, call GetVersion, and free memory without leaks

**Dependencies**: Phase 1 complete

**Tasks**:
- T009-T010: Implement GoFree and GetVersion exports (simplest FFI functions)
- T011-T015: Implement Rust WalletLibrary with libloading (load once at startup)
- T016-T020: Integrate into Tauri app.rs, implement startup error handling (FR-007)

**Exit Criteria**:
- [ ] GetVersion returns JSON {"success":true,"data":{"version":"0.2.0"}}
- [ ] GoFree called for every FFI return value
- [ ] Valgrind shows zero memory leaks in 100 consecutive GetVersion calls
- [ ] Application blocks startup with error dialog if library load fails

---

### Phase 3: User Story 1 - Fast Wallet Operations (T021-T038)

**Goal**: Migrate CreateWallet, ImportWallet, UnlockWallet, GenerateAddresses to FFI

**Deliverable**: US1 acceptance scenarios pass (<100ms create, <50ms unlock, <2s for 54 addresses)

**Dependencies**: Phase 2 complete (library loading infrastructure)

**Tasks**:
- T021-T024: Implement 4 Go exports (CreateWallet, ImportWallet, UnlockWallet, GenerateAddresses)
- T024.1-T024.3: **NEW** Add missing wallet operations (ExportWallet, RenameWallet, ListWallets) to satisfy FR-003
- T025-T030: Implement Rust FFI wrappers for each function
- T031-T037: Update Tauri commands to call FFI instead of subprocess
- T038: Write contract tests verifying end-to-end workflow

**Exit Criteria** (US1 Acceptance Scenarios):
- [ ] Wallet creation completes in <100ms (measure with logging timestamps)
- [ ] Wallet unlock completes in <50ms
- [ ] 54 address generation completes in <2s
- [ ] Wallet import completes in <100ms
- [ ] All operations return identical JSON structure to current CLI output

---

### Phase 4-6: User Stories 2-4 (T039-T063)

**Goal**: Implement startup optimization (US2), error handling improvements (US3), continuous operation efficiency (US4)

**Deliverable**: All user stories satisfied

**Dependencies**: Phase 3 complete

**Tasks Overview**:
- US2 (T039-T046): Remove service initialization delays, verify instant availability
- US3 (T047-T054): Structured error responses, clear error messages, <100ms error display
- US4 (T055-T063): Consecutive operation optimization, measure 60% time reduction for 20 ops

**Exit Criteria**: All acceptance scenarios for US2, US3, US4 pass

---

### Phase 7: Performance Testing & Polish (T064-T068)

**Goal**: Verify all success criteria, ensure backward compatibility

**Deliverable**: Feature ready for production

**Dependencies**: Phases 3-6 complete

**Tasks**:
- T064: Performance benchmarking (compare subprocess vs FFI)
- T065: Memory profiling (verify ±10MB tolerance)
- T066: Manual test checklist execution (SC-006)
- T067: Platform compatibility testing (Windows/macOS/Linux)
- T068: Security audit (verify FR-014 logging, no sensitive data leaks)

**Exit Criteria**: All 8 success criteria (SC-001 through SC-008) verified

---

## Risk Mitigation

### Risk 1: Platform-Specific Library Loading Failures

**Probability**: Medium | **Impact**: High (blocks app startup)

**Mitigation**:
- T016-T020: Implement comprehensive error handling with user-friendly messages
- FR-007: Block startup with clear error dialog explaining issue + reinstall suggestion
- Fallback: Document subprocess CLI as manual recovery option

### Risk 2: Memory Leaks Across FFI Boundary

**Probability**: Medium | **Impact**: High (gradual performance degradation)

**Mitigation**:
- Enforce GoFree pattern in all code (contracts/ffi-api.md)
- T065: Memory profiling with Valgrind/LeakSanitizer in CI
- Code review checklist: Every FFI call followed by GoFree

### Risk 3: Performance Targets Not Met

**Probability**: Low | **Impact**: Medium (feature goal not achieved)

**Mitigation**:
- Research.md already validates 5-10x target based on subprocess overhead elimination
- T064: Early performance benchmarking (before Phase 7)
- If target missed: Profile with flamegraph, optimize hot paths (see research.md § Performance Optimization)

### Risk 4: Test Compatibility (SC-007)

**Probability**: Low | **Impact**: High (breaks existing functionality)

**Mitigation**:
- Maintain identical Tauri command signatures (only internal impl changes)
- T066: Run full manual test checklist
- CI: Existing 48 unit tests must pass on every commit

---

## Definition of Done

Feature is **DONE** when:

1. ✅ All 68 tasks in tasks.md marked complete
2. ✅ All 8 success criteria (SC-001 to SC-008) verified:
   - Wallet creation <100ms
   - 54 address generation <2s
   - Startup to first operation <3s
   - Error display <100ms
   - Memory within ±10MB tolerance
   - Manual test checklist 100% pass
   - 48 unit tests pass unchanged
   - All platforms build and run identically
3. ✅ All 5 constitutional principles satisfied (documented in Constitution Check section)
4. ✅ Security audit complete (FR-014 logging, no sensitive data leaks)
5. ✅ Performance benchmarks show 5-10x improvement over baseline
6. ✅ Code reviewed by team, merge to main approved

---

## Next Steps

1. **Review this plan** with team for approval
2. **Verify Phase 1 artifacts** (data-model.md, contracts/ffi-api.md, quickstart.md) are accurate
3. **Begin Phase 1 tasks** (T001-T008): Setup dependencies and verify build environment
4. **Follow TDD workflow** (quickstart.md § TDD Cycle) for all implementation tasks

**Questions?** Consult:
- Technical decisions: [research.md](./research.md)
- FFI schemas: [data-model.md](./data-model.md)
- Build/test instructions: [quickstart.md](./quickstart.md)
- Task breakdown: [tasks.md](./tasks.md)

---

**Document Status**: ✅ Complete | **Last Updated**: 2025-10-25 | **Next Review**: Before T001 execution
