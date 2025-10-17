# CLI Command Contracts: Extended Multi-Chain Support

**Feature**: v0.3.0 Extended Multi-Chain Support
**Date**: 2025-10-17
**Status**: Design Complete

## Overview

This document defines the command-line interface contracts for wallet creation, address listing, and upgrade behavior with support for 54 blockchains (30 existing + 24 new).

---

## Command: `arcsign create`

### Purpose
Create a new HD wallet with addresses for all 54 supported blockchains

### Syntax
```bash
arcsign create [--name WALLET_NAME] [--passphrase] [--usb USB_PATH]
```

### Options
- `--name`: Optional wallet name (default: auto-generated)
- `--passphrase`: Enable BIP39 passphrase (prompt for secure input)
- `--usb`: USB mount path (default: auto-detect)

### Behavior (v0.3.0 Changes)

**Unchanged from v0.2.0**:
1. Prompt for application password (dual password protection)
2. Generate 24-word BIP39 mnemonic
3. Derive addresses for all registered chains

**Changed in v0.3.0**:
4. Generate addresses for **54 chains** (was 30 in v0.2.0)
5. Display extended summary with chain categories
6. Show generation metrics (time, success rate)

### Output Format

```
Creating new wallet...

✓ Generated 24-word mnemonic phrase
✓ Encrypted with Argon2id + AES-256-GCM
✓ Saved to USB: /Volumes/USB/arcsign/wallets/a1b2c3d4/

Multi-Coin Addresses:
  ✓ Generated 54 cryptocurrency addresses in 12.3 seconds

  Layer 2 Networks (6):
    1. Arbitrum (ARB): 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0
    2. Optimism (OP): 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0
    3. Base (BASE): 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0
    ... (3 more)

  UTXO Chains (7):
    1. Bitcoin (BTC): 1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa
    2. Litecoin (LTC): LMa1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p
    ... (5 more)

  EVM Mainnet (1):
    1. Ethereum (ETH): 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0

  Cosmos SDK (8):
    1. Cosmos Hub (ATOM): cosmos1pdv9lrdwl0rhmcsaetqjmz2g5hzpnnjwl2mj4y
    2. Osmosis (OSMO): osmo1pdv9lrdwl0rhmcsaetqjmz2g5hzpnnjwy7zvdk
    ... (6 more)

  Substrate (1):
    1. Kusama (KSM): CzBt6Hv6E9gZGG5CQ8NwHfKJL1KvN3Py3tJ3GBPxNqYKD3V

  Custom (31):
    1. Solana (SOL): 7Gm5Z8X...
    2. Tezos (XTZ): tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb
    3. Zilliqa (ZIL): zil1pdv9lrdwl0rhmcsaetqjmz2g5hzpnnjwqv0xzr
    ... (28 more)

  💡 Use 'arcsign list-addresses --wallet-id a1b2c3d4' to view all addresses

⚠️  CRITICAL: Write down your mnemonic phrase and store it securely!
    This is the ONLY way to recover your wallet if the USB drive is lost.

Wallet ID: a1b2c3d4
Wallet created successfully!
```

### Error Handling

**Partial Address Generation Failure** (NEW in v0.3.0):
```
Creating new wallet...

✓ Generated 24-word mnemonic phrase
✓ Encrypted with Argon2id + AES-256-GCM

Multi-Coin Addresses:
  ✓ Generated 52 of 54 addresses in 11.8 seconds
  ⚠️  2 chains failed to generate (see details below):

  Failed Chains:
    ✗ Starknet (STRK): EIP-2645 grinding timeout
    ✗ Kusama (KSM): sr25519 key derivation error

  📋 Details logged to: /Volumes/USB/arcsign/audit.log
  💡 You can regenerate failed addresses later with 'arcsign derive'

Wallet ID: a1b2c3d4
Wallet created successfully! (52/54 chains available)
```

### Exit Codes
- `0`: Success (all chains generated)
- `1`: Partial success (≥95% chains generated, some failures logged)
- `2`: Fatal error (wallet creation failed, no wallet saved)

---

## Command: `arcsign list-addresses`

### Purpose
Display all derived addresses for a wallet, grouped by chain category

### Syntax
```bash
arcsign list-addresses --wallet-id WALLET_ID [--category CATEGORY] [--format FORMAT]
```

### Options
- `--wallet-id`: Required wallet identifier
- `--category`: Optional filter (UTXO, EVM_Mainnet, Layer2, Cosmos_SDK, Substrate, Custom)
- `--format`: Output format (table, json, csv) (default: table)

### Behavior (v0.3.0 Changes)

**Unchanged from v0.2.0**:
1. Load wallet metadata from USB
2. Display addresses with coin names and symbols

**Changed in v0.3.0**:
3. Group addresses by **ChainCategory** (new grouping)
4. Support category filtering
5. Show 54 chains (was 30 in v0.2.0)

### Output Format (Table)

```bash
$ arcsign list-addresses --wallet-id a1b2c3d4

Wallet: My Cold Wallet (ID: a1b2c3d4)
Total Addresses: 54

═══════════════════════════════════════════════════════════════════════════
LAYER 2 NETWORKS (6 chains)
═══════════════════════════════════════════════════════════════════════════
 #  Symbol  Coin Name    Address                                       Path
───────────────────────────────────────────────────────────────────────────
 1  ARB     Arbitrum     0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0  m/44'/9001'/0'/0/0
 2  OP      Optimism     0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0  m/44'/614'/0'/0/0
 3  BASE    Base         0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0  m/44'/8453'/0'/0/0
 4  ZKS     zkSync       0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0  m/44'/324'/0'/0/0
 5  STRK    Starknet     0x01234567890abcdef...                      m/2645'/579218131'/0'/0'/0'
 6  LINEA   Linea        0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0  m/44'/59144'/0'/0/0

═══════════════════════════════════════════════════════════════════════════
UTXO CHAINS (7 chains)
═══════════════════════════════════════════════════════════════════════════
 #  Symbol  Coin Name           Address                                  Path
───────────────────────────────────────────────────────────────────────────────
 1  BTC     Bitcoin            1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa         m/44'/0'/0'/0/0
 2  LTC     Litecoin           LMa1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p         m/44'/2'/0'/0/0
 3  DOGE    Dogecoin           D7Y5...                                  m/44'/3'/0'/0/0
 4  DASH    Dash               Xk5d...                                  m/44'/5'/0'/0/0
 5  BCH     Bitcoin Cash       bitcoincash:qr5x...                      m/44'/145'/0'/0/0
 6  ZEC     Zcash              t1Vz...                                  m/44'/133'/0'/0/0
 7  DGB     DigiByte           DGqh...                                  m/44'/20'/0'/0/0

... (EVM Mainnet, Cosmos SDK, Substrate, Custom sections follow same format)

💡 Filter by category: arcsign list-addresses --wallet-id a1b2c3d4 --category Layer2
💡 Export to JSON: arcsign list-addresses --wallet-id a1b2c3d4 --format json
```

### Output Format (JSON)

```bash
$ arcsign list-addresses --wallet-id a1b2c3d4 --format json
```

```json
{
  "walletId": "a1b2c3d4",
  "walletName": "My Cold Wallet",
  "totalAddresses": 54,
  "addresses": [
    {
      "symbol": "BTC",
      "coinName": "Bitcoin",
      "coinType": 0,
      "address": "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
      "derivationPath": "m/44'/0'/0'/0/0",
      "marketCapRank": 1,
      "category": "UTXO"
    },
    {
      "symbol": "ETH",
      "coinName": "Ethereum",
      "coinType": 60,
      "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
      "derivationPath": "m/44'/60'/0'/0/0",
      "marketCapRank": 2,
      "category": "EVM_Mainnet"
    }
    ... (52 more addresses)
  ]
}
```

### Category Filter Examples

```bash
# Show only Layer 2 addresses
$ arcsign list-addresses --wallet-id a1b2c3d4 --category Layer2

# Show only Cosmos ecosystem
$ arcsign list-addresses --wallet-id a1b2c3d4 --category Cosmos_SDK

# Show UTXO chains
$ arcsign list-addresses --wallet-id a1b2c3d4 --category UTXO
```

### Exit Codes
- `0`: Success
- `1`: Wallet not found
- `2`: Invalid wallet ID format
- `3`: USB not connected/accessible

---

## Command: `arcsign get-address`

### Purpose
Retrieve a specific address by coin symbol

### Syntax
```bash
arcsign get-address --wallet-id WALLET_ID --coin SYMBOL
```

### Options
- `--wallet-id`: Required wallet identifier
- `--coin`: Coin symbol (e.g., BTC, ETH, ARB, KSM)

### Behavior (Unchanged from v0.2.0)

1. Load wallet metadata
2. Lookup address by symbol
3. Display address with derivation details

### Output Format

```bash
$ arcsign get-address --wallet-id a1b2c3d4 --coin ARB

Arbitrum (ARB) Address
════════════════════════════════════════════════════════════════════════
Symbol:          ARB
Coin Name:       Arbitrum
Category:        Layer 2 Network
Coin Type:       9001 (SLIP-44)
Derivation Path: m/44'/9001'/0'/0/0
Address:         0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0

⚠️  Note: This address is identical to your Ethereum mainnet address.
    Make sure to select the correct network (Arbitrum) when receiving funds.

💡 To view this address in Ethereum format: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0
```

### Special Cases

**Evmos Dual Format** (NEW in v0.3.0):
```bash
$ arcsign get-address --wallet-id a1b2c3d4 --coin EVMOS

Evmos (EVMOS) Address
════════════════════════════════════════════════════════════════════════
Symbol:          EVMOS
Coin Name:       Evmos
Category:        Cosmos SDK
Coin Type:       60 (uses Ethereum coin type)
Derivation Path: m/44'/60'/0'/0/0

Ethereum Format: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0
Cosmos Format:   evmos1pdv9lrdwl0rhmcsaetqjmz2g5hzpnnjwf5xh8k

💡 Use Ethereum format for MetaMask/EVM wallets
💡 Use Cosmos format for Keplr/Cosmos wallets
```

### Exit Codes
- `0`: Success
- `1`: Wallet not found
- `2`: Coin symbol not supported
- `3`: Address not generated (formatter failed during wallet creation)

---

## Upgrade Behavior (Automatic)

### Detection

When a v0.2.0 wallet (30 chains) is accessed in v0.3.0:

```bash
$ arcsign list-addresses --wallet-id a1b2c3d4

Wallet Upgrade Required
════════════════════════════════════════════════════════════════════════
Your wallet was created with v0.2.0 and supports 30 blockchains.
ArcSign v0.3.0 now supports 54 blockchains (24 new chains).

Generating addresses for 24 new blockchains...

Progress: [████████████████████████░] 96% (23/24 chains) - 8.2s

✓ Layer 2 Networks (6 new chains generated)
  - Arbitrum (ARB)
  - Optimism (OP)
  - Base (BASE)
  - zkSync (ZKS)
  - Starknet (STRK)
  - Linea (LINEA)

✓ Regional Chains (4 new chains generated)
  - Klaytn (KLAY)
  - Cronos (CRO)
  - HECO (HT)
  - Harmony (ONE)

✓ Cosmos Ecosystem (4 new chains generated)
  - Osmosis (OSMO)
  - Juno (JUNO)
  - Evmos (EVMOS)
  - Secret Network (SCRT)

✓ Alternative EVM (5 new chains generated)
  - Fantom (FTM)
  - Celo (CELO)
  - Moonbeam (GLMR)
  - Metis (METIS)
  - Gnosis (GNO)

✓ Specialized Chains (4 new chains generated)
  - Kusama (KSM)
  - Tezos (XTZ)
  - Zilliqa (ZIL)
  - Wanchain (WAN)

⚠️  1 chain failed to generate:
    ✗ ICON (ICX): SHA3-256 hash error (see audit.log for details)

════════════════════════════════════════════════════════════════════════
Upgrade Complete!
✓ 23 of 24 new addresses generated successfully in 8.7 seconds
✓ Wallet updated from v0.2.0 (30 chains) → v0.3.0 (53 chains)
✓ Original 30 addresses preserved (no changes)

You can now use your wallet with 53 supported blockchains.
════════════════════════════════════════════════════════════════════════

... (continues to display address list)
```

### Upgrade Options

**Automatic (Default)**:
- Triggered on first wallet access after upgrade
- Non-blocking (user sees progress)
- Requires password + passphrase (to decrypt mnemonic)

**Skip Upgrade** (Advanced):
```bash
$ arcsign list-addresses --wallet-id a1b2c3d4 --no-upgrade

Wallet: My Cold Wallet (ID: a1b2c3d4)
Version: v0.2.0 (30 chains)
⚠️  Upgrade available: v0.3.0 supports 54 chains (24 new chains)

... (displays only 30 existing addresses)

💡 To upgrade: Remove --no-upgrade flag on next command
💡 To manually upgrade: arcsign upgrade-wallet --wallet-id a1b2c3d4
```

### Manual Upgrade Command (NEW in v0.3.0)

```bash
$ arcsign upgrade-wallet --wallet-id a1b2c3d4

Upgrading wallet to v0.3.0...

Enter wallet password: ********
Enter BIP39 passphrase (if used): ********

Generating 24 new addresses...
Progress: [████████████████████████] 100% (24/24 chains) - 9.1s

✓ Upgrade complete! Wallet now supports 54 blockchains.
```

---

## Environment Variables

### USB Path Detection
```bash
# Override USB auto-detection
export ARCSIGN_USB_PATH="/Volumes/MyUSB"

# Use custom wallet directory
export ARCSIGN_WALLET_DIR="/Volumes/MyUSB/custom_wallets"
```

### Performance Tuning
```bash
# Adjust generation timeout (default: 30s)
export ARCSIGN_GENERATION_TIMEOUT=60

# Disable parallel generation (for debugging)
export ARCSIGN_SEQUENTIAL_MODE=true
```

---

## Exit Code Summary

| Code | Meaning | Example |
|------|---------|---------|
| 0 | Success | All operations completed |
| 1 | Partial success | 52/54 chains generated (acceptable) |
| 2 | Fatal error | Wallet creation failed |
| 3 | Invalid input | Unknown coin symbol, malformed wallet ID |
| 4 | USB error | USB not connected, insufficient space |
| 5 | Authentication | Wrong password, passphrase mismatch |

---

## Testing Contracts

### Unit Tests (Go)
```go
func TestCreateCommand_54Chains(t *testing.T)
func TestListAddresses_CategoryFilter(t *testing.T)
func TestGetAddress_EvmosDualFormat(t *testing.T)
func TestUpgrade_V02_To_V03(t *testing.T)
```

### Integration Tests (Shell)
```bash
test_create_wallet_with_54_chains()
test_list_addresses_layer2_filter()
test_automatic_upgrade_notification()
test_partial_generation_failure_handling()
```

---

## Next Steps

1. ✅ **Phase 0 Complete**: research.md
2. ✅ **Phase 1 Complete**: data-model.md, contracts/cli-commands.md
3. **Phase 1 Next**: Generate quickstart.md for developer implementation guide
4. **Phase 1**: Update CLAUDE.md agent context with new dependencies
5. **Phase 2**: Generate tasks.md with prioritized implementation tasks (/speckit.tasks command)
