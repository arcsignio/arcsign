package cli_test

import (
	"encoding/json"
	"os"
	"os/exec"
	"testing"
)

// T020b: Test for derive_address with optional BIP39_PASSPHRASE
// This test verifies that the BIP39 passphrase parameter correctly
// influences address derivation (different passphrase = different address).

func TestDeriveAddress_WithPassphrase(t *testing.T) {
	// Skip if CLI binary not built
	if _, err := os.Stat("../../arcsign"); err != nil {
		t.Skip("CLI binary not found - run 'go build -o arcsign ./cmd/arcsign' first")
	}

	// Arrange: Derive address with passphrase
	mnemonic := "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"
	derivationPath := "m/44'/0'/0'/0/0"
	passphrase := "my-secret-passphrase"

	cmd := exec.Command("../../arcsign")
	cmd.Env = append(os.Environ(),
		"ARCSIGN_MODE=dashboard",
		"CLI_COMMAND=derive_address",
		"MNEMONIC="+mnemonic,
		"DERIVATION_PATH="+derivationPath,
		"BIP39_PASSPHRASE="+passphrase,
	)

	// Act: Execute command
	output, err := cmd.CombinedOutput()

	// Assert: Command should succeed
	if err != nil {
		t.Fatalf("Command failed: %v\nOutput: %s", err, string(output))
	}

	// Assert: Output should be valid JSON
	var response map[string]interface{}
	if err := json.Unmarshal(output, &response); err != nil {
		t.Fatalf("Output is not valid JSON: %v\nOutput: %s", err, string(output))
	}

	// Assert: Response should indicate success
	success, ok := response["success"].(bool)
	if !ok || !success {
		t.Errorf("Expected success=true, got: %v", response)
	}

	// Assert: Data should contain address
	data, ok := response["data"].(map[string]interface{})
	if !ok {
		t.Fatalf("Expected data field, got: %v", response)
	}

	addressWithPassphrase, ok := data["address"].(string)
	if !ok || addressWithPassphrase == "" {
		t.Errorf("Expected non-empty address, got: %v", data)
	}

	// Now derive the same mnemonic WITHOUT passphrase
	cmdNoPassphrase := exec.Command("../../arcsign")
	cmdNoPassphrase.Env = append(os.Environ(),
		"ARCSIGN_MODE=dashboard",
		"CLI_COMMAND=derive_address",
		"MNEMONIC="+mnemonic,
		"DERIVATION_PATH="+derivationPath,
	)

	outputNoPassphrase, err := cmdNoPassphrase.CombinedOutput()
	if err != nil {
		t.Fatalf("Second command failed: %v\nOutput: %s", err, string(outputNoPassphrase))
	}

	var responseNoPassphrase map[string]interface{}
	if err := json.Unmarshal(outputNoPassphrase, &responseNoPassphrase); err != nil {
		t.Fatalf("Second output is not valid JSON: %v", err)
	}

	dataNoPassphrase := responseNoPassphrase["data"].(map[string]interface{})
	addressNoPassphrase := dataNoPassphrase["address"].(string)

	// Assert: Addresses should be DIFFERENT (passphrase changes derived keys)
	if addressWithPassphrase == addressNoPassphrase {
		t.Errorf("Expected different addresses with/without passphrase, both got: %s", addressWithPassphrase)
	}
}

func TestDeriveAddress_EmptyPassphrase(t *testing.T) {
	// Skip if CLI binary not built
	if _, err := os.Stat("../../arcsign"); err != nil {
		t.Skip("CLI binary not found")
	}

	// Arrange: Empty passphrase should be treated as no passphrase
	mnemonic := "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"
	derivationPath := "m/44'/0'/0'/0/0"

	cmd := exec.Command("../../arcsign")
	cmd.Env = append(os.Environ(),
		"ARCSIGN_MODE=dashboard",
		"CLI_COMMAND=derive_address",
		"MNEMONIC="+mnemonic,
		"DERIVATION_PATH="+derivationPath,
		"BIP39_PASSPHRASE=", // Empty passphrase
	)

	// Act: Execute command
	output, err := cmd.CombinedOutput()

	// Assert: Command should succeed
	if err != nil {
		t.Fatalf("Command failed: %v\nOutput: %s", err, string(output))
	}

	// Assert: Output should be valid JSON
	var response map[string]interface{}
	if err := json.Unmarshal(output, &response); err != nil {
		t.Fatalf("Output is not valid JSON: %v\nOutput: %s", err, string(output))
	}

	// Assert: Should succeed
	success, ok := response["success"].(bool)
	if !ok || !success {
		t.Errorf("Expected success=true, got: %v", response)
	}

	data := response["data"].(map[string]interface{})
	addressWithEmpty := data["address"].(string)

	// Now derive without BIP39_PASSPHRASE env var at all
	cmdNoEnv := exec.Command("../../arcsign")
	cmdNoEnv.Env = append(os.Environ(),
		"ARCSIGN_MODE=dashboard",
		"CLI_COMMAND=derive_address",
		"MNEMONIC="+mnemonic,
		"DERIVATION_PATH="+derivationPath,
	)

	outputNoEnv, _ := cmdNoEnv.CombinedOutput()
	var responseNoEnv map[string]interface{}
	json.Unmarshal(outputNoEnv, &responseNoEnv)
	dataNoEnv := responseNoEnv["data"].(map[string]interface{})
	addressNoEnv := dataNoEnv["address"].(string)

	// Assert: Empty passphrase should produce same address as no passphrase
	if addressWithEmpty != addressNoEnv {
		t.Errorf("Expected same address for empty passphrase vs no passphrase, got: %s vs %s", addressWithEmpty, addressNoEnv)
	}
}

func TestDeriveAddress_PassphraseCaseSensitive(t *testing.T) {
	// Skip if CLI binary not built
	if _, err := os.Stat("../../arcsign"); err != nil {
		t.Skip("CLI binary not found")
	}

	// Arrange: Test case sensitivity
	mnemonic := "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"
	derivationPath := "m/44'/0'/0'/0/0"

	// Derive with lowercase passphrase
	cmd1 := exec.Command("../../arcsign")
	cmd1.Env = append(os.Environ(),
		"ARCSIGN_MODE=dashboard",
		"CLI_COMMAND=derive_address",
		"MNEMONIC="+mnemonic,
		"DERIVATION_PATH="+derivationPath,
		"BIP39_PASSPHRASE=password",
	)

	output1, _ := cmd1.CombinedOutput()
	var response1 map[string]interface{}
	json.Unmarshal(output1, &response1)
	data1 := response1["data"].(map[string]interface{})
	address1 := data1["address"].(string)

	// Derive with uppercase passphrase
	cmd2 := exec.Command("../../arcsign")
	cmd2.Env = append(os.Environ(),
		"ARCSIGN_MODE=dashboard",
		"CLI_COMMAND=derive_address",
		"MNEMONIC="+mnemonic,
		"DERIVATION_PATH="+derivationPath,
		"BIP39_PASSPHRASE=PASSWORD",
	)

	output2, _ := cmd2.CombinedOutput()
	var response2 map[string]interface{}
	json.Unmarshal(output2, &response2)
	data2 := response2["data"].(map[string]interface{})
	address2 := data2["address"].(string)

	// Assert: Different case should produce different addresses
	if address1 == address2 {
		t.Errorf("Expected different addresses for case-sensitive passphrases, both got: %s", address1)
	}
}

func TestDeriveAddress_PassphraseWithSpecialChars(t *testing.T) {
	// Skip if CLI binary not built
	if _, err := os.Stat("../../arcsign"); err != nil {
		t.Skip("CLI binary not found")
	}

	// Arrange: Passphrase with special characters
	mnemonic := "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"
	derivationPath := "m/44'/0'/0'/0/0"
	passphrase := "P@ssw0rd!#$%^&*()"

	cmd := exec.Command("../../arcsign")
	cmd.Env = append(os.Environ(),
		"ARCSIGN_MODE=dashboard",
		"CLI_COMMAND=derive_address",
		"MNEMONIC="+mnemonic,
		"DERIVATION_PATH="+derivationPath,
		"BIP39_PASSPHRASE="+passphrase,
	)

	// Act: Execute command
	output, err := cmd.CombinedOutput()

	// Assert: Command should succeed with special characters
	if err != nil {
		t.Fatalf("Command failed with special chars in passphrase: %v\nOutput: %s", err, string(output))
	}

	// Assert: Output should be valid JSON
	var response map[string]interface{}
	if err := json.Unmarshal(output, &response); err != nil {
		t.Fatalf("Output is not valid JSON: %v\nOutput: %s", err, string(output))
	}

	// Assert: Should succeed
	success, ok := response["success"].(bool)
	if !ok || !success {
		t.Errorf("Expected success=true, got: %v", response)
	}

	// Assert: Should have valid address
	data := response["data"].(map[string]interface{})
	address := data["address"].(string)
	if address == "" {
		t.Errorf("Expected non-empty address with special char passphrase")
	}
}
