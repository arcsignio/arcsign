package cli

import (
	"encoding/json"
	"os/exec"
	"strings"
	"testing"
)

// T036 [P] [US1] Contract test for create_wallet JSON output matching OpenAPI spec
// Tests that CLI create command outputs JSON matching OpenAPI CreateWalletResponse schema

func TestCreateWallet_JSONOutputMatchesOpenAPISpec(t *testing.T) {
	tempDir := t.TempDir()

	cmd := exec.Command("./arcsign", "create")
	cmd.Env = []string{
		"ARCSIGN_MODE=dashboard",
		"WALLET_PASSWORD=TestPassword123!",
		"USB_PATH=" + tempDir,
		"WALLET_NAME=Contract Test Wallet",
		"MNEMONIC_LENGTH=24",
		"RETURN_MNEMONIC=true",
	}

	output, err := cmd.Output()
	if err != nil {
		t.Fatalf("CLI create command failed: %v", err)
	}

	// Verify single-line JSON output (no newlines)
	outputStr := string(output)
	if strings.Contains(outputStr, "\n") {
		t.Error("Expected single-line JSON output, got multi-line")
	}

	// Parse JSON response
	var response map[string]interface{}
	if err := json.Unmarshal(output, &response); err != nil {
		t.Fatalf("Failed to parse JSON output: %v\nOutput: %s", err, output)
	}

	// Validate required fields per OpenAPI CreateWalletResponse schema
	testCases := []struct {
		field       string
		shouldExist bool
		valueType   string
	}{
		{"success", true, "bool"},
		{"wallet", true, "object"},
		{"mnemonic", true, "string"}, // RETURN_MNEMONIC=true
		{"request_id", true, "string"},
		{"cli_version", true, "string"},
		{"duration_ms", true, "number"},
		{"warnings", true, "array"},
	}

	for _, tc := range testCases {
		value, exists := response[tc.field]
		if !exists && tc.shouldExist {
			t.Errorf("Required field '%s' missing from JSON response", tc.field)
			continue
		}

		// Type validation
		switch tc.valueType {
		case "bool":
			if _, ok := value.(bool); !ok {
				t.Errorf("Field '%s' should be boolean, got %T", tc.field, value)
			}
		case "string":
			if _, ok := value.(string); !ok {
				t.Errorf("Field '%s' should be string, got %T", tc.field, value)
			}
		case "number":
			if _, ok := value.(float64); !ok {
				t.Errorf("Field '%s' should be number, got %T", tc.field, value)
			}
		case "object":
			if _, ok := value.(map[string]interface{}); !ok {
				t.Errorf("Field '%s' should be object, got %T", tc.field, value)
			}
		case "array":
			if _, ok := value.([]interface{}); !ok {
				t.Errorf("Field '%s' should be array, got %T", tc.field, value)
			}
		}
	}

	// Validate success = true
	if success, ok := response["success"].(bool); !ok || !success {
		t.Errorf("Expected success=true, got %v", response["success"])
	}

	// Validate wallet object structure
	wallet, ok := response["wallet"].(map[string]interface{})
	if !ok {
		t.Fatal("wallet field is not an object")
	}

	walletFields := []string{"id", "name", "created_at", "uses_passphrase", "addresses_file"}
	for _, field := range walletFields {
		if _, exists := wallet[field]; !exists {
			t.Errorf("Wallet object missing required field '%s'", field)
		}
	}

	// Validate wallet.name matches WALLET_NAME env var
	if name, ok := wallet["name"].(string); !ok || name != "Contract Test Wallet" {
		t.Errorf("Expected wallet.name='Contract Test Wallet', got '%v'", wallet["name"])
	}

	// Validate wallet.uses_passphrase = false (no BIP39_PASSPHRASE provided)
	if usesPassphrase, ok := wallet["uses_passphrase"].(bool); !ok || usesPassphrase {
		t.Errorf("Expected wallet.uses_passphrase=false, got %v", wallet["uses_passphrase"])
	}

	// Validate mnemonic is 24 words (MNEMONIC_LENGTH=24)
	if mnemonic, ok := response["mnemonic"].(string); ok {
		words := strings.Fields(mnemonic)
		if len(words) != 24 {
			t.Errorf("Expected 24-word mnemonic, got %d words", len(words))
		}
	} else {
		t.Error("mnemonic field missing or not a string")
	}

	// Validate request_id is UUID format (36 chars with hyphens)
	if requestID, ok := response["request_id"].(string); ok {
		if len(requestID) != 36 || !strings.Contains(requestID, "-") {
			t.Errorf("request_id should be UUID format, got '%s'", requestID)
		}
	}

	// Validate cli_version is semver format (e.g., "1.0.0")
	if version, ok := response["cli_version"].(string); ok {
		parts := strings.Split(version, ".")
		if len(parts) != 3 {
			t.Errorf("cli_version should be semver format (x.y.z), got '%s'", version)
		}
	}

	// Validate warnings is empty array (no warnings for successful creation)
	if warnings, ok := response["warnings"].([]interface{}); ok {
		if len(warnings) != 0 {
			t.Errorf("Expected empty warnings array, got %v", warnings)
		}
	}
}

func TestCreateWallet_JSONErrorResponseMatchesOpenAPISpec(t *testing.T) {
	tempDir := t.TempDir()

	// Test invalid password (too short) - should return CliErrorResponse
	cmd := exec.Command("./arcsign", "create")
	cmd.Env = []string{
		"ARCSIGN_MODE=dashboard",
		"WALLET_PASSWORD=short", // Invalid: less than 12 chars
		"USB_PATH=" + tempDir,
		"MNEMONIC_LENGTH=24",
	}

	output, err := cmd.CombinedOutput()
	if err == nil {
		t.Fatal("Expected command to fail with invalid password, but it succeeded")
	}

	// Parse JSON error response
	var errorResponse map[string]interface{}
	if err := json.Unmarshal(output, &errorResponse); err != nil {
		t.Fatalf("Failed to parse JSON error output: %v\nOutput: %s", err, output)
	}

	// Validate CliErrorResponse schema
	if success, ok := errorResponse["success"].(bool); !ok || success {
		t.Errorf("Expected success=false for error response, got %v", errorResponse["success"])
	}

	// Validate error object exists
	errorObj, ok := errorResponse["error"].(map[string]interface{})
	if !ok {
		t.Fatal("error field missing or not an object")
	}

	// Validate error.code and error.message
	if _, exists := errorObj["code"]; !exists {
		t.Error("error.code field missing")
	}

	if _, exists := errorObj["message"]; !exists {
		t.Error("error.message field missing")
	}

	// Validate request_id, cli_version, duration_ms exist
	requiredFields := []string{"request_id", "cli_version", "duration_ms"}
	for _, field := range requiredFields {
		if _, exists := errorResponse[field]; !exists {
			t.Errorf("Required field '%s' missing from error response", field)
		}
	}
}

func TestCreateWallet_WithBIP39Passphrase_UsesPassphraseTrue(t *testing.T) {
	tempDir := t.TempDir()

	cmd := exec.Command("./arcsign", "create")
	cmd.Env = []string{
		"ARCSIGN_MODE=dashboard",
		"WALLET_PASSWORD=TestPassword123!",
		"USB_PATH=" + tempDir,
		"BIP39_PASSPHRASE=my-secret-25th-word",
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

	// Validate wallet.uses_passphrase = true when BIP39_PASSPHRASE is provided
	if usesPassphrase, ok := wallet["uses_passphrase"].(bool); !ok || !usesPassphrase {
		t.Errorf("Expected wallet.uses_passphrase=true when passphrase provided, got %v", wallet["uses_passphrase"])
	}
}

func TestCreateWallet_WithoutReturnMnemonic_NoMnemonicInResponse(t *testing.T) {
	tempDir := t.TempDir()

	cmd := exec.Command("./arcsign", "create")
	cmd.Env = []string{
		"ARCSIGN_MODE=dashboard",
		"WALLET_PASSWORD=TestPassword123!",
		"USB_PATH=" + tempDir,
		"MNEMONIC_LENGTH=24",
		// RETURN_MNEMONIC not set (default false)
	}

	output, err := cmd.Output()
	if err != nil {
		t.Fatalf("CLI create command failed: %v", err)
	}

	var response map[string]interface{}
	if err := json.Unmarshal(output, &response); err != nil {
		t.Fatalf("Failed to parse JSON output: %v", err)
	}

	// Validate mnemonic field does NOT exist when RETURN_MNEMONIC=false
	if _, exists := response["mnemonic"]; exists {
		t.Error("mnemonic field should not be present when RETURN_MNEMONIC is false")
	}
}
