# Tasks: User Dashboard for Wallet Management

**Feature Branch**: `004-dashboard`
**Input**: Design documents from `/Users/jnr350/Desktop/Yansiang/arcSignv2/specs/004-dashboard/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/wallet-api.yaml

**Tests**: Following TDD approach per constitution principle II (tests before implementation for security-critical applications)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description with /absolute/path/to/file.ext`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- All paths are absolute from repository root

## Path Conventions
- **Go CLI**: `/Users/jnr350/Desktop/Yansiang/arcSignv2/cmd/arcsign/`, `/Users/jnr350/Desktop/Yansiang/arcSignv2/internal/`
- **Tauri Backend**: `/Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src-tauri/src/`
- **React Frontend**: `/Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src/`
- **Tests**: `/Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/tests/`

---

## Phase 1: Setup (~10 tasks)

**Purpose**: Project initialization and basic structure

- [ ] T001 Create Tauri project structure in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/ using tauri init
- [ ] T002 Configure tauri.conf.json with permissions (fs-all, dialog-all, path-all, clipboard-all, shell-sidecar) at /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src-tauri/tauri.conf.json
- [ ] T003 [P] Initialize React 18 + TypeScript + Vite project in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src/
- [ ] T004 [P] Add Rust dependencies (serde, tokio, semver, sha2, hex) to /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src-tauri/Cargo.toml
- [ ] T005 [P] Add React dependencies (zustand, react-hook-form, zod) to /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/package.json
- [ ] T006 [P] Add macOS screenshot protection dependencies (cocoa, objc) to /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src-tauri/Cargo.toml
- [ ] T007 [P] Add Windows screenshot protection dependencies (windows crate with Win32 features) to /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src-tauri/Cargo.toml
- [ ] T008 [P] Configure ESLint and Prettier in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/.eslintrc.js
- [ ] T009 [P] Setup Vitest for React component testing in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/vite.config.ts
- [ ] T010 [P] Create directory structure (components, pages, stores, services, types, validation) in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src/

---

## Phase 2: Foundational (~25 tasks)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### CLI Dual-Mode Refactoring (Go)

- [X] T011 [P] Write test for CLI mode detection with ARCSIGN_MODE=dashboard in /Users/jnr350/Desktop/Yansiang/arcSignv2/tests/cli/mode_detection_test.go
- [X] T012 Create DetectMode() function that checks ARCSIGN_MODE environment variable in /Users/jnr350/Desktop/Yansiang/arcSignv2/internal/cli/mode.go
- [X] T013 [P] Write test for single-line JSON stdout output in /Users/jnr350/Desktop/Yansiang/arcSignv2/tests/cli/json_output_test.go
- [X] T014 Create WriteJSON() function that outputs single-line JSON to stdout in /Users/jnr350/Desktop/Yansiang/arcSignv2/internal/cli/output.go
- [X] T015 [P] Write test for stderr logging (human-readable) in /Users/jnr350/Desktop/Yansiang/arcSignv2/tests/cli/stderr_logging_test.go
- [X] T016 Create WriteLog() function that outputs to stderr in /Users/jnr350/Desktop/Yansiang/arcSignv2/internal/cli/output.go
- [X] T017 Define CliResponse struct with success, data, error, request_id, cli_version, duration_ms, warnings in /Users/jnr350/Desktop/Yansiang/arcSignv2/internal/cli/types.go
- [X] T018 Define CliError struct with error code and message in /Users/jnr350/Desktop/Yansiang/arcSignv2/internal/cli/types.go
- [X] T019 Define error code constants (INVALID_PASSWORD, USB_NOT_FOUND, etc.) in /Users/jnr350/Desktop/Yansiang/arcSignv2/internal/cli/errors.go
- [X] T020 Refactor main.go to detect mode and branch between interactive/non-interactive flows in /Users/jnr350/Desktop/Yansiang/arcSignv2/cmd/arcsign/main.go
- [ ] T020a [P] Write test for derive_address command with MNEMONIC, DERIVATION_PATH env vars in /Users/jnr350/Desktop/Yansiang/arcSignv2/tests/cli/derive_address_test.go
- [ ] T020b [P] Write test for derive_address with optional BIP39_PASSPHRASE in /Users/jnr350/Desktop/Yansiang/arcSignv2/tests/cli/derive_address_passphrase_test.go
- [ ] T020c Implement handleDeriveAddressNonInteractive() that derives single address without creating wallet files in /Users/jnr350/Desktop/Yansiang/arcSignv2/cmd/arcsign/handlers.go

### Address File Generation (Go CLI)

- [ ] T021 [P] Write test for addresses.json generation with schema_version "1.0" in /Users/jnr350/Desktop/Yansiang/arcSignv2/tests/wallet/addresses_file_test.go
- [ ] T022 Create generateAddressesFile() function that derives all 54 addresses and writes to addresses.json in /Users/jnr350/Desktop/Yansiang/arcSignv2/internal/wallet/addresses.go
- [ ] T023 [P] Write test for SHA-256 checksum computation of addresses array in /Users/jnr350/Desktop/Yansiang/arcSignv2/tests/wallet/checksum_test.go
- [ ] T024 Implement computeAddressesChecksum() function in /Users/jnr350/Desktop/Yansiang/arcSignv2/internal/wallet/checksum.go
- [ ] T025 Add AddressesFile struct with schema_version, wallet_id, generated_at, total_count, checksum, addresses in /Users/jnr350/Desktop/Yansiang/arcSignv2/internal/wallet/types.go
- [ ] T026 Update Address struct to include account, change, index fields (BIP44 components) in /Users/jnr350/Desktop/Yansiang/arcSignv2/internal/wallet/types.go

### Tauri CLI Wrapper (Rust)

- [ ] T027 [P] Write test for CliWrapper subprocess spawning with environment variables in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/tests/rust/cli_wrapper_test.rs
- [ ] T028 Create CliWrapper struct with cli_path field in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src-tauri/src/cli/wrapper.rs
- [ ] T029 [P] Write test for 30-second subprocess timeout in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/tests/rust/cli_timeout_test.rs
- [ ] T030 Implement spawn_cli_with_timeout() method with tokio::time::timeout in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src-tauri/src/cli/wrapper.rs
- [ ] T031 [P] Write test for JSON response parsing from stdout in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/tests/rust/cli_response_parsing_test.rs
- [ ] T032 Implement parse_cli_response() method with serde_json deserialization in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src-tauri/src/cli/wrapper.rs
- [ ] T033 Create Rust types matching CLI JSON responses (CliResponse, Wallet, Address, ErrorObject) in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src-tauri/src/cli/types.rs
- [ ] T034 [P] Write test for error parsing priority (JSON stdout → JSON stderr → raw stderr → exit code) in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/tests/rust/cli_error_parsing_test.rs
- [ ] T035 Implement parse_cli_error() method with fallback chain in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src-tauri/src/cli/wrapper.rs

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Generate New Wallet (Priority: P1) 🎯 MVP

**Goal**: Users can create new wallets with password-encrypted storage on USB, receive BIP39 mnemonic with security protections

**Independent Test**: Launch dashboard → click "Create New Wallet" → enter password → confirm mnemonic displayed with screenshot protection → verify wallet appears in list

### Tests for User Story 1 (TDD - Write First)

- [ ] T036 [P] [US1] Contract test for create_wallet JSON output matching OpenAPI spec in /Users/jnr350/Desktop/Yansiang/arcSignv2/tests/cli/create_wallet_json_test.go
- [ ] T037 [P] [US1] Integration test for CLI create_wallet with WALLET_PASSWORD env var in /Users/jnr350/Desktop/Yansiang/arcSignv2/tests/cli/create_wallet_integration_test.go
- [ ] T038 [P] [US1] Test for wallet file creation on USB with correct permissions (0600) in /Users/jnr350/Desktop/Yansiang/arcSignv2/tests/cli/wallet_file_permissions_test.go
- [ ] T039 [P] [US1] Test for addresses.json generation with 54 addresses in /Users/jnr350/Desktop/Yansiang/arcSignv2/tests/cli/addresses_json_generation_test.go
- [ ] T040 [P] [US1] Rust test for create_wallet Tauri command in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/tests/rust/create_wallet_command_test.rs
- [ ] T041 [P] [US1] React component test for WalletCreate form validation in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/tests/frontend/components/WalletCreate.test.tsx
- [ ] T042 [P] [US1] React integration test for wallet creation flow in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/tests/frontend/integration/wallet-creation-flow.test.tsx

### CLI Implementation for User Story 1 (Go)

- [ ] T043 [P] [US1] Implement handleCreateWalletNonInteractive() that reads WALLET_PASSWORD, USB_PATH, WALLET_NAME env vars in /Users/jnr350/Desktop/Yansiang/arcSignv2/cmd/arcsign/handlers.go
- [ ] T044 [US1] Call existing wallet.Create() function with parameters from environment variables in /Users/jnr350/Desktop/Yansiang/arcSignv2/cmd/arcsign/handlers.go
- [ ] T045 [US1] Generate BIP39 mnemonic using existing mnemonic service in /Users/jnr350/Desktop/Yansiang/arcSignv2/cmd/arcsign/handlers.go
- [ ] T046 [US1] Call generateAddressesFile() to create addresses.json with checksum (uses T022) in /Users/jnr350/Desktop/Yansiang/arcSignv2/cmd/arcsign/handlers.go
- [ ] T047 [US1] Build CliResponse with wallet metadata, mnemonic (if RETURN_MNEMONIC=true), request_id in /Users/jnr350/Desktop/Yansiang/arcSignv2/cmd/arcsign/handlers.go
- [ ] T048 [US1] Call WriteJSON() to output response to stdout (uses T014) in /Users/jnr350/Desktop/Yansiang/arcSignv2/cmd/arcsign/handlers.go
- [ ] T049 [P] [US1] Add error handling for USB_NOT_FOUND, INVALID_PASSWORD, IO_ERROR cases in /Users/jnr350/Desktop/Yansiang/arcSignv2/cmd/arcsign/handlers.go

### Tauri Backend for User Story 1 (Rust)

- [ ] T050 [P] [US1] Implement create_wallet Tauri command with password, usb_path, name parameters in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src-tauri/src/commands/wallet.rs
- [ ] T051 [US1] Call CliWrapper.create_wallet() with environment variables (ARCSIGN_MODE, WALLET_PASSWORD, USB_PATH, RETURN_MNEMONIC=true) in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src-tauri/src/commands/wallet.rs
- [ ] T052 [US1] Parse CLI JSON response and extract wallet metadata + mnemonic in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src-tauri/src/commands/wallet.rs
- [ ] T053 [US1] Return wallet and mnemonic to frontend via Tauri IPC in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src-tauri/src/commands/wallet.rs
- [ ] T054 [P] [US1] Add error handling with user-friendly messages (map error codes to messages) in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src-tauri/src/commands/wallet.rs
- [ ] T055 [P] [US1] Log full error details (exit code, stdout, stderr) to debug logs in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src-tauri/src/commands/wallet.rs

### React Frontend for User Story 1 (TypeScript)

- [ ] T056 [P] [US1] Create TypeScript types (Wallet, CreateWalletResponse) in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src/types/wallet.ts
- [ ] T057 [P] [US1] Create Zod password validation schema (min 12 chars, uppercase, lowercase, number) in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src/validation/password.ts
- [ ] T058 [P] [US1] Create Zod wallet name validation schema (1-50 chars, alphanumeric + spaces + dashes) in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src/validation/walletName.ts
- [ ] T059 [US1] Create WalletCreate component with React Hook Form + Zod in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src/components/WalletCreate.tsx
- [ ] T060 [US1] Implement password input field with strength indicator in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src/components/WalletCreate.tsx
- [ ] T061 [US1] Implement wallet name input field with inline validation in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src/components/WalletCreate.tsx
- [ ] T062 [US1] Implement BIP39 passphrase input (optional, advanced) in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src/components/WalletCreate.tsx
- [ ] T063 [US1] Implement mnemonic length selector (12 or 24 words) in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src/components/WalletCreate.tsx
- [ ] T064 [US1] Create createWallet() Tauri API wrapper with invoke('create_wallet') in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src/services/tauri-api.ts
- [ ] T065 [US1] Call createWallet() on form submit with loading state in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src/components/WalletCreate.tsx
- [ ] T066 [US1] Create MnemonicDisplay component with 30-second countdown timer in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src/components/MnemonicDisplay.tsx
- [ ] T067 [US1] Display mnemonic words in 3-column grid layout in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src/components/MnemonicDisplay.tsx
- [ ] T068 [US1] Add "I have backed up my mnemonic" checkbox with countdown disable in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src/components/MnemonicDisplay.tsx
- [ ] T069 [US1] Clear mnemonic from state after user confirmation in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src/components/MnemonicDisplay.tsx

### Screenshot Protection for User Story 1 (Rust)

- [ ] T070 [P] [US1] Implement macOS screenshot protection using NSWindow.sharingType in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src-tauri/src/security/macos.rs
- [ ] T071 [P] [US1] Implement Windows screenshot protection using SetWindowDisplayAffinity in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src-tauri/src/security/windows.rs
- [ ] T072 [P] [US1] Implement Linux watermark overlay trigger via event emission in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src-tauri/src/security/linux.rs
- [ ] T073 [US1] Create enable_screenshot_protection Tauri command in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src-tauri/src/commands/security.rs
- [ ] T074 [US1] Create disable_screenshot_protection Tauri command in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src-tauri/src/commands/security.rs
- [ ] T075 [P] [US1] Create WatermarkOverlay React component for Linux in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src/components/WatermarkOverlay.tsx
- [ ] T076 [US1] Call enable_screenshot_protection when MnemonicDisplay mounts in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src/components/MnemonicDisplay.tsx
- [ ] T077 [US1] Call disable_screenshot_protection when MnemonicDisplay unmounts in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src/components/MnemonicDisplay.tsx

**Checkpoint**: At this point, User Story 1 should be fully functional - users can create wallets and see mnemonics securely

---

## Phase 4: User Story 2 - Import Existing Wallet (Priority: P2)

**Goal**: Users can import wallets using BIP39 mnemonic phrases with duplicate detection and validation

**Independent Test**: Launch dashboard → click "Import Wallet" → enter valid 12/24-word mnemonic → verify duplicate detection works → confirm wallet imported with addresses

### Tests for User Story 2 (TDD - Write First)

- [ ] T078 [P] [US2] Test for mnemonic whitespace normalization (trim, collapse spaces) in /Users/jnr350/Desktop/Yansiang/arcSignv2/tests/cli/mnemonic_normalization_test.go
- [ ] T079 [P] [US2] Test for BIP39 word validation against wordlist in /Users/jnr350/Desktop/Yansiang/arcSignv2/tests/cli/bip39_validation_test.go
- [ ] T080 [P] [US2] Test for BIP39 checksum verification in /Users/jnr350/Desktop/Yansiang/arcSignv2/tests/cli/bip39_checksum_test.go
- [ ] T081 [P] [US2] Test for duplicate wallet detection via Bitcoin address derivation in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/tests/rust/duplicate_detection_test.rs
- [ ] T082 [P] [US2] React test for MnemonicInput component validation in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/tests/frontend/components/MnemonicInput.test.tsx

### CLI Implementation for User Story 2 (Go)

- [ ] T083 [P] [US2] Implement handleImportWalletNonInteractive() that reads MNEMONIC, WALLET_PASSWORD, USB_PATH env vars in /Users/jnr350/Desktop/Yansiang/arcSignv2/cmd/arcsign/handlers.go
- [ ] T084 [US2] Normalize mnemonic whitespace (trim, collapse spaces) in /Users/jnr350/Desktop/Yansiang/arcSignv2/cmd/arcsign/handlers.go
- [ ] T085 [US2] Validate mnemonic word count (12 or 24) in /Users/jnr350/Desktop/Yansiang/arcSignv2/cmd/arcsign/handlers.go
- [ ] T086 [US2] Validate BIP39 words against wordlist using existing mnemonic service in /Users/jnr350/Desktop/Yansiang/arcSignv2/cmd/arcsign/handlers.go
- [ ] T087 [US2] Verify BIP39 checksum using existing mnemonic service in /Users/jnr350/Desktop/Yansiang/arcSignv2/cmd/arcsign/handlers.go
- [ ] T088 [US2] Call existing wallet.Restore() function with mnemonic and password in /Users/jnr350/Desktop/Yansiang/arcSignv2/cmd/arcsign/handlers.go
- [ ] T089 [US2] Call generateAddressesFile() to create addresses.json (reuses T022) in /Users/jnr350/Desktop/Yansiang/arcSignv2/cmd/arcsign/handlers.go
- [ ] T090 [US2] Build CliResponse with wallet metadata (no mnemonic by default) in /Users/jnr350/Desktop/Yansiang/arcSignv2/cmd/arcsign/handlers.go
- [ ] T091 [P] [US2] Add error handling for INVALID_MNEMONIC, WALLET_EXISTS errors in /Users/jnr350/Desktop/Yansiang/arcSignv2/cmd/arcsign/handlers.go

### Tauri Backend for User Story 2 (Rust)

- [ ] T092 [P] [US2] Implement check_duplicate_wallet() function that calls CLI derive_address command (uses T020c) with mnemonic and m/44'/0'/0'/0/0 path in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src-tauri/src/commands/wallet.rs
- [ ] T093 [US2] Read all addresses.json files from USB and extract Bitcoin addresses for comparison in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src-tauri/src/commands/wallet.rs
- [ ] T094 [US2] Compare derived Bitcoin address with existing addresses, return duplicate wallet info (wallet_id, name, created_at) if match found in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src-tauri/src/commands/wallet.rs
- [ ] T095 [US2] Implement import_wallet Tauri command with mnemonic, password, usb_path parameters in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src-tauri/src/commands/wallet.rs
- [ ] T096 [US2] Call check_duplicate_wallet() before CLI invocation in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src-tauri/src/commands/wallet.rs
- [ ] T097 [US2] Call CliWrapper.import_wallet() with environment variables (ARCSIGN_MODE, MNEMONIC, WALLET_PASSWORD, USB_PATH) in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src-tauri/src/commands/wallet.rs
- [ ] T098 [US2] Parse CLI JSON response and extract wallet metadata in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src-tauri/src/commands/wallet.rs

### React Frontend for User Story 2 (TypeScript)

- [ ] T099 [P] [US2] Create Zod mnemonic validation schema (12 or 24 words, BIP39 wordlist check) in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src/validation/mnemonic.ts
- [ ] T100 [US2] Create WalletImport component with React Hook Form + Zod in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src/components/WalletImport.tsx
- [ ] T101 [US2] Implement MnemonicInput component with textarea (12 or 24 words) in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src/components/MnemonicInput.tsx
- [ ] T102 [US2] Add inline validation errors (invalid word, wrong length, checksum failure) in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src/components/MnemonicInput.tsx
- [ ] T103 [US2] Implement word count indicator (e.g., "12/12 words") in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src/components/MnemonicInput.tsx
- [ ] T104 [US2] Implement BIP39 passphrase input (optional, advanced) in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src/components/WalletImport.tsx
- [ ] T105 [US2] Create importWallet() Tauri API wrapper with invoke('import_wallet') in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src/services/tauri-api.ts
- [ ] T106 [US2] Call importWallet() on form submit with loading state in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src/components/WalletImport.tsx
- [ ] T107 [US2] Create DuplicateWalletDialog component with "Cancel" and "Import Anyway" options in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src/components/DuplicateWalletDialog.tsx
- [ ] T108 [US2] Show DuplicateWalletDialog if check_duplicate_wallet returns match in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src/components/WalletImport.tsx
- [ ] T109 [US2] Allow user to proceed with different wallet name if "Import Anyway" clicked in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src/components/WalletImport.tsx

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently - users can create or import wallets

---

## Phase 5: User Story 3 - View All Wallet Addresses (Priority: P1) 🎯 MVP

**Goal**: Users can view all 54 blockchain addresses with search, filter, and copy-to-clipboard functionality

**Independent Test**: Create wallet → click "View Addresses" → verify 54 addresses displayed → test search, filter, and copy functions

### Tests for User Story 3 (TDD - Write First)

- [ ] T110 [P] [US3] Test for addresses.json parsing with schema_version validation in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/tests/rust/addresses_file_parsing_test.rs
- [ ] T111 [P] [US3] Test for SHA-256 checksum validation of addresses array in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/tests/rust/addresses_checksum_test.rs
- [ ] T112 [P] [US3] Test for INVALID_CHECKSUM error handling in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/tests/rust/checksum_error_test.rs
- [ ] T113 [P] [US3] React test for AddressDisplay component rendering in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/tests/frontend/components/AddressDisplay.test.tsx
- [ ] T114 [P] [US3] React test for address search functionality in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/tests/frontend/components/AddressDisplay.test.tsx

### Tauri Backend for User Story 3 (Rust)

- [ ] T115 [P] [US3] Implement read_addresses_file() function that reads addresses.json from USB in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src-tauri/src/commands/address.rs
- [ ] T116 [US3] Parse JSON with serde_json into AddressesFile struct in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src-tauri/src/commands/address.rs
- [ ] T117 [US3] Validate schema_version matches "1.0" in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src-tauri/src/commands/address.rs
- [ ] T118 [US3] Compute SHA-256 checksum of addresses array and compare with file.checksum in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src-tauri/src/commands/address.rs
- [ ] T119 [US3] Return INVALID_CHECKSUM error if mismatch detected in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src-tauri/src/commands/address.rs
- [ ] T120 [US3] Implement get_addresses Tauri command with wallet_id, usb_path parameters in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src-tauri/src/commands/address.rs
- [ ] T121 [US3] Construct absolute path to addresses.json using wallet.addresses_file_path in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src-tauri/src/commands/address.rs
- [ ] T122 [US3] Return addresses array to frontend via Tauri IPC in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src-tauri/src/commands/address.rs

### React Frontend for User Story 3 (TypeScript)

- [ ] T123 [P] [US3] Create TypeScript Address type with all fields (blockchain, symbol, coin_type, account, change, index, address, path, category) in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src/types/address.ts
- [ ] T124 [P] [US3] Create AddressCategory enum (BASE_CHAINS, LAYER_2, REGIONAL, COSMOS, ALTERNATIVE_EVM, SPECIALIZED) in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src/types/address.ts
- [ ] T125 [US3] Create getAddresses() Tauri API wrapper with invoke('get_addresses') in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src/services/tauri-api.ts
- [ ] T126 [US3] Add addresses, searchQuery, filter to Zustand store in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src/stores/dashboardStore.ts
- [ ] T127 [US3] Create AddressDisplay component with search, filter, and list rendering in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src/components/AddressDisplay.tsx
- [ ] T128 [US3] Implement search input with debounced onChange (300ms) in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src/components/AddressDisplay.tsx
- [ ] T129 [US3] Filter addresses by searchQuery (match blockchain name or symbol, case-insensitive) in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src/components/AddressDisplay.tsx
- [ ] T130 [US3] Implement category filter dropdown (All, Base Chains, Layer 2, etc.) in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src/components/AddressDisplay.tsx
- [ ] T131 [US3] Filter addresses by selected category in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src/components/AddressDisplay.tsx
- [ ] T132 [US3] Create AddressCard component displaying blockchain, symbol, address, path in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src/components/AddressCard.tsx
- [ ] T133 [US3] Implement copy-to-clipboard button using Tauri clipboard API in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src/components/AddressCard.tsx
- [ ] T134 [US3] Show toast notification on successful copy ("Address copied to clipboard") in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src/components/AddressCard.tsx
- [ ] T135 [US3] Implement clipboard auto-clear after 30 seconds in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src/components/AddressCard.tsx
- [ ] T136 [US3] Call getAddresses() when wallet is selected in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src/pages/Dashboard.tsx
- [ ] T137 [US3] Show loading spinner while addresses are loading in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src/components/AddressDisplay.tsx
- [ ] T138 [US3] Show error message if checksum validation fails ("Wallet data corrupted. Please restore from backup.") in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src/components/AddressDisplay.tsx

**Checkpoint**: MVP complete! Users can create wallets (US1) and view addresses (US3). Dashboard is functionally usable.

---

## Phase 6: User Story 4 - Manage Multiple Wallets (Priority: P2)

**Goal**: Users can create/import multiple wallets, switch between them, and see wallet metadata

**Independent Test**: Create 2 wallets → verify both appear in wallet list → click each wallet → confirm addresses switch correctly

### Tests for User Story 4 (TDD - Write First)

- [ ] T139 [P] [US4] Test for list_wallets CLI command JSON output in /Users/jnr350/Desktop/Yansiang/arcSignv2/tests/cli/list_wallets_json_test.go
- [ ] T140 [P] [US4] Test for wallet metadata extraction from wallet files in /Users/jnr350/Desktop/Yansiang/arcSignv2/tests/cli/wallet_metadata_test.go
- [ ] T141 [P] [US4] React test for WalletList component rendering in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/tests/frontend/components/WalletList.test.tsx
- [ ] T142 [P] [US4] React test for wallet switching in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/tests/frontend/integration/wallet-switching.test.tsx

### CLI Implementation for User Story 4 (Go)

- [ ] T143 [P] [US4] Implement handleListWalletsNonInteractive() that reads USB_PATH env var in /Users/jnr350/Desktop/Yansiang/arcSignv2/cmd/arcsign/handlers.go
- [ ] T144 [US4] Scan {USB_PATH}/wallets/ directory for wallet subdirectories in /Users/jnr350/Desktop/Yansiang/arcSignv2/cmd/arcsign/handlers.go
- [ ] T145 [US4] Read wallet metadata from each wallet directory (id, name, created_at, uses_passphrase) in /Users/jnr350/Desktop/Yansiang/arcSignv2/cmd/arcsign/handlers.go
- [ ] T146 [US4] Build array of Wallet structs with addresses_file_path in /Users/jnr350/Desktop/Yansiang/arcSignv2/cmd/arcsign/handlers.go
- [ ] T147 [US4] Build CliResponse with wallets array in /Users/jnr350/Desktop/Yansiang/arcSignv2/cmd/arcsign/handlers.go
- [ ] T148 [US4] Call WriteJSON() to output response to stdout in /Users/jnr350/Desktop/Yansiang/arcSignv2/cmd/arcsign/handlers.go

### Tauri Backend for User Story 4 (Rust)

- [ ] T149 [P] [US4] Implement list_wallets Tauri command with usb_path parameter in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src-tauri/src/commands/wallet.rs
- [ ] T150 [US4] Call CliWrapper.list_wallets() with environment variables (ARCSIGN_MODE, USB_PATH) in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src-tauri/src/commands/wallet.rs
- [ ] T151 [US4] Parse CLI JSON response and extract wallets array in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src-tauri/src/commands/wallet.rs
- [ ] T152 [US4] Return wallets array to frontend via Tauri IPC in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src-tauri/src/commands/wallet.rs

### React Frontend for User Story 4 (TypeScript)

- [ ] T153 [P] [US4] Add wallets, selectedWalletId to Zustand store in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src/stores/dashboardStore.ts
- [ ] T154 [P] [US4] Add setWallets, selectWallet actions to Zustand store in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src/stores/dashboardStore.ts
- [ ] T155 [US4] Create listWallets() Tauri API wrapper with invoke('list_wallets') in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src/services/tauri-api.ts
- [ ] T156 [US4] Create WalletList component displaying all wallets in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src/components/WalletList.tsx
- [ ] T157 [US4] Create WalletCard component showing wallet name, created_at, address_count in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src/components/WalletCard.tsx
- [ ] T158 [US4] Implement wallet selection on card click in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src/components/WalletCard.tsx
- [ ] T159 [US4] Highlight selected wallet card with visual indicator in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src/components/WalletCard.tsx
- [ ] T160 [US4] Call listWallets() on dashboard mount and store in Zustand in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src/pages/Dashboard.tsx
- [ ] T161 [US4] Call getAddresses() when selectedWalletId changes in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src/pages/Dashboard.tsx
- [ ] T162 [US4] Show "No wallets found" message if wallets array is empty in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src/components/WalletList.tsx

**Checkpoint**: Users can manage multiple wallets and switch between them seamlessly

---

## Phase 7: User Story 5 - Export Address List (Priority: P3)

**Goal**: Users can export addresses to CSV or JSON files for record-keeping and portfolio tracking

**Independent Test**: Select wallet → click "Export Addresses" → choose CSV format → verify file contains all 54 addresses with metadata

### Tests for User Story 5 (TDD - Write First)

- [ ] T163 [P] [US5] Test for CSV export format with headers and all fields in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/tests/rust/export_csv_test.rs
- [ ] T164 [P] [US5] Test for JSON export format matching addresses.json schema in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/tests/rust/export_json_test.rs
- [ ] T165 [P] [US5] React test for ExportDialog component in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/tests/frontend/components/ExportDialog.test.tsx

### Tauri Backend for User Story 5 (Rust)

- [ ] T166 [P] [US5] Implement export_addresses_csv() function that formats addresses as CSV in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src-tauri/src/commands/address.rs
- [ ] T167 [P] [US5] Implement export_addresses_json() function that formats addresses as JSON in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src-tauri/src/commands/address.rs
- [ ] T168 [US5] Implement export_addresses Tauri command with wallet_id, format, file_path parameters in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src-tauri/src/commands/address.rs
- [ ] T169 [US5] Read addresses from addresses.json using read_addresses_file() (reuses T115) in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src-tauri/src/commands/address.rs
- [ ] T170 [US5] Format addresses based on format parameter (csv or json) in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src-tauri/src/commands/address.rs
- [ ] T171 [US5] Write formatted data to file_path using Tauri fs API in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src-tauri/src/commands/address.rs
- [ ] T172 [US5] Return success response with exported file path in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src-tauri/src/commands/address.rs

### React Frontend for User Story 5 (TypeScript)

- [ ] T173 [P] [US5] Create exportAddresses() Tauri API wrapper with invoke('export_addresses') in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src/services/tauri-api.ts
- [ ] T174 [US5] Create ExportDialog component with format selection (CSV or JSON) in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src/components/ExportDialog.tsx
- [ ] T175 [US5] Implement format radio buttons (CSV / JSON) in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src/components/ExportDialog.tsx
- [ ] T176 [US5] Use Tauri dialog.save() to prompt user for save location in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src/components/ExportDialog.tsx
- [ ] T177 [US5] Call exportAddresses() with selected format and file path in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src/components/ExportDialog.tsx
- [ ] T178 [US5] Show success toast notification with file path on export complete in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src/components/ExportDialog.tsx
- [ ] T179 [US5] Add "Export Addresses" button to AddressDisplay component in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src/components/AddressDisplay.tsx
- [ ] T180 [US5] Show ExportDialog when "Export Addresses" button clicked in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src/components/AddressDisplay.tsx

**Checkpoint**: All user stories complete - full dashboard functionality delivered

---

## Phase 8: Security & Polish (~15 tasks)

**Purpose**: Cross-cutting security enhancements and UX polish

### USB Detection

- [ ] T181 [P] Implement detect_usb_macos() that scans /Volumes/ in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src-tauri/src/commands/usb.rs
- [ ] T182 [P] Implement detect_usb_linux() that scans /media/ and /mnt/ in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src-tauri/src/commands/usb.rs
- [ ] T183 [P] Implement detect_usb_windows() using WMIC to query removable drives in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src-tauri/src/commands/usb.rs
- [ ] T184 Implement detect_usb Tauri command that calls platform-specific function in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src-tauri/src/commands/usb.rs
- [ ] T185 Create useUsbDetection() React hook with 3-second polling in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src/hooks/useUsbDetection.ts
- [ ] T186 Add usbPath, usbDetected to Zustand store in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src/stores/dashboardStore.ts
- [ ] T187 Call useUsbDetection() in Dashboard component in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src/pages/Dashboard.tsx
- [ ] T188 Show "USB not detected" message when usbPath is null in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src/pages/Dashboard.tsx

### Advanced Mnemonic Display Security

- [ ] T189 Create "View Mnemonic Phrase (Advanced)" button with warning dialog in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src/components/WalletCard.tsx
- [ ] T190 Implement password re-entry dialog before showing mnemonic in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src/components/ViewMnemonicDialog.tsx
- [ ] T191 Show security warning about screenshot risks before displaying mnemonic in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src/components/ViewMnemonicDialog.tsx
- [ ] T192 Implement blur on window focus loss when mnemonic is displayed in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src/components/MnemonicDisplay.tsx
- [ ] T193 Disable text selection and copy-paste on mnemonic display in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src/components/MnemonicDisplay.tsx

### Error Handling & Logging

- [ ] T194 Implement sanitized error message mapping for all error codes in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src/services/errorMessages.ts
- [ ] T195 Add debug logging for full error details (exit code, stdout, stderr) in /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard/src-tauri/src/cli/wrapper.rs

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phases 3-7)**: All depend on Foundational phase completion
  - US1 (P1): Can start after Foundational - No dependencies on other stories
  - US2 (P2): Can start after Foundational - No dependencies on other stories
  - US3 (P1): Can start after Foundational - No dependencies on other stories (MVP with US1)
  - US4 (P2): Can start after Foundational - No dependencies on other stories
  - US5 (P3): Depends on US3 (needs addresses to export)
- **Security & Polish (Phase 8)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Independent (uses shared CLI foundation)
- **User Story 3 (P1)**: Can start after Foundational (Phase 2) - Independent (reads addresses.json generated by US1/US2)
- **User Story 4 (P2)**: Can start after Foundational (Phase 2) - Independent (uses shared wallet management)
- **User Story 5 (P3)**: Depends on User Story 3 (exports addresses that US3 displays)

### Within Each User Story

- Tests MUST be written and FAIL before implementation (TDD)
- Models before services
- Services before endpoints
- Core implementation before integration
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel (T003-T010)
- All Foundational tasks marked [P] can run in parallel within subtasks (e.g., T011, T013, T015 parallel within CLI)
- Once Foundational phase completes:
  - US1, US2, US3, US4 can start in parallel (US5 must wait for US3)
  - Tests within each story marked [P] can run in parallel
  - Models within a story marked [P] can run in parallel
  - Different user stories can be worked on by different team members

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together:
Task T036: "Contract test for create_wallet JSON output"
Task T037: "Integration test for CLI create_wallet"
Task T038: "Test for wallet file creation with permissions"
Task T039: "Test for addresses.json generation"
Task T040: "Rust test for create_wallet Tauri command"
Task T041: "React test for WalletCreate form"
Task T042: "React integration test for wallet creation flow"

# Launch parallel CLI tasks:
Task T043: "Implement handleCreateWalletNonInteractive()"
Task T049: "Add error handling for USB_NOT_FOUND, INVALID_PASSWORD"

# Launch parallel Tauri backend tasks:
Task T050: "Implement create_wallet Tauri command"
Task T054: "Add error handling with user-friendly messages"
Task T055: "Log full error details to debug logs"

# Launch parallel React frontend tasks:
Task T056: "Create TypeScript types (Wallet, CreateWalletResponse)"
Task T057: "Create Zod password validation schema"
Task T058: "Create Zod wallet name validation schema"

# Launch parallel screenshot protection tasks:
Task T070: "Implement macOS screenshot protection"
Task T071: "Implement Windows screenshot protection"
Task T072: "Implement Linux watermark overlay"
Task T075: "Create WatermarkOverlay React component"
```

---

## Implementation Strategy

### MVP First (User Story 1 + User Story 3 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1 (Generate New Wallet)
4. Complete Phase 5: User Story 3 (View All Wallet Addresses)
5. **STOP and VALIDATE**: Test wallet creation and address display independently
6. Deploy/demo if ready

**Rationale**: US1 + US3 provide core value (create wallet → see addresses). US2 (import), US4 (multi-wallet), US5 (export) are enhancements.

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo
3. Add User Story 3 → Test independently → Deploy/Demo (MVP!)
4. Add User Story 2 → Test independently → Deploy/Demo
5. Add User Story 4 → Test independently → Deploy/Demo
6. Add User Story 5 → Test independently → Deploy/Demo
7. Add Security & Polish → Final release

Each story adds value without breaking previous stories.

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (T036-T077)
   - Developer B: User Story 2 (T078-T109)
   - Developer C: User Story 3 (T110-T138)
   - Developer D: User Story 4 (T139-T162)
3. Developer C completes User Story 5 after User Story 3 (dependency)
4. Team completes Security & Polish together

---

## Dependency Graph

```
Phase 1: Setup (T001-T010)
    ↓
Phase 2: Foundational (T011-T035)
    ├──────────────┬──────────────┬──────────────┬──────────────┐
    ↓              ↓              ↓              ↓              ↓
Phase 3: US1   Phase 4: US2   Phase 5: US3   Phase 6: US4   [WAIT]
(T036-T077)    (T078-T109)    (T110-T138)    (T139-T162)
P1 🎯 MVP      P2             P1 🎯 MVP      P2
    ↓              ↓              ↓              ↓              ↓
                                                              Phase 7: US5
                                                              (T163-T180)
                                                              P3
                                                              (depends on US3)
    └──────────────┴──────────────┴──────────────┴──────────────┘
                                    ↓
                            Phase 8: Security & Polish
                            (T181-T195)
```

---

## Notes

- [P] tasks = different files, no dependencies, can run in parallel
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing (TDD approach)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- MVP = US1 + US3 (create wallet + view addresses)
- Total tasks: 195 (Setup: 10, Foundational: 25, US1: 42, US2: 32, US3: 29, US4: 24, US5: 18, Polish: 15)
- Estimated effort: 3-4 weeks with 2 developers (MVP in 1-2 weeks)

**Avoid**:
- Vague tasks without file paths
- Multiple tasks editing same file (causes merge conflicts)
- Cross-story dependencies that break independence
- Implementing before tests exist (violates TDD)
