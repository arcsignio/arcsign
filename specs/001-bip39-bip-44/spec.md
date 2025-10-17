# Feature Specification: Wallet Mnemonic Management (BIP39/BIP44)

**Feature Branch**: `001-bip39-bip-44`
**Created**: 2025-10-15
**Status**: Draft
**Input**: User description: "先建立錢包註記詞相關的功能，支持bip39到bip-44"

## Clarifications

### Session 2025-10-15

- Q: Should the wallet support BIP39 optional passphrase (25th word) for additional security? → A: Optional passphrase support - users can add extra protection
- Q: How should the system behave when USB secure storage is unavailable or full during wallet operations? → A: Software-based encryption approach - mnemonic encrypted with user strong password via Argon2id KDF, then AES-256-GCM, stored on USB. If USB unavailable, display clear error and guide user to resolve (insert USB, free space)
- Q: How long should the mnemonic remain visible on screen during initial wallet creation? → A: 60 seconds with warning at 45 seconds
- Q: What rate limiting should apply to incorrect password/mnemonic restoration attempts? → A: 5 attempts per 15 minutes window
- Q: Should the system maintain an audit trail of wallet operations for security monitoring? → A: Audit log on USB - track wallet operations only

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Generate New Wallet Mnemonic (Priority: P1)

A user needs to create a new cryptocurrency wallet by generating a secure mnemonic phrase. The system generates a random mnemonic phrase following BIP39 standards, displays it to the user for backup, and confirms the user has safely recorded it before proceeding.

**Why this priority**: This is the foundational capability for wallet creation. Without the ability to generate a secure mnemonic, no other wallet operations are possible. This represents the minimum viable product.

**Independent Test**: Can be fully tested by generating a mnemonic phrase, verifying it meets BIP39 standards (valid word list, correct length, valid checksum), and confirming the user can view and backup the phrase.

**Acceptance Scenarios**:

1. **Given** the user has no existing wallet, **When** they request to create a new wallet and provide a strong encryption password, **Then** the system generates a valid 12-word BIP39 mnemonic phrase and displays it for backup
2. **Given** a mnemonic phrase is displayed, **When** the user confirms they have backed it up, **Then** the system requires the user to verify they recorded it correctly by entering specific words
3. **Given** the user successfully verifies their backup, **When** the wallet is created, **Then** the mnemonic is encrypted using Argon2id + AES-256-GCM with the user's password and stored on USB, never exposed in logs or unsecured storage
4. **Given** the user requests a 24-word mnemonic instead of 12-word, **When** generating the wallet, **Then** the system generates a valid 24-word BIP39 mnemonic phrase
5. **Given** the user creates a new wallet, **When** they optionally provide a passphrase (25th word), **Then** the system derives the master seed using both the mnemonic and passphrase, creating a distinct wallet from the same mnemonic without passphrase
6. **Given** a mnemonic is displayed, **When** 45 seconds have elapsed, **Then** the system displays a warning that the mnemonic will be hidden in 15 seconds
7. **Given** a mnemonic has been displayed for 60 seconds, **When** the timeout expires, **Then** the system automatically clears the mnemonic from the screen

---

### User Story 2 - Restore Wallet from Mnemonic (Priority: P2)

A user needs to restore access to their cryptocurrency wallet using their previously backed-up mnemonic phrase. The system validates the entered mnemonic and recovers the wallet's master seed, allowing the user to regain access to their assets.

**Why this priority**: Wallet recovery is critical for users who lose access to their device or need to migrate to a new device. This is the second most important feature after wallet creation.

**Independent Test**: Can be tested independently by providing a valid BIP39 mnemonic phrase, verifying the system accepts it, validates the checksum, and successfully restores wallet access with the correct derived addresses.

**Acceptance Scenarios**:

1. **Given** the user has a valid mnemonic phrase from a previous wallet, **When** they enter it into the restore function, **Then** the system validates the mnemonic and restores wallet access
2. **Given** the user enters an invalid mnemonic (wrong checksum or invalid words), **When** attempting to restore, **Then** the system displays a clear error message and does not proceed
3. **Given** the user enters a valid mnemonic with extra spaces or inconsistent capitalization, **When** restoring, **Then** the system normalizes the input and successfully restores the wallet
4. **Given** a restored wallet, **When** the user views their addresses, **Then** the addresses match those from the original wallet
5. **Given** the user's original wallet was created with a passphrase, **When** they restore using only the mnemonic without the passphrase, **Then** the system restores a different wallet (addresses do not match), and the system prompts for the optional passphrase if address verification fails
6. **Given** the user has entered an incorrect password 5 times within 15 minutes, **When** they attempt a 6th try, **Then** the system blocks further attempts and displays the remaining lockout time

---

### User Story 3 - Derive Hierarchical Deterministic (HD) Addresses (Priority: P3)

A user needs to generate multiple cryptocurrency addresses from their single mnemonic phrase following BIP44 standards. The system derives addresses for different cryptocurrencies and account structures using the hierarchical deterministic wallet specification.

**Why this priority**: HD address derivation enables advanced use cases like multi-currency wallets and address management. While important, users can still create and restore basic wallets without this feature.

**Independent Test**: Can be tested by providing a known mnemonic and derivation path, then verifying the system generates the correct addresses according to BIP44 specifications (m/44'/coin_type'/account'/change/address_index).

**Acceptance Scenarios**:

1. **Given** a wallet with a mnemonic seed, **When** the user requests a new receive address for Bitcoin, **Then** the system derives the next address using path m/44'/0'/0'/0/[index]
2. **Given** a wallet with a mnemonic seed, **When** the user requests addresses for multiple cryptocurrencies, **Then** the system derives addresses using the correct coin_type for each cryptocurrency
3. **Given** a specific derivation path, **When** the user manually specifies an address index, **Then** the system derives the address at that exact path
4. **Given** derived addresses, **When** the user exports address information, **Then** the system shows the derivation path but never exposes the private keys or mnemonic

---

### Edge Cases

- What happens when the user attempts to generate a mnemonic but the system cannot access a secure random number source?
- How does the system handle malformed mnemonic input during restoration (partial phrases, words not in BIP39 word list)?
- What happens when the user tries to derive addresses beyond the maximum recommended index?
- How does the system respond when the USB storage device is unavailable or full? (System displays clear error message and guides user to insert USB or free up space)
- What happens if the user cancels the mnemonic backup verification process midway?
- How does the system handle concurrent wallet creation or restoration requests?
- What happens when the user forgets their encryption password? (Unrecoverable without mnemonic backup)
- What happens if the user enters an incorrect encryption password during wallet access? (Rate limited to 5 attempts per 15 minutes)
- What happens when the user exceeds the rate limit for failed attempts? (Locked out for remainder of 15-minute window with clear countdown display)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST generate cryptographically secure random mnemonics following BIP39 specification
- **FR-002**: System MUST support both 12-word (128-bit entropy) and 24-word (256-bit entropy) mnemonic phrases
- **FR-003**: System MUST validate mnemonic checksums during restoration to detect invalid phrases
- **FR-004**: System MUST normalize mnemonic input (trim whitespace, lowercase conversion) before validation
- **FR-005**: System MUST derive master seed from mnemonic using PBKDF2-HMAC-SHA512 as specified in BIP39
- **FR-006**: System MUST support hierarchical deterministic key derivation following BIP32 specification
- **FR-007**: System MUST support BIP44 multi-account hierarchy structure (m/44'/coin_type'/account'/change/address_index)
- **FR-008**: System MUST support derivation paths for major cryptocurrencies using registered coin_type values
- **FR-009**: System MUST display generated mnemonics to users exactly once during initial creation with clear backup instructions
- **FR-010**: System MUST require mnemonic backup verification before allowing wallet usage
- **FR-011**: System MUST restore wallets from valid BIP39 mnemonic phrases and regenerate the same addresses
- **FR-012**: System MUST validate that user input contains only words from the BIP39 word list
- **FR-013**: System MUST derive addresses deterministically so the same mnemonic always produces the same address sequence
- **FR-014**: System MUST maintain an address index to track which addresses have been generated for each account
- **FR-015**: System MUST support optional BIP39 passphrase (25th word) during wallet creation and restoration
- **FR-016**: System MUST derive different master seeds when the same mnemonic is used with different passphrases
- **FR-017**: System MUST allow users to create wallets without a passphrase (empty passphrase is valid per BIP39)
- **FR-018**: System MUST require a strong encryption password from the user before creating or accessing a wallet
- **FR-019**: System MUST validate encryption password strength (minimum requirements to be defined in planning phase)
- **FR-020**: System MUST display clear error messages when USB storage is unavailable or full, with actionable guidance
- **FR-021**: System MUST prevent wallet operations when USB storage cannot be accessed until the issue is resolved
- **FR-022**: System MUST display the generated mnemonic for 60 seconds with a warning notification at 45 seconds
- **FR-023**: System MUST clear the mnemonic from the display after 60 seconds and require the user to re-display if needed
- **FR-024**: System MUST allow users to manually hide the mnemonic before the timeout expires
- **FR-025**: System MUST track failed password and mnemonic restoration attempts with timestamps
- **FR-026**: System MUST display remaining attempts and lockout time when rate limit is approaching or exceeded
- **FR-027**: System MUST reset the attempt counter after 15 minutes from the first failed attempt
- **FR-028**: System MUST maintain an audit log on USB storage recording wallet operations (creation, access, restoration attempts)
- **FR-029**: Audit log entries MUST include: timestamp, operation type, success/failure status, but MUST NOT include sensitive data
- **FR-030**: System MUST allow users to view the audit log for their wallet to detect unauthorized access attempts

### Security Requirements

- **SR-001**: Mnemonics MUST be encrypted using user-provided strong password via Argon2id KDF, then AES-256-GCM encryption, before storage on USB
- **SR-002**: Encryption keys derived from user password MUST NOT be stored; keys are re-derived from password on each wallet access
- **SR-003**: Encrypted mnemonic files MUST be stored exclusively on USB storage device (not on system internal storage)
- **SR-004**: System MUST use cryptographically secure random number generation (CSRNG) for mnemonic generation
- **SR-005**: System MUST NOT log mnemonics, seeds, private keys, encryption passwords, or any portion thereof
- **SR-006**: System MUST clear mnemonics, seeds, passwords, and derived keys from memory immediately after use
- **SR-007**: System MUST require both application password and wallet encryption password before allowing mnemonic access
- **SR-008**: Derivation operations MUST clear intermediate keys from memory immediately after address derivation
- **SR-009**: System MUST rate-limit password attempts and mnemonic restoration attempts to maximum 5 attempts per 15-minute window to prevent brute-force attacks
- **SR-010**: BIP39 passphrases MUST be handled with the same security controls as mnemonics (no storage, memory clearing, no logging)
- **SR-011**: System MUST NOT store BIP39 passphrases; passphrase is required on each wallet access for passphrase-protected wallets
- **SR-012**: Argon2id parameters MUST be configured for high security (time cost, memory cost, parallelism to be defined in planning phase)
- **SR-013**: System SHOULD prevent screenshots and screen recording when mnemonic is displayed (platform-dependent capability)
- **SR-014**: System MUST warn users about the 60-second display timeout to encourage prompt manual backup
- **SR-015**: Audit logs MUST NOT contain sensitive data (mnemonics, seeds, private keys, passwords, passphrases, addresses, amounts)
- **SR-016**: Audit log files MUST be tamper-evident (append-only, cryptographically signed or integrity-protected)
- **SR-017**: Audit logs MUST be stored on the same USB device as the encrypted wallet for co-location with wallet data

### Key Entities

- **Mnemonic Phrase**: A sequence of 12 or 24 words from the BIP39 word list representing the wallet's master entropy. Used for wallet backup and recovery. Stored encrypted on USB using Argon2id + AES-256-GCM. Must be kept strictly confidential.

- **Encryption Password**: A strong user-defined password used to derive the encryption key via Argon2id KDF. This password encrypts the mnemonic for storage on USB. Different from the optional BIP39 passphrase. Never stored; required for each wallet access. Must be kept strictly confidential.

- **Passphrase (25th Word)**: An optional user-defined string that combines with the mnemonic during seed derivation per BIP39. Different passphrases produce entirely different wallets from the same mnemonic. Provides plausible deniability and additional security layer. Never stored; required on wallet access if used. Must be kept strictly confidential alongside the mnemonic.

- **Master Seed**: A 512-bit value derived from the decrypted mnemonic phrase and optional passphrase using PBKDF2-HMAC-SHA512 per BIP39. Serves as the root for all hierarchical key derivation. Exists only in memory during operations and is cleared immediately after use. Never exposed to users or stored.

- **Derivation Path**: A hierarchical path notation (e.g., m/44'/0'/0'/0/0) that specifies how to derive a specific key from the master seed. Follows BIP44 structure with purpose, coin type, account, change, and address index levels.

- **Wallet Account**: A logical grouping of addresses derived from a single mnemonic using BIP44 account structure. Supports multiple accounts per wallet.

- **Derived Address**: A cryptocurrency address generated from the master seed following a specific derivation path. Each address has an associated private key that remains in secure storage.

- **Audit Log**: A tamper-evident append-only record of wallet operations stored on USB. Tracks wallet creation, successful/failed access attempts, and restoration operations with timestamps. Contains no sensitive data. Used for security monitoring and unauthorized access detection.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can generate a new wallet with a valid BIP39 mnemonic in under 30 seconds
- **SC-002**: Users can restore a wallet from a mnemonic phrase in under 1 minute
- **SC-003**: System correctly validates 100% of BIP39 test vectors from the official specification
- **SC-004**: Derived addresses match reference implementations (tested against known mnemonic-to-address mappings)
- **SC-005**: System handles 1000 address derivations per second without performance degradation
- **SC-006**: Zero security incidents related to mnemonic exposure or insecure storage
- **SC-007**: 95% of users successfully complete mnemonic backup verification on the first attempt
- **SC-008**: System maintains 100% deterministic behavior (same mnemonic always produces identical addresses)

## Assumptions

1. Users have basic understanding of cryptocurrency wallet concepts and the importance of mnemonic backup
2. USB storage device is available and has sufficient capacity for encrypted wallet files (minimum 1MB recommended)
3. Users can create and remember strong encryption passwords (guidance provided by the system)
4. System has access to a cryptographically secure random number generator (OS-provided CSRNG)
5. System memory can be securely cleared after sensitive operations (platform-dependent implementation)
6. Users will primarily use standard derivation paths rather than custom paths
7. Word list language is English (BIP39 English word list with 2048 words)
8. System supports Bitcoin, Ethereum, and other major cryptocurrencies with registered BIP44 coin types
9. Maximum of 100 accounts per wallet and 1000 addresses per account (reasonable defaults)
10. Mnemonic backup verification requires 3 randomly selected words from the phrase
11. Encryption password and optional BIP39 passphrase are distinct concepts that users can differentiate
12. USB storage is dedicated or has restricted access to prevent unauthorized file copying
