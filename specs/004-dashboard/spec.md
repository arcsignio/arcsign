# Feature Specification: User Dashboard for Wallet Management

**Feature Branch**: `004-dashboard`
**Created**: 2025-10-17
**Status**: Draft
**Input**: User description: "接下來要提供使用者dashboard，從錢包生成，導入助記詞，顯示錢包地址"

## Clarifications

### Session 2025-10-17

- Q: Which GUI framework should be used for the desktop dashboard? (D-008) → A: Tauri (Rust backend + web UI, small bundle ~10MB, secure, cross-platform)
- Q: What happens when user enters an invalid mnemonic phrase with incorrect checksum? → A: Display inline error message immediately
- Q: How does system handle mnemonic phrases with extra whitespace or incorrect word ordering? → A: Normalize whitespace, validate words
- Q: What happens when user tries to import a wallet that already exists in the dashboard? → A: Show warning, allow renaming
- Q: How does system respond when user cancels wallet creation midway through the flow? → A: Discard changes, return home

### Session 2025-10-22

- Q: The CLI needs to support non-interactive invocation by the Tauri dashboard. How should the CLI be restructured? → A: Refactor CLI to support both modes: detect environment variables (WALLET_PASSWORD, USB_PATH, etc.) for non-interactive mode, output JSON to stdout; keep stdin prompts for interactive mode
- Q: When the Tauri backend invokes the CLI subprocess and encounters failures (timeout, crash, malformed JSON, or non-zero exit code), what should the error handling behavior be? → A: Set 30-second timeout for wallet operations; capture stderr and parse for JSON error object first, fallback to raw stderr message, then "Wallet operation failed with exit code X" if stderr empty; for malformed JSON return "Invalid response from wallet service"; log full error details (exit code, stdout, stderr) to Tauri debug logs; show sanitized error messages to users (no sensitive data)
- Q: What should the exact JSON response format structure be for CLI commands, and what should the addresses file format be? → A: **stdout**: Single-line JSON only (machine-readable); **stderr**: logs/debug (human-readable). **Responses include**: `success` boolean, optional `mnemonic` (only if `RETURN_MNEMONIC=true`), `request_id`, `cli_version`, `duration_ms`, `warnings`. **Relative paths**: `wallets/{id}/addresses.json` (Dashboard prepends USB_PATH). **addresses.json**: includes `schema_version: "1.0"`, `checksum` (SHA-256 of addresses array for tamper detection), BIP44 components (`account`, `change`, `index`). **Error codes**: `INVALID_PASSWORD | USB_NOT_FOUND | WALLET_EXISTS | CRYPTO_ERROR | IO_ERROR | TIMEOUT | INVALID_SCHEMA | INVALID_CHECKSUM`. **Security**: mnemonic excluded by default, no sensitive data in stderr. **Versioning**: forward-compatible (add fields only, never remove/rename). **Workflow**: CLI auto-generates all 54 addresses during wallet creation and saves to addresses.json; Dashboard reads file directly for display
- Q: How should the system detect duplicate wallet imports when user enters a mnemonic phrase? → A: Derive Bitcoin address at `m/44'/0'/0'/0/0` in memory from imported mnemonic+passphrase (without creating wallet file); compare against Bitcoin address in all existing `addresses.json` files; if match found, show duplicate warning dialog with options to Cancel or Import Anyway with different name; same mnemonic with different passphrase produces different addresses and is not considered duplicate; this method is fast (1 derivation only), reliable (Bitcoin address uniquely identifies seed+passphrase), and respects passphrase combinations
- Q: How should the system implement mnemonic display security, given the risk of screenshots and screen recordings? → A: **Default behavior**: Hide mnemonic completely after wallet creation; show only "Wallet created successfully. Please backup your encrypted wallet file to multiple USB drives." **Advanced option**: Provide "View Mnemonic Phrase (Advanced)" button that requires password re-entry and shows severe warning about screenshot risks before displaying. **Protection measures** (when mnemonic is displayed): macOS uses `NSWindow.setContentProtection(true)`; Windows uses `SetWindowDisplayAffinity(WDA_EXCLUDEFROMCAPTURE)`; Linux shows visible watermark + randomized word layout + warning banner; all platforms implement 30-second mandatory countdown, blur on window focus loss, one-time display (cannot navigate back), disabled copy-paste/text selection, and warning dialog about camera-only backup. **Additional feature**: Separate "Decrypt and View Mnemonic" function accessible from wallet management menu (requires password, applies all security measures)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Generate New Wallet (Priority: P1)

A new user wants to create their first cryptocurrency wallet to start receiving digital assets. They open the dashboard and initiate wallet creation, receiving a secure mnemonic phrase that they must safely store offline before proceeding.

**Why this priority**: This is the entry point for all new users. Without the ability to create a wallet, users cannot access any other features. This represents the core value proposition of the wallet application.

**Independent Test**: Can be fully tested by launching the dashboard, clicking "Create New Wallet", completing the setup flow, and verifying that a valid wallet is created with a displayed mnemonic phrase. Delivers immediate value by giving users a functional wallet.

**Acceptance Scenarios**:

1. **Given** user opens the dashboard for the first time, **When** user clicks "Create New Wallet" button, **Then** system guides user through wallet creation workflow
2. **Given** user is in wallet creation flow, **When** user sets an encryption password, **Then** system validates password strength and displays requirements
3. **Given** user has set encryption password, **When** wallet is created, **Then** system displays mnemonic phrase with clear backup instructions
4. **Given** mnemonic phrase is displayed, **When** user confirms they have backed up the phrase, **Then** system proceeds to show the wallet dashboard with the new wallet loaded
5. **Given** wallet creation is complete, **When** user returns to dashboard, **Then** system displays the newly created wallet in the wallet list

---

### User Story 2 - Import Existing Wallet from Mnemonic (Priority: P2)

An existing cryptocurrency user wants to access their wallet on this application using their previously created mnemonic phrase. They navigate to the import option, enter their mnemonic, and regain access to their funds.

**Why this priority**: This enables wallet portability and allows users to migrate from other BIP39-compatible wallets. Critical for user acquisition from existing crypto holders but secondary to new wallet creation as it's not the primary use case for new users.

**Independent Test**: Can be tested independently by selecting "Import Wallet", entering a valid test mnemonic (e.g., "abandon abandon abandon..."), setting an encryption password, and verifying that the wallet is restored with correct addresses matching the mnemonic.

**Acceptance Scenarios**:

1. **Given** user is on dashboard, **When** user clicks "Import Wallet" button, **Then** system displays mnemonic import interface
2. **Given** import interface is shown, **When** user enters a valid mnemonic phrase (12 or 24 words), **Then** system validates the mnemonic format and checksum
3. **Given** valid mnemonic is entered, **When** user optionally enters BIP39 passphrase, **Then** system accepts the passphrase for wallet derivation
4. **Given** mnemonic and optional passphrase are provided, **When** user sets encryption password, **Then** system derives wallet and displays confirmation
5. **Given** wallet import is complete, **When** user views dashboard, **Then** imported wallet appears in wallet list with all addresses

---

### User Story 3 - View All Wallet Addresses (Priority: P1)

A user with an active wallet wants to view their cryptocurrency addresses across all 54 supported blockchains to receive payments or verify their holdings. They select their wallet from the dashboard and see a comprehensive, categorized list of all addresses.

**Why this priority**: This is the primary value delivery after wallet creation. Users need to see their addresses to actually use the wallet. Without address display, the wallet is essentially non-functional for its core purpose.

**Independent Test**: Can be tested by creating or importing a wallet, then navigating to the address display view and verifying that addresses are shown for all 54 supported blockchains, properly categorized and formatted.

**Acceptance Scenarios**:

1. **Given** user has a wallet loaded, **When** user views the dashboard, **Then** system displays wallet overview with total number of supported blockchains
2. **Given** wallet overview is shown, **When** user clicks "View All Addresses", **Then** system displays addresses organized by category (Base Chains, Layer 2, Regional, Cosmos, EVM, Specialized)
3. **Given** address list is displayed, **When** user views an address, **Then** system shows the full address with copy-to-clipboard functionality
4. **Given** user views addresses, **When** user filters by blockchain category, **Then** system shows only addresses matching the selected category
5. **Given** user views addresses, **When** user searches for a specific blockchain by name or symbol, **Then** system highlights matching addresses
6. **Given** address is displayed, **When** user clicks copy button, **Then** system copies address to clipboard and shows confirmation feedback

---

### User Story 4 - Manage Multiple Wallets (Priority: P2)

A user wants to organize their cryptocurrency holdings across multiple wallets for different purposes (e.g., personal, business, cold storage). They can create or import multiple wallets and switch between them in the dashboard.

**Why this priority**: Enhances user organization and security practices but is not essential for basic wallet functionality. Users can accomplish basic tasks with a single wallet, making this an enhancement rather than core feature.

**Independent Test**: Can be tested by creating two separate wallets, verifying both appear in the wallet list, switching between them, and confirming that each displays its unique addresses.

**Acceptance Scenarios**:

1. **Given** user has one wallet, **When** user creates or imports another wallet, **Then** dashboard displays a list of all wallets
2. **Given** multiple wallets exist, **When** user clicks on a wallet from the list, **Then** system switches to that wallet and displays its addresses
3. **Given** multiple wallets exist, **When** user views wallet list, **Then** each wallet shows its name, creation date, and number of addresses
4. **Given** wallet list is displayed, **When** user sets a custom name for a wallet, **Then** system saves and displays the custom name

---

### User Story 5 - Export Address List (Priority: P3)

A user wants to export their wallet addresses to a file for record-keeping, tax purposes, or integration with portfolio tracking tools. They select the export option and receive a comprehensive file with all addresses and metadata.

**Why this priority**: This is a convenience feature that adds value but is not essential for core wallet operations. Users can manually copy addresses when needed, making export functionality a nice-to-have enhancement.

**Independent Test**: Can be tested by selecting a wallet, clicking "Export Addresses", choosing a format (CSV/JSON), and verifying the exported file contains all addresses with proper formatting and metadata.

**Acceptance Scenarios**:

1. **Given** user has a wallet loaded, **When** user clicks "Export Addresses", **Then** system presents export format options (CSV, JSON)
2. **Given** export format is selected, **When** user initiates export, **Then** system generates and downloads file with all addresses
3. **Given** file is downloaded, **When** user opens the file, **Then** file contains addresses with blockchain name, symbol, coin type, derivation path, and category

---

### Edge Cases

- **Invalid mnemonic checksum**: System displays inline error message immediately below input field: "Invalid mnemonic: checksum verification failed". User remains in import interface to correct input.
- **Extra whitespace in mnemonic**: System automatically trims leading/trailing whitespace and collapses multiple spaces between words to single space before validation. If words are valid BIP39 words but in wrong order, displays "Invalid word order" error.
- **Duplicate wallet import**: System derives Bitcoin address at m/44'/0'/0'/0/0 in memory, compares with existing addresses.json files, displays warning dialog if match found with wallet creation date, allows cancel or import with different name.
- **Cancellation during wallet creation**: System shows confirmation dialog "Cancel wallet creation? Unsaved data will be lost" with Cancel/Confirm buttons. On confirm, discards all input data, clears mnemonic from memory, and returns user to dashboard home.
- **CLI subprocess timeout**: After 30 seconds, Dashboard terminates subprocess and displays "Wallet operation timed out. Please check USB connection and try again."
- **CLI subprocess crash**: Dashboard captures stderr, parses for JSON error object; if none, shows raw stderr; if empty, shows "Wallet operation failed with exit code X"
- **Malformed CLI JSON output**: Dashboard catches JSON parse error and displays "Invalid response from wallet service. Please check USB device and try again."
- **addresses.json checksum mismatch**: Dashboard validates SHA-256 checksum on file read; if mismatch, shows "Wallet data corrupted. Please restore from backup." error
- **Mnemonic display screenshot attempt**: Platform-specific protection blocks capture (macOS/Windows OS-level, Linux shows watermark); user sees warning about camera-only backup
- **Internet connection loss**: Wallet operations work offline (no connectivity required); addresses generated locally from seed
- **Very long addresses on small screens**: UI implements horizontal scrolling with copy button always visible; address truncated with ellipsis in list view, full address shown on click
- **Clipboard access denied**: Copy button shows error toast "Clipboard access denied. Please enable in system settings." and displays full address for manual selection

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a dashboard interface that displays all user wallets
- **FR-002**: System MUST allow users to create new wallets through a guided workflow
- **FR-003**: System MUST generate and display a BIP39 mnemonic phrase (12 or 24 words) during wallet creation
- **FR-004**: System MUST require users to explicitly confirm they have backed up their mnemonic before proceeding
- **FR-005**: System MUST allow users to import existing wallets using BIP39 mnemonic phrases
- **FR-006**: System MUST validate mnemonic phrase format and checksum during import
- **FR-007**: System MUST support optional BIP39 passphrase (25th word) during wallet creation and import
- **FR-008**: System MUST require users to set an encryption password for wallet storage
- **FR-009**: System MUST validate encryption password strength (minimum 12 characters, complexity requirements)
- **FR-010**: System MUST display addresses for all 54 supported blockchains for each wallet
- **FR-011**: System MUST organize addresses by category (Base Chains, Layer 2, Regional, Cosmos, Alternative EVM, Specialized)
- **FR-012**: System MUST display blockchain name, symbol, and derivation path alongside each address
- **FR-013**: System MUST provide copy-to-clipboard functionality for each address
- **FR-014**: System MUST allow users to filter addresses by category
- **FR-015**: System MUST allow users to search addresses by blockchain name or symbol
- **FR-016**: System MUST support multiple wallets per user
- **FR-017**: System MUST allow users to switch between different wallets
- **FR-018**: System MUST display wallet metadata (name, creation date, address count) in wallet list
- **FR-019**: System MUST allow users to set custom names for wallets
- **FR-020**: System MUST export addresses to CSV and JSON formats
- **FR-021**: System MUST include address metadata in exported files (blockchain, symbol, coin type, path, category)
- **FR-022**: System MUST persist wallet data to USB storage only (no hard drive storage)
- **FR-023**: System MUST encrypt all stored wallet data using AES-256-GCM with user's password
- **FR-024**: System MUST detect and mount USB storage before wallet operations
- **FR-025**: System MUST prevent display of mnemonic phrases after initial creation/import confirmation
- **FR-026**: System MUST provide visual feedback for all user actions (loading states, success, errors)
- **FR-027**: System MUST handle wallet creation/import failures gracefully with clear error messages
- **FR-028**: System MUST prevent multiple simultaneous wallet operations to avoid data corruption
- **FR-029**: System MUST display inline validation errors immediately when invalid mnemonic is entered, showing specific error type (checksum failure, invalid word, wrong length)
- **FR-030**: System MUST automatically normalize mnemonic input by trimming whitespace and collapsing multiple spaces, then validate each word against BIP39 wordlist before checksum validation
- **FR-031**: System MUST detect duplicate wallet imports by deriving Bitcoin address at m/44'/0'/0'/0/0 in memory and comparing against existing addresses.json files, display warning dialog if match found, and allow user to cancel or proceed with different wallet name
- **FR-032**: System MUST display confirmation dialog when user cancels wallet creation, discard all unsaved data, clear sensitive information from memory, and return to dashboard home
- **FR-033**: CLI MUST support non-interactive mode by detecting environment variables (WALLET_PASSWORD, USB_PATH, MNEMONIC_LENGTH, etc.) and outputting single-line JSON to stdout while logging to stderr
- **FR-034**: CLI MUST support interactive mode with stdin prompts when environment variables are not set
- **FR-035**: CLI MUST automatically generate all 54 addresses upon wallet creation and save to {USB_PATH}/wallets/{id}/addresses.json with schema_version, checksum, and full BIP44 derivation components
- **FR-036**: System MUST implement 30-second timeout for all CLI subprocess operations
- **FR-037**: System MUST parse CLI subprocess errors in this order: JSON error object from stderr, raw stderr message, then generic message with exit code if stderr empty
- **FR-038**: System MUST log full subprocess error details (exit code, stdout, stderr) to debug logs while showing sanitized messages to users
- **FR-039**: CLI JSON responses MUST include success boolean, optional mnemonic (only if RETURN_MNEMONIC=true), request_id, cli_version, duration_ms, and warnings array
- **FR-040**: addresses.json MUST include schema_version "1.0", SHA-256 checksum of addresses array, and separate account/change/index fields for each address
- **FR-041**: System MUST use relative paths (wallets/{id}/addresses.json) in CLI responses, with Dashboard prepending USB_PATH for absolute path resolution
- **FR-042**: CLI error codes MUST be from enumerated set: INVALID_PASSWORD, USB_NOT_FOUND, WALLET_EXISTS, INVALID_MNEMONIC, CRYPTO_ERROR, IO_ERROR, TIMEOUT, INVALID_SCHEMA, INVALID_CHECKSUM
- **FR-043**: System MUST display mnemonic phrase with security protections (FR-045, FR-046) immediately after wallet creation, require explicit backup confirmation, then hide mnemonic permanently (user can later view via FR-047 "Decrypt and View Mnemonic" with password re-entry)
- **FR-044**: System MUST provide "View Mnemonic Phrase (Advanced)" button that requires password re-entry and shows security warning before displaying mnemonic
- **FR-045**: System MUST implement platform-specific screenshot protection: macOS NSWindow.setContentProtection(true), Windows SetWindowDisplayAffinity(WDA_EXCLUDEFROMCAPTURE), Linux watermark + randomized layout + warning
- **FR-046**: System MUST implement mnemonic display protections: 30-second countdown, blur on focus loss, one-time display, disabled copy-paste, and camera-only backup warning
- **FR-047**: System MUST provide "Decrypt and View Mnemonic" function in wallet management menu with password requirement and all security protections
- **FR-048**: CLI MUST provide standalone derive_address command that accepts MNEMONIC, BIP39_PASSPHRASE (optional), DERIVATION_PATH environment variables, derives a single address in memory without creating wallet files, and outputs JSON response with derived address for duplicate detection purposes

### Key Entities

- **Wallet**: Represents a hierarchical deterministic wallet containing a mnemonic seed, encryption metadata, and derived addresses. Each wallet has a unique ID, optional custom name, creation timestamp, and BIP39 passphrase flag.

- **Address**: Represents a cryptocurrency address derived from a wallet, including the blockchain symbol, name, coin type, BIP44 derivation path with separate account/change/index fields, address string, and blockchain category.

- **Addresses File**: JSON file stored at {USB_PATH}/wallets/{id}/addresses.json containing schema_version "1.0", wallet_id, generated_at timestamp, total_count, SHA-256 checksum of addresses array, and array of all 54 addresses with full metadata.

- **CLI Response**: JSON object output to stdout containing success boolean, optional mnemonic (only if RETURN_MNEMONIC=true), wallet data, request_id (UUID for tracing), cli_version, duration_ms, and warnings array.

- **CLI Error Response**: JSON object output to stdout containing success: false, error object with code (from enumerated set) and message, request_id, cli_version, and duration_ms.

- **Dashboard State**: Represents the current view state including selected wallet, active filters, search query, and display preferences.

- **Export Package**: Represents a collection of addresses with metadata prepared for export, including wallet information, generation timestamp, and address list with full metadata.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can complete new wallet creation from dashboard launch to mnemonic backup confirmation in under 3 minutes
- **SC-002**: Users can successfully import an existing wallet using a 12-word or 24-word mnemonic in under 2 minutes
- **SC-003**: Dashboard displays all 54 blockchain addresses for a wallet within 15 seconds of wallet selection
- **SC-004**: Users can locate and copy a specific blockchain address in under 10 seconds using search or filter
- **SC-005**: 95% of users successfully complete their first wallet creation without errors or support requests
- **SC-006**: Address copy-to-clipboard operation completes instantly with visible confirmation feedback
- **SC-007**: Dashboard supports management of up to 10 wallets without performance degradation
- **SC-008**: Address export generates complete CSV/JSON files in under 5 seconds
- **SC-009**: System prevents accidental mnemonic phrase exposure with 100% reliability (no screenshots, no screen recordings capture the phrase)
- **SC-010**: Dashboard remains responsive with sub-200ms interactions for all user actions (clicks, searches, filters)
- **SC-011**: 90% of wallet import attempts succeed on first try when users provide valid mnemonics
- **SC-012**: Users can switch between wallets with addresses refreshing in under 2 seconds

## Assumptions *(include when making informed guesses)*

- **A-001**: Users have a compatible USB drive available for wallet storage (as per existing system requirements)
- **A-002**: Dashboard will be a desktop application (not web-based) given the USB storage requirement
- **A-003**: Users are familiar with basic cryptocurrency concepts (mnemonic phrases, addresses, blockchains)
- **A-004**: Dashboard displays all 54 addresses upfront rather than generating on-demand, leveraging existing generate-all functionality
- **A-005**: Wallet list displays up to 10 wallets before requiring pagination (reasonable default for personal use)
- **A-006**: Search and filter operations happen client-side (no server component) for security
- **A-007**: Dashboard invokes the CLI in non-interactive mode via subprocess, passing parameters through environment variables (WALLET_PASSWORD, USB_PATH, MNEMONIC_LENGTH, etc.) and receiving JSON responses from stdout; CLI retains interactive stdin prompts for direct terminal use
- **A-008**: Mnemonic phrase display includes a mandatory countdown timer (e.g., 30 seconds) before allowing user to confirm backup
- **A-009**: Dashboard includes a "restore wallet" feature separate from regular unlock to decrypt and view mnemonic
- **A-010**: Export functionality uses existing generate-all command, providing GUI trigger and file location selection

## Out of Scope *(include when feature boundaries need clarification)*

- **OS-001**: Transaction signing and broadcasting (address generation and display only)
- **OS-002**: Balance checking or portfolio tracking (addresses only, no blockchain integration)
- **OS-003**: QR code generation for addresses (copy-to-clipboard only in this phase)
- **OS-004**: Address book or contact management (recipient addresses not included)
- **OS-005**: Multi-language support (English only initially)
- **OS-006**: Mobile or web versions (desktop application only)
- **OS-007**: Hardware wallet integration (software wallet only)
- **OS-008**: Custom derivation paths (BIP44 standard path m/44'/coin'/0'/0/0 only)
- **OS-009**: Address labeling or notes (metadata only)
- **OS-010**: Cloud backup or synchronization (USB-only storage maintained)
- **OS-011**: Two-factor authentication (password-only protection)
- **OS-012**: Social recovery or multi-signature features

## Dependencies *(include when feature relies on external factors)*

- **D-001**: Existing CLI wallet service with create, restore, and generate-all commands
- **D-002**: Existing 54-blockchain address derivation formatters
- **D-003**: Existing USB storage detection and management service
- **D-004**: Existing encryption service (AES-256-GCM + Argon2id)
- **D-005**: Existing BIP39 service for mnemonic generation and validation
- **D-006**: Existing HD key service for BIP32/BIP44 derivation
- **D-007**: Existing coin registry with metadata for all 54 blockchains
- **D-008**: Tauri framework (Rust backend + web frontend, ~10MB bundle, cross-platform support via WebView, subprocess integration with existing Go CLI)
- **D-009**: Clipboard API availability in chosen GUI framework
- **D-010**: File system API for export functionality in chosen GUI framework

## Technical Constraints *(include when known limitations exist)*

- **TC-001**: All wallet data must be stored exclusively on USB drives (no hard drive storage)
- **TC-002**: Encrypted wallet files must use existing AES-256-GCM + Argon2id format
- **TC-003**: Mnemonic generation must follow BIP39 standard
- **TC-004**: Address derivation must follow BIP44 standard with existing paths
- **TC-005**: Dashboard must work offline (no internet connectivity required except for optional balance checking in future)
- **TC-006**: Dashboard must support Windows, macOS, and Linux (cross-platform requirement)
- **TC-007**: Password validation must enforce existing security requirements (12+ characters, complexity)
- **TC-008**: Rate limiting must be maintained (3 password attempts per minute)
- **TC-009**: Audit logging must continue for all wallet operations
- **TC-010**: File permissions must remain 0600 for all wallet data

## Security Considerations *(include when security is relevant)*

- **SEC-001**: Mnemonic phrases must never be persisted in plaintext (only encrypted storage)
- **SEC-002**: Mnemonic display must be time-limited and require explicit user confirmation before proceeding
- **SEC-003**: Dashboard must clear mnemonic from memory immediately after user confirmation or cancellation
- **SEC-004**: Screen recording or screenshot prevention should be implemented for mnemonic display screens
- **SEC-005**: Clipboard must be cleared after 30 seconds when addresses are copied
- **SEC-006**: Dashboard must lock/logout after 15 minutes of inactivity
- **SEC-007**: Password fields must use secure input (no plaintext display)
- **SEC-008**: Error messages must not reveal sensitive information (wallet existence, password hints, etc.)
- **SEC-009**: Dashboard must validate all user inputs to prevent injection attacks
- **SEC-010**: USB detection must verify write permissions before allowing wallet creation
