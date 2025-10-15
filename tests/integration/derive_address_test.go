package integration

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/yourusername/arcsign/internal/services/address"
	"github.com/yourusername/arcsign/internal/services/bip39service"
	"github.com/yourusername/arcsign/internal/services/hdkey"
	"github.com/yourusername/arcsign/internal/services/wallet"
)

// T093-T097: Integration test for derive address workflow
func TestDeriveAddressIntegration(t *testing.T) {
	// Create temporary storage
	tempDir := t.TempDir()

	t.Run("derives Bitcoin address from wallet", func(t *testing.T) {
		// Step 1: Create a wallet
		walletService := wallet.NewWalletService(tempDir)
		walletData, mnemonic, err := walletService.CreateWallet("Test Wallet", "Test@Password123", 12, false, "")
		if err != nil {
			t.Fatalf("Failed to create wallet: %v", err)
		}

		// Step 2: Restore wallet to get mnemonic
		restoredMnemonic, err := walletService.RestoreWallet(walletData.ID, "Test@Password123")
		if err != nil {
			t.Fatalf("Failed to restore wallet: %v", err)
		}

		if restoredMnemonic != mnemonic {
			t.Error("Restored mnemonic doesn't match original")
		}

		// Step 3: Generate BIP39 seed
		bip39Service := bip39service.NewBIP39Service()
		seed, err := bip39Service.MnemonicToSeed(restoredMnemonic, "")
		if err != nil {
			t.Fatalf("Failed to generate seed: %v", err)
		}

		// Step 4: Create master key
		hdkeyService := hdkey.NewHDKeyService()
		masterKey, err := hdkeyService.NewMasterKey(seed)
		if err != nil {
			t.Fatalf("Failed to create master key: %v", err)
		}

		// Step 5: Derive Bitcoin address at m/44'/0'/0'/0/0
		path := "m/44'/0'/0'/0/0"
		derivedKey, err := hdkeyService.DerivePath(masterKey, path)
		if err != nil {
			t.Fatalf("Failed to derive path: %v", err)
		}

		// Step 6: Generate Bitcoin address
		addressService := address.NewAddressService()
		bitcoinAddress, err := addressService.DeriveBitcoinAddress(derivedKey)
		if err != nil {
			t.Fatalf("Failed to generate Bitcoin address: %v", err)
		}

		// Verify address format
		if bitcoinAddress == "" {
			t.Error("Bitcoin address should not be empty")
		}

		// Bitcoin P2PKH addresses start with 1, P2SH with 3, or bech32 with bc1
		if !strings.HasPrefix(bitcoinAddress, "1") &&
			!strings.HasPrefix(bitcoinAddress, "3") &&
			!strings.HasPrefix(bitcoinAddress, "bc1") {
			t.Errorf("Invalid Bitcoin address format: %s", bitcoinAddress)
		}

		t.Logf("✓ Bitcoin address: %s", bitcoinAddress)
		t.Logf("✓ Derivation path: %s", path)
	})

	t.Run("derives Ethereum address from wallet", func(t *testing.T) {
		// Step 1: Create a wallet
		walletService := wallet.NewWalletService(tempDir)
		walletData, mnemonic, err := walletService.CreateWallet("ETH Wallet", "Ethereum@123", 12, false, "")
		if err != nil {
			t.Fatalf("Failed to create wallet: %v", err)
		}

		// Step 2: Restore wallet
		restoredMnemonic, err := walletService.RestoreWallet(walletData.ID, "Ethereum@123")
		if err != nil {
			t.Fatalf("Failed to restore wallet: %v", err)
		}

		if restoredMnemonic != mnemonic {
			t.Error("Restored mnemonic doesn't match original")
		}

		// Step 3: Generate BIP39 seed
		bip39Service := bip39service.NewBIP39Service()
		seed, err := bip39Service.MnemonicToSeed(restoredMnemonic, "")
		if err != nil {
			t.Fatalf("Failed to generate seed: %v", err)
		}

		// Step 4: Create master key
		hdkeyService := hdkey.NewHDKeyService()
		masterKey, err := hdkeyService.NewMasterKey(seed)
		if err != nil {
			t.Fatalf("Failed to create master key: %v", err)
		}

		// Step 5: Derive Ethereum address at m/44'/60'/0'/0/0
		path := "m/44'/60'/0'/0/0"
		derivedKey, err := hdkeyService.DerivePath(masterKey, path)
		if err != nil {
			t.Fatalf("Failed to derive path: %v", err)
		}

		// Step 6: Generate Ethereum address
		addressService := address.NewAddressService()
		ethAddress, err := addressService.DeriveEthereumAddress(derivedKey)
		if err != nil {
			t.Fatalf("Failed to generate Ethereum address: %v", err)
		}

		// Verify address format
		if ethAddress == "" {
			t.Error("Ethereum address should not be empty")
		}

		// Ethereum addresses start with 0x and are 42 characters long
		if !strings.HasPrefix(ethAddress, "0x") {
			t.Errorf("Ethereum address should start with 0x: %s", ethAddress)
		}

		if len(ethAddress) != 42 {
			t.Errorf("Ethereum address should be 42 characters, got %d: %s", len(ethAddress), ethAddress)
		}

		t.Logf("✓ Ethereum address: %s", ethAddress)
		t.Logf("✓ Derivation path: %s", path)
	})

	t.Run("derives multiple addresses from same wallet", func(t *testing.T) {
		// Create wallet
		walletService := wallet.NewWalletService(tempDir)
		_, mnemonic, err := walletService.CreateWallet("Multi Address", "Multi@Pass123", 12, false, "")
		if err != nil {
			t.Fatalf("Failed to create wallet: %v", err)
		}

		// Generate seed
		bip39Service := bip39service.NewBIP39Service()
		seed, err := bip39Service.MnemonicToSeed(mnemonic, "")
		if err != nil {
			t.Fatalf("Failed to generate seed: %v", err)
		}

		// Create master key
		hdkeyService := hdkey.NewHDKeyService()
		masterKey, err := hdkeyService.NewMasterKey(seed)
		if err != nil {
			t.Fatalf("Failed to create master key: %v", err)
		}

		addressService := address.NewAddressService()

		// Derive 5 Bitcoin addresses
		bitcoinAddresses := make([]string, 5)
		for i := 0; i < 5; i++ {
			path := "m/44'/0'/0'/0/" + string(rune('0'+i))
			derivedKey, err := hdkeyService.DerivePath(masterKey, path)
			if err != nil {
				t.Fatalf("Failed to derive Bitcoin path %d: %v", i, err)
			}

			bitcoinAddresses[i], err = addressService.DeriveBitcoinAddress(derivedKey)
			if err != nil {
				t.Fatalf("Failed to generate Bitcoin address %d: %v", i, err)
			}

			t.Logf("✓ Bitcoin address %d: %s", i, bitcoinAddresses[i])
		}

		// Verify all addresses are unique
		for i := 0; i < len(bitcoinAddresses); i++ {
			for j := i + 1; j < len(bitcoinAddresses); j++ {
				if bitcoinAddresses[i] == bitcoinAddresses[j] {
					t.Errorf("Bitcoin address %d and %d are identical", i, j)
				}
			}
		}

		// Derive 5 Ethereum addresses
		ethAddresses := make([]string, 5)
		for i := 0; i < 5; i++ {
			path := "m/44'/60'/0'/0/" + string(rune('0'+i))
			derivedKey, err := hdkeyService.DerivePath(masterKey, path)
			if err != nil {
				t.Fatalf("Failed to derive Ethereum path %d: %v", i, err)
			}

			ethAddresses[i], err = addressService.DeriveEthereumAddress(derivedKey)
			if err != nil {
				t.Fatalf("Failed to generate Ethereum address %d: %v", i, err)
			}

			t.Logf("✓ Ethereum address %d: %s", i, ethAddresses[i])
		}

		// Verify all Ethereum addresses are unique
		for i := 0; i < len(ethAddresses); i++ {
			for j := i + 1; j < len(ethAddresses); j++ {
				if ethAddresses[i] == ethAddresses[j] {
					t.Errorf("Ethereum address %d and %d are identical", i, j)
				}
			}
		}
	})

	t.Run("derives addresses with BIP39 passphrase", func(t *testing.T) {
		// Create wallet with BIP39 passphrase
		walletService := wallet.NewWalletService(tempDir)
		bip39Passphrase := "super-secret-passphrase"
		_, mnemonic, err := walletService.CreateWallet("Passphrase Wallet", "Pass@word123", 24, true, bip39Passphrase)
		if err != nil {
			t.Fatalf("Failed to create wallet: %v", err)
		}

		// Generate seed WITH passphrase
		bip39Service := bip39service.NewBIP39Service()
		seedWithPassphrase, err := bip39Service.MnemonicToSeed(mnemonic, bip39Passphrase)
		if err != nil {
			t.Fatalf("Failed to generate seed with passphrase: %v", err)
		}

		// Generate seed WITHOUT passphrase
		seedWithoutPassphrase, err := bip39Service.MnemonicToSeed(mnemonic, "")
		if err != nil {
			t.Fatalf("Failed to generate seed without passphrase: %v", err)
		}

		// Seeds should be different
		if string(seedWithPassphrase) == string(seedWithoutPassphrase) {
			t.Error("Seeds with and without passphrase should be different")
		}

		// Derive address with passphrase
		hdkeyService := hdkey.NewHDKeyService()
		masterKeyWithPassphrase, err := hdkeyService.NewMasterKey(seedWithPassphrase)
		if err != nil {
			t.Fatalf("Failed to create master key: %v", err)
		}

		derivedKey, err := hdkeyService.DerivePath(masterKeyWithPassphrase, "m/44'/0'/0'/0/0")
		if err != nil {
			t.Fatalf("Failed to derive path: %v", err)
		}

		addressService := address.NewAddressService()
		addressWithPassphrase, err := addressService.DeriveBitcoinAddress(derivedKey)
		if err != nil {
			t.Fatalf("Failed to generate address: %v", err)
		}

		// Derive address without passphrase
		masterKeyWithoutPassphrase, err := hdkeyService.NewMasterKey(seedWithoutPassphrase)
		if err != nil {
			t.Fatalf("Failed to create master key: %v", err)
		}

		derivedKey2, err := hdkeyService.DerivePath(masterKeyWithoutPassphrase, "m/44'/0'/0'/0/0")
		if err != nil {
			t.Fatalf("Failed to derive path: %v", err)
		}

		addressWithoutPassphrase, err := addressService.DeriveBitcoinAddress(derivedKey2)
		if err != nil {
			t.Fatalf("Failed to generate address: %v", err)
		}

		// Addresses should be different
		if addressWithPassphrase == addressWithoutPassphrase {
			t.Error("Addresses with and without passphrase should be different")
		}

		t.Logf("✓ Address with passphrase: %s", addressWithPassphrase)
		t.Logf("✓ Address without passphrase: %s", addressWithoutPassphrase)
	})

	t.Run("derives addresses across multiple accounts", func(t *testing.T) {
		// Create wallet
		walletService := wallet.NewWalletService(tempDir)
		_, mnemonic, err := walletService.CreateWallet("Multi Account", "Account@123456", 12, false, "")
		if err != nil {
			t.Fatalf("Failed to create wallet: %v", err)
		}

		// Generate seed
		bip39Service := bip39service.NewBIP39Service()
		seed, err := bip39Service.MnemonicToSeed(mnemonic, "")
		if err != nil {
			t.Fatalf("Failed to generate seed: %v", err)
		}

		// Create master key
		hdkeyService := hdkey.NewHDKeyService()
		masterKey, err := hdkeyService.NewMasterKey(seed)
		if err != nil {
			t.Fatalf("Failed to create master key: %v", err)
		}

		addressService := address.NewAddressService()

		// Derive addresses from 3 different accounts
		addresses := make([]string, 3)
		for account := uint32(0); account < 3; account++ {
			path := "m/44'/0'/" + string(rune('0'+account)) + "'/0/0"
			derivedKey, err := hdkeyService.DerivePath(masterKey, path)
			if err != nil {
				t.Fatalf("Failed to derive account %d: %v", account, err)
			}

			addresses[account], err = addressService.DeriveBitcoinAddress(derivedKey)
			if err != nil {
				t.Fatalf("Failed to generate address for account %d: %v", account, err)
			}

			t.Logf("✓ Account %d address: %s (path: %s)", account, addresses[account], path)
		}

		// Verify all addresses are unique
		for i := 0; i < len(addresses); i++ {
			for j := i + 1; j < len(addresses); j++ {
				if addresses[i] == addresses[j] {
					t.Errorf("Account %d and %d have identical addresses", i, j)
				}
			}
		}
	})
}

// T098: End-to-end workflow test
func TestEndToEndWorkflow(t *testing.T) {
	tempDir := t.TempDir()

	t.Run("complete workflow: create → restore → derive", func(t *testing.T) {
		// Phase 1: Create wallet
		t.Log("Phase 1: Creating wallet...")
		walletService := wallet.NewWalletService(tempDir)
		walletData, originalMnemonic, err := walletService.CreateWallet("E2E Wallet", "E2E@Password123", 12, false, "")
		if err != nil {
			t.Fatalf("Failed to create wallet: %v", err)
		}
		t.Logf("✓ Wallet created: %s", walletData.ID)

		// Verify wallet files exist
		walletDir := filepath.Join(tempDir, walletData.ID)
		if _, err := os.Stat(walletDir); os.IsNotExist(err) {
			t.Error("Wallet directory should exist")
		}

		metadataPath := filepath.Join(walletDir, "wallet.json")
		if _, err := os.Stat(metadataPath); os.IsNotExist(err) {
			t.Error("Wallet metadata should exist")
		}

		// Phase 2: Restore wallet
		t.Log("Phase 2: Restoring wallet...")
		restoredMnemonic, err := walletService.RestoreWallet(walletData.ID, "E2E@Password123")
		if err != nil {
			t.Fatalf("Failed to restore wallet: %v", err)
		}

		if restoredMnemonic != originalMnemonic {
			t.Error("Restored mnemonic doesn't match original")
		}
		t.Logf("✓ Wallet restored successfully")

		// Phase 3: Derive addresses
		t.Log("Phase 3: Deriving addresses...")
		bip39Service := bip39service.NewBIP39Service()
		seed, err := bip39Service.MnemonicToSeed(restoredMnemonic, "")
		if err != nil {
			t.Fatalf("Failed to generate seed: %v", err)
		}

		hdkeyService := hdkey.NewHDKeyService()
		masterKey, err := hdkeyService.NewMasterKey(seed)
		if err != nil {
			t.Fatalf("Failed to create master key: %v", err)
		}

		addressService := address.NewAddressService()

		// Derive Bitcoin address
		btcKey, err := hdkeyService.DerivePath(masterKey, "m/44'/0'/0'/0/0")
		if err != nil {
			t.Fatalf("Failed to derive Bitcoin path: %v", err)
		}

		btcAddress, err := addressService.DeriveBitcoinAddress(btcKey)
		if err != nil {
			t.Fatalf("Failed to generate Bitcoin address: %v", err)
		}
		t.Logf("✓ Bitcoin address: %s", btcAddress)

		// Derive Ethereum address
		ethKey, err := hdkeyService.DerivePath(masterKey, "m/44'/60'/0'/0/0")
		if err != nil {
			t.Fatalf("Failed to derive Ethereum path: %v", err)
		}

		ethAddress, err := addressService.DeriveEthereumAddress(ethKey)
		if err != nil {
			t.Fatalf("Failed to generate Ethereum address: %v", err)
		}
		t.Logf("✓ Ethereum address: %s", ethAddress)

		// Phase 4: Verify addresses are deterministic
		t.Log("Phase 4: Verifying determinism...")

		// Re-derive from same mnemonic
		seed2, _ := bip39Service.MnemonicToSeed(restoredMnemonic, "")
		masterKey2, _ := hdkeyService.NewMasterKey(seed2)

		btcKey2, _ := hdkeyService.DerivePath(masterKey2, "m/44'/0'/0'/0/0")
		btcAddress2, _ := addressService.DeriveBitcoinAddress(btcKey2)

		ethKey2, _ := hdkeyService.DerivePath(masterKey2, "m/44'/60'/0'/0/0")
		ethAddress2, _ := addressService.DeriveEthereumAddress(ethKey2)

		if btcAddress != btcAddress2 {
			t.Error("Bitcoin addresses should be deterministic")
		}

		if ethAddress != ethAddress2 {
			t.Error("Ethereum addresses should be deterministic")
		}

		t.Log("✓ All addresses are deterministic")
		t.Log("✓ End-to-end workflow completed successfully!")
	})
}
