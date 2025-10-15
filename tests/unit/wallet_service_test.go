package unit

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/yourusername/arcsign/internal/services/wallet"
)

// T047: Test for CreateWallet() happy path
func TestCreateWallet(t *testing.T) {
	tempDir := t.TempDir()

	t.Run("creates wallet successfully with 12-word mnemonic", func(t *testing.T) {
		service := wallet.NewWalletService(tempDir)

		walletData, mnemonic, err := service.CreateWallet("My Test Wallet", "SecurePass@123", 12, false, "")
		if err != nil {
			t.Fatalf("CreateWallet failed: %v", err)
		}

		// Verify wallet metadata
		if walletData.ID == "" {
			t.Error("Wallet ID should not be empty")
		}
		if walletData.Name != "My Test Wallet" {
			t.Errorf("Expected name 'My Test Wallet', got '%s'", walletData.Name)
		}
		if walletData.UsesPassphrase {
			t.Error("UsesPassphrase should be false")
		}
		if walletData.CreatedAt.IsZero() {
			t.Error("CreatedAt should be set")
		}

		// Verify mnemonic
		words := strings.Fields(mnemonic)
		if len(words) != 12 {
			t.Errorf("Expected 12-word mnemonic, got %d words", len(words))
		}

		// Verify wallet files were created
		walletDir := filepath.Join(tempDir, walletData.ID)
		if _, err := os.Stat(walletDir); os.IsNotExist(err) {
			t.Error("Wallet directory was not created")
		}

		metadataPath := filepath.Join(walletDir, "wallet.json")
		if _, err := os.Stat(metadataPath); os.IsNotExist(err) {
			t.Error("Wallet metadata file was not created")
		}

		mnemonicPath := filepath.Join(walletDir, "mnemonic.enc")
		if _, err := os.Stat(mnemonicPath); os.IsNotExist(err) {
			t.Error("Encrypted mnemonic file was not created")
		}
	})

	t.Run("creates wallet successfully with 24-word mnemonic", func(t *testing.T) {
		service := wallet.NewWalletService(tempDir)

		_, mnemonic, err := service.CreateWallet("My Wallet 24", "SecurePass@123", 24, false, "")
		if err != nil {
			t.Fatalf("CreateWallet failed: %v", err)
		}

		words := strings.Fields(mnemonic)
		if len(words) != 24 {
			t.Errorf("Expected 24-word mnemonic, got %d words", len(words))
		}
	})

	t.Run("creates wallet with BIP39 passphrase", func(t *testing.T) {
		service := wallet.NewWalletService(tempDir)

		walletData, _, err := service.CreateWallet(
			"Passphrase Wallet",
			"SecurePass@123",
			12,
			true,
			"my-bip39-passphrase",
		)
		if err != nil {
			t.Fatalf("CreateWallet failed: %v", err)
		}

		if !walletData.UsesPassphrase {
			t.Error("UsesPassphrase should be true")
		}
	})

	t.Run("creates wallet without name", func(t *testing.T) {
		service := wallet.NewWalletService(tempDir)

		walletData, _, err := service.CreateWallet("", "SecurePass@123", 12, false, "")
		if err != nil {
			t.Fatalf("CreateWallet failed: %v", err)
		}

		if walletData.Name != "" {
			t.Errorf("Expected empty name, got '%s'", walletData.Name)
		}
	})
}

// T048: Test for password validation
func TestCreateWalletPasswordValidation(t *testing.T) {
	tempDir := t.TempDir()
	service := wallet.NewWalletService(tempDir)

	t.Run("rejects weak password", func(t *testing.T) {
		_, _, err := service.CreateWallet("Test", "weak", 12, false, "")
		if err == nil {
			t.Error("Expected error for weak password")
		}
		if !strings.Contains(err.Error(), "password") {
			t.Errorf("Expected password error, got: %v", err)
		}
	})

	t.Run("rejects password shorter than 12 characters", func(t *testing.T) {
		_, _, err := service.CreateWallet("Test", "Short@1", 12, false, "")
		if err == nil {
			t.Error("Expected error for short password")
		}
	})

	t.Run("accepts strong password", func(t *testing.T) {
		_, _, err := service.CreateWallet("Test", "VerySecure@Pass123", 12, false, "")
		if err != nil {
			t.Errorf("Strong password rejected: %v", err)
		}
	})
}

// T049: Test for wallet name validation
func TestCreateWalletNameValidation(t *testing.T) {
	tempDir := t.TempDir()
	service := wallet.NewWalletService(tempDir)

	t.Run("rejects name longer than 64 characters", func(t *testing.T) {
		longName := strings.Repeat("a", 65)
		_, _, err := service.CreateWallet(longName, "SecurePass@123", 12, false, "")
		if err == nil {
			t.Error("Expected error for long wallet name")
		}
		if !strings.Contains(err.Error(), "64") {
			t.Errorf("Expected error mentioning 64-character limit, got: %v", err)
		}
	})

	t.Run("accepts name with exactly 64 characters", func(t *testing.T) {
		name64 := strings.Repeat("a", 64)
		_, _, err := service.CreateWallet(name64, "SecurePass@123", 12, false, "")
		if err != nil {
			t.Errorf("64-character name rejected: %v", err)
		}
	})
}

// T050: Test for storage and encryption integration
func TestCreateWalletStorageEncryption(t *testing.T) {
	tempDir := t.TempDir()
	service := wallet.NewWalletService(tempDir)

	t.Run("mnemonic is encrypted and stored", func(t *testing.T) {
		walletData, mnemonic, err := service.CreateWallet("Storage Test", "SecurePass@123", 12, false, "")
		if err != nil {
			t.Fatalf("CreateWallet failed: %v", err)
		}

		// Read encrypted mnemonic file
		mnemonicPath := filepath.Join(tempDir, walletData.ID, "mnemonic.enc")
		encryptedData, err := os.ReadFile(mnemonicPath)
		if err != nil {
			t.Fatalf("Failed to read encrypted mnemonic: %v", err)
		}

		// Verify encrypted data doesn't contain plaintext mnemonic
		if strings.Contains(string(encryptedData), mnemonic) {
			t.Error("Encrypted file contains plaintext mnemonic!")
		}

		// Verify file is not empty
		if len(encryptedData) == 0 {
			t.Error("Encrypted mnemonic file is empty")
		}
	})

	t.Run("wallet metadata is stored as JSON", func(t *testing.T) {
		walletData, _, err := service.CreateWallet("Metadata Test", "SecurePass@123", 12, false, "")
		if err != nil {
			t.Fatalf("CreateWallet failed: %v", err)
		}

		// Read wallet metadata
		metadataPath := filepath.Join(tempDir, walletData.ID, "wallet.json")
		metadata, err := os.ReadFile(metadataPath)
		if err != nil {
			t.Fatalf("Failed to read metadata: %v", err)
		}

		// Verify it's valid JSON with expected fields
		metadataStr := string(metadata)
		if !strings.Contains(metadataStr, walletData.ID) {
			t.Error("Metadata doesn't contain wallet ID")
		}
		if !strings.Contains(metadataStr, "Metadata Test") {
			t.Error("Metadata doesn't contain wallet name")
		}
	})

	t.Run("audit log is created", func(t *testing.T) {
		walletData, _, err := service.CreateWallet("Audit Test", "SecurePass@123", 12, false, "")
		if err != nil {
			t.Fatalf("CreateWallet failed: %v", err)
		}

		// Wait briefly for async audit log write
		time.Sleep(50 * time.Millisecond)

		// Check audit log file exists
		auditPath := filepath.Join(tempDir, walletData.ID, "audit.log")
		if _, err := os.Stat(auditPath); os.IsNotExist(err) {
			t.Error("Audit log file was not created")
		}

		// Read audit log
		auditData, _ := os.ReadFile(auditPath)
		auditStr := string(auditData)

		// Verify audit entry contains expected operation
		if !strings.Contains(auditStr, "WALLET_CREATE") {
			t.Error("Audit log doesn't contain WALLET_CREATE operation")
		}
		if !strings.Contains(auditStr, "SUCCESS") {
			t.Error("Audit log doesn't contain SUCCESS status")
		}
	})

	t.Run("creates unique wallet IDs", func(t *testing.T) {
		wallet1, _, _ := service.CreateWallet("Wallet 1", "SecurePass@123", 12, false, "")
		wallet2, _, _ := service.CreateWallet("Wallet 2", "SecurePass@123", 12, false, "")

		if wallet1.ID == wallet2.ID {
			t.Error("Generated duplicate wallet IDs")
		}
	})
}
