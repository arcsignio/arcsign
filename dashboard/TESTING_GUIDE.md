# ArcSign Dashboard - Testing Guide

**Generated:** 2025-10-24
**Version:** 0.3.0
**Feature:** 004-dashboard

## Quick Start

### Option 1: Run Development Servers
```bash
# Simply double-click:
start-dev.bat
```

### Option 2: Manual Start
```bash
# Terminal 1: Frontend
npm run dev

# Terminal 2: Tauri
npm run tauri dev
```

---

## Test Scenarios

### 1. Create New Wallet (User Story 1)

**Setup:**
- Test USB Path: `C:\Users\yangs\Desktop\test-wallet-usb`

**Steps:**
1. Click "Create New Wallet" button
2. Fill in the form:
   - **Password**: `TestPassword123!` (12+ chars, uppercase, lowercase, number)
   - **Confirm Password**: `TestPassword123!`
   - **Wallet Name**: `My Test Wallet` (optional)
   - **Mnemonic Length**: Select `24 words`
   - **USB Path**: `C:\Users\yangs\Desktop\test-wallet-usb`
3. Click "Create Wallet"

**Expected Results:**
✅ Wallet creation succeeds
✅ Mnemonic display appears with:
  - 24 words in 3-column grid
  - 30-second countdown timer
  - Screenshot protection enabled (window cannot be captured)
  - Copy to clipboard button works
  - "I have backed up" checkbox (enabled after 5 seconds)
✅ After confirmation, mnemonic disappears from memory

**Test Files Created:**
```
test-wallet-usb/
  wallets/
    <wallet-id>/
      wallet.json       (encrypted wallet metadata)
      addresses.json    (54 blockchain addresses with checksum)
```

---

### 2. Import Existing Wallet (User Story 2)

**Test Mnemonic (valid BIP39):**
```
abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about
```

**Steps:**
1. Click "Import Wallet"
2. Paste the mnemonic
3. Set password: `ImportTest123!`
4. Confirm password
5. Wallet name: `Imported Wallet`
6. Click "Import"

**Expected Results:**
✅ Mnemonic is normalized (whitespace trimmed)
✅ BIP39 validation passes
✅ Wallet is imported successfully
✅ Duplicate detection works (try importing same mnemonic twice)

---

### 3. View Wallet Addresses (User Story 3)

**Steps:**
1. Select a wallet from the dropdown
2. Enter wallet password
3. Click "Load Addresses"

**Expected Results:**
✅ 54 addresses load (one per blockchain)
✅ Address list displays:
  - Rank (1-54)
  - Symbol (BTC, ETH, SOL, etc.)
  - Name (Bitcoin, Ethereum, etc.)
  - Address (blockchain-specific format)
  - Derivation path (m/44'/xxx'/0'/0/0)

**Filtering:**
- Category filter: base, layer2, regional, cosmos, alt_evm, specialized
- Search: Type "BTC" or "Bitcoin" to filter
- Key type filter: secp256k1, ed25519, sr25519

---

### 4. Multi-Wallet Management (User Story 4)

**Steps:**
1. Create 2-3 wallets with different names
2. Use wallet selector dropdown to switch between wallets
3. Right-click wallet → "Rename"
4. Change name to "Updated Wallet Name"

**Expected Results:**
✅ All wallets appear in dropdown
✅ Switching wallets clears current address list
✅ Rename updates wallet metadata
✅ Wallet count shows in UI

---

### 5. Export Addresses (User Story 5)

**Steps:**
1. Load a wallet's addresses
2. Click "Export" button
3. Select format: JSON or CSV
4. Click "Export"

**Expected Results:**
✅ JSON export contains full metadata:
```json
{
  "wallet_id": "...",
  "addresses": [
    {
      "rank": 1,
      "symbol": "BTC",
      "name": "Bitcoin",
      "address": "1A1zP1...",
      "derivation_path": "m/44'/0'/0'/0/0",
      "category": "base",
      "key_type": "secp256k1"
    }
  ],
  "total_count": 54
}
```

✅ CSV export contains:
```csv
rank,symbol,name,address,derivation_path
1,BTC,Bitcoin,1A1zP1...,m/44'/0'/0'/0/0
```

---

## Security Features to Verify

### Screenshot Protection
**Test:**
1. Open wallet creation → mnemonic display
2. Try taking screenshot (Windows: Win+Shift+S)

**Expected:**
- macOS: Screenshot shows black window
- Windows: Screenshot blocked or shows black area
- Linux: Watermark appears on screen

### Password Validation
**Test these passwords:**
- ❌ `short` (too short)
- ❌ `alllowercase123` (no uppercase)
- ❌ `ALLUPPERCASE123` (no lowercase)
- ❌ `NoNumbers` (no number)
- ✅ `ValidPassword123!` (all requirements met)

### Mnemonic Memory Clearing
**Test:**
1. Create wallet, view mnemonic
2. Click "I have backed up"
3. Open browser DevTools → React DevTools → State

**Expected:**
- Mnemonic should NOT appear in React state
- Memory should be cleared

---

## USB Storage Verification

**Check USB Files:**
```bash
# View wallet metadata
cat C:/Users/yangs/Desktop/test-wallet-usb/wallets/<wallet-id>/wallet.json

# View addresses file
cat C:/Users/yangs/Desktop/test-wallet-usb/wallets/<wallet-id>/addresses.json
```

**Expected Structure:**
```
test-wallet-usb/
  wallets/
    <wallet-id-1>/
      wallet.json       (encrypted, AES-256-GCM)
      addresses.json    (plaintext with SHA-256 checksum)
    <wallet-id-2>/
      wallet.json
      addresses.json
```

---

## Performance Benchmarks

| Operation | Target | Actual |
|-----------|--------|--------|
| Wallet Creation | <3s | ⏱️ Test |
| Address Generation | <5s | ⏱️ Test |
| Address Loading | <2s (cached) | ⏱️ Test |
| Export JSON | <1s | ⏱️ Test |
| Export CSV | <1s | ⏱️ Test |

---

## Troubleshooting

### Issue: "CLI not found"
**Solution:**
```bash
# Ensure CLI is in Tauri directory
ls C:/Users/yangs/Desktop/arcsign_v2/dashboard/src-tauri/arcsign.exe

# Rebuild if missing
cd C:/Users/yangs/Desktop/arcsign_v2
go build -o arcsign.exe ./cmd/arcsign
cp arcsign.exe dashboard/src-tauri/
```

### Issue: "USB path does not exist"
**Solution:**
```bash
# Create test directory
mkdir C:/Users/yangs/Desktop/test-wallet-usb

# Or use actual USB drive path
# E.g., D:\ or E:\
```

### Issue: Tauri compilation takes too long
**Expected:**
- First compile: 5-10 minutes (downloads dependencies)
- Subsequent compiles: 1-2 minutes (incremental)

### Issue: Frontend not loading
**Check:**
```bash
# Ensure Vite dev server is running
# Should see: "Local: http://localhost:5173"
npm run dev
```

---

## Testing Checklist

**Core Features:**
- [ ] Create wallet (12 words)
- [ ] Create wallet (24 words)
- [ ] Create wallet with BIP39 passphrase
- [ ] Import wallet from mnemonic
- [ ] Import duplicate wallet (should detect)
- [ ] View 54 addresses
- [ ] Filter addresses by category
- [ ] Search addresses by symbol
- [ ] Export to JSON
- [ ] Export to CSV
- [ ] Switch between wallets
- [ ] Rename wallet

**Security:**
- [ ] Screenshot protection works
- [ ] Mnemonic auto-clear (30 seconds)
- [ ] Password validation enforced
- [ ] Mnemonic not in React state
- [ ] USB files have correct permissions

**UI/UX:**
- [ ] Loading spinners appear
- [ ] Error messages are user-friendly
- [ ] Forms validate correctly
- [ ] Confirmation dialogs work
- [ ] Countdown timer accurate
- [ ] Copy to clipboard works

---

## Next Steps After Testing

1. **Report Issues:** Create GitHub issues for any bugs found
2. **Performance:** Measure actual timing vs benchmarks
3. **Edge Cases:** Test with invalid inputs, network errors, USB removal
4. **Production Build:** Run `npm run tauri build` for release binary

---

**Happy Testing! 🎉**
