package cli

import (
	"encoding/json"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

// T037 [P] [US1] Integration test for CLI create_wallet with WALLET_PASSWORD env var
// Tests end-to-end wallet creation using environment variables

func TestCreateWallet_Integration_SuccessfulCreation(t *testing.T) {
	tempDir := t.TempDir()

	cmd := exec.Command("./arcsign", "create")
	cmd.Env = []string{
		"ARCSIGN_MODE=dashboard",
		"WALLET_PASSWORD=IntegrationTest123!",
		"USB_PATH=" + tempDir,
		"WALLET_NAME=Integration Test Wallet",
		"MNEMONIC_LENGTH=24",
		"RETURN_MNEMONIC=true",
	}

	output, err := cmd.Output()
	if err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok {
			t.Fatalf("CLI create command failed: %v\nStderr: %s", err, exitErr.Stderr)
		}
		t.Fatalf("CLI create command failed: %v", err)
	}

	var response map[string]interface{}
	if err := json.Unmarshal(output, &response); err != nil {
		t.Fatalf("Failed to parse JSON output: %v\nOutput: %s", err, output)
	}

	// Validate successful response
	if success, ok := response["success"].(bool); !ok || !success {
		t.Errorf("Expected success=true, got %v", response["success"])
	}

	// Extract wallet ID and addresses_file path
	wallet, ok := response["wallet"].(map[string]interface{})
	if !ok {
		t.Fatal("wallet field is not an object")
	}

	walletID, ok := wallet["id"].(string)
	if !ok || walletID == "" {
		t.Fatal("wallet.id is missing or empty")
	}

	addressesFile, ok := wallet["addresses_file"].(string)
	if !ok || addressesFile == "" {
		t.Fatal("wallet.addresses_file is missing or empty")
	}

	// Verify wallet directory exists
	walletDir := filepath.Join(tempDir, "wallets", walletID)
	if _, err := os.Stat(walletDir); os.IsNotExist(err) {
		t.Errorf("Wallet directory not created: %s", walletDir)
	}

	// Verify addresses.json file exists
	addressesFilePath := filepath.Join(tempDir, addressesFile)
	if _, err := os.Stat(addressesFilePath); os.IsNotExist(err) {
		t.Errorf("addresses.json file not created: %s", addressesFilePath)
	}

	// Verify mnemonic is present (RETURN_MNEMONIC=true)
	if _, exists := response["mnemonic"]; !exists {
		t.Error("mnemonic field missing when RETURN_MNEMONIC=true")
	}
}

func TestCreateWallet_Integration_InvalidPassword(t *testing.T) {
	tempDir := t.TempDir()

	// Test with password less than 12 characters
	cmd := exec.Command("./arcsign", "create")
	cmd.Env = []string{
		"ARCSIGN_MODE=dashboard",
		"WALLET_PASSWORD=Short1!", // Only 7 chars
		"USB_PATH=" + tempDir,
		"MNEMONIC_LENGTH=24",
	}

	output, err := cmd.CombinedOutput()
	if err == nil {
		t.Fatal("Expected command to fail with short password, but it succeeded")
	}

	var errorResponse map[string]interface{}
	if err := json.Unmarshal(output, &errorResponse); err != nil {
		t.Fatalf("Failed to parse JSON error output: %v\nOutput: %s", err, output)
	}

	// Validate error response
	if success, ok := errorResponse["success"].(bool); !ok || success {
		t.Errorf("Expected success=false for invalid password, got %v", errorResponse["success"])
	}

	errorObj, ok := errorResponse["error"].(map[string]interface{})
	if !ok {
		t.Fatal("error object missing from response")
	}

	// Expect INVALID_PASSWORD error code
	if code, ok := errorObj["code"].(string); !ok || code != "INVALID_PASSWORD" {
		t.Errorf("Expected error.code='INVALID_PASSWORD', got '%v'", errorObj["code"])
	}
}

func TestCreateWallet_Integration_NonexistentUSBPath(t *testing.T) {
	// Use a path that definitely doesn't exist
	nonexistentPath := "/nonexistent/usb/path/12345"

	cmd := exec.Command("./arcsign", "create")
	cmd.Env = []string{
		"ARCSIGN_MODE=dashboard",
		"WALLET_PASSWORD=ValidPassword123!",
		"USB_PATH=" + nonexistentPath,
		"MNEMONIC_LENGTH=24",
	}

	output, err := cmd.CombinedOutput()
	if err == nil {
		t.Fatal("Expected command to fail with nonexistent USB path, but it succeeded")
	}

	var errorResponse map[string]interface{}
	if err := json.Unmarshal(output, &errorResponse); err != nil {
		t.Fatalf("Failed to parse JSON error output: %v\nOutput: %s", err, output)
	}

	// Validate error response
	if success, ok := errorResponse["success"].(bool); !ok || success {
		t.Errorf("Expected success=false for nonexistent USB path, got %v", errorResponse["success"])
	}

	errorObj, ok := errorResponse["error"].(map[string]interface{})
	if !ok {
		t.Fatal("error object missing from response")
	}

	// Expect USB_NOT_FOUND or IO_ERROR
	code, ok := errorObj["code"].(string)
	if !ok {
		t.Fatal("error.code is not a string")
	}

	if code != "USB_NOT_FOUND" && code != "IO_ERROR" {
		t.Errorf("Expected error.code='USB_NOT_FOUND' or 'IO_ERROR', got '%s'", code)
	}
}

func TestCreateWallet_Integration_12WordMnemonic(t *testing.T) {
	tempDir := t.TempDir()

	cmd := exec.Command("./arcsign", "create")
	cmd.Env = []string{
		"ARCSIGN_MODE=dashboard",
		"WALLET_PASSWORD=ValidPassword123!",
		"USB_PATH=" + tempDir,
		"MNEMONIC_LENGTH=12",
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

	// Validate mnemonic is 12 words
	mnemonic, ok := response["mnemonic"].(string)
	if !ok {
		t.Fatal("mnemonic field missing or not a string")
	}

	words := len(strings.Fields(mnemonic))
	if words != 12 {
		t.Errorf("Expected 12-word mnemonic, got %d words", words)
	}
}

func TestCreateWallet_Integration_DefaultWalletName(t *testing.T) {
	tempDir := t.TempDir()

	cmd := exec.Command("./arcsign", "create")
	cmd.Env = []string{
		"ARCSIGN_MODE=dashboard",
		"WALLET_PASSWORD=ValidPassword123!",
		"USB_PATH=" + tempDir,
		"MNEMONIC_LENGTH=24",
		// WALLET_NAME not provided - should auto-generate
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

	// Verify wallet has a name (auto-generated)
	name, ok := wallet["name"].(string)
	if !ok || name == "" {
		t.Error("Expected auto-generated wallet name, got empty or missing name")
	}

	// Verify name contains timestamp or "Wallet" keyword (implementation detail)
	if !strings.Contains(name, "Wallet") && !strings.Contains(name, "2025") {
		t.Logf("Auto-generated name: '%s'", name)
	}
}

func TestCreateWallet_Integration_ExitCodeZeroOnSuccess(t *testing.T) {
	tempDir := t.TempDir()

	cmd := exec.Command("./arcsign", "create")
	cmd.Env = []string{
		"ARCSIGN_MODE=dashboard",
		"WALLET_PASSWORD=ValidPassword123!",
		"USB_PATH=" + tempDir,
		"MNEMONIC_LENGTH=24",
	}

	if err := cmd.Run(); err != nil {
		t.Errorf("Expected exit code 0 on successful creation, got error: %v", err)
	}
}

func TestCreateWallet_Integration_ExitCodeNonZeroOnFailure(t *testing.T) {
	cmd := exec.Command("./arcsign", "create")
	cmd.Env = []string{
		"ARCSIGN_MODE=dashboard",
		"WALLET_PASSWORD=short", // Invalid password
		"USB_PATH=/tmp",
		"MNEMONIC_LENGTH=24",
	}

	err := cmd.Run()
	if err == nil {
		t.Fatal("Expected non-zero exit code on failure, but command succeeded")
	}

	if exitErr, ok := err.(*exec.ExitError); ok {
		if exitErr.ExitCode() == 0 {
			t.Error("Expected non-zero exit code on failure, got 0")
		}
	}
}
