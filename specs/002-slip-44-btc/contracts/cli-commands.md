# CLI Command Contracts: Multi-Cryptocurrency Address Generation

**Branch**: `002-slip-44-btc` | **Date**: 2025-10-16 | **Phase**: 1 (Design)

## Overview

This document defines the CLI command interfaces for multi-cryptocurrency address generation. These commands extend the existing ArcSign CLI (`arcsign`) with two new commands: `list-addresses` and `get-address`.

---

## Command Reference

### Existing Commands (for context)

```bash
arcsign create       # Create a new wallet (MODIFIED to generate multi-coin addresses)
arcsign restore      # Restore an existing wallet
arcsign derive       # Derive cryptocurrency addresses (unchanged)
arcsign version      # Show version information
arcsign help         # Show help message
```

### New Commands (this feature)

```bash
arcsign list-addresses   # Display all pre-generated addresses
arcsign get-address      # Display address for specific cryptocurrency
```

---

## 1. arcsign create (Modified)

**Purpose**: Create a new wallet with pre-generated multi-cryptocurrency addresses.

**Changes from v0.1.0**:
- **Added**: Automatic generation of 30-50 cryptocurrency addresses during wallet creation
- **Added**: Post-creation summary showing successful and failed coin address generation
- **Behavior**: Wallet creation continues even if some coin address formatters fail

### Usage

```bash
arcsign create
```

**Interactive Prompts**:

1. Detect USB storage
2. Enter wallet name (optional)
3. Choose mnemonic length (12 or 24 words)
4. BIP39 passphrase (optional)
5. Set encryption password
6. **NEW**: Generate multi-coin addresses (automatic, no prompt)
7. Display mnemonic phrase
8. **NEW**: Display address generation summary

### New Output (Step 6)

```
Step 6: Creating wallet and generating addresses...
(This may take up to 10 seconds due to encryption and multi-coin derivation)

✓ Wallet created successfully!
✓ Generated addresses for 30 cryptocurrencies

Address Generation Summary:
  Successfully generated: 28 addresses
  Failed to generate: 2 addresses
    - XMR (Monero): formatter not implemented
    - DOT (Polkadot): formatter not implemented

Note: Failed addresses can be derived later using the 'derive' command.
```

### Exit Codes

| Code | Description |
|------|-------------|
| 0 | Wallet created successfully, all addresses generated |
| 0 | Wallet created successfully, some addresses failed (non-blocking) |
| 1 | Wallet creation failed (USB not found, password validation failed, etc.) |

### Success Criteria

- Wallet metadata includes `addressBook` field with 28-50 `DerivedAddress` entries
- Addresses sorted by market capitalization (BTC first, ETH second, etc.)
- Failed address generations logged to `audit.log`
- Wallet creation completes in <10 seconds (including address generation)

---

## 2. arcsign list-addresses (New)

**Purpose**: Display all pre-generated cryptocurrency addresses for a wallet.

### Usage

```bash
arcsign list-addresses --wallet-id <UUID>
```

### Arguments

| Argument | Required | Type | Description | Example |
|----------|----------|------|-------------|---------|
| `--wallet-id` | Yes | UUID | Wallet identifier | `550e8400-e29b-41d4-a716-446655440000` |

**Alternative Syntax**:

```bash
arcsign list-addresses -w <UUID>   # Short form
```

### Interactive Flow

```
=== ArcSign Multi-Coin Address Listing ===

Step 1: Detecting USB storage...
✓ USB device detected: /Volumes/USB_DRIVE

Step 2: Loading wallet...
✓ Wallet found!

Wallet Information:
  ID: 550e8400-e29b-41d4-a716-446655440000
  Name: My Wallet
  Created: 2025-10-16 10:30:00

Step 3: Listing all cryptocurrency addresses...
(Addresses are sorted by market capitalization)

═══════════════════════════════════════════════════════════════════════════════
                         CRYPTOCURRENCY ADDRESSES (30)
═══════════════════════════════════════════════════════════════════════════════

 #  Symbol  Coin Name            Address                                          Derivation Path
───────────────────────────────────────────────────────────────────────────────────────────────────
 1  BTC     Bitcoin              1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa               m/44'/0'/0'/0/0
 2  ETH     Ethereum             0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb        m/44'/60'/0'/0/0
 3  XRP     Ripple               rN7n7otQDd6FczFgLdlqtyMVrXeMCJzTbf               m/44'/144'/0'/0/0
 4  SOL     Solana               9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM     m/44'/501'/0'/0/0
 5  BNB     Binance Coin         0x3f5CE5FBFe3E9af3971dD833D26bA9b5C936f0bE        m/44'/714'/0'/0/0
 6  USDT    Tether (ERC-20)      0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb        m/44'/60'/0'/0/0
 7  ADA     Cardano              addr1qxy3...                                    m/44'/1815'/0'/0/0
 8  DOGE    Dogecoin             DGDc8K...                                       m/44'/3'/0'/0/0
 9  TRX     TRON                 TJRyWw...                                       m/44'/195'/0'/0/0
10  LTC     Litecoin             LMa1bY...                                       m/44'/2'/0'/0/0
... (20 more addresses)

═══════════════════════════════════════════════════════════════════════════════

Total: 30 addresses
Storage: /Volumes/USB_DRIVE/550e8400-e29b-41d4-a716-446655440000/wallet.json

Note: Addresses are public keys and can be safely shared to receive funds.
```

### Output Format

**Table Columns**:

1. **#** - Rank by market capitalization (1 = highest)
2. **Symbol** - Coin ticker (e.g., BTC, ETH)
3. **Coin Name** - Full coin name (e.g., Bitcoin, Ethereum)
4. **Address** - Derived cryptocurrency address (coin-specific format)
5. **Derivation Path** - BIP44 path used to derive address

**Sorting**: Addresses always displayed in descending order by market capitalization (BTC #1, ETH #2, etc.)

### Exit Codes

| Code | Description |
|------|-------------|
| 0 | Addresses listed successfully |
| 1 | Wallet not found (invalid wallet ID or USB not detected) |
| 1 | Wallet does not contain addressBook (v0.1.0 wallet) |
| 1 | USB storage device not detected |

### Error Handling

**Scenario: Wallet without AddressBook** (v0.1.0 wallet)

```
❌ Error: This wallet does not contain pre-generated addresses.

This wallet was created with an older version of ArcSign (v0.1.0).
To view addresses, use the 'derive' command to generate addresses manually.

Alternatively, create a new wallet with ArcSign v0.2.0+ to enable
automatic multi-cryptocurrency address generation.
```

**Scenario: No Password Required**

- **Design Decision**: Addresses are public keys, so no password/authentication is required to list them
- **Security**: Listing addresses does not expose sensitive data (private keys remain encrypted)

---

## 3. arcsign get-address (New)

**Purpose**: Display address for a specific cryptocurrency.

### Usage

```bash
# By coin symbol
arcsign get-address --wallet-id <UUID> --coin <SYMBOL>

# By SLIP-44 coin type index
arcsign get-address --wallet-id <UUID> --coin-type <INDEX>
```

### Arguments

| Argument | Required | Type | Description | Example |
|----------|----------|------|-------------|---------|
| `--wallet-id` | Yes | UUID | Wallet identifier | `550e8400-e29b-41d4-a716-446655440000` |
| `--coin` | Yes* | String | Coin ticker symbol (uppercase) | `BTC`, `ETH`, `XRP` |
| `--coin-type` | Yes* | Integer | SLIP-44 coin type index | `0` (Bitcoin), `60` (Ethereum) |

**Note**: Either `--coin` OR `--coin-type` must be provided (not both).

**Alternative Syntax**:

```bash
arcsign get-address -w <UUID> -c <SYMBOL>     # Short form (symbol)
arcsign get-address -w <UUID> -t <INDEX>      # Short form (coin type)
```

### Interactive Flow (by coin symbol)

```
=== ArcSign Address Lookup ===

Step 1: Detecting USB storage...
✓ USB device detected: /Volumes/USB_DRIVE

Step 2: Loading wallet...
✓ Wallet found!

Wallet Information:
  ID: 550e8400-e29b-41d4-a716-446655440000
  Name: My Wallet

Step 3: Looking up address for Bitcoin (BTC)...
✓ Address found!

═══════════════════════════════════════════════════════════════════════════════
                              BITCOIN ADDRESS
═══════════════════════════════════════════════════════════════════════════════

Coin:            Bitcoin (BTC)
Address:         1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa
Derivation Path: m/44'/0'/0'/0/0
SLIP-44 Type:    0
Market Cap Rank: #1

═══════════════════════════════════════════════════════════════════════════════

You can use this address to receive Bitcoin (BTC) payments.
```

### Interactive Flow (by coin type index)

```
=== ArcSign Address Lookup ===

Step 1: Detecting USB storage...
✓ USB device detected: /Volumes/USB_DRIVE

Step 2: Loading wallet...
✓ Wallet found!

Step 3: Looking up address for coin type 60...
✓ Address found!

═══════════════════════════════════════════════════════════════════════════════
                             ETHEREUM ADDRESS
═══════════════════════════════════════════════════════════════════════════════

Coin:            Ethereum (ETH)
Address:         0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb
Derivation Path: m/44'/60'/0'/0/0
SLIP-44 Type:    60
Market Cap Rank: #2

═══════════════════════════════════════════════════════════════════════════════

You can use this address to receive Ethereum (ETH) payments.
```

### Exit Codes

| Code | Description |
|------|-------------|
| 0 | Address retrieved successfully |
| 1 | Wallet not found (invalid wallet ID or USB not detected) |
| 1 | Coin not found in address book (invalid symbol or coin type) |
| 1 | Wallet does not contain addressBook (v0.1.0 wallet) |
| 1 | USB storage device not detected |
| 1 | Missing required argument (--coin or --coin-type) |

### Error Handling

**Scenario: Coin Not Found**

```
❌ Error: Address not found for coin 'XMR'

The coin 'XMR' (Monero) is not in this wallet's address book.

This could mean:
  - The coin was not supported when this wallet was created
  - Address generation failed during wallet creation

To derive this address manually, use:
  arcsign derive --wallet-id 550e8400... --coin-type 128
```

**Scenario: Invalid Coin Symbol**

```
❌ Error: Unknown coin symbol 'INVALID'

Valid coin symbols include: BTC, ETH, XRP, SOL, BNB, LTC, DOGE, etc.

To see all available addresses, use:
  arcsign list-addresses --wallet-id 550e8400...
```

**Scenario: Both --coin and --coin-type Provided**

```
❌ Error: Cannot use both --coin and --coin-type

Please specify either:
  --coin BTC         (lookup by symbol)
  --coin-type 0      (lookup by SLIP-44 index)

But not both at the same time.
```

---

## Command Comparison

### Feature Matrix

| Feature | `create` | `list-addresses` | `get-address` | `derive` (existing) |
|---------|----------|------------------|---------------|---------------------|
| Generates new addresses | Yes (30-50 coins) | No | No | Yes (1 coin) |
| Requires password | Yes | No | No | Yes |
| Reads from wallet file | Yes | Yes | Yes | Yes |
| Writes to wallet file | Yes | No | No | No |
| Requires mnemonic decryption | Yes | No | No | Yes |
| USB required | Yes | Yes | Yes | Yes |
| Time complexity | O(n) coins | O(1) file read | O(n) linear search | O(1) derivation |

### When to Use Each Command

- **`create`**: Initial wallet setup, generates all addresses at once
- **`list-addresses`**: View all cryptocurrency addresses, no password needed
- **`get-address`**: Quickly find address for specific coin, no password needed
- **`derive`**: Generate address for custom parameters (different account/index) or unsupported coins

---

## Help Text

### Updated main help

```
ArcSign - Secure HD Wallet with USB-only storage

Usage:
  arcsign create                 Create a new wallet with multi-coin support
  arcsign restore                Restore an existing wallet
  arcsign derive                 Derive cryptocurrency addresses (custom paths)
  arcsign list-addresses         List all pre-generated addresses
  arcsign get-address            Get address for specific cryptocurrency
  arcsign version                Show version information
  arcsign help                   Show this help message

Multi-Coin Address Commands:
  arcsign list-addresses --wallet-id <UUID>
  arcsign get-address --wallet-id <UUID> --coin <SYMBOL>
  arcsign get-address --wallet-id <UUID> --coin-type <INDEX>

For more information, visit: https://github.com/yourusername/arcsign
```

### Help for list-addresses

```
arcsign list-addresses --help

Usage:
  arcsign list-addresses --wallet-id <UUID>
  arcsign list-addresses -w <UUID>              (short form)

Description:
  Display all pre-generated cryptocurrency addresses for a wallet.
  Addresses are sorted by market capitalization (BTC first, ETH second, etc.)

Arguments:
  --wallet-id, -w <UUID>    Wallet identifier (required)

Examples:
  arcsign list-addresses --wallet-id 550e8400-e29b-41d4-a716-446655440000
  arcsign list-addresses -w 550e8400-e29b-41d4-a716-446655440000

Notes:
  - No password required (addresses are public keys)
  - Wallet must be on connected USB drive
  - Only works with wallets created in ArcSign v0.2.0+
```

### Help for get-address

```
arcsign get-address --help

Usage:
  arcsign get-address --wallet-id <UUID> --coin <SYMBOL>
  arcsign get-address --wallet-id <UUID> --coin-type <INDEX>
  arcsign get-address -w <UUID> -c <SYMBOL>         (short form)
  arcsign get-address -w <UUID> -t <INDEX>          (short form)

Description:
  Display address for a specific cryptocurrency.
  Lookup by coin symbol (e.g., BTC) or SLIP-44 coin type index (e.g., 0).

Arguments:
  --wallet-id, -w <UUID>      Wallet identifier (required)
  --coin, -c <SYMBOL>         Coin ticker symbol (e.g., BTC, ETH, XRP)
  --coin-type, -t <INDEX>     SLIP-44 coin type index (e.g., 0, 60, 144)

Examples:
  arcsign get-address -w 550e8400... --coin BTC
  arcsign get-address -w 550e8400... --coin-type 60
  arcsign get-address -w 550e8400... -c XRP

Notes:
  - No password required (addresses are public keys)
  - Use either --coin OR --coin-type (not both)
  - To see all coins, use: arcsign list-addresses
```

---

## Implementation Notes

### Argument Parsing

**Recommended Library**: Native `flag` package (no external dependencies)

```go
// Example: list-addresses command
func handleListAddresses() {
    fs := flag.NewFlagSet("list-addresses", flag.ExitOnError)
    walletID := fs.String("wallet-id", "", "Wallet identifier (UUID)")
    walletIDShort := fs.String("w", "", "Wallet identifier (UUID) - short form")

    fs.Parse(os.Args[2:])

    // Prefer long form over short form
    id := *walletID
    if id == "" {
        id = *walletIDShort
    }

    if id == "" {
        fmt.Println("❌ Error: --wallet-id is required")
        fs.Usage()
        os.Exit(1)
    }

    // ... rest of implementation
}
```

### Performance Requirements

| Command | Target Latency | Success Criterion |
|---------|----------------|-------------------|
| `list-addresses` | <100 ms | SC-003: Address lookup by symbol |
| `get-address` | <100 ms | SC-003: Address lookup by symbol |
| `create` (multi-coin) | <10 sec | SC-001: Wallet creation with 30-50 coins |

### Audit Logging

All commands log to `audit.log`:

```
[2025-10-16T10:30:00Z] LIST_ADDRESSES walletID=550e8400... addressCount=30 duration=15ms SUCCESS
[2025-10-16T10:31:00Z] GET_ADDRESS walletID=550e8400... coin=BTC duration=8ms SUCCESS
[2025-10-16T10:32:00Z] GET_ADDRESS walletID=550e8400... coin=XMR ERROR="coin not found in address book"
```

---

## Testing Contracts

### Unit Tests

**Test Cases for list-addresses**:

```go
func TestListAddresses_Success(t *testing.T)
func TestListAddresses_WalletNotFound(t *testing.T)
func TestListAddresses_NoAddressBook(t *testing.T)  // v0.1.0 wallet
func TestListAddresses_USBNotDetected(t *testing.T)
func TestListAddresses_SortedByMarketCap(t *testing.T)
```

**Test Cases for get-address**:

```go
func TestGetAddress_BySymbol_Success(t *testing.T)
func TestGetAddress_ByCoinType_Success(t *testing.T)
func TestGetAddress_CoinNotFound(t *testing.T)
func TestGetAddress_InvalidSymbol(t *testing.T)
func TestGetAddress_BothCoinAndCoinType(t *testing.T)  // Error case
func TestGetAddress_NeitherCoinNorCoinType(t *testing.T)  // Error case
```

### Integration Tests

```go
func TestEndToEnd_CreateAndList(t *testing.T) {
    // 1. Create wallet with multi-coin addresses
    // 2. List addresses
    // 3. Verify all coins present and sorted
}

func TestEndToEnd_CreateAndGet(t *testing.T) {
    // 1. Create wallet
    // 2. Get specific address
    // 3. Verify address matches wallet.json
}
```

---

## Backward Compatibility

### v0.1.0 Wallets

**Detection**:

```go
if wallet.AddressBook == nil {
    fmt.Println("❌ Error: This wallet does not contain pre-generated addresses.")
    fmt.Println()
    fmt.Println("This wallet was created with an older version of ArcSign (v0.1.0).")
    fmt.Println("To view addresses, use the 'derive' command to generate addresses manually.")
    os.Exit(1)
}
```

**User Experience**: Clear error message with actionable guidance (use `derive` or create new wallet)

---

## Security Considerations

### No Password Required for Address Listing

**Rationale**:
- Addresses are **public keys** designed to be shared
- No private keys are exposed by listing addresses
- Viewing addresses does not compromise wallet security

**Threat Model**:
- ✅ **Theft of USB drive**: Addresses are already public, no additional risk
- ✅ **Screen viewing by attacker**: Same risk as QR code display, addresses are meant to be shared
- ✅ **Address reuse analysis**: Users can generate new addresses with `derive` command

### Audit Trail

All address access logged for forensics:

```
[2025-10-16T10:30:00Z] LIST_ADDRESSES walletID=550e8400... SUCCESS
[2025-10-16T10:31:00Z] GET_ADDRESS walletID=550e8400... coin=BTC SUCCESS
```

**Purpose**: Detect unauthorized USB access patterns (e.g., multiple list operations from unknown systems)

---

## Next Steps

1. Generate `quickstart.md` (developer guide with TDD workflow)
2. Update `CLAUDE.md` agent context
3. Re-evaluate Constitution Check after Phase 1 completion
