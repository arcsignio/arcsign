# Feature Specification: Multi-Cryptocurrency Address Generation with SLIP-44 Support

**Feature Branch**: `002-slip-44-btc`
**Created**: 2025-10-16
**Status**: Draft
**Input**: User description: "我要能夠支援已知的SLIP-44底下所有的地址生成，因此要有完整列表，錢包地址因為是公鑰，所以要跟著儲存到錢包檔案，並且明碼即可，條列出來像是btc:XXXXXXXX,ETH:0xDDDDDDDDD等等這樣全部條列出來，之後就不用一直重新計算，生成的地址derive path:m/44'/coin'/account'/change/index，只改coin對應SLIP-44來生成處理"

## Clarifications

### Session 2025-10-16

- Q: How many SLIP-44 coin types should be supported (all 200+ or a subset)? → A: Support 30-50 mainstream cryptocurrencies (Bitcoin, Ethereum, Litecoin, XRP, BCH, Stellar, Dogecoin, Dash, Monero, Zcash, etc.)
- Q: How should users be notified when address derivation fails for specific coins? → A: Display summary after wallet creation listing successful and failed coins, plus log all failures to audit log
- Q: What JSON structure should be used to store addresses in wallet metadata? → A: JSON object array with each object containing symbol, address, coinType, derivation path, and coin name
- Q: In what order should addresses be displayed when listing all addresses? → A: Sort by market capitalization (most popular coins first: BTC, ETH, USDT, BNB, XRP, etc.)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Pre-generate Multi-Coin Addresses on Wallet Creation (Priority: P1)

A user creates a new wallet and wants to immediately have receiving addresses for all supported cryptocurrencies without needing to derive them individually later. The system automatically generates and stores one address for each registered SLIP-44 coin type during wallet creation.

**Why this priority**: This is the core value proposition - eliminating the need to repeatedly derive addresses. Users get instant access to addresses for all supported cryptocurrencies, and the system avoids redundant computation.

**Independent Test**: Create a wallet and verify that the wallet metadata file contains a plaintext list of addresses for all SLIP-44 coin types (Bitcoin, Ethereum, Litecoin, etc.) in the format `BTC:1A1zP1..., ETH:0x742d35..., LTC:LMa1b2...`. Addresses should be immediately visible without additional derive operations.

**Acceptance Scenarios**:

1. **Given** a user runs `arcsign create` with a password, **When** wallet creation completes successfully, **Then** the wallet file contains addresses for 30-50 mainstream cryptocurrencies stored in plaintext format
2. **Given** a newly created wallet, **When** user views the wallet metadata file, **Then** addresses are stored in JSON array format with each entry containing symbol, address, coinType, path, and name fields
3. **Given** a wallet with pre-generated addresses, **When** user requests an address for a specific coin, **Then** the address is retrieved from storage without re-derivation
4. **Given** wallet creation with 24-word mnemonic, **When** addresses are generated, **Then** all addresses use derivation path `m/44'/COIN_TYPE'/0'/0/0` where COIN_TYPE matches SLIP-44 registry
5. **Given** a wallet with BIP39 passphrase enabled, **When** addresses are generated, **Then** all addresses are derived using the passphrase-protected seed
6. **Given** address derivation fails for some coins during wallet creation, **When** wallet creation completes, **Then** system displays a summary showing successful coins count and failed coins list with error reasons, and logs all failures to audit log

---

### User Story 2 - View All Generated Addresses (Priority: P2)

A user with an existing wallet wants to view all cryptocurrency addresses that were generated during wallet creation, organized by coin type, without re-deriving them.

**Why this priority**: Users need convenient access to their addresses for receiving funds. This provides a simple interface to view all addresses at once, complementing the P1 pre-generation feature.

**Independent Test**: Run `arcsign list-addresses --wallet-id <uuid>` and verify it displays all addresses grouped by coin type with their derivation paths, retrieved from storage without performing derivation.

**Acceptance Scenarios**:

1. **Given** an unlocked wallet, **When** user runs list addresses command, **Then** system displays all coin addresses sorted by market capitalization (most popular coins first: BTC, ETH, etc.)
2. **Given** a wallet with 30-50 coin addresses, **When** user views the address list, **Then** addresses are displayed with coin name, symbol, address, and derivation path in descending order of coin popularity
3. **Given** a wallet file, **When** addresses are listed, **Then** no cryptographic derivation occurs (addresses are read from plaintext storage)
4. **Given** a locked wallet, **When** user attempts to list addresses, **Then** system displays addresses without requiring password (addresses are public data)

---

### User Story 3 - Display Specific Coin Address (Priority: P3)

A user wants to quickly retrieve a receiving address for a specific cryptocurrency (e.g., Bitcoin or Ethereum) without viewing all addresses.

**Why this priority**: Convenience feature for users who need a single address quickly. Builds on P1 and P2 by providing focused access.

**Independent Test**: Run `arcsign get-address --wallet-id <uuid> --coin BTC` and verify it returns only the Bitcoin address from storage without performing derivation.

**Acceptance Scenarios**:

1. **Given** an unlocked wallet, **When** user requests address for Bitcoin (`--coin BTC`), **Then** system displays Bitcoin address, derivation path, and coin type index
2. **Given** a wallet with pre-generated addresses, **When** user requests address for a coin using symbol (e.g., `ETH`), **Then** system returns the corresponding Ethereum address
3. **Given** a wallet with pre-generated addresses, **When** user requests address for a coin using SLIP-44 index (e.g., `--coin-type 60`), **Then** system returns the Ethereum address
4. **Given** a request for an unsupported coin, **When** the coin is not in SLIP-44 registry, **Then** system displays clear error message

---

### Edge Cases

- **What happens when SLIP-44 registry adds new coins after wallet creation?** Existing wallets only contain addresses for coins registered at creation time. User must manually derive addresses for newly added coins using existing derive command.
- **What happens if address derivation fails for a specific coin during wallet creation?** System logs the error to audit log, skips that coin, and continues generating addresses for remaining coins. After wallet creation completes, system displays a summary showing successful coins (with address count) and failed coins (with error reasons). User can retry failed derivations later using the derive command.
- **What happens when wallet file is corrupted and addresses are unreadable?** System detects corruption and offers to re-derive all addresses from the encrypted mnemonic (requires password).
- **What happens if user wants multiple addresses for the same coin (e.g., address index 0, 1, 2)?** Initial implementation only generates index 0 for each coin. User can use existing `derive` command to generate additional indices.
- **What happens when viewing addresses for a wallet created with passphrase?** Addresses are already stored in plaintext from creation time, so no passphrase is needed to view them. However, passphrase is needed if re-deriving.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST generate cryptocurrency addresses for 30-50 mainstream SLIP-44 coin types during wallet creation
- **FR-002**: System MUST use derivation path `m/44'/coin_type'/0'/0/0` where `coin_type` matches SLIP-44 registry index
- **FR-003**: System MUST store generated addresses in plaintext JSON format within the wallet metadata file as an array of objects (addresses are public keys, not sensitive)
- **FR-004**: System MUST store each address with metadata in JSON object format: `{"symbol": "BTC", "address": "1A1zP1...", "coinType": 0, "path": "m/44'/0'/0'/0/0", "name": "Bitcoin"}`
- **FR-005**: System MUST support mainstream SLIP-44 coin types including: Bitcoin (0), Litecoin (2), Dogecoin (3), Dash (5), Ethereum (60), Ethereum Classic (61), Ripple/XRP (144), Bitcoin Cash (145), Stellar (148), Monero, Zcash, and 20-40 other popular cryptocurrencies
- **FR-006**: System MUST retrieve addresses from storage without re-derivation when user requests to view addresses
- **FR-007**: System MUST display addresses with associated metadata (coin symbol, coin name, coin type index, address, derivation path) sorted by market capitalization in descending order (most popular coins first)
- **FR-008**: System MUST handle address derivation failures gracefully by logging errors to audit log, continuing with remaining coins, and displaying a post-creation summary showing successful coin count and failed coin list with error reasons
- **FR-009**: System MUST support filtering addresses by coin symbol (e.g., `BTC`, `ETH`) or SLIP-44 coin type index (e.g., `0`, `60`)
- **FR-010**: System MUST not require password/authentication to view stored addresses (addresses are public data)
- **FR-011**: System MUST implement coin-specific address formatting (Bitcoin uses Base58Check, Ethereum uses hex with 0x prefix, etc.)
- **FR-012**: System MUST maintain a registry mapping SLIP-44 coin type indices to coin metadata (symbol, full name, address format)

### Key Entities

- **CoinRegistry**: Maps SLIP-44 coin type index to coin metadata (symbol, full name, address derivation algorithm). Contains all registered SLIP-44 coins.

- **DerivedAddress**: Represents a single derived cryptocurrency address. Attributes: coin symbol, coin type index, address string, derivation path, coin full name.

- **WalletAddressBook**: Collection of all pre-generated addresses for a wallet. Stored in wallet metadata file as JSON array. Each entry contains: symbol, address, coinType (SLIP-44 index), derivation path, and coin name. Example: `[{"symbol": "BTC", "address": "1A1zP1...", "coinType": 0, "path": "m/44'/0'/0'/0/0", "name": "Bitcoin"}, ...]`

- **Wallet** (extended): Existing wallet entity now includes `addressBook` field containing array of address objects with full metadata for efficient lookup and display.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Wallet creation generates addresses for 30-50 mainstream coin types in under 10 seconds (includes all derivation and formatting)
- **SC-002**: Users can view all generated addresses without waiting (instant retrieval from storage, no computation)
- **SC-003**: Address lookup by coin symbol or index returns result in under 100ms (simple storage lookup)
- **SC-004**: 100% of address derivation failures during wallet creation are logged and do not prevent wallet creation
- **SC-005**: Users can receive funds on any supported cryptocurrency without running additional derive commands (addresses available immediately after wallet creation)
- **SC-006**: System supports 30-50 mainstream cryptocurrencies at launch (Bitcoin, Ethereum, Litecoin, XRP, Bitcoin Cash, Stellar, Dogecoin, Dash, Monero, Zcash, and 20-40 others)

## Assumptions

- **Assumption 1**: Users primarily need one receiving address per cryptocurrency (address index 0). Additional indices can be derived on demand using existing `derive` command.
- **Assumption 2**: Storing addresses in plaintext is acceptable since addresses are public keys designed to be shared (not sensitive like private keys or mnemonics).
- **Assumption 3**: SLIP-44 registry updates are infrequent enough that existing wallets do not need automatic retroactive address generation for newly registered coins.
- **Assumption 4**: Most users will use a subset of popular cryptocurrencies, but generating all addresses upfront provides future-proofing without significant overhead.
- **Assumption 5**: Account index 0 and change index 0 (external chain) are reasonable defaults for pre-generated addresses following standard BIP44 usage patterns.
- **Assumption 6**: Wallet metadata file size increase (2-4 KB for 30-50 addresses) is acceptable for USB storage given benefits of avoiding re-derivation.

## Dependencies

- **BIP32/BIP44 Implementation**: Requires existing HD key derivation infrastructure (already implemented in v0.1.0)
- **SLIP-44 Registry**: Requires complete list of registered coin types with metadata (symbol, name, derivation algorithm)
- **Coin-Specific Address Formatters**: Requires address generation logic for each coin type (Bitcoin P2PKH, Ethereum Keccak256, etc.)
- **Wallet Storage Format**: Requires extending wallet metadata JSON schema to include `addressBook` field

## Out of Scope

- Generating multiple addresses per coin (indices beyond 0) during wallet creation
- Automatic address regeneration when SLIP-44 adds new coins post-creation
- Change addresses (internal chain, index 1) - only external (receiving) addresses generated
- Multiple account indices per coin - only account 0 is generated
- Transaction signing or balance tracking - this feature only handles address generation
- QR code generation for addresses - may be added in future release
- Address labels or custom naming - addresses identified only by coin symbol
