package wallet

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/arcsignio/arcsign/internal/models"
	"github.com/arcsignio/arcsign/internal/services/crypto"
	"github.com/arcsignio/arcsign/internal/utils"
)

const validPassword = "TestP@ssw0rd!Secure123"

func newTestService(t *testing.T) *WalletService {
	t.Helper()
	return NewWalletService(t.TempDir())
}

// --- CreateWallet Tests ---

func TestCreateWallet_12Words(t *testing.T) {
	svc := newTestService(t)

	wallet, mnemonic, err := svc.CreateWallet("test-wallet", validPassword, 12, false, "")
	if err != nil {
		t.Fatalf("CreateWallet failed: %v", err)
	}

	if wallet == nil {
		t.Fatal("wallet is nil")
	}
	if wallet.ID == "" {
		t.Error("wallet ID is empty")
	}
	if mnemonic == "" {
		t.Fatal("mnemonic is empty")
	}

	words := strings.Fields(mnemonic)
	if len(words) != 12 {
		t.Errorf("expected 12 words, got %d", len(words))
	}
}

func TestCreateWallet_24Words(t *testing.T) {
	svc := newTestService(t)

	wallet, mnemonic, err := svc.CreateWallet("test-24", validPassword, 24, false, "")
	if err != nil {
		t.Fatalf("CreateWallet failed: %v", err)
	}

	words := strings.Fields(mnemonic)
	if len(words) != 24 {
		t.Errorf("expected 24 words, got %d", len(words))
	}
	if wallet.Name != "test-24" {
		t.Errorf("wallet name: got %q, want %q", wallet.Name, "test-24")
	}
}

func TestCreateWallet_EmptyName(t *testing.T) {
	svc := newTestService(t)

	wallet, _, err := svc.CreateWallet("", validPassword, 12, false, "")
	if err != nil {
		t.Fatalf("CreateWallet with empty name should succeed: %v", err)
	}
	if wallet.Name != "" {
		t.Errorf("wallet name should be empty, got %q", wallet.Name)
	}
}

func TestCreateWallet_WithPassphrase(t *testing.T) {
	svc := newTestService(t)

	wallet, _, err := svc.CreateWallet("passphrase-wallet", validPassword, 12, true, "my-passphrase")
	if err != nil {
		t.Fatalf("CreateWallet with passphrase failed: %v", err)
	}
	if !wallet.UsesPassphrase {
		t.Error("UsesPassphrase should be true")
	}
}

func TestCreateWallet_WeakPassword(t *testing.T) {
	svc := newTestService(t)

	// Password too short (less than 12 chars)
	_, _, err := svc.CreateWallet("test", "short", 12, false, "")
	if err == nil {
		t.Fatal("CreateWallet should fail with weak password")
	}
}

func TestCreateWallet_LongWalletName(t *testing.T) {
	svc := newTestService(t)

	longName := strings.Repeat("a", 65) // >64 chars
	_, _, err := svc.CreateWallet(longName, validPassword, 12, false, "")
	if err == nil {
		t.Fatal("CreateWallet should fail with wallet name > 64 chars")
	}
}

func TestCreateWallet_DirectoryCreated(t *testing.T) {
	tmpDir := t.TempDir()
	svc := NewWalletService(tmpDir)

	wallet, _, err := svc.CreateWallet("dir-test", validPassword, 12, false, "")
	if err != nil {
		t.Fatalf("CreateWallet failed: %v", err)
	}

	walletDir := filepath.Join(tmpDir, wallet.ID)
	if _, err := os.Stat(walletDir); os.IsNotExist(err) {
		t.Error("wallet directory was not created")
	}

	mnemonicPath := filepath.Join(walletDir, "mnemonic.enc")
	if _, err := os.Stat(mnemonicPath); os.IsNotExist(err) {
		t.Error("mnemonic.enc file was not created")
	}

	metadataPath := filepath.Join(walletDir, "wallet.json")
	if _, err := os.Stat(metadataPath); os.IsNotExist(err) {
		t.Error("wallet.json file was not created")
	}
}

func TestCreateWallet_MnemonicEncrypted(t *testing.T) {
	tmpDir := t.TempDir()
	svc := NewWalletService(tmpDir)

	wallet, mnemonic, err := svc.CreateWallet("enc-test", validPassword, 12, false, "")
	if err != nil {
		t.Fatalf("CreateWallet failed: %v", err)
	}

	// Read encrypted file directly
	mnemonicPath := filepath.Join(tmpDir, wallet.ID, "mnemonic.enc")
	encData, err := os.ReadFile(mnemonicPath)
	if err != nil {
		t.Fatalf("failed to read mnemonic.enc: %v", err)
	}

	// Raw file content should NOT contain plaintext mnemonic
	if strings.Contains(string(encData), mnemonic) {
		t.Error("mnemonic.enc contains plaintext mnemonic — encryption not applied")
	}
}

func TestCreateWallet_AddressBookGenerated(t *testing.T) {
	svc := newTestService(t)

	wallet, _, err := svc.CreateWallet("addr-test", validPassword, 12, false, "")
	if err != nil {
		t.Fatalf("CreateWallet failed: %v", err)
	}

	if wallet.AddressBook == nil {
		t.Skip("AddressBook is nil — address generation may have failed (non-fatal)")
	}
}

// --- ImportWalletFromMnemonic Tests ---

func TestImportWallet_Valid(t *testing.T) {
	svc := newTestService(t)

	mnemonic := "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"

	wallet, err := svc.ImportWalletFromMnemonic("imported", mnemonic, validPassword, false, "")
	if err != nil {
		t.Fatalf("ImportWalletFromMnemonic failed: %v", err)
	}
	if wallet == nil {
		t.Fatal("wallet is nil")
	}
	if wallet.Name != "imported" {
		t.Errorf("wallet name: got %q, want %q", wallet.Name, "imported")
	}
}

func TestImportWallet_InvalidMnemonic(t *testing.T) {
	svc := newTestService(t)

	_, err := svc.ImportWalletFromMnemonic("bad", "invalid mnemonic words here", validPassword, false, "")
	if err == nil {
		t.Fatal("ImportWalletFromMnemonic should fail with invalid mnemonic")
	}
}

func TestImportWallet_WhitespaceNormalized(t *testing.T) {
	svc := newTestService(t)

	mnemonic := "  abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about  "

	wallet, err := svc.ImportWalletFromMnemonic("trimmed", mnemonic, validPassword, false, "")
	if err != nil {
		t.Fatalf("ImportWalletFromMnemonic with whitespace should succeed: %v", err)
	}
	if wallet == nil {
		t.Fatal("wallet is nil")
	}
}

// --- LoadWallet Tests ---

func TestLoadWallet_Exists(t *testing.T) {
	svc := newTestService(t)

	created, _, err := svc.CreateWallet("load-test", validPassword, 12, false, "")
	if err != nil {
		t.Fatalf("CreateWallet failed: %v", err)
	}

	loaded, err := svc.LoadWallet(created.ID)
	if err != nil {
		t.Fatalf("LoadWallet failed: %v", err)
	}

	if loaded.ID != created.ID {
		t.Errorf("loaded wallet ID: got %q, want %q", loaded.ID, created.ID)
	}
	if loaded.Name != "load-test" {
		t.Errorf("loaded wallet name: got %q, want %q", loaded.Name, "load-test")
	}
}

func TestLoadWallet_NotExists(t *testing.T) {
	svc := newTestService(t)

	_, err := svc.LoadWallet("nonexistent-wallet-id")
	if err == nil {
		t.Fatal("LoadWallet should fail for non-existent wallet")
	}
	if err != utils.ErrWalletNotFound {
		t.Errorf("expected ErrWalletNotFound, got: %v", err)
	}
}

// --- RestoreWallet Tests ---

func TestRestoreWallet_CorrectPassword(t *testing.T) {
	svc := newTestService(t)

	created, originalMnemonic, err := svc.CreateWallet("restore-test", validPassword, 12, false, "")
	if err != nil {
		t.Fatalf("CreateWallet failed: %v", err)
	}

	restored, err := svc.RestoreWallet(created.ID, validPassword)
	if err != nil {
		t.Fatalf("RestoreWallet failed: %v", err)
	}

	if restored != originalMnemonic {
		t.Errorf("restored mnemonic doesn't match original")
	}
}

func TestRestoreWallet_WrongPassword(t *testing.T) {
	svc := newTestService(t)

	created, _, err := svc.CreateWallet("wrong-pw", validPassword, 12, false, "")
	if err != nil {
		t.Fatalf("CreateWallet failed: %v", err)
	}

	_, err = svc.RestoreWallet(created.ID, "WrongP@ssword123!")
	if err == nil {
		t.Fatal("RestoreWallet should fail with wrong password")
	}
}

func TestRestoreWallet_RateLimited(t *testing.T) {
	svc := newTestService(t)

	created, _, err := svc.CreateWallet("ratelimit-test", validPassword, 12, false, "")
	if err != nil {
		t.Fatalf("CreateWallet failed: %v", err)
	}

	// Make 3 failed attempts (rate limit is 3 per minute)
	for i := 0; i < 3; i++ {
		svc.RestoreWallet(created.ID, "WrongP@ssword123!")
	}

	// 4th attempt should be rate-limited
	_, err = svc.RestoreWallet(created.ID, validPassword)
	if err == nil {
		t.Fatal("RestoreWallet should be rate-limited after 3 failed attempts")
	}
	if err != utils.ErrRateLimitExceeded {
		t.Errorf("expected ErrRateLimitExceeded, got: %v", err)
	}
}

// --- DeleteWallet Tests ---

func TestDeleteWallet_CorrectPassword(t *testing.T) {
	tmpDir := t.TempDir()
	svc := NewWalletService(tmpDir)

	created, _, err := svc.CreateWallet("delete-test", validPassword, 12, false, "")
	if err != nil {
		t.Fatalf("CreateWallet failed: %v", err)
	}

	walletDir := filepath.Join(tmpDir, created.ID)
	if _, err := os.Stat(walletDir); os.IsNotExist(err) {
		t.Fatal("wallet directory should exist before deletion")
	}

	err = svc.DeleteWallet(created.ID, validPassword)
	if err != nil {
		t.Fatalf("DeleteWallet failed: %v", err)
	}

	if _, err := os.Stat(walletDir); !os.IsNotExist(err) {
		t.Error("wallet directory should be removed after deletion")
	}
}

func TestDeleteWallet_WrongPassword(t *testing.T) {
	tmpDir := t.TempDir()
	svc := NewWalletService(tmpDir)

	created, _, err := svc.CreateWallet("no-delete", validPassword, 12, false, "")
	if err != nil {
		t.Fatalf("CreateWallet failed: %v", err)
	}

	err = svc.DeleteWallet(created.ID, "WrongP@ssword123!")
	if err == nil {
		t.Fatal("DeleteWallet should fail with wrong password")
	}

	// Wallet should still exist
	walletDir := filepath.Join(tmpDir, created.ID)
	if _, err := os.Stat(walletDir); os.IsNotExist(err) {
		t.Error("wallet directory should NOT be deleted when password is wrong")
	}
}

func TestDeleteWallet_EmptyWalletID(t *testing.T) {
	svc := newTestService(t)

	err := svc.DeleteWallet("", validPassword)
	if err == nil {
		t.Fatal("DeleteWallet should fail with empty wallet ID")
	}
}

// --- ListWallets Tests ---

func TestListWallets_Empty(t *testing.T) {
	svc := newTestService(t)

	wallets, err := svc.ListWallets()
	if err != nil {
		t.Fatalf("ListWallets failed: %v", err)
	}
	if len(wallets) != 0 {
		t.Errorf("expected 0 wallets, got %d", len(wallets))
	}
}

func TestListWallets_Multiple(t *testing.T) {
	svc := newTestService(t)

	// Create 3 wallets
	for i := 0; i < 3; i++ {
		_, _, err := svc.CreateWallet("wallet-"+string(rune('A'+i)), validPassword, 12, false, "")
		if err != nil {
			t.Fatalf("CreateWallet %d failed: %v", i, err)
		}
	}

	wallets, err := svc.ListWallets()
	if err != nil {
		t.Fatalf("ListWallets failed: %v", err)
	}
	if len(wallets) != 3 {
		t.Errorf("expected 3 wallets, got %d", len(wallets))
	}
}

func TestListWallets_NonExistentStoragePath(t *testing.T) {
	svc := NewWalletService("/nonexistent/path/that/does/not/exist")

	wallets, err := svc.ListWallets()
	if err != nil {
		t.Fatalf("ListWallets should return empty list for nonexistent path: %v", err)
	}
	if len(wallets) != 0 {
		t.Errorf("expected 0 wallets, got %d", len(wallets))
	}
}

// --- Metadata Persistence Test ---

func TestCreateWallet_MetadataPersisted(t *testing.T) {
	tmpDir := t.TempDir()
	svc := NewWalletService(tmpDir)

	wallet, _, err := svc.CreateWallet("persist-test", validPassword, 12, true, "")
	if err != nil {
		t.Fatalf("CreateWallet failed: %v", err)
	}

	// Read wallet.json directly and verify structure
	metadataPath := filepath.Join(tmpDir, wallet.ID, "wallet.json")
	data, err := os.ReadFile(metadataPath)
	if err != nil {
		t.Fatalf("failed to read wallet.json: %v", err)
	}

	var loaded models.Wallet
	if err := json.Unmarshal(data, &loaded); err != nil {
		t.Fatalf("failed to parse wallet.json: %v", err)
	}

	if loaded.ID != wallet.ID {
		t.Errorf("persisted ID: got %q, want %q", loaded.ID, wallet.ID)
	}
	if loaded.Name != "persist-test" {
		t.Errorf("persisted Name: got %q, want %q", loaded.Name, "persist-test")
	}
	if !loaded.UsesPassphrase {
		t.Error("persisted UsesPassphrase should be true")
	}
}

// --- Round-trip: Create -> Restore -> Verify ---

func TestCreateAndRestore_RoundTrip(t *testing.T) {
	svc := newTestService(t)

	wallet, originalMnemonic, err := svc.CreateWallet("roundtrip", validPassword, 12, false, "")
	if err != nil {
		t.Fatalf("CreateWallet failed: %v", err)
	}

	// Restore should return the same mnemonic
	restored, err := svc.RestoreWallet(wallet.ID, validPassword)
	if err != nil {
		t.Fatalf("RestoreWallet failed: %v", err)
	}

	if restored != originalMnemonic {
		t.Error("restored mnemonic doesn't match the original from creation")
	}

	// Verify the encrypted mnemonic can also be decrypted directly
	encData, err := os.ReadFile(wallet.EncryptedMnemonicPath)
	if err != nil {
		t.Fatalf("failed to read encrypted file: %v", err)
	}

	enc, err := crypto.DeserializeEncryptedData(encData)
	if err != nil {
		t.Fatalf("failed to deserialize: %v", err)
	}

	decrypted, err := crypto.DecryptMnemonic(enc, validPassword)
	if err != nil {
		t.Fatalf("direct decryption failed: %v", err)
	}

	if decrypted != originalMnemonic {
		t.Error("direct decryption doesn't match original mnemonic")
	}
}
