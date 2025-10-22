package wallet_test

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"os"
	"testing"

	"github.com/yourusername/arcsign/internal/wallet"
)

// T023: Test for SHA-256 checksum computation of addresses array
// This test verifies that computeAddressesChecksum() correctly computes
// the SHA-256 hash of the addresses array for tamper detection.

func TestComputeAddressesChecksum_ValidHash(t *testing.T) {
	// Arrange: Create sample addresses array
	addresses := []wallet.Address{
		{
			Blockchain: "Bitcoin",
			Symbol:     "BTC",
			CoinType:   0,
			Account:    0,
			Change:     0,
			Index:      0,
			Address:    "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
			Path:       "m/44'/0'/0'/0/0",
			Category:   wallet.CategoryBaseChains,
		},
		{
			Blockchain: "Ethereum",
			Symbol:     "ETH",
			CoinType:   60,
			Account:    0,
			Change:     0,
			Index:      0,
			Address:    "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
			Path:       "m/44'/60'/0'/0/0",
			Category:   wallet.CategoryBaseChains,
		},
	}

	// Act: Compute checksum
	checksum := wallet.ComputeAddressesChecksum(addresses)

	// Assert: Checksum should be 64 characters (SHA-256 hex)
	if len(checksum) != 64 {
		t.Errorf("Expected checksum length 64, got %d", len(checksum))
	}

	// Assert: Checksum should be valid hex string
	if _, err := hex.DecodeString(checksum); err != nil {
		t.Errorf("Checksum is not valid hex: %v", err)
	}

	// Assert: Checksum should be lowercase hex
	for _, c := range checksum {
		if (c >= 'A' && c <= 'F') {
			t.Errorf("Checksum contains uppercase hex character: %c", c)
		}
	}
}

func TestComputeAddressesChecksum_Deterministic(t *testing.T) {
	// Arrange: Create same addresses array twice
	addresses := []wallet.Address{
		{
			Blockchain: "Bitcoin",
			Symbol:     "BTC",
			CoinType:   0,
			Account:    0,
			Change:     0,
			Index:      0,
			Address:    "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
			Path:       "m/44'/0'/0'/0/0",
			Category:   wallet.CategoryBaseChains,
		},
	}

	// Act: Compute checksum twice
	checksum1 := wallet.ComputeAddressesChecksum(addresses)
	checksum2 := wallet.ComputeAddressesChecksum(addresses)

	// Assert: Checksums should be identical (deterministic)
	if checksum1 != checksum2 {
		t.Errorf("Expected deterministic checksums, got:\n%s\n%s", checksum1, checksum2)
	}
}

func TestComputeAddressesChecksum_MatchesManualCalculation(t *testing.T) {
	// Arrange: Create single address
	addresses := []wallet.Address{
		{
			Blockchain: "Bitcoin",
			Symbol:     "BTC",
			CoinType:   0,
			Account:    0,
			Change:     0,
			Index:      0,
			Address:    "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
			Path:       "m/44'/0'/0'/0/0",
			Category:   wallet.CategoryBaseChains,
		},
	}

	// Act: Compute checksum using function
	computedChecksum := wallet.ComputeAddressesChecksum(addresses)

	// Compute checksum manually
	serialized, err := json.Marshal(addresses)
	if err != nil {
		t.Fatalf("Failed to serialize addresses: %v", err)
	}
	hash := sha256.Sum256(serialized)
	expectedChecksum := hex.EncodeToString(hash[:])

	// Assert: Checksums should match
	if computedChecksum != expectedChecksum {
		t.Errorf("Checksum mismatch:\nExpected: %s\nGot:      %s", expectedChecksum, computedChecksum)
	}
}

func TestComputeAddressesChecksum_DifferentForDifferentData(t *testing.T) {
	// Arrange: Create two different address arrays
	addresses1 := []wallet.Address{
		{
			Blockchain: "Bitcoin",
			Symbol:     "BTC",
			CoinType:   0,
			Account:    0,
			Change:     0,
			Index:      0,
			Address:    "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
			Path:       "m/44'/0'/0'/0/0",
			Category:   wallet.CategoryBaseChains,
		},
	}

	addresses2 := []wallet.Address{
		{
			Blockchain: "Ethereum",
			Symbol:     "ETH",
			CoinType:   60,
			Account:    0,
			Change:     0,
			Index:      0,
			Address:    "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
			Path:       "m/44'/60'/0'/0/0",
			Category:   wallet.CategoryBaseChains,
		},
	}

	// Act: Compute checksums
	checksum1 := wallet.ComputeAddressesChecksum(addresses1)
	checksum2 := wallet.ComputeAddressesChecksum(addresses2)

	// Assert: Checksums should be different
	if checksum1 == checksum2 {
		t.Errorf("Expected different checksums for different data, both got: %s", checksum1)
	}
}

func TestComputeAddressesChecksum_SensitiveToOrder(t *testing.T) {
	// Arrange: Create addresses in different orders
	addr1 := wallet.Address{
		Blockchain: "Bitcoin",
		Symbol:     "BTC",
		CoinType:   0,
		Account:    0,
		Change:     0,
		Index:      0,
		Address:    "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
		Path:       "m/44'/0'/0'/0/0",
		Category:   wallet.CategoryBaseChains,
	}

	addr2 := wallet.Address{
		Blockchain: "Ethereum",
		Symbol:     "ETH",
		CoinType:   60,
		Account:    0,
		Change:     0,
		Index:      0,
		Address:    "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
		Path:       "m/44'/60'/0'/0/0",
		Category:   wallet.CategoryBaseChains,
	}

	addressesOrder1 := []wallet.Address{addr1, addr2}
	addressesOrder2 := []wallet.Address{addr2, addr1}

	// Act: Compute checksums
	checksum1 := wallet.ComputeAddressesChecksum(addressesOrder1)
	checksum2 := wallet.ComputeAddressesChecksum(addressesOrder2)

	// Assert: Checksums should be different (order matters)
	if checksum1 == checksum2 {
		t.Errorf("Expected different checksums for different order, both got: %s", checksum1)
	}
}

func TestValidateAddressesFileChecksum_Valid(t *testing.T) {
	// Arrange: Create addresses file with valid checksum
	addresses := []wallet.Address{
		{
			Blockchain: "Bitcoin",
			Symbol:     "BTC",
			CoinType:   0,
			Account:    0,
			Change:     0,
			Index:      0,
			Address:    "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
			Path:       "m/44'/0'/0'/0/0",
			Category:   wallet.CategoryBaseChains,
		},
	}

	validChecksum := wallet.ComputeAddressesChecksum(addresses)

	addressesFile := wallet.AddressesFile{
		SchemaVersion: "1.0",
		WalletID:      "test-wallet",
		GeneratedAt:   "2025-10-22T14:30:25Z",
		TotalCount:    1,
		Checksum:      validChecksum,
		Addresses:     addresses,
	}

	// Act: Validate checksum
	err := wallet.ValidateAddressesFileChecksum(&addressesFile)

	// Assert: Should pass validation
	if err != nil {
		t.Errorf("Expected valid checksum, got error: %v", err)
	}
}

func TestValidateAddressesFileChecksum_Invalid(t *testing.T) {
	// Arrange: Create addresses file with INVALID checksum
	addresses := []wallet.Address{
		{
			Blockchain: "Bitcoin",
			Symbol:     "BTC",
			CoinType:   0,
			Account:    0,
			Change:     0,
			Index:      0,
			Address:    "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
			Path:       "m/44'/0'/0'/0/0",
			Category:   wallet.CategoryBaseChains,
		},
	}

	// Use wrong checksum (all zeros)
	invalidChecksum := "0000000000000000000000000000000000000000000000000000000000000000"

	addressesFile := wallet.AddressesFile{
		SchemaVersion: "1.0",
		WalletID:      "test-wallet",
		GeneratedAt:   "2025-10-22T14:30:25Z",
		TotalCount:    1,
		Checksum:      invalidChecksum,
		Addresses:     addresses,
	}

	// Act: Validate checksum
	err := wallet.ValidateAddressesFileChecksum(&addressesFile)

	// Assert: Should fail validation
	if err == nil {
		t.Error("Expected checksum validation to fail, but it passed")
	}
}

func TestValidateAddressesFileChecksum_DetectsTampering(t *testing.T) {
	// Arrange: Create addresses file, then tamper with data
	addresses := []wallet.Address{
		{
			Blockchain: "Bitcoin",
			Symbol:     "BTC",
			CoinType:   0,
			Account:    0,
			Change:     0,
			Index:      0,
			Address:    "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
			Path:       "m/44'/0'/0'/0/0",
			Category:   wallet.CategoryBaseChains,
		},
	}

	validChecksum := wallet.ComputeAddressesChecksum(addresses)

	addressesFile := wallet.AddressesFile{
		SchemaVersion: "1.0",
		WalletID:      "test-wallet",
		GeneratedAt:   "2025-10-22T14:30:25Z",
		TotalCount:    1,
		Checksum:      validChecksum,
		Addresses:     addresses,
	}

	// Tamper with address data AFTER checksum was computed
	addressesFile.Addresses[0].Address = "TAMPERED_ADDRESS"

	// Act: Validate checksum
	err := wallet.ValidateAddressesFileChecksum(&addressesFile)

	// Assert: Should detect tampering
	if err == nil {
		t.Error("Expected checksum validation to detect tampering, but it passed")
	}
}

func TestGenerateAddressesFile_IntegratedChecksumValidation(t *testing.T) {
	// Arrange: Generate a real addresses file
	tempDir := t.TempDir()
	walletID := "test-wallet-checksum"
	mnemonic := "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"

	// Act: Generate file
	filePath, err := wallet.GenerateAddressesFile(tempDir, walletID, mnemonic, "")
	if err != nil {
		t.Fatalf("GenerateAddressesFile failed: %v", err)
	}

	// Read generated file
	data, err := os.ReadFile(filePath)
	if err != nil {
		t.Fatalf("Failed to read generated file: %v", err)
	}

	var addressesFile wallet.AddressesFile
	if err := json.Unmarshal(data, &addressesFile); err != nil {
		t.Fatalf("Failed to parse JSON: %v", err)
	}

	// Assert: Generated file should pass checksum validation
	if err := wallet.ValidateAddressesFileChecksum(&addressesFile); err != nil {
		t.Errorf("Generated file failed checksum validation: %v", err)
	}

	// Verify checksum manually
	expectedChecksum := wallet.ComputeAddressesChecksum(addressesFile.Addresses)
	if addressesFile.Checksum != expectedChecksum {
		t.Errorf("Checksum in file doesn't match computed checksum:\nFile:     %s\nComputed: %s",
			addressesFile.Checksum, expectedChecksum)
	}
}
