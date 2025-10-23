package cli

import (
	"encoding/json"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

// T039 [P] [US1] Test for addresses.json generation with 54 addresses
// Tests that addresses.json is generated with all 54 blockchain addresses

func TestAddressesJSON_Contains54Addresses(t *testing.T) {
	tempDir := t.TempDir()

	cmd := exec.Command("./arcsign", "create")
	cmd.Env = []string{
		"ARCSIGN_MODE=dashboard",
		"WALLET_PASSWORD=AddressTest123!",
		"USB_PATH=" + tempDir,
		"MNEMONIC_LENGTH=24",
		"RETURN_MNEMONIC=true",
	}

	output, err := cmd.Output()
	if err != nil {
		t.Fatalf("CLI create command failed: %v", err)
	}

	var response map[string]interface{}
	if err := json.Unmarshal(output, &response); err != nil {
		t.Fatalf("Failed to parse JSON output: %v", err)
	}

	wallet, ok := response["wallet"].(map[string]interface{})
	if !ok {
		t.Fatal("wallet field is not an object")
	}

	addressesFile, ok := wallet["addresses_file"].(string)
	if !ok || addressesFile == "" {
		t.Fatal("wallet.addresses_file is missing or empty")
	}

	// Read addresses.json file
	addressesFilePath := filepath.Join(tempDir, addressesFile)
	content, err := os.ReadFile(addressesFilePath)
	if err != nil {
		t.Fatalf("Failed to read addresses.json: %v", err)
	}

	var addressesData map[string]interface{}
	if err := json.Unmarshal(content, &addressesData); err != nil {
		t.Fatalf("Failed to parse addresses.json: %v", err)
	}

	// Validate schema structure
	requiredFields := []string{"schema_version", "wallet_id", "generated_at", "total_count", "checksum", "addresses"}
	for _, field := range requiredFields {
		if _, exists := addressesData[field]; !exists {
			t.Errorf("Required field '%s' missing from addresses.json", field)
		}
	}

	// Validate total_count = 54
	if totalCount, ok := addressesData["total_count"].(float64); !ok || totalCount != 54 {
		t.Errorf("Expected total_count=54, got %v", addressesData["total_count"])
	}

	// Validate addresses array has 54 entries
	addresses, ok := addressesData["addresses"].([]interface{})
	if !ok {
		t.Fatal("addresses field is not an array")
	}

	if len(addresses) != 54 {
		t.Errorf("Expected 54 addresses, got %d", len(addresses))
	}
}

func TestAddressesJSON_SchemaVersion(t *testing.T) {
	tempDir := t.TempDir()

	cmd := exec.Command("./arcsign", "create")
	cmd.Env = []string{
		"ARCSIGN_MODE=dashboard",
		"WALLET_PASSWORD=SchemaTest123!",
		"USB_PATH=" + tempDir,
		"MNEMONIC_LENGTH=24",
	}

	output, err := cmd.Output()
	if err != nil {
		t.Fatalf("CLI create command failed: %v", err)
	}

	var response map[string]interface{}
	if err := json.Unmarshal(output, &response); err != nil {
		t.Fatalf("Failed to parse JSON output: %v", err)
	}

	wallet, ok := response["wallet"].(map[string]interface{})
	if !ok {
		t.Fatal("wallet field is not an object")
	}

	addressesFile, ok := wallet["addresses_file"].(string)
	if !ok {
		t.Fatal("wallet.addresses_file is missing")
	}

	addressesFilePath := filepath.Join(tempDir, addressesFile)
	content, err := os.ReadFile(addressesFilePath)
	if err != nil {
		t.Fatalf("Failed to read addresses.json: %v", err)
	}

	var addressesData map[string]interface{}
	if err := json.Unmarshal(content, &addressesData); err != nil {
		t.Fatalf("Failed to parse addresses.json: %v", err)
	}

	// Validate schema_version = "1.0"
	if schemaVersion, ok := addressesData["schema_version"].(string); !ok || schemaVersion != "1.0" {
		t.Errorf("Expected schema_version='1.0', got '%v'", addressesData["schema_version"])
	}
}

func TestAddressesJSON_WalletIDMatches(t *testing.T) {
	tempDir := t.TempDir()

	cmd := exec.Command("./arcsign", "create")
	cmd.Env = []string{
		"ARCSIGN_MODE=dashboard",
		"WALLET_PASSWORD=WalletIDTest123!",
		"USB_PATH=" + tempDir,
		"MNEMONIC_LENGTH=24",
	}

	output, err := cmd.Output()
	if err != nil {
		t.Fatalf("CLI create command failed: %v", err)
	}

	var response map[string]interface{}
	if err := json.Unmarshal(output, &response); err != nil {
		t.Fatalf("Failed to parse JSON output: %v", err)
	}

	wallet, ok := response["wallet"].(map[string]interface{})
	if !ok {
		t.Fatal("wallet field is not an object")
	}

	walletID, ok := wallet["id"].(string)
	if !ok {
		t.Fatal("wallet.id is missing")
	}

	addressesFile, ok := wallet["addresses_file"].(string)
	if !ok {
		t.Fatal("wallet.addresses_file is missing")
	}

	addressesFilePath := filepath.Join(tempDir, addressesFile)
	content, err := os.ReadFile(addressesFilePath)
	if err != nil {
		t.Fatalf("Failed to read addresses.json: %v", err)
	}

	var addressesData map[string]interface{}
	if err := json.Unmarshal(content, &addressesData); err != nil {
		t.Fatalf("Failed to parse addresses.json: %v", err)
	}

	// Validate wallet_id in addresses.json matches response wallet.id
	if addressesWalletID, ok := addressesData["wallet_id"].(string); !ok || addressesWalletID != walletID {
		t.Errorf("Wallet ID mismatch: response has '%s', addresses.json has '%v'", walletID, addressesData["wallet_id"])
	}
}

func TestAddressesJSON_ChecksumPresent(t *testing.T) {
	tempDir := t.TempDir()

	cmd := exec.Command("./arcsign", "create")
	cmd.Env = []string{
		"ARCSIGN_MODE=dashboard",
		"WALLET_PASSWORD=ChecksumTest123!",
		"USB_PATH=" + tempDir,
		"MNEMONIC_LENGTH=24",
	}

	output, err := cmd.Output()
	if err != nil {
		t.Fatalf("CLI create command failed: %v", err)
	}

	var response map[string]interface{}
	if err := json.Unmarshal(output, &response); err != nil {
		t.Fatalf("Failed to parse JSON output: %v", err)
	}

	wallet, ok := response["wallet"].(map[string]interface{})
	if !ok {
		t.Fatal("wallet field is not an object")
	}

	addressesFile, ok := wallet["addresses_file"].(string)
	if !ok {
		t.Fatal("wallet.addresses_file is missing")
	}

	addressesFilePath := filepath.Join(tempDir, addressesFile)
	content, err := os.ReadFile(addressesFilePath)
	if err != nil {
		t.Fatalf("Failed to read addresses.json: %v", err)
	}

	var addressesData map[string]interface{}
	if err := json.Unmarshal(content, &addressesData); err != nil {
		t.Fatalf("Failed to parse addresses.json: %v", err)
	}

	// Validate checksum field exists and is 64-char hex string (SHA-256)
	checksum, ok := addressesData["checksum"].(string)
	if !ok {
		t.Fatal("checksum field missing or not a string")
	}

	if len(checksum) != 64 {
		t.Errorf("Expected checksum to be 64-char hex string (SHA-256), got %d chars", len(checksum))
	}

	// Validate checksum is valid hex
	for _, c := range checksum {
		if !((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f')) {
			t.Errorf("checksum contains invalid hex character: '%c'", c)
			break
		}
	}
}

func TestAddressesJSON_AddressStructure(t *testing.T) {
	tempDir := t.TempDir()

	cmd := exec.Command("./arcsign", "create")
	cmd.Env = []string{
		"ARCSIGN_MODE=dashboard",
		"WALLET_PASSWORD=AddressStructTest123!",
		"USB_PATH=" + tempDir,
		"MNEMONIC_LENGTH=24",
	}

	output, err := cmd.Output()
	if err != nil {
		t.Fatalf("CLI create command failed: %v", err)
	}

	var response map[string]interface{}
	if err := json.Unmarshal(output, &response); err != nil {
		t.Fatalf("Failed to parse JSON output: %v", err)
	}

	wallet, ok := response["wallet"].(map[string]interface{})
	if !ok {
		t.Fatal("wallet field is not an object")
	}

	addressesFile, ok := wallet["addresses_file"].(string)
	if !ok {
		t.Fatal("wallet.addresses_file is missing")
	}

	addressesFilePath := filepath.Join(tempDir, addressesFile)
	content, err := os.ReadFile(addressesFilePath)
	if err != nil {
		t.Fatalf("Failed to read addresses.json: %v", err)
	}

	var addressesData map[string]interface{}
	if err := json.Unmarshal(content, &addressesData); err != nil {
		t.Fatalf("Failed to parse addresses.json: %v", err)
	}

	addresses, ok := addressesData["addresses"].([]interface{})
	if !ok {
		t.Fatal("addresses field is not an array")
	}

	if len(addresses) == 0 {
		t.Fatal("addresses array is empty")
	}

	// Validate first address has required fields
	firstAddr, ok := addresses[0].(map[string]interface{})
	if !ok {
		t.Fatal("First address is not an object")
	}

	requiredAddressFields := []string{"blockchain", "symbol", "coin_type", "account", "change", "index", "address", "path", "category"}
	for _, field := range requiredAddressFields {
		if _, exists := firstAddr[field]; !exists {
			t.Errorf("Address object missing required field '%s'", field)
		}
	}
}

func TestAddressesJSON_BitcoinAddressPresent(t *testing.T) {
	tempDir := t.TempDir()

	cmd := exec.Command("./arcsign", "create")
	cmd.Env = []string{
		"ARCSIGN_MODE=dashboard",
		"WALLET_PASSWORD=BitcoinTest123!",
		"USB_PATH=" + tempDir,
		"MNEMONIC_LENGTH=24",
	}

	output, err := cmd.Output()
	if err != nil {
		t.Fatalf("CLI create command failed: %v", err)
	}

	var response map[string]interface{}
	if err := json.Unmarshal(output, &response); err != nil {
		t.Fatalf("Failed to parse JSON output: %v", err)
	}

	wallet, ok := response["wallet"].(map[string]interface{})
	if !ok {
		t.Fatal("wallet field is not an object")
	}

	addressesFile, ok := wallet["addresses_file"].(string)
	if !ok {
		t.Fatal("wallet.addresses_file is missing")
	}

	addressesFilePath := filepath.Join(tempDir, addressesFile)
	content, err := os.ReadFile(addressesFilePath)
	if err != nil {
		t.Fatalf("Failed to read addresses.json: %v", err)
	}

	var addressesData map[string]interface{}
	if err := json.Unmarshal(content, &addressesData); err != nil {
		t.Fatalf("Failed to parse addresses.json: %v", err)
	}

	addresses, ok := addressesData["addresses"].([]interface{})
	if !ok {
		t.Fatal("addresses field is not an array")
	}

	// Find Bitcoin address (coin_type = 0)
	foundBitcoin := false
	for _, addr := range addresses {
		addrMap, ok := addr.(map[string]interface{})
		if !ok {
			continue
		}

		coinType, ok := addrMap["coin_type"].(float64)
		if !ok {
			continue
		}

		if coinType == 0 {
			foundBitcoin = true

			// Validate Bitcoin-specific fields
			if symbol, ok := addrMap["symbol"].(string); !ok || symbol != "BTC" {
				t.Errorf("Bitcoin address should have symbol='BTC', got '%v'", addrMap["symbol"])
			}

			if blockchain, ok := addrMap["blockchain"].(string); !ok || blockchain != "Bitcoin" {
				t.Errorf("Bitcoin address should have blockchain='Bitcoin', got '%v'", addrMap["blockchain"])
			}

			if path, ok := addrMap["path"].(string); !ok || !strings.HasPrefix(path, "m/44'/0'/") {
				t.Errorf("Bitcoin address should have path starting with m/44'/0'/, got '%v'", addrMap["path"])
			}

			break
		}
	}

	if !foundBitcoin {
		t.Error("Bitcoin address (coin_type=0) not found in addresses array")
	}
}

func TestAddressesJSON_EthereumAddressPresent(t *testing.T) {
	tempDir := t.TempDir()

	cmd := exec.Command("./arcsign", "create")
	cmd.Env = []string{
		"ARCSIGN_MODE=dashboard",
		"WALLET_PASSWORD=EthereumTest123!",
		"USB_PATH=" + tempDir,
		"MNEMONIC_LENGTH=24",
	}

	output, err := cmd.Output()
	if err != nil {
		t.Fatalf("CLI create command failed: %v", err)
	}

	var response map[string]interface{}
	if err := json.Unmarshal(output, &response); err != nil {
		t.Fatalf("Failed to parse JSON output: %v", err)
	}

	wallet, ok := response["wallet"].(map[string]interface{})
	if !ok {
		t.Fatal("wallet field is not an object")
	}

	addressesFile, ok := wallet["addresses_file"].(string)
	if !ok {
		t.Fatal("wallet.addresses_file is missing")
	}

	addressesFilePath := filepath.Join(tempDir, addressesFile)
	content, err := os.ReadFile(addressesFilePath)
	if err != nil {
		t.Fatalf("Failed to read addresses.json: %v", err)
	}

	var addressesData map[string]interface{}
	if err := json.Unmarshal(content, &addressesData); err != nil {
		t.Fatalf("Failed to parse addresses.json: %v", err)
	}

	addresses, ok := addressesData["addresses"].([]interface{})
	if !ok {
		t.Fatal("addresses field is not an array")
	}

	// Find Ethereum address (coin_type = 60)
	foundEthereum := false
	for _, addr := range addresses {
		addrMap, ok := addr.(map[string]interface{})
		if !ok {
			continue
		}

		coinType, ok := addrMap["coin_type"].(float64)
		if !ok {
			continue
		}

		if coinType == 60 {
			foundEthereum = true

			// Validate Ethereum-specific fields
			if symbol, ok := addrMap["symbol"].(string); !ok || symbol != "ETH" {
				t.Errorf("Ethereum address should have symbol='ETH', got '%v'", addrMap["symbol"])
			}

			if blockchain, ok := addrMap["blockchain"].(string); !ok || blockchain != "Ethereum" {
				t.Errorf("Ethereum address should have blockchain='Ethereum', got '%v'", addrMap["blockchain"])
			}

			// Ethereum addresses start with 0x
			if address, ok := addrMap["address"].(string); ok {
				if !strings.HasPrefix(address, "0x") {
					t.Errorf("Ethereum address should start with 0x, got '%s'", address)
				}
			}

			break
		}
	}

	if !foundEthereum {
		t.Error("Ethereum address (coin_type=60) not found in addresses array")
	}
}

func TestAddressesJSON_AllAddressesUnique(t *testing.T) {
	tempDir := t.TempDir()

	cmd := exec.Command("./arcsign", "create")
	cmd.Env = []string{
		"ARCSIGN_MODE=dashboard",
		"WALLET_PASSWORD=UniqueTest123!",
		"USB_PATH=" + tempDir,
		"MNEMONIC_LENGTH=24",
	}

	output, err := cmd.Output()
	if err != nil {
		t.Fatalf("CLI create command failed: %v", err)
	}

	var response map[string]interface{}
	if err := json.Unmarshal(output, &response); err != nil {
		t.Fatalf("Failed to parse JSON output: %v", err)
	}

	wallet, ok := response["wallet"].(map[string]interface{})
	if !ok {
		t.Fatal("wallet field is not an object")
	}

	addressesFile, ok := wallet["addresses_file"].(string)
	if !ok {
		t.Fatal("wallet.addresses_file is missing")
	}

	addressesFilePath := filepath.Join(tempDir, addressesFile)
	content, err := os.ReadFile(addressesFilePath)
	if err != nil {
		t.Fatalf("Failed to read addresses.json: %v", err)
	}

	var addressesData map[string]interface{}
	if err := json.Unmarshal(content, &addressesData); err != nil {
		t.Fatalf("Failed to parse addresses.json: %v", err)
	}

	addresses, ok := addressesData["addresses"].([]interface{})
	if !ok {
		t.Fatal("addresses field is not an array")
	}

	// Check that all coin_type values are unique (no duplicates)
	seenCoinTypes := make(map[float64]bool)
	for _, addr := range addresses {
		addrMap, ok := addr.(map[string]interface{})
		if !ok {
			continue
		}

		coinType, ok := addrMap["coin_type"].(float64)
		if !ok {
			continue
		}

		if seenCoinTypes[coinType] {
			t.Errorf("Duplicate coin_type found: %v", coinType)
		}
		seenCoinTypes[coinType] = true
	}

	// Verify we have 54 unique coin types
	if len(seenCoinTypes) != 54 {
		t.Errorf("Expected 54 unique coin types, got %d", len(seenCoinTypes))
	}
}
