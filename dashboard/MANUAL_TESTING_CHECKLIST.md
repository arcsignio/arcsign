# ArcSign Dashboard - Comprehensive Manual Testing Checklist

**Test Date:** _____________
**Tester:** _____________
**Build Version:** 1.0.0
**Platform:** Windows / macOS / Linux _(circle one)_
**Test USB Path:** `C:\Users\yangs\Desktop\test-wallet-usb`

---

## Unit Test Status

**Last Run:** 2025-10-24
**Result:** ✅ **48/48 tests passing**

```
✓ 48 unit tests passed
✓ Category serialization fixed (alt_evm)
✓ CLI wrapper tests
✓ Command tests (wallet, USB, security, export)
✓ Model tests (address, wallet)
✓ Error handling tests
```

---

## Pre-Testing Setup

### Environment Check
- [ ] **Go CLI Installed:** Run `./arcsign.exe version` → Should show version info
- [ ] **Node/NPM Installed:** Run `npm --version` → v18.0.0 or higher
- [ ] **Rust/Cargo Installed:** Run `cargo --version` → v1.75.0 or higher
- [ ] **USB Drive Ready:** Minimum 100 MB free space, writable
- [ ] **Test Directory Created:** `mkdir C:\Users\yangs\Desktop\test-wallet-usb`

### Application Launch
- [ ] **Start Dev Server:** Run `start-dev.bat` OR `npm run tauri dev`
- [ ] **Frontend Loads:** Vite dev server at http://localhost:5173
- [ ] **Tauri Window Opens:** Desktop application window visible
- [ ] **No Console Errors:** Check browser DevTools console

**Notes:** ___________________________________________

---

## Test Suite 1: USB Detection & Selection

### TC1.1 - USB Device Detection
- [ ] Application detects test USB path: `C:\Users\yangs\Desktop\test-wallet-usb`
- [ ] USB shows correct available space (e.g., "150 GB available")
- [ ] USB icon/name displays correctly
- [ ] "Select USB" button is clickable

**Status:** ☐ Pass ☐ Fail
**Notes:** ___________________________________________

### TC1.2 - No USB / Empty State
- [ ] Delete test directory temporarily
- [ ] Restart application
- [ ] See "No USB detected" message
- [ ] "Refresh" button visible
- [ ] Recreate directory, click refresh
- [ ] USB now appears

**Status:** ☐ Pass ☐ Fail
**Notes:** ___________________________________________

### TC1.3 - Multiple USB Detection
- [ ] Create second test path: `C:\Users\yangs\Desktop\test-wallet-usb2`
- [ ] Both paths appear in USB list
- [ ] Can select either path
- [ ] Selected path highlighted/active

**Status:** ☐ Pass ☐ Fail
**Notes:** ___________________________________________

---

## Test Suite 2: Wallet Creation (User Story 1)

### TC2.1 - Create 12-Word Wallet (Basic)
**Test Steps:**
1. [ ] Click "Create New Wallet"
2. [ ] Enter password: `TestPassword123!`
3. [ ] Confirm password: `TestPassword123!`
4. [ ] Password strength shows "Strong"
5. [ ] Select: **12 words**
6. [ ] Leave BIP39 passphrase OFF
7. [ ] Optional name: `Test Wallet 12`
8. [ ] Click "Create Wallet"

**Expected Results:**
- [ ] Loading spinner appears (3-10 seconds)
- [ ] Mnemonic display screen shows
- [ ] Exactly **12 words** displayed in grid format
- [ ] Words are valid BIP39 words (lowercase, alphabetic)
- [ ] **60-second countdown timer** visible and counting down
- [ ] "Copy to Clipboard" button works
- [ ] "I've Written It Down" checkbox appears
- [ ] Checkbox **disabled** until countdown reaches 0
- [ ] After countdown ends, checkbox becomes enabled
- [ ] Check checkbox and click "Continue"
- [ ] Return to dashboard/wallet list
- [ ] New wallet appears with name "Test Wallet 12"

**Status:** ☐ Pass ☐ Fail
**Mnemonic (first 4 words for verification):** ___________________________________________
**Creation Time:** _____ seconds
**Notes:** ___________________________________________

### TC2.2 - Create 24-Word Wallet with BIP39 Passphrase
**Test Steps:**
1. [ ] Click "Create New Wallet"
2. [ ] Enter password: `SecurePass999!@#`
3. [ ] Confirm password: `SecurePass999!@#`
4. [ ] Select: **24 words**
5. [ ] Enable "Use BIP39 Passphrase"
6. [ ] Enter passphrase: `MySecret2025`
7. [ ] Wallet name: `Premium Wallet 24`
8. [ ] Click "Create Wallet"

**Expected Results:**
- [ ] Exactly **24 words** displayed
- [ ] 60-second countdown enforced
- [ ] Wallet created with custom name "Premium Wallet 24"
- [ ] Passphrase flag saved (has_passphrase: true)

**Status:** ☐ Pass ☐ Fail
**Notes:** ___________________________________________

### TC2.3 - Password Validation
**Test Each Scenario:**

**a) Too Short:**
- [ ] Enter password: `Test123`
- [ ] Error: "Password must be at least 12 characters"
- [ ] "Create Wallet" button disabled

**b) Missing Uppercase:**
- [ ] Enter password: `testpassword123!`
- [ ] Error: "Password must contain uppercase letter"
- [ ] Button disabled

**c) Missing Lowercase:**
- [ ] Enter password: `TESTPASSWORD123!`
- [ ] Error: "Password must contain lowercase letter"
- [ ] Button disabled

**d) Missing Number:**
- [ ] Enter password: `TestPassword!@#`
- [ ] Error: "Password must contain number"
- [ ] Button disabled

**e) Password Mismatch:**
- [ ] Enter password: `TestPassword123!`
- [ ] Confirm: `TestPassword123` (missing !)
- [ ] Error: "Passwords do not match"
- [ ] Button disabled

**f) Valid Password:**
- [ ] Enter password: `TestPassword123!`
- [ ] Confirm: `TestPassword123!`
- [ ] Password strength: "Strong"
- [ ] Button enabled

**Status:** ☐ Pass ☐ Fail
**Notes:** ___________________________________________

### TC2.4 - Mnemonic Display Security
**Screenshot Protection:**
- [ ] On mnemonic display screen
- [ ] Attempt screenshot:
  - **Windows:** Press `Win + Shift + S`
  - **macOS:** Press `Cmd + Shift + 4`
  - **Linux:** Press `PrtScn`
- [ ] Screenshot blocked OR shows black screen
- [ ] Console shows security message (optional)

**Clipboard Copy:**
- [ ] Click "Copy to Clipboard" button
- [ ] Paste into notepad: All 12/24 words appear
- [ ] Wait exactly 30 seconds
- [ ] Paste again: Clipboard cleared (empty or different content)

**Countdown Timer:**
- [ ] Timer starts at 60 seconds
- [ ] Timer counts down every second
- [ ] "I've Written It Down" checkbox disabled while timer > 0
- [ ] At 0 seconds, checkbox becomes enabled
- [ ] Cannot click "Continue" without checking checkbox

**Status:** ☐ Pass ☐ Fail
**Notes:** ___________________________________________

### TC2.5 - Wallet File Creation
**Verify USB Storage:**
1. [ ] Navigate to `C:\Users\yangs\Desktop\test-wallet-usb\wallets\`
2. [ ] Find wallet directory (format: `<wallet-id>/`)
3. [ ] Check `wallet.json` exists (encrypted wallet metadata)
4. [ ] Check `addresses.json` does NOT exist yet (created on first unlock)

**File Structure:**
```
test-wallet-usb/
  wallets/
    <wallet-id-1>/
      wallet.json       ← Should exist
      addresses.json    ← Should NOT exist yet
```

**Status:** ☐ Pass ☐ Fail
**Wallet ID:** ___________________________________________
**Notes:** ___________________________________________

---

## Test Suite 3: Wallet Import (User Story 2)

### TC3.1 - Import Valid 12-Word Mnemonic
**Test Mnemonic (standard BIP39 test vector):**
```
abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about
```

**Test Steps:**
1. [ ] Click "Import Existing Wallet"
2. [ ] Paste mnemonic above
3. [ ] Mnemonic auto-normalizes (lowercase, single spaces)
4. [ ] Enter password: `ImportTest123!`
5. [ ] Confirm password: `ImportTest123!`
6. [ ] Wallet name: `Imported Test Wallet`
7. [ ] Click "Import Wallet"

**Expected Results:**
- [ ] Loading spinner appears
- [ ] Success message: "Wallet imported successfully"
- [ ] Wallet appears in wallet list
- [ ] Wallet name shows "Imported Test Wallet"

**Status:** ☐ Pass ☐ Fail
**Import Time:** _____ seconds
**Notes:** ___________________________________________

### TC3.2 - Import 24-Word Mnemonic with Passphrase
**Test Steps:**
1. [ ] Use 24-word mnemonic from TC2.2 (if saved)
2. [ ] Click "Import Existing Wallet"
3. [ ] Paste 24-word mnemonic
4. [ ] Enable "Use BIP39 Passphrase"
5. [ ] Enter passphrase: `MySecret2025` (same as creation)
6. [ ] Enter password: `ImportPass999!`
7. [ ] Wallet name: `Imported Premium`
8. [ ] Click "Import"

**Expected Results:**
- [ ] Wallet imported successfully
- [ ] Generated addresses should match original wallet (if still available for comparison)

**Status:** ☐ Pass ☐ Fail
**Notes:** ___________________________________________

### TC3.3 - Mnemonic Validation Errors

**a) Invalid Word Count:**
- [ ] Enter 6 words: `abandon abandon abandon abandon abandon abandon`
- [ ] Error: "Mnemonic must be 12 or 24 words (you entered 6 words)"
- [ ] "Import Wallet" button disabled

**b) Invalid Word:**
- [ ] Enter: `notaword abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about`
- [ ] Error: "Mnemonic contains invalid words"
- [ ] Button disabled

**c) Extra Whitespace (should auto-fix):**
- [ ] Enter: `abandon  abandon   abandon` (multiple spaces)
- [ ] Mnemonic auto-normalized to single spaces
- [ ] No error if words are valid

**d) Mixed Case (should auto-fix):**
- [ ] Enter: `ABANDON Abandon aBaNdOn ...`
- [ ] All words converted to lowercase
- [ ] No error

**Status:** ☐ Pass ☐ Fail
**Notes:** ___________________________________________

### TC3.4 - Duplicate Wallet Detection
**Test Steps:**
1. [ ] Import the test mnemonic from TC3.1
2. [ ] Note wallet ID
3. [ ] Try importing the SAME mnemonic again
4. [ ] System should detect duplicate

**Expected Results:**
- [ ] Warning message: "This wallet already exists"
- [ ] Option to cancel or continue
- [ ] If continue, wallet ID remains the same (no duplicate storage)

**Status:** ☐ Pass ☐ Fail
**Notes:** ___________________________________________

---

## Test Suite 4: Address Generation & Display (User Story 3)

### TC4.1 - Generate All 54 Addresses
**Test Steps:**
1. [ ] Select wallet from wallet list (use TC2.1 or TC3.1 wallet)
2. [ ] Click "View Addresses" or "Unlock"
3. [ ] Enter wallet password
4. [ ] Click "Unlock"

**Expected Results:**
- [ ] Loading spinner: "Generating addresses..."
- [ ] Progress indicator (if implemented)
- [ ] Wait for completion (10-30 seconds expected)
- [ ] Address list displays
- [ ] Total count: **exactly 54 addresses**
- [ ] Addresses grouped by category:
  - [ ] **Base:** Bitcoin, Ethereum, etc.
  - [ ] **Layer2:** Polygon, Arbitrum, etc.
  - [ ] **Regional:** Japan Open Chain, etc.
  - [ ] **Cosmos:** Cosmos Hub, etc.
  - [ ] **AltEvm:** Alternative EVM chains
  - [ ] **Specialized:** Special purpose chains

**Verification:**
- [ ] Count addresses manually or use counter
- [ ] First address: Bitcoin (BTC, rank 1)
- [ ] Second address: Ethereum (ETH, rank 2)

**Status:** ☐ Pass ☐ Fail
**Generation Time:** _____ seconds
**Total Address Count:** _____
**Notes:** ___________________________________________

### TC4.2 - Address Data Completeness
**For Each Address (check first 5):**

**Address #1 - Bitcoin:**
- [ ] **Rank:** 1
- [ ] **Symbol:** BTC
- [ ] **Name:** Bitcoin
- [ ] **Address:** Starts with `1` or `bc1` (valid Bitcoin format)
- [ ] **Derivation Path:** `m/44'/0'/0'/0/0`
- [ ] **Category:** base
- [ ] **Key Type:** secp256k1

**Address #2 - Ethereum:**
- [ ] **Rank:** 2
- [ ] **Symbol:** ETH
- [ ] **Name:** Ethereum
- [ ] **Address:** Starts with `0x` (40 hex chars)
- [ ] **Derivation Path:** `m/44'/60'/0'/0/0`
- [ ] **Category:** base
- [ ] **Key Type:** secp256k1

**Address #3-5:** (Pick any 3)
- [ ] All required fields present
- [ ] Addresses in correct format for blockchain
- [ ] Derivation paths follow BIP44: `m/44'/coin_type'/0'/0/0`

**Status:** ☐ Pass ☐ Fail
**Notes:** ___________________________________________

### TC4.3 - Address List UI Features

**Virtualization (Performance):**
- [ ] Scroll through address list smoothly
- [ ] No lag when scrolling quickly
- [ ] Only visible addresses rendered (check with React DevTools)

**Copy to Clipboard:**
- [ ] Click copy icon next to Bitcoin address
- [ ] Toast notification: "Address copied"
- [ ] Paste into notepad: Correct Bitcoin address
- [ ] Wait 30 seconds
- [ ] Paste again: Clipboard cleared

**Search/Filter (if implemented):**
- [ ] Search for "Bitcoin" → BTC addresses shown
- [ ] Search for "ETH" → Ethereum addresses shown
- [ ] Clear search → All 54 addresses visible

**Category Filter (if implemented):**
- [ ] Filter by "Base" → Shows BTC, ETH, etc.
- [ ] Filter by "Layer2" → Shows Polygon, Arbitrum, etc.
- [ ] "All Categories" → Shows all 54

**Status:** ☐ Pass ☐ Fail
**Notes:** ___________________________________________

### TC4.4 - Address File Creation
**Verify USB Storage:**
1. [ ] After addresses generated, navigate to wallet directory
2. [ ] `C:\Users\yangs\Desktop\test-wallet-usb\wallets\<wallet-id>\`
3. [ ] `addresses.json` now exists
4. [ ] Open file, verify structure:

```json
{
  "wallet_id": "...",
  "addresses": [
    {
      "rank": 1,
      "symbol": "BTC",
      "name": "Bitcoin",
      "coin_type": 0,
      "derivation_path": "m/44'/0'/0'/0/0",
      "address": "1A1zP1...",
      "category": "base",
      "key_type": "secp256k1"
    },
    // ... 53 more
  ],
  "total_count": 54,
  "checksum": "sha256:..."
}
```

- [ ] `total_count` is 54
- [ ] `checksum` field present
- [ ] All addresses have required fields

**Status:** ☐ Pass ☐ Fail
**Notes:** ___________________________________________

---

## Test Suite 5: Multi-Wallet Management (User Story 4)

### TC5.1 - Wallet List Display
**Setup:**
- [ ] Create 3 wallets with different names:
  - `Wallet Alpha`
  - `Wallet Beta`
  - `Wallet Gamma`

**Test:**
- [ ] Return to main dashboard
- [ ] All 3 wallets appear in wallet selector/list
- [ ] Each wallet shows:
  - [ ] Name
  - [ ] Created date/timestamp
  - [ ] Last modified date (if implemented)
- [ ] Each has "View Addresses" button
- [ ] Each has "Rename" or settings button

**Status:** ☐ Pass ☐ Fail
**Notes:** ___________________________________________

### TC5.2 - Switch Between Wallets
**Test Steps:**
1. [ ] Select "Wallet Alpha"
2. [ ] Unlock with password
3. [ ] View addresses (note first 3 addresses)
4. [ ] Return to wallet list
5. [ ] Select "Wallet Beta"
6. [ ] Unlock with password
7. [ ] View addresses
8. [ ] Verify addresses are DIFFERENT from Wallet Alpha
9. [ ] Return to wallet list
10. [ ] Both wallets still visible

**Expected Results:**
- [ ] Each wallet has unique addresses
- [ ] No data loss when switching
- [ ] Wallet list persists

**Status:** ☐ Pass ☐ Fail
**Notes:** ___________________________________________

### TC5.3 - Rename Wallet
**Test Steps:**
1. [ ] Select "Wallet Alpha"
2. [ ] Click "Rename" button/icon
3. [ ] Enter new name: `Updated Alpha Wallet`
4. [ ] Click "Save" or press Enter
5. [ ] Success message appears
6. [ ] Wallet list updates with new name
7. [ ] Unlock wallet and verify addresses unchanged

**Expected Results:**
- [ ] Rename succeeds
- [ ] New name persists across app restarts
- [ ] Addresses remain identical (only metadata changed)

**Status:** ☐ Pass ☐ Fail
**Notes:** ___________________________________________

### TC5.4 - Wallet Metadata Persistence
**Test Steps:**
1. [ ] Create wallet, view addresses
2. [ ] Close application completely
3. [ ] Relaunch application
4. [ ] Select same USB path
5. [ ] Wallet still appears in list
6. [ ] Unlock wallet
7. [ ] All 54 addresses still present

**Expected Results:**
- [ ] Wallet persists across sessions
- [ ] Created date unchanged
- [ ] Addresses unchanged

**Status:** ☐ Pass ☐ Fail
**Notes:** ___________________________________________

---

## Test Suite 6: Address Export (User Story 5)

### TC6.1 - Export to JSON
**Test Steps:**
1. [ ] Unlock wallet, view addresses
2. [ ] Click "Export Addresses" button
3. [ ] Select format: **JSON**
4. [ ] Choose save location (e.g., Desktop)
5. [ ] Click "Export"
6. [ ] Success message appears
7. [ ] Open exported JSON file

**Verify JSON Structure:**
```json
{
  "wallet_id": "<wallet-id>",
  "addresses": [
    {
      "rank": 1,
      "symbol": "BTC",
      "name": "Bitcoin",
      "coin_type": 0,
      "derivation_path": "m/44'/0'/0'/0/0",
      "address": "1A1zP1...",
      "category": "base",
      "key_type": "secp256k1"
    }
    // ... 53 more
  ],
  "total_count": 54,
  "exported_at": "2025-10-24T12:00:00Z"
}
```

- [ ] Valid JSON (no syntax errors)
- [ ] Contains all 54 addresses
- [ ] All required fields present
- [ ] `total_count` is 54

**Status:** ☐ Pass ☐ Fail
**File Location:** ___________________________________________
**Notes:** ___________________________________________

### TC6.2 - Export to CSV
**Test Steps:**
1. [ ] Click "Export Addresses"
2. [ ] Select format: **CSV**
3. [ ] Export to Desktop
4. [ ] Open CSV in Excel/Google Sheets

**Verify CSV Structure:**
- [ ] Header row: `rank,symbol,name,coin_type,derivation_path,address,category,key_type`
- [ ] 54 data rows (plus 1 header = 55 total)
- [ ] Columns aligned correctly
- [ ] Special characters escaped (commas in quotes, etc.)

**Sample First Row:**
```csv
1,BTC,Bitcoin,0,m/44'/0'/0'/0/0,1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa,base,secp256k1
```

**Status:** ☐ Pass ☐ Fail
**File Location:** ___________________________________________
**Notes:** ___________________________________________

### TC6.3 - Export Filename Format
**Test:**
- [ ] Export JSON
- [ ] Check filename: `arcsign-addresses-<wallet_id>-<timestamp>.json`
- [ ] Example: `arcsign-addresses-abc123-20251024120000.json`
- [ ] Export again 5 seconds later
- [ ] Verify different timestamp (no overwrite)

**Status:** ☐ Pass ☐ Fail
**Notes:** ___________________________________________

---

## Test Suite 7: Security Features (Phase 8)

### TC7.1 - Screenshot Protection

**On Mnemonic Display Screen:**
- [ ] Create wallet → Mnemonic display appears
- [ ] **Windows:** Press `Win + Shift + S`
  - [ ] Screenshot blocked OR window shows black
- [ ] **macOS:** Press `Cmd + Shift + 4`
  - [ ] Screenshot shows black/protected window
- [ ] **Linux:** Press `PrtScn`
  - [ ] Screenshot blocked or watermarked

**On Address List Screen:**
- [ ] View addresses
- [ ] Attempt screenshot
- [ ] Addresses protected (black screen or blocked)

**On Non-Sensitive Screens:**
- [ ] USB selection screen
- [ ] Attempt screenshot
- [ ] Screenshot allowed (not sensitive)

**Status:** ☐ Pass ☐ Fail
**Notes:** ___________________________________________

### TC7.2 - Clipboard Auto-Clear (30-second timer)
**Test Steps:**
1. [ ] Copy Bitcoin address to clipboard
2. [ ] Immediately paste → Address appears
3. [ ] Wait **29 seconds**
4. [ ] Paste again → Address still there
5. [ ] Wait **1 more second** (total 30 seconds)
6. [ ] Paste again → Clipboard empty or cleared
7. [ ] Copy Ethereum address
8. [ ] After 15 seconds, manually copy something else
9. [ ] Verify manual copy NOT cleared at 30 seconds

**Expected Results:**
- [ ] Clipboard cleared after exactly 30 seconds
- [ ] Manual copies not affected
- [ ] Timer resets on each new copy

**Status:** ☐ Pass ☐ Fail
**Notes:** ___________________________________________

### TC7.3 - Inactivity Auto-Logout (15 minutes)
**Test Steps:**
1. [ ] Unlock wallet, view addresses
2. [ ] Leave application idle (no mouse/keyboard interaction)
3. [ ] Wait **14 minutes** → No logout yet
4. [ ] Wait **1 more minute** (total 15 minutes)
5. [ ] Warning modal appears: "Logging out in 60 seconds due to inactivity"
6. [ ] Click "Stay Logged In"
7. [ ] Timer resets
8. [ ] Wait **15 minutes** again without interaction
9. [ ] Warning appears at 15:00
10. [ ] Let countdown reach 0
11. [ ] Application locks → Returns to wallet selection
12. [ ] Sensitive data cleared from memory

**Expected Results:**
- [ ] 15-minute idle triggers warning
- [ ] 60-second countdown before logout
- [ ] "Stay Logged In" resets timer
- [ ] Auto-logout after 16 minutes total (15 + 1)

**Status:** ☐ Pass ☐ Fail
**Notes:** ___________________________________________ _(This test takes 16+ minutes)_

### TC7.4 - Password Protection
**Wrong Password:**
- [ ] Select wallet
- [ ] Enter wrong password: `WrongPass123!`
- [ ] Click "Unlock"
- [ ] Error: "Invalid password" or "Authentication failed"
- [ ] Wallet remains locked

**Correct Password:**
- [ ] Enter correct password
- [ ] Click "Unlock"
- [ ] Wallet unlocks successfully
- [ ] Addresses displayed

**Status:** ☐ Pass ☐ Fail
**Notes:** ___________________________________________

### TC7.5 - Sensitive Memory Clearing
**Test Steps:**
1. [ ] Unlock wallet, view mnemonic (if creation) or addresses
2. [ ] Close application completely
3. [ ] _(Advanced)_ Use memory inspector tool (if available)
4. [ ] Verify mnemonic NOT in memory dump
5. [ ] Verify password NOT in memory dump

**Expected Results:**
- [ ] Mnemonic cleared on screen transition
- [ ] Password cleared after authentication
- [ ] No sensitive data in React DevTools state

**Status:** ☐ Pass ☐ Fail
**Notes:** ___________________________________________ _(Skip if no memory tools)_

---

## Test Suite 8: Error Handling & Edge Cases

### TC8.1 - USB Disconnected During Operation
**Test Steps:**
1. [ ] Unlock wallet, viewing addresses
2. [ ] Delete test directory: `C:\Users\yangs\Desktop\test-wallet-usb`
3. [ ] Try to export addresses
4. [ ] Error message: "USB device not found" or similar
5. [ ] Recreate directory
6. [ ] Retry operation
7. [ ] Operation succeeds

**Status:** ☐ Pass ☐ Fail
**Notes:** ___________________________________________

### TC8.2 - Insufficient USB Space
**Test Steps:**
1. [ ] _(Difficult to test without full USB)_
2. [ ] Simulate by checking error handling code
3. [ ] Expected error: "Insufficient space on USB device"

**Status:** ☐ Pass ☐ Fail ☐ Skipped
**Notes:** ___________________________________________

### TC8.3 - Read-Only USB
**Test Steps:**
1. [ ] Set test directory to read-only (Windows file properties)
2. [ ] Try to create wallet
3. [ ] Error: "USB device is read-only" or "Permission denied"
4. [ ] Remove read-only flag
5. [ ] Retry → Success

**Status:** ☐ Pass ☐ Fail
**Notes:** ___________________________________________

### TC8.4 - CLI Binary Not Found
**Test Steps:**
1. [ ] Rename `arcsign.exe` to `arcsign.exe.bak`
2. [ ] Try to create wallet
3. [ ] Error: "CLI binary not found at: ./arcsign.exe"
4. [ ] Restore binary name
5. [ ] Retry → Success

**Status:** ☐ Pass ☐ Fail
**Notes:** ___________________________________________

### TC8.5 - Network/Process Errors
**Test Steps:**
1. [ ] Kill Go CLI process (if running in background)
2. [ ] Try wallet operation
3. [ ] Error: "Failed to execute CLI" or similar
4. [ ] Application remains stable (no crash)

**Status:** ☐ Pass ☐ Fail
**Notes:** ___________________________________________

---

## Test Suite 9: Performance Benchmarks

### TC9.1 - Wallet Creation Speed
**Test:**
- [ ] Create 12-word wallet
- [ ] Measure time from "Create Wallet" click to mnemonic display

**Results:**
- **Target:** <10 seconds
- **Actual:** _____ seconds
- [ ] Pass (<10s) [ ] Fail (≥10s)

**Notes:** ___________________________________________

### TC9.2 - Address Generation Speed
**Test:**
- [ ] Unlock wallet, trigger address generation
- [ ] Measure time from "Unlock" to address list display

**Results:**
- **Target:** <30 seconds for 54 addresses
- **Actual:** _____ seconds
- [ ] Pass (<30s) [ ] Fail (≥30s)

**Notes:** ___________________________________________

### TC9.3 - Export Performance
**Test:**
- [ ] Export 54 addresses to JSON
- [ ] Measure time from "Export" click to file saved

**Results:**
- **Target:** <2 seconds
- **Actual:** _____ seconds
- [ ] Pass (<2s) [ ] Fail (≥2s)

**Notes:** ___________________________________________

### TC9.4 - Memory Usage
**Test:**
- [ ] Check Task Manager/Activity Monitor
- [ ] At idle: _____ MB
- [ ] With addresses loaded: _____ MB
- [ ] Expected: <500 MB

**Results:**
- [ ] Pass (<500 MB) [ ] Fail (≥500 MB)

**Notes:** ___________________________________________

---

## Test Suite 10: Data Integrity Verification

### TC10.1 - Mnemonic-to-Address Consistency
**Test Steps:**
1. [ ] Use test mnemonic: `abandon abandon abandon ... about`
2. [ ] Import as Wallet A
3. [ ] Generate addresses, note Bitcoin address
4. [ ] Delete wallet (if possible) or use new USB
5. [ ] Import SAME mnemonic as Wallet B
6. [ ] Generate addresses
7. [ ] Compare Bitcoin addresses → Should be IDENTICAL

**Expected Results:**
- [ ] Same mnemonic produces same addresses
- [ ] BTC addresses match
- [ ] ETH addresses match
- [ ] All 54 addresses identical

**Status:** ☐ Pass ☐ Fail
**BTC Address (Wallet A):** ___________________________________________
**BTC Address (Wallet B):** ___________________________________________
**Match:** ☐ Yes ☐ No

### TC10.2 - Address Checksum Validation
**Test Steps:**
1. [ ] Generate addresses for wallet
2. [ ] Copy Bitcoin address
3. [ ] Use online validator: https://en.bitcoin.it/wiki/Address
4. [ ] Verify checksum valid
5. [ ] Repeat for Ethereum (use EIP-55 checksum validator)

**Expected Results:**
- [ ] Bitcoin address checksum valid
- [ ] Ethereum address checksum valid (mixed case)
- [ ] No invalid addresses generated

**Status:** ☐ Pass ☐ Fail
**Notes:** ___________________________________________

### TC10.3 - Wallet File Encryption
**Test Steps:**
1. [ ] Create wallet with password `TestPass123!`
2. [ ] Navigate to `wallet.json` file
3. [ ] Open in text editor
4. [ ] Verify mnemonic NOT in plaintext
5. [ ] Verify encrypted data present (base64/hex format)

**Expected Results:**
- [ ] `wallet.json` does not contain mnemonic in plaintext
- [ ] File contains encrypted blob
- [ ] Password not stored in file

**Status:** ☐ Pass ☐ Fail
**Notes:** ___________________________________________

---

## Critical Bug Checklist (Regressions)

### Previously Fixed Issues - Verify Still Fixed:
- [ ] ✅ Category serialization: `alt_evm` (not `altevm`)
- [ ] ✅ Tauri parameter naming: camelCase (not snake_case)
- [ ] ✅ Tempfile dependency included for tests
- [ ] ✅ All 48 unit tests passing

### Common Issues to Check:
- [ ] No console errors in browser DevTools
- [ ] No Rust compilation warnings (critical code)
- [ ] No TypeScript errors in frontend
- [ ] No memory leaks (check with repeated operations)
- [ ] No UI freezing during long operations

**Status:** ☐ Pass ☐ Fail
**Notes:** ___________________________________________

---

## Final Test Summary

### Test Statistics
| Category | Total Tests | Passed | Failed | Skipped |
|----------|-------------|--------|--------|---------|
| USB Detection | 3 | ___ | ___ | ___ |
| Wallet Creation | 5 | ___ | ___ | ___ |
| Wallet Import | 4 | ___ | ___ | ___ |
| Address Display | 4 | ___ | ___ | ___ |
| Multi-Wallet | 4 | ___ | ___ | ___ |
| Export | 3 | ___ | ___ | ___ |
| Security | 5 | ___ | ___ | ___ |
| Error Handling | 5 | ___ | ___ | ___ |
| Performance | 4 | ___ | ___ | ___ |
| Data Integrity | 3 | ___ | ___ | ___ |
| **TOTAL** | **40** | ___ | ___ | ___ |

### Overall Assessment
- [ ] ✅ **Ready for Production** - All tests passed, no critical issues
- [ ] ⚠️ **Needs Minor Fixes** - Some non-critical issues found
- [ ] ❌ **Needs Major Rework** - Critical bugs or missing features

### Critical Bugs Found
1. ___________________________________________
2. ___________________________________________
3. ___________________________________________

### Minor Issues Found
1. ___________________________________________
2. ___________________________________________
3. ___________________________________________

### Recommendations
___________________________________________
___________________________________________
___________________________________________

---

## Sign-Off

**Tester Name:** _____________________
**Signature:** _____________________
**Date:** _____________________
**Test Duration:** _____ hours

**Next Steps:**
- [ ] Create GitHub issues for failed tests
- [ ] Assign priority levels (P0-Critical, P1-High, P2-Medium, P3-Low)
- [ ] Schedule bug fixes
- [ ] Re-test after fixes
- [ ] Approve for production release

---

**End of Manual Testing Checklist**
