# Implementation Tasks: Wallet Mnemonic Management (BIP39/BIP44)

**Feature**: `001-bip39-bip-44`
**Branch**: `001-bip39-bip-44`
**Date**: 2025-10-15
**Status**: Ready for Implementation

---

## Overview

This document provides dependency-ordered implementation tasks following Test-Driven Development (TDD) principles as mandated by the ArcSign Constitution. Tasks are organized by user story to enable independent implementation and testing.

**Key Principles**:
- **TDD Required**: Red-Green-Refactor cycle (write test first, minimal implementation, refactor)
- **User Story Organization**: Each user story is independently testable
- **Incremental Delivery**: MVP = User Story 1 (P1)
- **Parallel Execution**: Tasks marked [P] can run in parallel

---

## Task Summary

| Phase | Task Count | Description |
|-------|------------|-------------|
| Phase 1: Setup | 6 | Project initialization and dependencies |
| Phase 2: Foundational | 15 | Core infrastructure (models, encryption, storage) |
| Phase 3: User Story 1 (P1) | 18 | Generate New Wallet Mnemonic (MVP) |
| Phase 4: User Story 2 (P2) | 12 | Restore Wallet from Mnemonic |
| Phase 5: User Story 3 (P3) | 10 | Derive HD Addresses (BIP44) |
| Phase 6: Polish | 8 | Cross-cutting concerns and final integration |
| **Total** | **69** | |

---

## Dependency Graph

### User Story Completion Order

```
Phase 1 (Setup)
    ↓
Phase 2 (Foundational)
    ↓
Phase 3 (User Story 1 - P1) ──→ MVP Release Point
    ↓
Phase 4 (User Story 2 - P2) ──→ Can be implemented independently
    ↓
Phase 5 (User Story 3 - P3) ──→ Can be implemented independently
    ↓
Phase 6 (Polish)
```

### Dependencies Between User Stories

- **US1 (Generate)** → **Blocks**: US2 (Restore), US3 (Derive)
- **US2 (Restore)** → **Independent** (can run in parallel with US3)
- **US3 (Derive)** → **Independent** (can run in parallel with US2)

**Note**: After US1 is complete, US2 and US3 can be developed in parallel by different team members.

---

## Implementation Strategy

### MVP Scope (User Story 1 Only)

For minimum viable product, implement **only** Phase 1, Phase 2, and Phase 3:
- Users can create new wallets with BIP39 mnemonics
- Mnemonics are encrypted and stored securely on USB
- Users can verify backup by entering specific words
- Rate limiting and audit logging enabled

**MVP Exit Criteria**:
- All User Story 1 acceptance scenarios passing
- BIP39 test vectors validated
- Encryption roundtrip tests passing
- USB storage operational on all platforms

### Incremental Delivery

1. **Week 1-2**: Phase 1 + Phase 2 (Foundational infrastructure)
2. **Week 3**: Phase 3 (US1 - MVP)
3. **Week 4**: Phase 4 (US2 - Restore)
4. **Week 5**: Phase 5 (US3 - Derive HD)
5. **Week 6**: Phase 6 (Polish & Integration)

---

##  Phase 1: Setup (Project Initialization)

**Goal**: Initialize Go project structure, install dependencies, configure development environment.

**Prerequisites**: Go 1.21+ installed, USB storage device available.

### Tasks

- [ ] T001 Initialize Go module in project root with `go mod init`
- [ ] T002 [P] Install BIP39 dependency: `github.com/tyler-smith/go-bip39@v1.1.0`
- [ ] T003 [P] Install BIP32/BIP44 dependencies: `github.com/btcsuite/btcd/btcutil/hdkeychain@v1.1.4` and `github.com/btcsuite/btcd/chaincfg@v1.1.4`
- [ ] T004 [P] Install encryption dependencies: `golang.org/x/crypto@v0.17.0`
- [ ] T005 [P] Install USB storage dependencies: `github.com/SonarBeserk/gousbdrivedetector@latest` and `golang.org/x/sys@v0.15.0`
- [ ] T006 Create directory structure per plan.md: cmd/arcsign/, internal/{models,services,cli,lib}/, tests/{contract,integration,unit}/

**Validation**: Run `go mod tidy && go mod verify` successfully.

---

## Phase 2: Foundational (Core Infrastructure)

**Goal**: Implement shared models, encryption, storage, and audit infrastructure required by all user stories.

**Prerequisites**: Phase 1 complete.

### Foundational Models

- [ ] T007 Write test for Wallet model in tests/unit/models_test.go
- [ ] T008 Implement Wallet model in internal/models/wallet.go with fields: ID, Name, CreatedAt, LastAccessedAt, EncryptedMnemonicPath, UsesPassphrase
- [ ] T009 [P] Write test for EncryptedMnemonic model in tests/unit/models_test.go
- [ ] T010 [P] Implement EncryptedMnemonic model in internal/models/mnemonic.go with fields: Salt, Nonce, Ciphertext, Argon2Time, Argon2Memory, Argon2Threads, Version
- [ ] T011 [P] Write test for Account model in tests/unit/models_test.go
- [ ] T012 [P] Implement Account model in internal/models/account.go with fields: WalletID, AccountIndex, CoinType, Name, CreatedAt, NextAddressIndex, NextChangeIndex
- [ ] T013 [P] Write test for Address model in tests/unit/models_test.go
- [ ] T014 [P] Implement Address model in internal/models/address.go with fields: AccountID, Change, AddressIndex, DerivationPath, Address, PublicKey, CreatedAt, Label

### Encryption Service (Argon2id + AES-256-GCM)

- [ ] T015 Write test for clearBytes() function in tests/unit/crypto_test.go
- [ ] T016 Implement clearBytes() with runtime.KeepAlive() in internal/services/crypto/memory.go
- [ ] T017 Write test for EncryptMnemonic() with known password/mnemonic in tests/unit/crypto_test.go
- [ ] T018 Implement EncryptMnemonic() using Argon2id (4 iter, 256 MiB, 4 threads) + AES-256-GCM in internal/services/crypto/encryption.go
- [ ] T019 Write test for DecryptMnemonic() roundtrip in tests/unit/crypto_test.go
- [ ] T020 Implement DecryptMnemonic() with GCM authentication in internal/services/crypto/encryption.go
- [ ] T021 Write test for SerializeEncryptedData() binary format in tests/unit/crypto_test.go
- [ ] T022 Implement SerializeEncryptedData() and DeserializeEncryptedData() per data-model.md format in internal/services/crypto/encryption.go

### USB Storage Service

- [ ] T023 Write test for DetectUSBDevices() in tests/unit/storage_test.go (mock USB detection)
- [ ] T024 Implement DetectUSBDevices() using gousbdrivedetector in internal/services/storage/usb.go
- [ ] T025 Write test for AtomicWriteFile() temp-file-then-rename in tests/unit/storage_test.go
- [ ] T026 Implement AtomicWriteFile() with Sync() and 0600 permissions in internal/services/storage/file.go
- [ ] T027 Write test for GetAvailableSpace() (Unix and Windows build tags) in tests/unit/storage_test.go
- [ ] T028 Implement GetAvailableSpace() using golang.org/x/sys in internal/services/storage/usb.go

### Audit Log Service

- [ ] T029 Write test for AuditLogEntry creation in tests/unit/audit_test.go
- [ ] T030 Implement LogOperation() to append NDJSON entries in internal/services/audit/logger.go
- [ ] T031 Write test for audit log file permissions (0600) in tests/unit/audit_test.go

### Shared Utilities

- [ ] T032 [P] Write test for password strength validation in tests/unit/validator_test.go
- [ ] T033 [P] Implement ValidatePassword() (12+ chars, 3+ complexity) in internal/lib/validator.go
- [ ] T034 [P] Write test for UUID generation in tests/unit/lib_test.go
- [ ] T035 [P] Implement GenerateUUID() using crypto/rand in internal/lib/uuid.go
- [ ] T036 [P] Implement custom error types (ErrUSBNotFound, ErrUSBFull, etc.) in internal/lib/errors.go

**Validation**: All unit tests pass (`go test ./tests/unit/...`).

---

## Phase 3: User Story 1 (P1) - Generate New Wallet Mnemonic

**Goal**: Implement wallet creation with BIP39 mnemonic generation, encryption, and secure USB storage.

**User Story**: A user needs to create a new cryptocurrency wallet by generating a secure mnemonic phrase following BIP39 standards.

**Independent Test**: Generate mnemonic, verify BIP39 compliance (valid word list, correct length, valid checksum), encrypt with password, store on USB, verify backup.

**Prerequisites**: Phase 2 complete.

### BIP39 Service (Mnemonic Generation)

- [ ] T037 [US1] Write test for NewEntropy() using BIP39 test vectors in tests/contract/bip39_vectors_test.go
- [ ] T038 [US1] Implement GenerateMnemonic() for 24-word (256-bit entropy) in internal/services/bip39/generator.go using tyler-smith/go-bip39
- [ ] T039 [US1] Write test for GenerateMnemonic() 12-word option in tests/unit/bip39_test.go
- [ ] T040 [US1] Implement 12-word mnemonic generation option in internal/services/bip39/generator.go
- [ ] T041 [US1] Write test for mnemonic checksum validation in tests/unit/bip39_test.go
- [ ] T042 [US1] Implement ValidateMnemonic() with checksum verification in internal/services/bip39/validator.go
- [ ] T043 [US1] Write test for optional BIP39 passphrase (25th word) support in tests/unit/bip39_test.go
- [ ] T044 [US1] Implement MnemonicToSeed() with optional passphrase in internal/services/bip39/generator.go
- [ ] T045 [US1] Write test for mnemonic normalization (trim whitespace, lowercase) in tests/unit/bip39_test.go
- [ ] T046 [US1] Implement NormalizeMnemonic() in internal/services/bip39/validator.go

### Wallet Creation Service

- [ ] T047 [US1] Write integration test for CreateWallet() end-to-end flow in tests/integration/wallet_create_test.go
- [ ] T048 [US1] Implement CreateWallet() orchestration: generate mnemonic → encrypt → store USB → create wallet metadata in internal/services/wallet/create.go
- [ ] T049 [US1] Write test for wallet metadata JSON serialization in tests/unit/wallet_test.go
- [ ] T050 [US1] Implement SaveWalletMetadata() to write {wallet-id}.meta.json in internal/services/wallet/persistence.go

### Rate Limiting Service

- [ ] T051 [US1] Write test for PasswordAttemptTracker in-memory structure in tests/unit/ratelimit_test.go
- [ ] T052 [US1] Implement RecordFailedAttempt() with 5 attempts per 15 minutes logic in internal/services/auth/ratelimit.go
- [ ] T053 [US1] Write test for rate limit lockout with timestamp-based expiration in tests/unit/ratelimit_test.go
- [ ] T054 [US1] Implement CheckRateLimit() returning remaining time until lockout expires in internal/services/auth/ratelimit.go

### CLI - Create Wallet Command

- [ ] T055 [US1] Write test for CLI flag parsing (--name, --mnemonic-length, --passphrase) in tests/unit/cli_test.go
- [ ] T056 [US1] Implement `arcsign wallet create` CLI command in internal/cli/create.go
- [ ] T057 [US1] Implement mnemonic display with 60-second timeout and 45-second warning in internal/cli/create.go
- [ ] T058 [US1] Write test for mnemonic backup verification (3 random words) in tests/unit/cli_test.go
- [ ] T059 [US1] Implement backup verification prompt in internal/cli/create.go

### Integration & Audit

- [ ] T060 [US1] Write integration test for complete wallet creation flow with audit log entry in tests/integration/wallet_lifecycle_test.go
- [ ] T061 [US1] Implement audit logging for WALLET_CREATE operation (SUCCESS/FAILURE) in internal/services/wallet/create.go

**Acceptance Scenarios** (from spec.md):
1. ✅ User creates wallet → 24-word BIP39 mnemonic generated
2. ✅ Mnemonic displayed → Backup verification required (3 random words)
3. ✅ Backup verified → Mnemonic encrypted (Argon2id + AES-256-GCM) and stored on USB
4. ✅ 24-word option supported
5. ✅ Optional BIP39 passphrase (25th word) supported
6. ✅ 45-second warning before mnemonic hidden
7. ✅ 60-second timeout → Mnemonic auto-cleared from screen

**Validation**: Run `go test ./tests/integration/wallet_create_test.go -v` → All scenarios pass.

---

## Phase 4: User Story 2 (P2) - Restore Wallet from Mnemonic

**Goal**: Implement wallet restoration from BIP39 mnemonic phrase with validation and decryption.

**User Story**: A user needs to restore access to their wallet using a previously backed-up mnemonic phrase.

**Independent Test**: Provide valid BIP39 mnemonic, verify system accepts it, validates checksum, restores wallet with matching derived addresses.

**Prerequisites**: Phase 3 complete.

**Can Run in Parallel With**: User Story 3 (P3)

### Mnemonic Restoration Service

- [ ] T062 [US2] Write test for RestoreMnemonic() with invalid checksum (must fail) in tests/unit/bip39_test.go
- [ ] T063 [US2] Write test for RestoreMnemonic() with invalid words (not in BIP39 word list) in tests/unit/bip39_test.go
- [ ] T064 [US2] Write test for RestoreMnemonic() with extra spaces/inconsistent capitalization (must normalize) in tests/unit/bip39_test.go
- [ ] T065 [US2] Implement RestoreWallet() orchestration: normalize → validate → encrypt → store USB in internal/services/wallet/restore.go

### Password Verification

- [ ] T066 [US2] Write test for DecryptMnemonic() with wrong password (must fail with GCM authentication error) in tests/unit/crypto_test.go
- [ ] T067 [US2] Write test for rate limiting on failed password attempts (5 attempts per 15 minutes) in tests/integration/ratelimit_test.go
- [ ] T068 [US2] Implement rate limit enforcement in RestoreWallet() flow in internal/services/wallet/restore.go

### Address Verification (for passphrase detection)

- [ ] T069 [US2] Write test for comparing derived addresses between original and restored wallet in tests/integration/wallet_restore_test.go
- [ ] T070 [US2] Implement passphrase prompt when addresses don't match (suggests missing passphrase) in internal/cli/restore.go

### CLI - Restore Wallet Command

- [ ] T071 [US2] Implement `arcsign wallet restore` CLI command with interactive mnemonic prompt in internal/cli/restore.go
- [ ] T072 [US2] Implement optional --mnemonic-file flag for automation in internal/cli/restore.go
- [ ] T073 [US2] Implement --passphrase flag for BIP39 passphrase in internal/cli/restore.go

### Integration & Audit

- [ ] T074 [US2] Write integration test for complete wallet restoration flow in tests/integration/wallet_restore_test.go
- [ ] T075 [US2] Implement audit logging for WALLET_RESTORE operation (SUCCESS/FAILURE with failureReason) in internal/services/wallet/restore.go

**Acceptance Scenarios** (from spec.md):
1. ✅ Valid mnemonic entered → Wallet restored successfully
2. ✅ Invalid mnemonic (wrong checksum/invalid words) → Clear error message
3. ✅ Valid mnemonic with extra spaces/inconsistent capitalization → Normalized and restored
4. ✅ Restored wallet → Addresses match original wallet
5. ✅ Wallet created with passphrase → System prompts for passphrase if addresses don't match
6. ✅ 5 incorrect password attempts within 15 minutes → System blocks 6th attempt with lockout countdown

**Validation**: Run `go test ./tests/integration/wallet_restore_test.go -v` → All scenarios pass.

---

## Phase 5: User Story 3 (P3) - Derive Hierarchical Deterministic (HD) Addresses

**Goal**: Implement BIP44 address derivation for multiple cryptocurrencies using hierarchical deterministic wallet specification.

**User Story**: A user needs to generate multiple cryptocurrency addresses from their single mnemonic phrase following BIP44 standards.

**Independent Test**: Provide known mnemonic and derivation path, verify system generates correct addresses according to BIP44 spec (m/44'/coin_type'/account'/change/address_index).

**Prerequisites**: Phase 3 complete.

**Can Run in Parallel With**: User Story 2 (P2)

### BIP32 Service (HD Key Derivation)

- [ ] T076 [US3] Write test for NewMaster() using btcsuite test vectors in tests/contract/bip32_vectors_test.go
- [ ] T077 [US3] Implement CreateMasterKey() from BIP39 seed in internal/services/bip32/derivation.go using btcsuite/hdkeychain
- [ ] T078 [US3] Write test for DeriveChild() with hardened derivation in tests/unit/bip32_test.go
- [ ] T079 [US3] Implement DeriveChild() with hardened/non-hardened support in internal/services/bip32/derivation.go
- [ ] T080 [US3] Write test for key.Zero() memory clearing in tests/unit/bip32_test.go
- [ ] T081 [US3] Implement proper defer key.Zero() in all derivation functions in internal/services/bip32/derivation.go

### BIP44 Service (Multi-Account Hierarchy)

- [ ] T082 [US3] Write test for BIP44Path struct validation in tests/unit/bip44_test.go
- [ ] T083 [US3] Implement BIP44Path struct with fields: Purpose, CoinType, Account, Change, AddressIndex in internal/services/bip44/paths.go
- [ ] T084 [US3] Write test for DeriveBIP44Address() with Bitcoin (coin_type=0) in tests/contract/bip44_vectors_test.go
- [ ] T085 [US3] Implement DeriveBIP44Address() manual derivation path construction: m/44'/coin_type'/account'/change/address_index in internal/services/bip44/paths.go
- [ ] T086 [US3] Write test for DeriveBIP44Address() with Ethereum (coin_type=60) in tests/contract/bip44_vectors_test.go
- [ ] T087 [US3] Write test for multiple coin types (Bitcoin, Ethereum, Litecoin) in tests/unit/bip44_test.go

### Account Service

- [ ] T088 [US3] Write test for CreateAccount() with unique account index validation in tests/unit/account_test.go
- [ ] T089 [US3] Implement CreateAccount() orchestration: validate → create Account entity → save to {wallet-id}_accounts.json in internal/services/account/create.go
- [ ] T090 [US3] Write test for NextAddressIndex tracking in tests/unit/account_test.go

### Address Service

- [ ] T091 [US3] Write test for DeriveAddress() generating Bitcoin P2PKH address in tests/integration/address_test.go
- [ ] T092 [US3] Implement DeriveAddress() orchestration: BIP44 derivation → address generation → save to {wallet-id}_addresses.json in internal/services/address/derive.go
- [ ] T093 [US3] Write test for address derivation path validation (never expose private keys) in tests/unit/address_test.go

### CLI - Account & Address Commands

- [ ] T094 [US3] Implement `arcsign account create` CLI command with --wallet-id, --coin-type, --name flags in internal/cli/account.go
- [ ] T095 [US3] Implement `arcsign address derive` CLI command with --wallet-id, --account-id, --change, --label flags in internal/cli/derive.go
- [ ] T096 [US3] Implement `arcsign address list` CLI command with --wallet-id, --account-id flags in internal/cli/derive.go

### Integration & Audit

- [ ] T097 [US3] Write integration test for complete account creation → address derivation flow in tests/integration/account_lifecycle_test.go
- [ ] T098 [US3] Implement audit logging for ACCOUNT_CREATE and ADDRESS_DERIVE operations in internal/services/account/create.go and internal/services/address/derive.go

**Acceptance Scenarios** (from spec.md):
1. ✅ Request new Bitcoin receive address → System derives using path m/44'/0'/0'/0/[index]
2. ✅ Request addresses for multiple cryptocurrencies → System uses correct coin_type for each
3. ✅ Manually specify address index → System derives at exact path
4. ✅ Export address information → Derivation path shown, private keys NEVER exposed

**Validation**: Run `go test ./tests/integration/account_lifecycle_test.go -v` → All scenarios pass.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Goal**: Final integration, CLI usability improvements, comprehensive testing, security hardening.

**Prerequisites**: Phases 3, 4, 5 complete.

### CLI Improvements

- [ ] T099 Implement `arcsign wallet list` CLI command to list all wallets on USB in internal/cli/list.go
- [ ] T100 Implement `arcsign wallet unlock` and `arcsign wallet lock` CLI commands in internal/cli/unlock.go
- [ ] T101 Implement `arcsign audit log` CLI command with --wallet-id, --limit, --offset, --operation, --status flags in internal/cli/audit.go
- [ ] T102 Add colored output and user-friendly error messages using fmt.Sprintf in internal/cli/*.go

### Security Hardening

- [ ] T103 Run gosec security scanner: `gosec ./...` and fix all HIGH severity issues
- [ ] T104 Write memory profiling test to verify clearBytes() effectiveness in tests/security/memory_test.go
- [ ] T105 Write entropy quality test using chi-squared statistical test in tests/security/entropy_test.go
- [ ] T106 Verify all sensitive data uses []byte (not string) across codebase

### Final Integration Testing

- [ ] T107 Write end-to-end test covering US1 → US2 → US3 full lifecycle in tests/integration/full_lifecycle_test.go
- [ ] T108 Test on real USB devices (Linux, macOS, Windows) and document platform-specific issues

### Documentation & Deployment

- [ ] T109 Update CLAUDE.md with implementation notes and lessons learned
- [ ] T110 Write deployment guide in docs/DEPLOYMENT.md with build instructions for all platforms
- [ ] T111 Create release artifacts using `make build-all` and test on each platform

**Validation**: Run `go test ./... -v` → All tests pass on all platforms.

---

## Parallel Execution Opportunities

### Within Phase 2 (Foundational)

**Parallelizable Tasks** (can be developed simultaneously by different team members):
- Models (T007-T014): 4 parallel streams (Wallet, EncryptedMnemonic, Account, Address)
- Encryption Service (T015-T022): 1 stream
- USB Storage Service (T023-T028): 1 stream
- Audit Log Service (T029-T031): 1 stream
- Shared Utilities (T032-T036): 1 stream

**Recommendation**: Assign 5 developers to Phase 2, each taking one stream above.

### Between User Stories

**After Phase 3 Complete** (US1 MVP):
- **Stream A**: Implement User Story 2 (Phase 4)
- **Stream B**: Implement User Story 3 (Phase 5)

Both streams are independent and can proceed in parallel.

---

## Test Execution

### Unit Tests
```bash
# Run all unit tests
go test ./tests/unit/... -v

# Run with coverage
go test ./tests/unit/... -cover -coverprofile=coverage.out
go tool cover -html=coverage.out
```

### Contract Tests (BIP39/BIP32/BIP44 Test Vectors)
```bash
# Validate against official test vectors
go test ./tests/contract/... -v
```

### Integration Tests
```bash
# Run integration tests (requires USB device)
go test ./tests/integration/... -v
```

### Security Tests
```bash
# Memory clearing and entropy quality
go test ./tests/security/... -v

# Security scanner
gosec ./...
```

### All Tests
```bash
go test ./... -v
```

---

## Success Criteria

### Phase 3 (MVP) Exit Criteria

- [ ] All User Story 1 acceptance scenarios passing
- [ ] BIP39 test vectors (12-word and 24-word) validated
- [ ] Encryption/decryption roundtrip tests passing
- [ ] USB storage operational on Linux, macOS, Windows
- [ ] Rate limiting functional (5 attempts per 15 minutes)
- [ ] Audit log entries created for all wallet operations
- [ ] Mnemonic display timeout (60 seconds) working
- [ ] Backup verification (3 random words) functional
- [ ] Memory clearing verified via heap profiling
- [ ] No sensitive data in logs (audit via grep)

### Phase 4 (US2) Exit Criteria

- [ ] All User Story 2 acceptance scenarios passing
- [ ] Invalid mnemonic detection working (checksum validation)
- [ ] Mnemonic normalization functional (spaces, capitalization)
- [ ] Address verification working (detects missing passphrase)
- [ ] Rate limiting enforced on failed restoration attempts
- [ ] Audit log captures WALLET_RESTORE with failureReason

### Phase 5 (US3) Exit Criteria

- [ ] All User Story 3 acceptance scenarios passing
- [ ] BIP44 derivation paths correct for Bitcoin, Ethereum, Litecoin
- [ ] Addresses match reference implementations (MetaMask, Ledger)
- [ ] Private keys never exposed (verified via code audit)
- [ ] Account and address persistence working ({wallet-id}_accounts.json, {wallet-id}_addresses.json)
- [ ] Audit log captures ACCOUNT_CREATE and ADDRESS_DERIVE

### Final (Phase 6) Exit Criteria

- [ ] All tests passing on Linux, macOS, Windows
- [ ] gosec security scan: 0 HIGH severity issues
- [ ] Code coverage ≥ 80%
- [ ] Memory profiling: All clearBytes() effective
- [ ] Entropy quality: Chi-squared test passing
- [ ] CLI usability: Colored output, clear error messages
- [ ] Documentation complete: quickstart.md, DEPLOYMENT.md
- [ ] Release artifacts built and tested on all platforms

---

## Performance Benchmarks

Run these benchmarks after implementation to verify performance goals from plan.md:

```bash
# Mnemonic generation (<100ms)
go test -bench=BenchmarkGenerateMnemonic -benchtime=100x ./tests/unit/bip39_test.go

# Address derivation (1000 addresses/second)
go test -bench=BenchmarkDeriveAddress -benchtime=1000x ./tests/unit/bip44_test.go

# Encryption/decryption (<500ms)
go test -bench=BenchmarkEncryptDecrypt -benchtime=100x ./tests/unit/crypto_test.go

# Argon2id parameters (~2-3 seconds)
go test -bench=BenchmarkArgon2id -benchtime=10x ./tests/unit/crypto_test.go
```

---

## Notes

### TDD Workflow Reminder

For EVERY task:
1. **Red**: Write failing test first
2. **Green**: Write minimal code to pass test
3. **Refactor**: Improve code quality without breaking tests
4. **Repeat**: Move to next task

### Constitution Compliance

- **Security-First**: All encryption, memory clearing, file permissions per SR-001 through SR-017
- **Test-Driven**: Red-Green-Refactor cycle enforced for all tasks
- **Incremental**: Each user story is independently testable and deployable
- **Composition**: Services use interfaces, no inheritance hierarchies
- **Documentation**: All architectural decisions documented in plan.md, research.md

### Task ID Format

- **T###**: Sequential task number (execution order)
- **[P]**: Parallelizable (can run simultaneously with other [P] tasks in same phase)
- **[US#]**: User Story label (US1, US2, US3) for user story phase tasks only

---

**Tasks Status**: ✅ READY FOR IMPLEMENTATION

Total: 111 tasks organized across 6 phases. Estimated duration: 6 weeks for 2-3 developers.

**Next Step**: Begin Phase 1 (Setup) by running tasks T001-T006.
