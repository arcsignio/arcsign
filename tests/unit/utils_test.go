package unit

import (
	"strings"
	"testing"

	"github.com/yourusername/arcsign/internal/utils"
)

// T032: Test for password validation
func TestValidatePassword(t *testing.T) {
	t.Run("accepts strong password", func(t *testing.T) {
		password := "MySecure@Pass123"
		err := utils.ValidatePassword(password)
		if err != nil {
			t.Errorf("Strong password rejected: %v", err)
		}
	})

	t.Run("rejects password shorter than 12 characters", func(t *testing.T) {
		password := "Short@1"
		err := utils.ValidatePassword(password)
		if err == nil {
			t.Error("Expected error for short password")
		}
		if !strings.Contains(err.Error(), "12 characters") {
			t.Errorf("Expected length error, got: %v", err)
		}
	})

	t.Run("accepts password without uppercase (has 3 other types)", func(t *testing.T) {
		// lowercase + numbers + special = 3 types
		password := "mysecure@pass123"
		err := utils.ValidatePassword(password)
		if err != nil {
			t.Errorf("Password with 3 complexity types should be accepted: %v", err)
		}
	})

	t.Run("accepts password without lowercase (has 3 other types)", func(t *testing.T) {
		// uppercase + numbers + special = 3 types
		password := "MYSECURE@PASS123"
		err := utils.ValidatePassword(password)
		if err != nil {
			t.Errorf("Password with 3 complexity types should be accepted: %v", err)
		}
	})

	t.Run("accepts password without numbers (has 3 other types)", func(t *testing.T) {
		// uppercase + lowercase + special = 3 types
		password := "MySecure@Password"
		err := utils.ValidatePassword(password)
		if err != nil {
			t.Errorf("Password with 3 complexity types should be accepted: %v", err)
		}
	})

	t.Run("accepts password without special characters (has 3 other types)", func(t *testing.T) {
		// uppercase + lowercase + numbers = 3 types
		password := "MySecurePass123"
		err := utils.ValidatePassword(password)
		if err != nil {
			t.Errorf("Password with 3 complexity types should be accepted: %v", err)
		}
	})

	t.Run("rejects password with only 2 complexity types", func(t *testing.T) {
		// Only lowercase + numbers (2 types)
		password := "mysecurepass123"
		err := utils.ValidatePassword(password)
		if err == nil {
			t.Error("Expected error for insufficient complexity")
		}
		if !strings.Contains(err.Error(), "3") {
			t.Errorf("Expected error mentioning 3 complexity types, got: %v", err)
		}
	})

	t.Run("rejects password with only 1 complexity type", func(t *testing.T) {
		// Only lowercase
		password := "mysecurepassword"
		err := utils.ValidatePassword(password)
		if err == nil {
			t.Error("Expected error for insufficient complexity")
		}
	})
}

// T033: Test for UUID generation
func TestGenerateSecureUUID(t *testing.T) {
	t.Run("generates valid UUID", func(t *testing.T) {
		uuid, err := utils.GenerateSecureUUID()
		if err != nil {
			t.Fatalf("UUID generation failed: %v", err)
		}

		// UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
		if len(uuid) != 36 {
			t.Errorf("Expected UUID length 36, got %d", len(uuid))
		}

		parts := strings.Split(uuid, "-")
		if len(parts) != 5 {
			t.Errorf("Expected 5 UUID parts, got %d", len(parts))
		}

		// Check version 4 marker
		if parts[2][0] != '4' {
			t.Errorf("Expected UUID v4, got version %c", parts[2][0])
		}
	})

	t.Run("generates unique UUIDs", func(t *testing.T) {
		uuid1, _ := utils.GenerateSecureUUID()
		uuid2, _ := utils.GenerateSecureUUID()

		if uuid1 == uuid2 {
			t.Error("Generated duplicate UUIDs")
		}
	})

	t.Run("generates 1000 unique UUIDs", func(t *testing.T) {
		seen := make(map[string]bool)

		for i := 0; i < 1000; i++ {
			uuid, err := utils.GenerateSecureUUID()
			if err != nil {
				t.Fatalf("UUID generation failed at iteration %d: %v", i, err)
			}

			if seen[uuid] {
				t.Fatalf("Duplicate UUID found: %s", uuid)
			}
			seen[uuid] = true
		}
	})
}

// T034-T036: Test for custom error types
func TestCustomErrors(t *testing.T) {
	t.Run("ErrUSBNotFound", func(t *testing.T) {
		err := utils.ErrUSBNotFound
		if err == nil {
			t.Error("ErrUSBNotFound should not be nil")
		}
		if !strings.Contains(err.Error(), "USB") {
			t.Errorf("Expected USB in error message, got: %v", err)
		}
	})

	t.Run("ErrUSBFull", func(t *testing.T) {
		err := utils.ErrUSBFull
		if err == nil {
			t.Error("ErrUSBFull should not be nil")
		}
		if !strings.Contains(err.Error(), "full") || !strings.Contains(err.Error(), "space") {
			t.Errorf("Expected 'full' or 'space' in error message, got: %v", err)
		}
	})

	t.Run("ErrWalletNotFound", func(t *testing.T) {
		err := utils.ErrWalletNotFound
		if err == nil {
			t.Error("ErrWalletNotFound should not be nil")
		}
		if !strings.Contains(err.Error(), "wallet") && !strings.Contains(err.Error(), "Wallet") {
			t.Errorf("Expected 'wallet' in error message, got: %v", err)
		}
	})

	t.Run("ErrInvalidPassword", func(t *testing.T) {
		err := utils.ErrInvalidPassword
		if err == nil {
			t.Error("ErrInvalidPassword should not be nil")
		}
		if !strings.Contains(err.Error(), "password") && !strings.Contains(err.Error(), "Password") {
			t.Errorf("Expected 'password' in error message, got: %v", err)
		}
	})

	t.Run("ErrDecryptionFailed", func(t *testing.T) {
		err := utils.ErrDecryptionFailed
		if err == nil {
			t.Error("ErrDecryptionFailed should not be nil")
		}
		if !strings.Contains(err.Error(), "decrypt") && !strings.Contains(err.Error(), "Decrypt") {
			t.Errorf("Expected 'decrypt' in error message, got: %v", err)
		}
	})

	t.Run("ErrInvalidMnemonic", func(t *testing.T) {
		err := utils.ErrInvalidMnemonic
		if err == nil {
			t.Error("ErrInvalidMnemonic should not be nil")
		}
		if !strings.Contains(err.Error(), "mnemonic") && !strings.Contains(err.Error(), "Mnemonic") {
			t.Errorf("Expected 'mnemonic' in error message, got: %v", err)
		}
	})

	t.Run("ErrRateLimitExceeded", func(t *testing.T) {
		err := utils.ErrRateLimitExceeded
		if err == nil {
			t.Error("ErrRateLimitExceeded should not be nil")
		}
		if !strings.Contains(err.Error(), "rate") || !strings.Contains(err.Error(), "limit") {
			t.Errorf("Expected 'rate limit' in error message, got: %v", err)
		}
	})

	t.Run("error types are distinct", func(t *testing.T) {
		errors := []error{
			utils.ErrUSBNotFound,
			utils.ErrUSBFull,
			utils.ErrWalletNotFound,
			utils.ErrInvalidPassword,
			utils.ErrDecryptionFailed,
			utils.ErrInvalidMnemonic,
			utils.ErrRateLimitExceeded,
		}

		// Verify all error messages are distinct
		seen := make(map[string]bool)
		for _, err := range errors {
			msg := err.Error()
			if seen[msg] {
				t.Errorf("Duplicate error message: %s", msg)
			}
			seen[msg] = true
		}
	})
}
