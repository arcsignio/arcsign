package wallet_test

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/yourusername/arcsign/internal/wallet"
)

// T021: Test for addresses.json generation with schema_version "1.0"
// This test verifies that generateAddressesFile() creates a properly formatted
// addresses.json file with correct schema, all 54 addresses, and valid checksum.

func TestGenerateAddressesFile_ValidFormat(t *testing.T) {
	// Arrange: Create temporary directory for test output
	tempDir := t.TempDir()
	walletID := "test-wallet-123"
	mnemonic := "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"
	passphrase := ""

	// Act: Generate addresses file
	filePath, err := wallet.GenerateAddressesFile(tempDir, walletID, mnemonic, passphrase)

	// Assert: File should be created successfully
	if err != nil {
		t.Fatalf("GenerateAddressesFile failed: %v", err)
	}

	// Assert: File should exist at expected path
	expectedPath := filepath.Join(tempDir, "wallets", walletID, "addresses.json")
	if filePath != expectedPath {
		t.Errorf("Expected file path %s, got %s", expectedPath, filePath)
	}

	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		t.Fatalf("addresses.json file not created at %s", filePath)
	}

	// Assert: File should be readable
	data, err := os.ReadFile(filePath)
	if err != nil {
		t.Fatalf("Failed to read addresses.json: %v", err)
	}

	// Assert: File should contain valid JSON
	var addressesFile wallet.AddressesFile
	if err := json.Unmarshal(data, &addressesFile); err != nil {
		t.Fatalf("Invalid JSON in addresses.json: %v", err)
	}

	// Assert: Schema version should be "1.0"
	if addressesFile.SchemaVersion != "1.0" {
		t.Errorf("Expected schema_version '1.0', got '%s'", addressesFile.SchemaVersion)
	}

	// Assert: Wallet ID should match input
	if addressesFile.WalletID != walletID {
		t.Errorf("Expected wallet_id '%s', got '%s'", walletID, addressesFile.WalletID)
	}

	// Assert: Generated timestamp should be recent (within last minute)
	generatedAt, err := time.Parse(time.RFC3339, addressesFile.GeneratedAt)
	if err != nil {
		t.Fatalf("Invalid generated_at timestamp: %v", err)
	}
	if time.Since(generatedAt) > time.Minute {
		t.Errorf("GeneratedAt timestamp is too old: %v", generatedAt)
	}

	// Assert: Total count should be 54
	if addressesFile.TotalCount != 54 {
		t.Errorf("Expected total_count 54, got %d", addressesFile.TotalCount)
	}

	// Assert: Addresses array length should match total_count
	if len(addressesFile.Addresses) != int(addressesFile.TotalCount) {
		t.Errorf("Expected %d addresses, got %d", addressesFile.TotalCount, len(addressesFile.Addresses))
	}

	// Assert: Checksum should be non-empty and 64 hex characters
	if len(addressesFile.Checksum) != 64 {
		t.Errorf("Expected checksum length 64, got %d", len(addressesFile.Checksum))
	}
}

func TestGenerateAddressesFile_AllAddressFieldsPresent(t *testing.T) {
	// Arrange
	tempDir := t.TempDir()
	walletID := "test-wallet-456"
	mnemonic := "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"
	passphrase := ""

	// Act
	filePath, err := wallet.GenerateAddressesFile(tempDir, walletID, mnemonic, passphrase)
	if err != nil {
		t.Fatalf("GenerateAddressesFile failed: %v", err)
	}

	// Read and parse file
	data, _ := os.ReadFile(filePath)
	var addressesFile wallet.AddressesFile
	json.Unmarshal(data, &addressesFile)

	// Assert: First address should be Bitcoin (coin_type 0)
	if len(addressesFile.Addresses) == 0 {
		t.Fatal("No addresses generated")
	}

	firstAddr := addressesFile.Addresses[0]

	// Assert: All required fields should be present
	if firstAddr.Blockchain == "" {
		t.Error("Address missing blockchain field")
	}
	if firstAddr.Symbol == "" {
		t.Error("Address missing symbol field")
	}
	if firstAddr.Address == "" {
		t.Error("Address missing address field")
	}
	if firstAddr.Path == "" {
		t.Error("Address missing path field")
	}

	// Assert: BIP44 components should be present
	if firstAddr.CoinType != 0 {
		t.Errorf("Expected first address coin_type 0 (Bitcoin), got %d", firstAddr.CoinType)
	}
	if firstAddr.Account != 0 {
		t.Errorf("Expected account 0, got %d", firstAddr.Account)
	}
	if firstAddr.Change != 0 {
		t.Errorf("Expected change 0, got %d", firstAddr.Change)
	}
	if firstAddr.Index != 0 {
		t.Errorf("Expected index 0, got %d", firstAddr.Index)
	}

	// Assert: Path should match BIP44 format
	expectedPath := "m/44'/0'/0'/0/0"
	if firstAddr.Path != expectedPath {
		t.Errorf("Expected path '%s', got '%s'", expectedPath, firstAddr.Path)
	}
}

func TestGenerateAddressesFile_WithPassphrase(t *testing.T) {
	// Arrange: Generate addresses with passphrase
	tempDir := t.TempDir()
	walletID := "test-wallet-passphrase"
	mnemonic := "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"
	passphrase := "my-secret-passphrase"

	// Act: Generate with passphrase
	filePath1, err := wallet.GenerateAddressesFile(tempDir, walletID+"_with", mnemonic, passphrase)
	if err != nil {
		t.Fatalf("GenerateAddressesFile with passphrase failed: %v", err)
	}

	// Generate without passphrase
	filePath2, err := wallet.GenerateAddressesFile(tempDir, walletID+"_without", mnemonic, "")
	if err != nil {
		t.Fatalf("GenerateAddressesFile without passphrase failed: %v", err)
	}

	// Read both files
	data1, _ := os.ReadFile(filePath1)
	data2, _ := os.ReadFile(filePath2)

	var file1, file2 wallet.AddressesFile
	json.Unmarshal(data1, &file1)
	json.Unmarshal(data2, &file2)

	// Assert: Addresses should be DIFFERENT (passphrase changes derived addresses)
	if len(file1.Addresses) == 0 || len(file2.Addresses) == 0 {
		t.Fatal("No addresses generated")
	}

	firstAddr1 := file1.Addresses[0].Address
	firstAddr2 := file2.Addresses[0].Address

	if firstAddr1 == firstAddr2 {
		t.Errorf("Expected different addresses with/without passphrase, both got: %s", firstAddr1)
	}
}

func TestGenerateAddressesFile_DeterministicAddresses(t *testing.T) {
	// Arrange: Generate addresses twice with same mnemonic
	tempDir := t.TempDir()
	mnemonic := "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"

	// Act: Generate first time
	filePath1, err := wallet.GenerateAddressesFile(tempDir, "wallet1", mnemonic, "")
	if err != nil {
		t.Fatalf("First generation failed: %v", err)
	}

	// Generate second time
	filePath2, err := wallet.GenerateAddressesFile(tempDir, "wallet2", mnemonic, "")
	if err != nil {
		t.Fatalf("Second generation failed: %v", err)
	}

	// Read both files
	data1, _ := os.ReadFile(filePath1)
	data2, _ := os.ReadFile(filePath2)

	var file1, file2 wallet.AddressesFile
	json.Unmarshal(data1, &file1)
	json.Unmarshal(data2, &file2)

	// Assert: Addresses should be IDENTICAL (deterministic derivation)
	if len(file1.Addresses) != len(file2.Addresses) {
		t.Fatalf("Different number of addresses: %d vs %d", len(file1.Addresses), len(file2.Addresses))
	}

	for i := range file1.Addresses {
		if file1.Addresses[i].Address != file2.Addresses[i].Address {
			t.Errorf("Address %d differs: %s vs %s",
				i, file1.Addresses[i].Address, file2.Addresses[i].Address)
		}
	}
}
