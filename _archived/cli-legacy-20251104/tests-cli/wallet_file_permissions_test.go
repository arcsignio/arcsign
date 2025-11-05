package cli

import (
	"encoding/json"
	"os"
	"os/exec"
	"path/filepath"
	"testing"
)

// T038 [P] [US1] Test for wallet file creation on USB with correct permissions (0600)
// Tests that wallet files are created with secure permissions (owner-only read/write)

func TestWalletFileCreation_CorrectPermissions(t *testing.T) {
	tempDir := t.TempDir()

	cmd := exec.Command("./arcsign", "create")
	cmd.Env = []string{
		"ARCSIGN_MODE=dashboard",
		"WALLET_PASSWORD=PermissionTest123!",
		"USB_PATH=" + tempDir,
		"WALLET_NAME=Permission Test Wallet",
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

	walletID, ok := wallet["id"].(string)
	if !ok || walletID == "" {
		t.Fatal("wallet.id is missing or empty")
	}

	// Check wallet directory permissions (should be 0700 - owner only)
	walletDir := filepath.Join(tempDir, "wallets", walletID)
	dirInfo, err := os.Stat(walletDir)
	if err != nil {
		t.Fatalf("Failed to stat wallet directory: %v", err)
	}

	dirMode := dirInfo.Mode().Perm()
	expectedDirMode := os.FileMode(0700)
	if dirMode != expectedDirMode {
		t.Errorf("Wallet directory permissions incorrect: expected %o, got %o", expectedDirMode, dirMode)
	}

	// Check addresses.json file permissions (should be 0600 - owner read/write only)
	addressesFile, ok := wallet["addresses_file"].(string)
	if !ok || addressesFile == "" {
		t.Fatal("wallet.addresses_file is missing or empty")
	}

	addressesFilePath := filepath.Join(tempDir, addressesFile)
	fileInfo, err := os.Stat(addressesFilePath)
	if err != nil {
		t.Fatalf("Failed to stat addresses.json: %v", err)
	}

	fileMode := fileInfo.Mode().Perm()
	expectedFileMode := os.FileMode(0600)
	if fileMode != expectedFileMode {
		t.Errorf("addresses.json permissions incorrect: expected %o, got %o", expectedFileMode, fileMode)
	}
}

func TestWalletFileCreation_DirectoryStructure(t *testing.T) {
	tempDir := t.TempDir()

	cmd := exec.Command("./arcsign", "create")
	cmd.Env = []string{
		"ARCSIGN_MODE=dashboard",
		"WALLET_PASSWORD=StructureTest123!",
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

	walletID, ok := wallet["id"].(string)
	if !ok || walletID == "" {
		t.Fatal("wallet.id is missing or empty")
	}

	// Verify expected directory structure:
	// {USB_PATH}/
	//   wallets/
	//     {wallet_id}/
	//       addresses.json

	walletsDir := filepath.Join(tempDir, "wallets")
	if _, err := os.Stat(walletsDir); os.IsNotExist(err) {
		t.Errorf("wallets/ directory not created: %s", walletsDir)
	}

	walletDir := filepath.Join(walletsDir, walletID)
	if _, err := os.Stat(walletDir); os.IsNotExist(err) {
		t.Errorf("wallet directory not created: %s", walletDir)
	}

	addressesFilePath := filepath.Join(walletDir, "addresses.json")
	if _, err := os.Stat(addressesFilePath); os.IsNotExist(err) {
		t.Errorf("addresses.json not created: %s", addressesFilePath)
	}

	// Verify addresses_file path in response matches actual file location
	addressesFile, ok := wallet["addresses_file"].(string)
	if !ok || addressesFile == "" {
		t.Fatal("wallet.addresses_file is missing or empty")
	}

	expectedRelPath := filepath.Join("wallets", walletID, "addresses.json")
	if addressesFile != expectedRelPath {
		t.Errorf("addresses_file path mismatch: expected %s, got %s", expectedRelPath, addressesFile)
	}
}

func TestWalletFileCreation_FileOwnership(t *testing.T) {
	tempDir := t.TempDir()

	cmd := exec.Command("./arcsign", "create")
	cmd.Env = []string{
		"ARCSIGN_MODE=dashboard",
		"WALLET_PASSWORD=OwnershipTest123!",
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
	if !ok || addressesFile == "" {
		t.Fatal("wallet.addresses_file is missing or empty")
	}

	addressesFilePath := filepath.Join(tempDir, addressesFile)

	// Verify file is readable by current user
	content, err := os.ReadFile(addressesFilePath)
	if err != nil {
		t.Errorf("Failed to read addresses.json (should be readable by owner): %v", err)
	}

	if len(content) == 0 {
		t.Error("addresses.json is empty (should contain address data)")
	}
}

func TestWalletFileCreation_NoWorldReadableFiles(t *testing.T) {
	tempDir := t.TempDir()

	cmd := exec.Command("./arcsign", "create")
	cmd.Env = []string{
		"ARCSIGN_MODE=dashboard",
		"WALLET_PASSWORD=SecurityTest123!",
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
	if !ok || walletID == "" {
		t.Fatal("wallet.id is missing or empty")
	}

	walletDir := filepath.Join(tempDir, "wallets", walletID)

	// Walk through all files in wallet directory
	err = filepath.Walk(walletDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		mode := info.Mode().Perm()

		// Check no "other" permissions (world-readable/writable)
		if mode&0007 != 0 {
			t.Errorf("File %s has world-accessible permissions: %o", path, mode)
		}

		// Check no "group" permissions (group-readable/writable)
		if mode&0070 != 0 {
			t.Errorf("File %s has group-accessible permissions: %o", path, mode)
		}

		return nil
	})

	if err != nil {
		t.Errorf("Error walking wallet directory: %v", err)
	}
}

func TestWalletFileCreation_AtomicWrite(t *testing.T) {
	tempDir := t.TempDir()

	cmd := exec.Command("./arcsign", "create")
	cmd.Env = []string{
		"ARCSIGN_MODE=dashboard",
		"WALLET_PASSWORD=AtomicTest123!",
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
	if !ok || addressesFile == "" {
		t.Fatal("wallet.addresses_file is missing or empty")
	}

	addressesFilePath := filepath.Join(tempDir, addressesFile)

	// Verify no temporary files left behind (e.g., .tmp, .bak, ~)
	dir := filepath.Dir(addressesFilePath)
	entries, err := os.ReadDir(dir)
	if err != nil {
		t.Fatalf("Failed to read wallet directory: %v", err)
	}

	for _, entry := range entries {
		name := entry.Name()
		// Check for common temporary file patterns
		if filepath.Ext(name) == ".tmp" || filepath.Ext(name) == ".bak" || name[0] == '~' {
			t.Errorf("Temporary file found (should be cleaned up): %s", name)
		}
	}

	// Verify addresses.json is complete and valid JSON
	content, err := os.ReadFile(addressesFilePath)
	if err != nil {
		t.Fatalf("Failed to read addresses.json: %v", err)
	}

	var addressesData map[string]interface{}
	if err := json.Unmarshal(content, &addressesData); err != nil {
		t.Errorf("addresses.json contains invalid JSON (atomic write may have failed): %v", err)
	}
}
