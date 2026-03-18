package backup

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/Jason-chen-taiwan/arcSignv2/internal/models"
	"github.com/Jason-chen-taiwan/arcSignv2/internal/services/crypto"
	"github.com/Jason-chen-taiwan/arcSignv2/internal/services/storage"
)

// createTestWallet creates a minimal wallet directory for testing
func createTestWallet(t *testing.T, storagePath, walletID, name, password string, usesPassphrase bool) {
	t.Helper()

	walletDir := filepath.Join(storagePath, walletID)
	if err := os.MkdirAll(walletDir, 0700); err != nil {
		t.Fatalf("failed to create wallet dir: %v", err)
	}

	// Encrypt a test mnemonic
	mnemonic := "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"
	encrypted, err := crypto.EncryptMnemonic(mnemonic, password)
	if err != nil {
		t.Fatalf("failed to encrypt mnemonic: %v", err)
	}

	mnemonicPath := filepath.Join(walletDir, "mnemonic.enc")
	encData := crypto.SerializeEncryptedData(encrypted)
	if err := storage.AtomicWriteFile(mnemonicPath, encData, 0600); err != nil {
		t.Fatalf("failed to write mnemonic.enc: %v", err)
	}

	// Create wallet.json
	wallet := &models.Wallet{
		ID:                    walletID,
		Name:                  name,
		EncryptedMnemonicPath: mnemonicPath,
		UsesPassphrase:        usesPassphrase,
		AddressBook: &models.AddressBook{
			Addresses: []models.DerivedAddress{
				{
					Symbol:         "BTC",
					CoinName:       "Bitcoin",
					CoinType:       0,
					Address:        "bc1qtest123",
					DerivationPath: "m/44'/0'/0'/0/0",
					MarketCapRank:  1,
					Category:       models.ChainCategoryUTXO,
				},
				{
					Symbol:         "ETH",
					CoinName:       "Ethereum",
					CoinType:       60,
					Address:        "0xtest456",
					DerivationPath: "m/44'/60'/0'/0/0",
					MarketCapRank:  2,
					Category:       models.ChainCategoryEVMMainnet,
				},
			},
		},
	}

	metadataJSON, err := json.MarshalIndent(wallet, "", "  ")
	if err != nil {
		t.Fatalf("failed to marshal wallet: %v", err)
	}

	metadataPath := filepath.Join(walletDir, "wallet.json")
	if err := storage.AtomicWriteFile(metadataPath, metadataJSON, 0600); err != nil {
		t.Fatalf("failed to write wallet.json: %v", err)
	}
}

func TestExportBackup_Success(t *testing.T) {
	tmpDir := t.TempDir()
	walletID := "test-wallet-001"
	password := "TestPass123!"

	createTestWallet(t, tmpDir, walletID, "My Test Wallet", password, false)

	svc := NewBackupService(tmpDir)
	backupData, walletName, err := svc.ExportBackup(walletID)
	if err != nil {
		t.Fatalf("ExportBackup failed: %v", err)
	}

	if walletName != "My Test Wallet" {
		t.Errorf("expected wallet name %q, got %q", "My Test Wallet", walletName)
	}

	// Verify backup is valid JSON with correct format
	var payload BackupPayload
	if err := json.Unmarshal(backupData, &payload); err != nil {
		t.Fatalf("backup data is not valid JSON: %v", err)
	}

	if payload.Format != BackupFormat {
		t.Errorf("expected format %q, got %q", BackupFormat, payload.Format)
	}
	if payload.Version != BackupVersion {
		t.Errorf("expected version %d, got %d", BackupVersion, payload.Version)
	}
	if payload.WalletName != "My Test Wallet" {
		t.Errorf("expected wallet name %q, got %q", "My Test Wallet", payload.WalletName)
	}
	if payload.MnemonicEncData == "" {
		t.Error("mnemonicEncData should not be empty")
	}
	if payload.ExportedAt == "" {
		t.Error("exportedAt should not be empty")
	}
}

func TestExportBackup_WalletNotFound(t *testing.T) {
	tmpDir := t.TempDir()
	svc := NewBackupService(tmpDir)

	_, _, err := svc.ExportBackup("nonexistent-wallet")
	if err == nil {
		t.Fatal("expected error for nonexistent wallet, got nil")
	}
}

func TestImportBackup_Success(t *testing.T) {
	tmpDir := t.TempDir()
	walletID := "test-wallet-002"
	password := "TestPass123!"

	createTestWallet(t, tmpDir, walletID, "Export Wallet", password, false)

	svc := NewBackupService(tmpDir)

	// Export
	backupData, _, err := svc.ExportBackup(walletID)
	if err != nil {
		t.Fatalf("ExportBackup failed: %v", err)
	}

	// Import into a different storage path
	importDir := t.TempDir()
	importSvc := NewBackupService(importDir)

	wallet, err := importSvc.ImportBackup(backupData, password, "")
	if err != nil {
		t.Fatalf("ImportBackup failed: %v", err)
	}

	// Verify new wallet has a different ID
	if wallet.ID == walletID {
		t.Error("imported wallet should have a new ID")
	}

	// Verify wallet name is preserved
	if wallet.Name != "Export Wallet" {
		t.Errorf("expected name %q, got %q", "Export Wallet", wallet.Name)
	}

	// Verify files exist on disk
	if _, err := os.Stat(filepath.Join(importDir, wallet.ID, "wallet.json")); err != nil {
		t.Errorf("wallet.json not found: %v", err)
	}
	if _, err := os.Stat(filepath.Join(importDir, wallet.ID, "mnemonic.enc")); err != nil {
		t.Errorf("mnemonic.enc not found: %v", err)
	}
}

func TestImportBackup_WrongPassword(t *testing.T) {
	tmpDir := t.TempDir()
	walletID := "test-wallet-003"
	password := "TestPass123!"

	createTestWallet(t, tmpDir, walletID, "Locked Wallet", password, false)

	svc := NewBackupService(tmpDir)
	backupData, _, err := svc.ExportBackup(walletID)
	if err != nil {
		t.Fatalf("ExportBackup failed: %v", err)
	}

	importDir := t.TempDir()
	importSvc := NewBackupService(importDir)

	_, err = importSvc.ImportBackup(backupData, "WrongPassword999!", "")
	if err == nil {
		t.Fatal("expected error for wrong password, got nil")
	}
}

func TestImportBackup_InvalidFormat(t *testing.T) {
	importDir := t.TempDir()
	importSvc := NewBackupService(importDir)

	// Test with invalid JSON
	_, err := importSvc.ImportBackup([]byte("not json"), "pass123", "")
	if err == nil {
		t.Fatal("expected error for invalid JSON")
	}

	// Test with wrong format field
	wrongFormat := `{"format": "not-arcsign", "version": 1}`
	_, err = importSvc.ImportBackup([]byte(wrongFormat), "pass123", "")
	if err == nil {
		t.Fatal("expected error for wrong format")
	}

	// Test with wrong version
	wrongVersion := `{"format": "arcsign-backup", "version": 999}`
	_, err = importSvc.ImportBackup([]byte(wrongVersion), "pass123", "")
	if err == nil {
		t.Fatal("expected error for wrong version")
	}
}

func TestImportBackup_PreservesAddressBook(t *testing.T) {
	tmpDir := t.TempDir()
	walletID := "test-wallet-004"
	password := "TestPass123!"

	createTestWallet(t, tmpDir, walletID, "Address Wallet", password, false)

	svc := NewBackupService(tmpDir)
	backupData, _, err := svc.ExportBackup(walletID)
	if err != nil {
		t.Fatalf("ExportBackup failed: %v", err)
	}

	importDir := t.TempDir()
	importSvc := NewBackupService(importDir)

	wallet, err := importSvc.ImportBackup(backupData, password, "")
	if err != nil {
		t.Fatalf("ImportBackup failed: %v", err)
	}

	// Verify address book is preserved
	if wallet.AddressBook == nil {
		t.Fatal("address book should not be nil")
	}
	if len(wallet.AddressBook.Addresses) != 2 {
		t.Fatalf("expected 2 addresses, got %d", len(wallet.AddressBook.Addresses))
	}

	btc := wallet.AddressBook.Addresses[0]
	if btc.Symbol != "BTC" || btc.Address != "bc1qtest123" {
		t.Errorf("BTC address not preserved: got %s / %s", btc.Symbol, btc.Address)
	}

	eth := wallet.AddressBook.Addresses[1]
	if eth.Symbol != "ETH" || eth.Address != "0xtest456" {
		t.Errorf("ETH address not preserved: got %s / %s", eth.Symbol, eth.Address)
	}
}

func TestImportBackup_PreservesUsesPassphrase(t *testing.T) {
	tmpDir := t.TempDir()
	walletID := "test-wallet-005"
	password := "TestPass123!"

	createTestWallet(t, tmpDir, walletID, "Passphrase Wallet", password, true)

	svc := NewBackupService(tmpDir)
	backupData, _, err := svc.ExportBackup(walletID)
	if err != nil {
		t.Fatalf("ExportBackup failed: %v", err)
	}

	importDir := t.TempDir()
	importSvc := NewBackupService(importDir)

	wallet, err := importSvc.ImportBackup(backupData, password, "")
	if err != nil {
		t.Fatalf("ImportBackup failed: %v", err)
	}

	if !wallet.UsesPassphrase {
		t.Error("usesPassphrase should be true after import")
	}
}

func TestImportBackup_CustomName(t *testing.T) {
	tmpDir := t.TempDir()
	walletID := "test-wallet-006"
	password := "TestPass123!"

	createTestWallet(t, tmpDir, walletID, "Original Name", password, false)

	svc := NewBackupService(tmpDir)
	backupData, _, err := svc.ExportBackup(walletID)
	if err != nil {
		t.Fatalf("ExportBackup failed: %v", err)
	}

	importDir := t.TempDir()
	importSvc := NewBackupService(importDir)

	wallet, err := importSvc.ImportBackup(backupData, password, "Custom Name")
	if err != nil {
		t.Fatalf("ImportBackup failed: %v", err)
	}

	if wallet.Name != "Custom Name" {
		t.Errorf("expected name %q, got %q", "Custom Name", wallet.Name)
	}
}

// ============================================================================
// Bundle (batch) export/import tests
// ============================================================================

func TestExportAllBackups_Success(t *testing.T) {
	tmpDir := t.TempDir()
	password := "BundlePass123!"

	// Create 3 wallets with different passwords
	createTestWallet(t, tmpDir, "wallet-a", "Wallet A", "PassA123!", false)
	createTestWallet(t, tmpDir, "wallet-b", "Wallet B", "PassB123!", false)
	createTestWallet(t, tmpDir, "wallet-c", "Wallet C", "PassC123!", true)

	svc := NewBackupService(tmpDir)
	bundleData, _, err := svc.ExportAllBackups(password)
	if err != nil {
		t.Fatalf("ExportAllBackups failed: %v", err)
	}

	if len(bundleData) == 0 {
		t.Fatal("bundle data should not be empty")
	}

	// Verify it can be decrypted
	decrypted, err := crypto.Decrypt(bundleData, password)
	if err != nil {
		t.Fatalf("failed to decrypt bundle: %v", err)
	}

	var bundle BundlePayload
	if err := json.Unmarshal(decrypted, &bundle); err != nil {
		t.Fatalf("failed to parse bundle: %v", err)
	}

	if bundle.Format != BundleFormat {
		t.Errorf("expected format %q, got %q", BundleFormat, bundle.Format)
	}
	if bundle.WalletCount != 3 {
		t.Errorf("expected 3 wallets, got %d", bundle.WalletCount)
	}
	if len(bundle.Wallets) != 3 {
		t.Errorf("expected 3 wallet payloads, got %d", len(bundle.Wallets))
	}
}

func TestExportAllBackups_EmptyStorage(t *testing.T) {
	tmpDir := t.TempDir()
	svc := NewBackupService(tmpDir)

	_, _, err := svc.ExportAllBackups("password123")
	if err == nil {
		t.Fatal("expected error for empty storage, got nil")
	}
}

func TestImportAllBackups_Success(t *testing.T) {
	tmpDir := t.TempDir()
	bundlePassword := "BundlePass123!"

	createTestWallet(t, tmpDir, "wallet-a", "Wallet A", "PassA123!", false)
	createTestWallet(t, tmpDir, "wallet-b", "Wallet B", "PassB123!", true)

	svc := NewBackupService(tmpDir)
	bundleData, _, err := svc.ExportAllBackups(bundlePassword)
	if err != nil {
		t.Fatalf("ExportAllBackups failed: %v", err)
	}

	// Import into a clean directory
	importDir := t.TempDir()
	importSvc := NewBackupService(importDir)

	wallets, err := importSvc.ImportAllBackups(bundleData, bundlePassword)
	if err != nil {
		t.Fatalf("ImportAllBackups failed: %v", err)
	}

	if len(wallets) != 2 {
		t.Fatalf("expected 2 wallets, got %d", len(wallets))
	}

	// Verify wallet names
	names := map[string]bool{}
	for _, w := range wallets {
		names[w.Name] = true
		// Verify files exist
		if _, err := os.Stat(filepath.Join(importDir, w.ID, "wallet.json")); err != nil {
			t.Errorf("wallet.json not found for %s: %v", w.Name, err)
		}
		if _, err := os.Stat(filepath.Join(importDir, w.ID, "mnemonic.enc")); err != nil {
			t.Errorf("mnemonic.enc not found for %s: %v", w.Name, err)
		}
	}
	if !names["Wallet A"] || !names["Wallet B"] {
		t.Errorf("expected wallet names [Wallet A, Wallet B], got %v", names)
	}
}

func TestImportAllBackups_WrongPassword(t *testing.T) {
	tmpDir := t.TempDir()
	bundlePassword := "BundlePass123!"

	createTestWallet(t, tmpDir, "wallet-a", "Wallet A", "PassA!", false)

	svc := NewBackupService(tmpDir)
	bundleData, _, err := svc.ExportAllBackups(bundlePassword)
	if err != nil {
		t.Fatalf("ExportAllBackups failed: %v", err)
	}

	importDir := t.TempDir()
	importSvc := NewBackupService(importDir)

	_, err = importSvc.ImportAllBackups(bundleData, "WrongPassword!")
	if err == nil {
		t.Fatal("expected error for wrong password, got nil")
	}
}

func TestImportAllBackups_InvalidData(t *testing.T) {
	importDir := t.TempDir()
	importSvc := NewBackupService(importDir)

	_, err := importSvc.ImportAllBackups([]byte("garbage data"), "password")
	if err == nil {
		t.Fatal("expected error for invalid data, got nil")
	}
}

func TestExportImport_RoundTrip_MnemonicIntegrity(t *testing.T) {
	tmpDir := t.TempDir()
	walletID := "test-wallet-007"
	password := "TestPass123!"

	createTestWallet(t, tmpDir, walletID, "Roundtrip Wallet", password, false)

	svc := NewBackupService(tmpDir)

	// Export
	backupData, _, err := svc.ExportBackup(walletID)
	if err != nil {
		t.Fatalf("ExportBackup failed: %v", err)
	}

	// Import
	importDir := t.TempDir()
	importSvc := NewBackupService(importDir)

	wallet, err := importSvc.ImportBackup(backupData, password, "")
	if err != nil {
		t.Fatalf("ImportBackup failed: %v", err)
	}

	// Verify the imported mnemonic can be decrypted with the same password
	mnemonicPath := filepath.Join(importDir, wallet.ID, "mnemonic.enc")
	mnemonicEncBytes, err := os.ReadFile(mnemonicPath)
	if err != nil {
		t.Fatalf("failed to read imported mnemonic.enc: %v", err)
	}

	encrypted, err := crypto.DeserializeEncryptedData(mnemonicEncBytes)
	if err != nil {
		t.Fatalf("failed to deserialize imported mnemonic: %v", err)
	}

	mnemonic, err := crypto.DecryptMnemonic(encrypted, password)
	if err != nil {
		t.Fatalf("failed to decrypt imported mnemonic: %v", err)
	}

	expectedMnemonic := "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"
	if mnemonic != expectedMnemonic {
		t.Errorf("mnemonic mismatch after round-trip")
	}
}
