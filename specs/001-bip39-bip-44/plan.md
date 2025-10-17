# Implementation Plan: Wallet Mnemonic Management (BIP39/BIP44)

**Branch**: `001-bip39-bip-44` | **Date**: 2025-10-15 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-bip39-bip-44/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Implement secure hierarchical deterministic (HD) wallet functionality following BIP39 and BIP44 standards. The system will enable users to generate cryptographically secure mnemonic phrases (12 or 24 words), store them encrypted on USB using Argon2id + AES-256-GCM, restore wallets from mnemonics, and derive multiple cryptocurrency addresses from a single seed using BIP44 hierarchical paths. Security is paramount: mnemonics are encrypted with user passwords, never logged, and cleared from memory after use. The implementation follows a backend-first approach using Go for performance and security.

## Technical Context

**Language/Version**: Go 1.21+ (backend-first per constitution)
**Primary Dependencies**:
- BIP39/BIP32/BIP44: NEEDS CLARIFICATION (go library selection)
- Cryptography: NEEDS CLARIFICATION (Argon2id implementation, AES-256-GCM)
- USB Storage I/O: NEEDS CLARIFICATION (cross-platform USB detection and file operations)

**Storage**: File-based encrypted storage on USB device (no database for Phase 1)
**Testing**: Go standard testing package (`testing`), table-driven tests, BIP39 test vectors
**Target Platform**: Cross-platform desktop (Linux, macOS, Windows) with USB support

**Project Type**: Single backend project (CLI initially, API-ready architecture per constitution)
**Performance Goals**:
- Mnemonic generation: <100ms
- Address derivation: 1000 addresses/second
- Encryption/decryption: <500ms per operation

**Constraints**:
- Memory: Sensitive data cleared immediately after use (no persistence in RAM)
- USB requirement: System unusable without USB device present
- Offline-capable: No network dependency for core wallet operations

**Scale/Scope**:
- Single-user desktop application
- 100 accounts per wallet max
- 1000 addresses per account max
- ~5K-10K LOC estimated

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. Security-First Development (NON-NEGOTIABLE)

- [x] Private keys/mnemonics never leave USB secure zone (encrypted at rest)
- [x] Argon2id + AES-256-GCM encryption mandated in spec (SR-001, SR-012)
- [x] Multi-factor auth enforced: Application password + Wallet password (SR-002, SR-007)
- [x] API service isolation: N/A for Phase 1 (no external APIs)
- [x] Logs must not contain sensitive data (SR-005, SR-015)
- [x] Secrets via environment/OS store: Password never stored, re-derived each use (SR-002)

**Status**: ✅ PASS - All security requirements aligned with constitution

### II. Test-Driven Development (NON-NEGOTIABLE)

- [x] Red-Green-Refactor cycle mandated in implementation tasks
- [x] Unit + integration + contract tests required (BIP39 test vectors, encryption validation)
- [x] Security tests required for mnemonic handling, encryption, rate limiting

**Status**: ✅ PASS - TDD workflow will be enforced in Phase 2 (tasks.md)

### III. Incremental Progress Over Big Bangs

- [x] Feature broken into 3 user stories (P1: Generate, P2: Restore, P3: Derive HD addresses)
- [x] Each phase produces compilable, testable artifacts
- [x] Implementation will follow 3-attempt rule with fallback documentation

**Status**: ✅ PASS - Feature already decomposed incrementally in spec.md

### IV. Composition Over Inheritance

- [x] Architecture will use interfaces for Mnemonic, Encryption, Storage services
- [x] Single responsibility: Separate modules for BIP39, BIP44, Encryption, Storage, Audit
- [x] Dependency injection for testability (no singletons or global state)

**Status**: ✅ PASS - Architecture design will enforce composition in Phase 1

### V. Documentation-Driven Development

- [x] Architectural decisions documented in this plan.md before implementation
- [x] API contracts will be documented in Phase 1 (contracts/)
- [x] SYSTEM_SPECIFICATION.md update deferred to post-deployment

**Status**: ✅ PASS - Documentation workflow followed

### Architecture Alignment

- [x] MVC separation: Model (wallet entities), Services (BIP39/44 logic), CLI (controller)
- [x] Backend-first: Go implementation prioritized, API-ready design
- [x] API service isolation: N/A for Phase 1 (no external APIs)

**Status**: ✅ PASS - Architecture follows constitutional mandates

### Overall Gate Evaluation

**RESULT**: ✅ **PASS** - All constitutional requirements satisfied. Proceed to Phase 0.

---

## Post-Design Constitution Check (Phase 1 Complete)

*Re-evaluation after completing research, data model, contracts, and quickstart design.*

### I. Security-First Development

- [x] **Design Review**: Data model enforces encryption (EncryptedMnemonic entity), file permissions (0600), rate limiting (PasswordAttemptTracker)
- [x] **API Contract**: All sensitive operations require authentication, audit logging enforced
- [x] **Quickstart**: Security considerations documented, password requirements specified

**Status**: ✅ PASS - Security-first principles embedded in design

### II. Test-Driven Development

- [x] **Quickstart**: TDD workflow documented (Red-Green-Refactor cycle)
- [x] **Test Structure**: Unit, integration, contract, security test suites defined
- [x] **Test Vectors**: BIP39/32/44 official test vectors referenced

**Status**: ✅ PASS - TDD approach specified for implementation phase

### III. Incremental Progress

- [x] **Data Model**: Entities designed incrementally (Wallet → Account → Address → AuditLog)
- [x] **API Contracts**: Endpoints map to user stories (US-001, US-002, US-003)
- [x] **Quickstart**: Development workflow supports iterative development

**Status**: ✅ PASS - Design supports incremental implementation

### IV. Composition Over Inheritance

- [x] **Data Model**: Entities use composition (Wallet contains Accounts, Account contains Addresses)
- [x] **Services**: Modular design (BIP39, BIP32, BIP44, Crypto, Storage, Audit as separate services)
- [x] **No Inheritance**: No entity inheritance hierarchies detected

**Status**: ✅ PASS - Composition-based architecture

### V. Documentation-Driven Development

- [x] **Data Model**: Complete entity definitions with validation rules
- [x] **API Contracts**: OpenAPI 3.0 specification with examples
- [x] **Quickstart**: Developer guide with usage examples
- [x] **Research**: Technical decisions documented with rationale

**Status**: ✅ PASS - Documentation complete before implementation

### Architecture Alignment (Post-Design)

- [x] **MVC**: Models defined (data-model.md), Controllers defined (API contracts), Services defined (research.md)
- [x] **Backend-First**: Go implementation, API contracts ready for future backend
- [x] **Single Source of Truth**: All design artifacts link to spec.md

**Status**: ✅ PASS - Architecture adheres to constitutional mandates

### Final Gate Evaluation

**RESULT**: ✅ **PASS** - Design phase complete. All constitutional principles satisfied.

**Proceed to Phase 2**: Run `/speckit.tasks` to generate implementation tasks.

## Project Structure

### Documentation (this feature)

```
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```
cmd/
└── arcsign/                    # CLI entry point
    └── main.go

internal/
├── models/                     # Data entities (Wallet, Mnemonic, Account, Address)
│   ├── wallet.go
│   ├── mnemonic.go
│   └── account.go
├── services/                   # Business logic
│   ├── bip39/                  # BIP39 mnemonic generation/validation
│   │   ├── generator.go
│   │   └── validator.go
│   ├── bip32/                  # BIP32 HD key derivation
│   │   └── derivation.go
│   ├── bip44/                  # BIP44 multi-account hierarchy
│   │   └── paths.go
│   ├── crypto/                 # Argon2id + AES-256-GCM encryption
│   │   ├── encryption.go
│   │   └── memory.go           # Secure memory clearing
│   ├── storage/                # USB file operations
│   │   ├── usb.go
│   │   └── file.go
│   └── audit/                  # Audit log management
│       └── logger.go
├── cli/                        # CLI commands (controller layer)
│   ├── create.go               # Create wallet command
│   ├── restore.go              # Restore wallet command
│   └── derive.go               # Derive address command
└── lib/                        # Shared utilities
    ├── errors.go
    └── validator.go

tests/
├── contract/                   # BIP39/32/44 test vectors
│   ├── bip39_vectors_test.go
│   └── bip44_vectors_test.go
├── integration/                # End-to-end wallet workflows
│   ├── wallet_lifecycle_test.go
│   └── encryption_test.go
└── unit/                       # Unit tests for each service
    ├── bip39_test.go
    ├── crypto_test.go
    └── storage_test.go

go.mod
go.sum
```

**Structure Decision**: Single Go project with MVC separation. The `internal/` directory prevents external imports, enforcing encapsulation. CLI commands (controller) orchestrate services (business logic) that operate on models (entities). Backend-first architecture allows future API layer to reuse `internal/services` and `internal/models` without modification.

## Complexity Tracking

*Fill ONLY if Constitution Check has violations that must be justified*

**No violations detected.** All constitutional requirements are satisfied.
