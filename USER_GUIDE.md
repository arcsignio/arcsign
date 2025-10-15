# ArcSign User Guide

**Complete Guide to Using ArcSign HD Wallet**

## Table of Contents

1. [Getting Started](#getting-started)
2. [Creating Your First Wallet](#creating-your-first-wallet)
3. [Restoring a Wallet](#restoring-a-wallet)
4. [Deriving Cryptocurrency Addresses](#deriving-cryptocurrency-addresses)
5. [Advanced Features](#advanced-features)
6. [Common Use Cases](#common-use-cases)
7. [Troubleshooting](#troubleshooting)
8. [Best Practices](#best-practices)

## Getting Started

### What You Need

- A computer (Windows, macOS, or Linux)
- A USB drive (minimum 10 MB free space)
- The ArcSign executable (`arcsign` or `arcsign.exe`)

### First Time Setup

1. **Download ArcSign**: Get the latest release from the GitHub repository
2. **Prepare USB Drive**: Insert a USB drive (can be empty or have existing files)
3. **Verify Installation**:

```bash
# Windows
.\arcsign.exe version

# macOS/Linux
./arcsign version
```

Expected output:
```
ArcSign v0.1.0
```

## Creating Your First Wallet

### Basic Wallet Creation

The simplest way to create a wallet with default settings:

```bash
./arcsign create
```

### Step-by-Step Walkthrough

#### Step 1: USB Detection

```
Step 1: Detecting USB storage...
✓ USB device detected: D:\
```

**What's happening**: ArcSign automatically finds your USB drive.

**Troubleshooting**: If no USB is found, check:
- USB is properly inserted
- USB is formatted (FAT32, exFAT, or NTFS)
- Try a different USB port

#### Step 2: Wallet Name (Optional)

```
Step 2: Enter wallet name (optional, press Enter to skip): My Bitcoin Wallet
```

**Recommendations**:
- Use descriptive names: "Trading Wallet", "Savings", "DeFi Portfolio"
- Maximum 64 characters
- Can include spaces and special characters
- Press Enter to skip (unnamed wallet)

#### Step 3: Mnemonic Length

```
Step 3: Choose mnemonic length:
  1) 12 words (recommended for most users)
  2) 24 words (maximum security)
Enter choice (1 or 2): 1
```

**Choose 12 words if**:
- You want easier backup (shorter phrase)
- Standard security is sufficient
- You're new to crypto wallets

**Choose 24 words if**:
- You want maximum security
- You're storing significant funds
- You don't mind longer backup process

#### Step 4: BIP39 Passphrase (Advanced)

```
Step 4: BIP39 passphrase (advanced)
A BIP39 passphrase adds an extra layer of security.
⚠️  Warning: If you forget the passphrase, you cannot recover your wallet!
Use BIP39 passphrase? (y/N): N
```

**Recommendation for beginners**: Choose "N" (No)

**When to use a passphrase**:
- You understand plausible deniability
- You can reliably remember another password
- You want to create "hidden" wallets

**Important**: The passphrase is NOT the encryption password. See [Advanced Features](#advanced-features) for details.

#### Step 5: Encryption Password

```
Step 5: Set encryption password
Requirements:
  - At least 12 characters
  - At least 3 of: uppercase, lowercase, numbers, special characters

Enter password: ************
Confirm password: ************
```

**Good passwords**:
- `MyBitcoin@2025!` (16 chars, all types)
- `Crypto$Wallet99` (15 chars, all types)
- `ArcSign_Secure2024` (18 chars, all types)

**Bad passwords**:
- `password123` (too simple)
- `12345678901` (only numbers)
- `MyWallet` (too short)

**Tips**:
- Use a unique password (don't reuse)
- Consider using a password manager
- Remember: This protects your encrypted mnemonic on USB

#### Step 6: Creating Wallet

```
Step 6: Creating wallet...
(This may take a few seconds due to encryption)
```

**What's happening**: ArcSign is using Argon2id to derive encryption keys. This intentionally takes a few seconds to resist brute-force attacks.

#### Step 7: Backup Your Mnemonic

```
═══════════════════════════════════════════════════════════
                  ⚠️  BACKUP YOUR MNEMONIC  ⚠️
═══════════════════════════════════════════════════════════

Write down these words in order and store them safely:

  abandon ability able about above absent absorb abstract absurd abuse access accident

═══════════════════════════════════════════════════════════
```

**CRITICAL STEP**:

1. **Write it down on paper**
   - Use pen (not pencil - can fade)
   - Write clearly and legibly
   - Number the words (1-12 or 1-24)
   - Double-check spelling

2. **Store securely**
   - Fireproof safe
   - Safety deposit box
   - Multiple locations (home + offsite)

3. **NEVER**:
   - Take a photo
   - Store in a text file
   - Send via email or messaging
   - Enter on websites
   - Share with anyone

4. **Test your backup**:
   - Try reading back the words
   - Verify order is correct
   - Check for spelling errors

#### Step 8: Completion

```
✓ Setup complete!

Wallet Information:
  ID: 3c3e0aba-91e1-44d4-8b29-ec066d5acf0b
  Name: My Bitcoin Wallet
  Created: 2025-10-16 15:30:45
  Mnemonic: 12 words
  Storage: D:\

Your wallet is now ready to use!
```

**Save this information**:
- **Wallet ID**: Needed to restore wallet - copy to safe location
- **Storage location**: Remember which USB has this wallet

## Restoring a Wallet

### When to Restore

- You want to view your mnemonic phrase
- You're setting up on a new computer
- You need to verify your backup

### Restore Command

```bash
./arcsign restore
```

### Step-by-Step Restore

#### Step 1-2: USB and Wallet ID

```
Step 1: Detecting USB storage...
✓ USB device detected: D:\

Step 2: Enter wallet ID: 3c3e0aba-91e1-44d4-8b29-ec066d5acf0b
```

**Finding your wallet ID**:
- Check the paper where you wrote it down
- Look in the USB drive folder names
- Each wallet has a unique UUID

#### Step 3: Loading Wallet

```
Step 3: Loading wallet...
✓ Wallet found!

Wallet Information:
  ID: 3c3e0aba-91e1-44d4-8b29-ec066d5acf0b
  Name: My Bitcoin Wallet
  Created: 2025-10-16 15:30:45
  Last Accessed: 2025-10-16 15:35:12
```

#### Step 4: Password Entry

```
Step 4: Enter encryption password
⚠️  Warning: You have 3 attempts before rate limiting activates

Enter password (attempt 1/3): ************
```

**Security features**:
- 3 attempts allowed per minute
- After 3 failed attempts: wait 1 minute
- Successful login resets the counter

#### Step 5: Mnemonic Display

```
✓ Wallet restored successfully!

═══════════════════════════════════════════════════════════
                    YOUR RECOVERY PHRASE
═══════════════════════════════════════════════════════════

  abandon ability able about above absent absorb abstract absurd abuse access accident

═══════════════════════════════════════════════════════════
```

**After viewing**:
- Verify against your written backup
- Correct any errors in your backup
- Clear your screen (prevent screenshots)

## Deriving Cryptocurrency Addresses

### Overview

Use the `derive` command to generate cryptocurrency addresses from your wallet. All addresses are derived deterministically from your mnemonic phrase.

### Derive Command

```bash
./arcsign derive
```

### Step-by-Step Address Derivation

#### Steps 1-4: Unlock Wallet

(Same as restore: USB detection, wallet ID, password)

```
✓ Wallet unlocked successfully!
```

#### Step 5: Select Cryptocurrency

```
Step 5: Select cryptocurrency
  1) Bitcoin (BTC)
  2) Ethereum (ETH)
Enter choice (1 or 2): 1
```

**Supported cryptocurrencies**:
- **Bitcoin (BTC)**: P2PKH addresses (start with "1")
- **Ethereum (ETH)**: Native addresses (start with "0x")

#### Step 6: Account Index

```
Step 6: Enter account index
(Most users should use 0 for the first account)
Account index (default 0): 0
```

**What is an account?**
- Think of accounts as separate "sub-wallets"
- Account 0: Your main wallet (recommended)
- Account 1: Secondary wallet (e.g., for business)
- Account 2: Another separate wallet

**When to use different accounts**:
- Separate personal and business funds
- Create distinct portfolios
- Organize by purpose (trading, savings, etc.)

#### Step 7: Address Index

```
Step 7: Enter address index
(Use 0 for the first address, 1 for the second, etc.)
Address index (default 0): 0
```

**What is an address index?**
- Multiple addresses within the same account
- Address 0: Your first receiving address
- Address 1: Your second receiving address
- And so on...

**When to use different addresses**:
- Privacy: Use unique address per transaction
- Organization: Different addresses for different purposes
- Security: Limit exposure of any single address

#### Step 8-9: Derivation and Display

```
Step 8: Deriving address...
✓ Address derived successfully!

═══════════════════════════════════════════════════════════
                    BITCOIN ADDRESS
═══════════════════════════════════════════════════════════

  Address: 16XiVQeqbDsVPRNcCUCtKwiGhNsfhz8J1c

  Derivation Path: m/44'/0'/0'/0/0
  Coin: Bitcoin
  Account: 0
  Index: 0

═══════════════════════════════════════════════════════════

You can use this address to receive funds.
```

**Using your address**:
- Copy the address carefully (all characters matter)
- Share with sender to receive funds
- Verify first few and last few characters when copying
- Test with small amount first

## Advanced Features

### BIP39 Passphrase (25th Word)

The BIP39 passphrase is an advanced security feature that acts as a "25th word" added to your mnemonic.

#### How It Works

```
Same Mnemonic + Different Passphrase = Different Wallet

Example:
- Mnemonic: "abandon ability able..." (12 words)
- Passphrase A: "" (empty) → Wallet A
- Passphrase B: "MySecret123" → Wallet B (completely different!)
```

#### Use Cases

1. **Plausible Deniability**:
   - Wallet with no passphrase: small "decoy" amount
   - Wallet with passphrase: main holdings
   - Under duress, reveal only the empty-passphrase wallet

2. **Two-Factor Security**:
   - Mnemonic: stored in safe (factor 1)
   - Passphrase: memorized only (factor 2)
   - Attacker needs both to access funds

#### Setting Up

```
Step 4: BIP39 passphrase (advanced)
Use BIP39 passphrase? (y/N): y

Enter BIP39 passphrase: MySecret@Passphrase123
```

#### Critical Warnings

⚠️ **The passphrase is NOT stored anywhere**
- If forgotten, funds are permanently lost
- No recovery possible
- No "forgot passphrase" feature

⚠️ **Write it down separately**
- Store in different location than mnemonic
- Consider: "If I forget this, I lose everything"

⚠️ **Test thoroughly**
- Derive an address with passphrase
- Note the address
- Restore wallet with passphrase
- Verify same address is derived

### Understanding Derivation Paths

#### BIP44 Path Format

```
m / 44' / coin_type' / account' / change / address_index

Example: m/44'/0'/0'/0/0
         │  │   │    │   │  │
         │  │   │    │   │  └─ Address 0 (0, 1, 2, ...)
         │  │   │    │   └──── External chain (0) or Internal/change (1)
         │  │   │    └──────── Account 0 (0, 1, 2, ...)
         │  │   └───────────── Bitcoin (0), Ethereum (60), etc.
         │  └───────────────── BIP44 standard
         └──────────────────── Master key
```

#### Common Paths

**Bitcoin**:
- First address: `m/44'/0'/0'/0/0`
- Second address: `m/44'/0'/0'/0/1`
- Change address: `m/44'/0'/0'/1/0`
- Second account: `m/44'/0'/1'/0/0`

**Ethereum**:
- First address: `m/44'/60'/0'/0/0`
- Second address: `m/44'/60'/0'/0/1`

#### Apostrophe (') Meaning

- **With apostrophe (')**: Hardened derivation
  - More secure
  - Used for purpose, coin_type, account
  - Cannot derive child public keys from parent public key

- **Without apostrophe**: Non-hardened derivation
  - Used for change and address_index
  - Allows watch-only wallets (xpub)

## Common Use Cases

### Use Case 1: Personal Bitcoin Wallet

**Setup**:
```bash
./arcsign create
# 12 words, no passphrase, name: "Personal BTC"
```

**Generate addresses**:
```bash
./arcsign derive
# Bitcoin (1), Account 0, Address 0 → Share with others
# Bitcoin (1), Account 0, Address 1 → For another sender
# Bitcoin (1), Account 0, Address 2 → For yet another sender
```

**Benefits**:
- Multiple addresses for privacy
- All backed up by single mnemonic
- USB-only storage for security

### Use Case 2: Multi-Currency Portfolio

**Setup**:
```bash
./arcsign create
# 24 words, no passphrase, name: "Crypto Portfolio"
```

**Generate addresses**:
```bash
# Bitcoin address
./arcsign derive
# Choice: 1 (Bitcoin), Account 0, Address 0

# Ethereum address
./arcsign derive
# Choice: 2 (Ethereum), Account 0, Address 0
```

**Benefits**:
- Single backup for multiple cryptocurrencies
- Organized by coin type
- Standards-compliant (BIP44)

### Use Case 3: Business with Separate Accounts

**Setup**:
```bash
./arcsign create
# 12 words, no passphrase, name: "Business Wallet"
```

**Generate addresses**:
```bash
# Personal account
./arcsign derive
# Bitcoin (1), Account 0, Address 0

# Business account
./arcsign derive
# Bitcoin (1), Account 1, Address 0

# Client deposits
./arcsign derive
# Bitcoin (1), Account 2, Address 0
```

**Benefits**:
- Separate accounts for accounting
- All backed up by one mnemonic
- Clear separation of funds

### Use Case 4: High-Security Setup with Passphrase

**Setup**:
```bash
./arcsign create
# 24 words, YES passphrase, name: "High Security"
# Passphrase: [memorized strong passphrase]
```

**Decoy wallet** (no passphrase):
```bash
./arcsign derive
# Use empty passphrase when prompted
# Fund with small amount ($100-500)
```

**Real wallet** (with passphrase):
```bash
./arcsign derive
# Use real passphrase when prompted
# Fund with main holdings
```

**Benefits**:
- Plausible deniability
- Two-factor security (mnemonic + memorized passphrase)
- Protection against physical coercion

## Troubleshooting

### "No USB storage device found"

**Symptoms**:
```
Step 1: Detecting USB storage...
❌ Error: No USB storage device found
```

**Solutions**:
1. Verify USB is fully inserted
2. Try a different USB port
3. Check USB is formatted (use FAT32, exFAT, or NTFS)
4. On Linux: Check `/media/` permissions
5. On Windows: Run as Administrator
6. Try a different USB drive

### "Wallet ID is incorrect"

**Symptoms**:
```
❌ Error loading wallet: wallet not found
```

**Solutions**:
1. Verify you copied the complete UUID
   - Format: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
   - Example: `3c3e0aba-91e1-44d4-8b29-ec066d5acf0b`
2. Check you're using the correct USB drive
3. Look in USB drive for folder names (each is a wallet ID)
4. Wallet IDs are case-sensitive (but typically lowercase)

### "Rate limit exceeded"

**Symptoms**:
```
❌ Rate limit exceeded!
Too many failed attempts. Please wait 1 minute and try again.
```

**Solutions**:
1. Wait 60 seconds before retrying
2. Verify your password is correct
3. Check CAPS LOCK is not enabled
4. Try password in a text editor first (to verify typing)
5. After 1 minute: successful login resets counter

### "Wrong password"

**Symptoms**:
```
❌ Wrong password (attempt 1/3 failed)
```

**Solutions**:
1. Double-check password is correct
2. Verify CAPS LOCK state
3. Try typing slowly
4. If forgotten:
   - Password CANNOT be recovered
   - You need your mnemonic phrase to create new wallet
   - Old encrypted mnemonic will be inaccessible

### Addresses Don't Match Expected

**Symptoms**:
- Address derived doesn't match another wallet
- Expected address 1..., got address 1...

**Possible causes**:
1. **Wrong BIP39 passphrase**:
   - Verify passphrase exactly (case-sensitive)
   - Even one character different = different wallet

2. **Wrong derivation path**:
   - Check account index (0, 1, 2, ...)
   - Check address index (0, 1, 2, ...)
   - Check coin type (Bitcoin=0, Ethereum=60)

3. **Different standard**:
   - ArcSign uses BIP44: `m/44'/coin'/account'/0/index`
   - Some wallets use BIP49 (P2SH-SegWit) or BIP84 (Native SegWit)

**Solution**:
- Use exact same inputs (passphrase, account, index)
- Verify BIP44 standard in other wallet

## Best Practices

### Backup Strategy

**Multiple Copies**:
```
Primary backup: Fireproof safe at home
Secondary backup: Safety deposit box at bank
Tertiary backup: Trusted family member (different location)
```

**What to backup**:
- ✅ Mnemonic phrase (written on paper)
- ✅ Wallet ID (for convenience)
- ✅ BIP39 passphrase (if used - separate location)
- ❌ Encryption password (memorize only)
- ❌ USB drive contents (can be rebuilt from mnemonic)

### Security Practices

**Physical Security**:
- Disconnect USB when not in use
- Store USB in secure location
- Never leave USB unattended
- Consider encrypted USB drive

**Operational Security**:
- Use trusted computers only
- Prefer offline/air-gapped computers
- Check for surveillance (cameras, people)
- Clear clipboard after copying addresses
- Restart computer after sensitive operations

**Password Hygiene**:
- Unique password per wallet
- Minimum 16 characters recommended
- Use password manager for encryption passwords
- Never reuse passwords across wallets

### Testing Strategy

**Before Adding Significant Funds**:

1. **Test wallet creation**:
   ```bash
   ./arcsign create
   # Write down mnemonic
   ```

2. **Test restoration**:
   ```bash
   ./arcsign restore
   # Verify mnemonic matches
   ```

3. **Test address derivation**:
   ```bash
   ./arcsign derive
   # Generate address at m/44'/0'/0'/0/0
   # Note the address
   ```

4. **Test determinism**:
   ```bash
   ./arcsign derive
   # Generate same path again
   # Verify address is identical
   ```

5. **Test with small amount**:
   - Send $10-50 to generated address
   - Verify receipt in blockchain explorer
   - Practice restoration on different computer

### Regular Maintenance

**Monthly**:
- Test wallet restoration
- Verify USB drive integrity
- Check backup readability

**Yearly**:
- Test full recovery from mnemonic
- Update USB drive (if aging)
- Review and update backups

---

## Quick Reference

### Commands

```bash
./arcsign create   # Create new wallet
./arcsign restore  # View mnemonic
./arcsign derive   # Generate address
./arcsign version  # Show version
./arcsign help     # Show usage
```

### Coin Types (SLIP-44)

```
Bitcoin (BTC):    0
Ethereum (ETH):   60
Litecoin (LTC):   2
Dogecoin (DOGE):  3
```

### Common Paths

```
Bitcoin first:     m/44'/0'/0'/0/0
Bitcoin second:    m/44'/0'/0'/0/1
Ethereum first:    m/44'/60'/0'/0/0
Ethereum second:   m/44'/60'/0'/0/1
Bitcoin account 2: m/44'/0'/1'/0/0
```

### Password Requirements

```
✅ Minimum 12 characters
✅ At least 3 of:
   - Uppercase (A-Z)
   - Lowercase (a-z)
   - Numbers (0-9)
   - Special (!@#$...)
```

### Need Help?

- **Documentation**: README.md, SECURITY.md, ARCHITECTURE.md
- **Issues**: GitHub Issues page
- **Security**: security@example.com

---

**Happy securing your crypto! 🔒**
