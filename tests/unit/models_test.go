package unit

import (
	"testing"
	"time"

	"github.com/yourusername/arcsign/internal/models"
)

// T007: Test for Wallet model
func TestWalletModel(t *testing.T) {
	t.Run("creates wallet with all required fields", func(t *testing.T) {
		now := time.Now()
		wallet := models.Wallet{
			ID:                     "550e8400-e29b-41d4-a716-446655440000",
			Name:                   "My Test Wallet",
			CreatedAt:              now,
			LastAccessedAt:         now,
			EncryptedMnemonicPath:  "/media/usb/arcsign/wallets/test.wallet",
			UsesPassphrase:         false,
		}

		if wallet.ID != "550e8400-e29b-41d4-a716-446655440000" {
			t.Errorf("Expected ID to be set, got %s", wallet.ID)
		}
		if wallet.Name != "My Test Wallet" {
			t.Errorf("Expected Name to be 'My Test Wallet', got %s", wallet.Name)
		}
		if wallet.EncryptedMnemonicPath != "/media/usb/arcsign/wallets/test.wallet" {
			t.Errorf("Expected path to be set, got %s", wallet.EncryptedMnemonicPath)
		}
		if wallet.UsesPassphrase != false {
			t.Errorf("Expected UsesPassphrase to be false, got %v", wallet.UsesPassphrase)
		}
	})

	t.Run("validates wallet name length", func(t *testing.T) {
		longName := string(make([]byte, 65)) // 65 characters (max is 64)
		err := models.ValidateWalletName(longName)
		if err == nil {
			t.Error("Expected error for name longer than 64 characters")
		}
	})

	t.Run("accepts valid wallet name", func(t *testing.T) {
		validName := "My Valid Wallet Name"
		err := models.ValidateWalletName(validName)
		if err != nil {
			t.Errorf("Expected no error for valid name, got %v", err)
		}
	})
}

// T009: Test for EncryptedMnemonic model
func TestEncryptedMnemonicModel(t *testing.T) {
	t.Run("creates encrypted mnemonic with all fields", func(t *testing.T) {
		salt := make([]byte, 16)
		nonce := make([]byte, 12)
		ciphertext := make([]byte, 50)

		encrypted := models.EncryptedMnemonic{
			Salt:          salt,
			Nonce:         nonce,
			Ciphertext:    ciphertext,
			Argon2Time:    4,
			Argon2Memory:  262144, // 256 MiB in KiB
			Argon2Threads: 4,
			Version:       1,
		}

		if len(encrypted.Salt) != 16 {
			t.Errorf("Expected salt length 16, got %d", len(encrypted.Salt))
		}
		if len(encrypted.Nonce) != 12 {
			t.Errorf("Expected nonce length 12, got %d", len(encrypted.Nonce))
		}
		if encrypted.Argon2Time != 4 {
			t.Errorf("Expected Argon2Time 4, got %d", encrypted.Argon2Time)
		}
		if encrypted.Version != 1 {
			t.Errorf("Expected Version 1, got %d", encrypted.Version)
		}
	})

	t.Run("validates Argon2 parameters", func(t *testing.T) {
		tests := []struct {
			name    string
			time    uint32
			memory  uint32
			threads uint8
			wantErr bool
		}{
			{"valid parameters", 4, 262144, 4, false},
			{"time too low", 2, 262144, 4, true},
			{"time too high", 11, 262144, 4, true},
			{"memory too low", 4, 32768, 4, true},
			{"threads zero", 4, 262144, 0, true},
		}

		for _, tt := range tests {
			t.Run(tt.name, func(t *testing.T) {
				err := models.ValidateArgon2Params(tt.time, tt.memory, tt.threads)
				if (err != nil) != tt.wantErr {
					t.Errorf("ValidateArgon2Params() error = %v, wantErr %v", err, tt.wantErr)
				}
			})
		}
	})
}

// T011: Test for Account model
func TestAccountModel(t *testing.T) {
	t.Run("creates account with all required fields", func(t *testing.T) {
		now := time.Now()
		account := models.Account{
			WalletID:         "550e8400-e29b-41d4-a716-446655440000",
			AccountIndex:     0,
			CoinType:         0, // Bitcoin
			Name:             "Bitcoin Main",
			CreatedAt:        now,
			NextAddressIndex: 0,
			NextChangeIndex:  0,
		}

		if account.WalletID != "550e8400-e29b-41d4-a716-446655440000" {
			t.Errorf("Expected WalletID to be set, got %s", account.WalletID)
		}
		if account.CoinType != 0 {
			t.Errorf("Expected CoinType 0 (Bitcoin), got %d", account.CoinType)
		}
		if account.Name != "Bitcoin Main" {
			t.Errorf("Expected Name 'Bitcoin Main', got %s", account.Name)
		}
	})

	t.Run("validates account index", func(t *testing.T) {
		err := models.ValidateAccountIndex(101) // Max is 100
		if err == nil {
			t.Error("Expected error for account index > 100")
		}
	})

	t.Run("validates coin type", func(t *testing.T) {
		validCoinTypes := []uint32{0, 60, 2, 3, 501} // Bitcoin, Ethereum, Litecoin, Dogecoin, Solana
		for _, coinType := range validCoinTypes {
			err := models.ValidateCoinType(coinType)
			if err != nil {
				t.Errorf("Expected coin type %d to be valid, got error: %v", coinType, err)
			}
		}
	})
}

// T013: Test for Address model
func TestAddressModel(t *testing.T) {
	t.Run("creates address with all required fields", func(t *testing.T) {
		now := time.Now()
		address := models.Address{
			AccountID:      "550e8400-e29b-41d4-a716-446655440000_0_0",
			Change:         0, // External/receive
			AddressIndex:   0,
			DerivationPath: "m/44'/0'/0'/0/0",
			Address:        "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
			PublicKey:      "0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798",
			CreatedAt:      now,
			Label:          "First receive address",
		}

		if address.Change != 0 {
			t.Errorf("Expected Change 0, got %d", address.Change)
		}
		if address.DerivationPath != "m/44'/0'/0'/0/0" {
			t.Errorf("Expected derivation path, got %s", address.DerivationPath)
		}
		if len(address.PublicKey) != 66 { // Compressed public key hex
			t.Errorf("Expected public key length 66, got %d", len(address.PublicKey))
		}
	})

	t.Run("validates change value", func(t *testing.T) {
		if err := models.ValidateChange(0); err != nil {
			t.Errorf("Expected change 0 to be valid, got error: %v", err)
		}
		if err := models.ValidateChange(1); err != nil {
			t.Errorf("Expected change 1 to be valid, got error: %v", err)
		}
		if err := models.ValidateChange(2); err == nil {
			t.Error("Expected change 2 to be invalid")
		}
	})

	t.Run("validates address index", func(t *testing.T) {
		err := models.ValidateAddressIndex(1001) // Max is 1000
		if err == nil {
			t.Error("Expected error for address index > 1000")
		}
	})
}
