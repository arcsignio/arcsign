package unit

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/yourusername/arcsign/internal/services/wallet"
)

// T062: Test for LoadWallet() - load metadata from disk
func TestLoadWallet(t *testing.T) {
	tempDir := t.TempDir()
	service := wallet.NewWalletService(tempDir)

	// Create a wallet first
	walletData, _, err := service.CreateWallet("Test Wallet", "SecurePass@123", 12, false, "")
	if err != nil {
		t.Fatalf("Failed to create wallet: %v", err)
	}

	t.Run("loads wallet metadata successfully", func(t *testing.T) {
		loaded, err := service.LoadWallet(walletData.ID)
		if err != nil {
			t.Fatalf("LoadWallet failed: %v", err)
		}

		if loaded.ID != walletData.ID {
			t.Errorf("Expected ID %s, got %s", walletData.ID, loaded.ID)
		}
		if loaded.Name != "Test Wallet" {
			t.Errorf("Expected name 'Test Wallet', got '%s'", loaded.Name)
		}
		if loaded.UsesPassphrase {
			t.Error("UsesPassphrase should be false")
		}
	})

	t.Run("fails with non-existent wallet ID", func(t *testing.T) {
		_, err := service.LoadWallet("non-existent-id")
		if err == nil {
			t.Error("Expected error for non-existent wallet")
		}
	})
}

// T063: Test for RestoreWallet() - decrypt mnemonic with password
func TestRestoreWallet(t *testing.T) {
	tempDir := t.TempDir()
	service := wallet.NewWalletService(tempDir)

	// Create a wallet first
	walletData, originalMnemonic, err := service.CreateWallet("Restore Test", "SecurePass@123", 12, false, "")
	if err != nil {
		t.Fatalf("Failed to create wallet: %v", err)
	}

	t.Run("restores wallet with correct password", func(t *testing.T) {
		mnemonic, err := service.RestoreWallet(walletData.ID, "SecurePass@123")
		if err != nil {
			t.Fatalf("RestoreWallet failed: %v", err)
		}

		if mnemonic != originalMnemonic {
			t.Error("Restored mnemonic doesn't match original")
		}

		// Verify it's valid BIP39
		words := strings.Fields(mnemonic)
		if len(words) != 12 {
			t.Errorf("Expected 12 words, got %d", len(words))
		}
	})

	t.Run("fails with wrong password", func(t *testing.T) {
		_, err := service.RestoreWallet(walletData.ID, "WrongPassword@123")
		if err == nil {
			t.Error("Expected error for wrong password")
		}
		if !strings.Contains(err.Error(), "decrypt") {
			t.Errorf("Expected decryption error, got: %v", err)
		}
	})

	t.Run("fails with non-existent wallet", func(t *testing.T) {
		_, err := service.RestoreWallet("non-existent-id", "SecurePass@123")
		if err == nil {
			t.Error("Expected error for non-existent wallet")
		}
	})
}

// T064: Test for RestoreWallet() with BIP39 passphrase
func TestRestoreWalletWithPassphrase(t *testing.T) {
	tempDir := t.TempDir()
	service := wallet.NewWalletService(tempDir)

	// Create wallet with BIP39 passphrase
	walletData, originalMnemonic, err := service.CreateWallet(
		"Passphrase Wallet",
		"SecurePass@123",
		12,
		true,
		"my-bip39-passphrase",
	)
	if err != nil {
		t.Fatalf("Failed to create wallet: %v", err)
	}

	t.Run("restores wallet with passphrase", func(t *testing.T) {
		mnemonic, err := service.RestoreWallet(walletData.ID, "SecurePass@123")
		if err != nil {
			t.Fatalf("RestoreWallet failed: %v", err)
		}

		if mnemonic != originalMnemonic {
			t.Error("Restored mnemonic doesn't match original")
		}

		// Load metadata to verify passphrase flag
		loaded, _ := service.LoadWallet(walletData.ID)
		if !loaded.UsesPassphrase {
			t.Error("UsesPassphrase flag should be true")
		}
	})
}

// T065: Test for rate limiting on restore attempts
func TestRestoreWalletRateLimiting(t *testing.T) {
	tempDir := t.TempDir()
	service := wallet.NewWalletService(tempDir)

	// Create wallet
	walletData, _, err := service.CreateWallet("Rate Limit Test", "SecurePass@123", 12, false, "")
	if err != nil {
		t.Fatalf("Failed to create wallet: %v", err)
	}

	t.Run("blocks excessive failed attempts", func(t *testing.T) {
		// Try wrong password 3 times (should all be allowed but fail)
		for i := 0; i < 3; i++ {
			_, err := service.RestoreWallet(walletData.ID, "WrongPass@123")
			if err == nil {
				t.Error("Expected decryption error")
			}
		}

		// 4th attempt should be rate limited
		_, err := service.RestoreWallet(walletData.ID, "WrongPass@123")
		if err == nil {
			t.Error("Expected rate limit error")
		}
		if !strings.Contains(err.Error(), "rate limit") {
			t.Errorf("Expected rate limit error, got: %v", err)
		}
	})

	t.Run("resets rate limit on successful restore", func(t *testing.T) {
		// Create new wallet with fresh rate limit
		walletData2, _, _ := service.CreateWallet("Reset Test", "SecurePass@123", 12, false, "")

		// Make 2 failed attempts
		service.RestoreWallet(walletData2.ID, "Wrong@123")
		service.RestoreWallet(walletData2.ID, "Wrong@123")

		// Successful attempt should reset counter
		_, err := service.RestoreWallet(walletData2.ID, "SecurePass@123")
		if err != nil {
			t.Fatalf("Successful restore failed: %v", err)
		}

		// After successful auth, counter is reset - we can make 3 new failed attempts
		service.RestoreWallet(walletData2.ID, "Wrong@123")
		service.RestoreWallet(walletData2.ID, "Wrong@123")
		service.RestoreWallet(walletData2.ID, "Wrong@123")

		// Fourth attempt should be rate limited
		_, err = service.RestoreWallet(walletData2.ID, "Wrong@123")
		if err == nil || !strings.Contains(err.Error(), "rate limit") {
			t.Error("Expected rate limit after 3 failed attempts")
		}
	})
}

// T066: Test for audit logging on restore
func TestRestoreWalletAuditLog(t *testing.T) {
	tempDir := t.TempDir()
	service := wallet.NewWalletService(tempDir)

	walletData, _, err := service.CreateWallet("Audit Test", "SecurePass@123", 12, false, "")
	if err != nil {
		t.Fatalf("Failed to create wallet: %v", err)
	}

	t.Run("logs successful restore", func(t *testing.T) {
		_, err := service.RestoreWallet(walletData.ID, "SecurePass@123")
		if err != nil {
			t.Fatalf("RestoreWallet failed: %v", err)
		}

		// Check audit log
		auditPath := filepath.Join(tempDir, walletData.ID, "audit.log")
		content, err := os.ReadFile(auditPath)
		if err != nil {
			t.Fatalf("Failed to read audit log: %v", err)
		}

		auditStr := string(content)
		if !strings.Contains(auditStr, "WALLET_ACCESS") {
			t.Error("Audit log should contain WALLET_ACCESS operation")
		}
		if !strings.Contains(auditStr, "SUCCESS") {
			t.Error("Audit log should contain SUCCESS status")
		}
	})

	t.Run("logs failed restore attempt", func(t *testing.T) {
		service.RestoreWallet(walletData.ID, "WrongPass@123")

		// Check audit log
		auditPath := filepath.Join(tempDir, walletData.ID, "audit.log")
		content, _ := os.ReadFile(auditPath)
		auditStr := string(content)

		if !strings.Contains(auditStr, "FAILURE") {
			t.Error("Audit log should contain FAILURE status")
		}
		if !strings.Contains(auditStr, "wrong_password") {
			t.Error("Audit log should contain 'wrong_password' failure reason")
		}
	})
}

// Integration test
func TestWalletRestoreIntegration(t *testing.T) {
	tempDir := t.TempDir()
	service := wallet.NewWalletService(tempDir)

	t.Run("full create and restore workflow", func(t *testing.T) {
		// Create wallet
		walletData, originalMnemonic, err := service.CreateWallet(
			"Integration Test",
			"VerySecure@Pass123",
			24, // 24-word mnemonic
			true,
			"optional-passphrase",
		)
		if err != nil {
			t.Fatalf("Create failed: %v", err)
		}

		// Load wallet metadata
		loaded, err := service.LoadWallet(walletData.ID)
		if err != nil {
			t.Fatalf("Load failed: %v", err)
		}
		if loaded.Name != "Integration Test" {
			t.Error("Wallet name not persisted correctly")
		}

		// Restore wallet
		restoredMnemonic, err := service.RestoreWallet(walletData.ID, "VerySecure@Pass123")
		if err != nil {
			t.Fatalf("Restore failed: %v", err)
		}

		// Verify mnemonic matches
		if restoredMnemonic != originalMnemonic {
			t.Error("Restored mnemonic doesn't match original")
		}

		// Verify 24 words
		words := strings.Fields(restoredMnemonic)
		if len(words) != 24 {
			t.Errorf("Expected 24 words, got %d", len(words))
		}
	})
}
