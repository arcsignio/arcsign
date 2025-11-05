package cli_test

import (
	"encoding/json"
	"os"
	"os/exec"
	"strings"
	"testing"
)

// T020a: Test for derive_address command with MNEMONIC and DERIVATION_PATH
// This test verifies that the CLI can derive a single address in memory
// without creating wallet files, for duplicate detection purposes.

func TestDeriveAddress_ValidMnemonicAndPath(t *testing.T) {
	// Skip if CLI binary not built
	if _, err := os.Stat("../../arcsign"); err != nil {
		t.Skip("CLI binary not found - run 'go build -o arcsign ./cmd/arcsign' first")
	}

	// Arrange: Set environment variables
	mnemonic := "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"
	derivationPath := "m/44'/0'/0'/0/0"

	cmd := exec.Command("../../arcsign")
	cmd.Env = append(os.Environ(),
		"ARCSIGN_MODE=dashboard",
		"CLI_COMMAND=derive_address",
		"MNEMONIC="+mnemonic,
		"DERIVATION_PATH="+derivationPath,
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

	address, ok := data["address"].(string)
	if !ok || address == "" {
		t.Errorf("Expected non-empty address, got: %v", data)
	}

	// Assert: Address should be Bitcoin format (starts with bc1 or 1 or 3)
	if !strings.HasPrefix(address, "bc1") && !strings.HasPrefix(address, "1") && !strings.HasPrefix(address, "3") {
		t.Errorf("Expected Bitcoin address format, got: %s", address)
	}

	// Assert: Should include derivation path in response
	path, ok := data["path"].(string)
	if !ok || path != derivationPath {
		t.Errorf("Expected path=%s, got: %v", derivationPath, data)
	}
}

func TestDeriveAddress_MissingMnemonic(t *testing.T) {
	// Skip if CLI binary not built
	if _, err := os.Stat("../../arcsign"); err != nil {
		t.Skip("CLI binary not found")
	}

	// Arrange: Missing MNEMONIC environment variable
	cmd := exec.Command("../../arcsign")
	cmd.Env = append(os.Environ(),
		"ARCSIGN_MODE=dashboard",
		"CLI_COMMAND=derive_address",
		"DERIVATION_PATH=m/44'/0'/0'/0/0",
	)

	// Act: Execute command
	output, err := cmd.CombinedOutput()

	// Assert: Command should fail (exit code != 0)
	if err == nil {
		t.Fatalf("Expected command to fail with missing MNEMONIC, but it succeeded")
	}

	// Assert: Output should be valid JSON error
	var response map[string]interface{}
	if err := json.Unmarshal(output, &response); err != nil {
		t.Fatalf("Output is not valid JSON: %v\nOutput: %s", err, string(output))
	}

	// Assert: Response should indicate failure
	success, ok := response["success"].(bool)
	if !ok || success {
		t.Errorf("Expected success=false, got: %v", response)
	}

	// Assert: Should have error with appropriate code
	errorObj, ok := response["error"].(map[string]interface{})
	if !ok {
		t.Fatalf("Expected error field, got: %v", response)
	}

	code, ok := errorObj["code"].(string)
	if !ok || code == "" {
		t.Errorf("Expected error code, got: %v", errorObj)
	}
}

func TestDeriveAddress_InvalidMnemonic(t *testing.T) {
	// Skip if CLI binary not built
	if _, err := os.Stat("../../arcsign"); err != nil {
		t.Skip("CLI binary not found")
	}

	// Arrange: Invalid mnemonic (wrong word count)
	invalidMnemonic := "abandon abandon abandon"

	cmd := exec.Command("../../arcsign")
	cmd.Env = append(os.Environ(),
		"ARCSIGN_MODE=dashboard",
		"CLI_COMMAND=derive_address",
		"MNEMONIC="+invalidMnemonic,
		"DERIVATION_PATH=m/44'/0'/0'/0/0",
	)

	// Act: Execute command
	output, err := cmd.CombinedOutput()

	// Assert: Command should fail
	if err == nil {
		t.Fatalf("Expected command to fail with invalid mnemonic, but it succeeded")
	}

	// Assert: Output should be valid JSON error
	var response map[string]interface{}
	if err := json.Unmarshal(output, &response); err != nil {
		t.Fatalf("Output is not valid JSON: %v\nOutput: %s", err, string(output))
	}

	// Assert: Error code should be INVALID_MNEMONIC
	errorObj, ok := response["error"].(map[string]interface{})
	if !ok {
		t.Fatalf("Expected error field, got: %v", response)
	}

	code, ok := errorObj["code"].(string)
	if !ok || code != "INVALID_MNEMONIC" {
		t.Errorf("Expected error code INVALID_MNEMONIC, got: %s", code)
	}
}

func TestDeriveAddress_EthereumAddress(t *testing.T) {
	// Skip if CLI binary not built
	if _, err := os.Stat("../../arcsign"); err != nil {
		t.Skip("CLI binary not found")
	}

	// Arrange: Ethereum derivation path (coin_type=60)
	mnemonic := "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"
	derivationPath := "m/44'/60'/0'/0/0"

	cmd := exec.Command("../../arcsign")
	cmd.Env = append(os.Environ(),
		"ARCSIGN_MODE=dashboard",
		"CLI_COMMAND=derive_address",
		"MNEMONIC="+mnemonic,
		"DERIVATION_PATH="+derivationPath,
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

	// Assert: Data should contain Ethereum address
	data, ok := response["data"].(map[string]interface{})
	if !ok {
		t.Fatalf("Expected data field, got: %v", response)
	}

	address, ok := data["address"].(string)
	if !ok || address == "" {
		t.Errorf("Expected non-empty address, got: %v", data)
	}

	// Assert: Address should be Ethereum format (starts with 0x)
	if !strings.HasPrefix(address, "0x") {
		t.Errorf("Expected Ethereum address format (0x...), got: %s", address)
	}

	// Assert: Ethereum address should be 42 characters (0x + 40 hex chars)
	if len(address) != 42 {
		t.Errorf("Expected Ethereum address length 42, got: %d", len(address))
	}
}
