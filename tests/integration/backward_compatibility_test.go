package integration

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/yourusername/arcsign/internal/models"
	"github.com/yourusername/arcsign/internal/services/wallet"
)

// T106: Backward compatibility tests for v0.1.0 wallets (without AddressBook)

// TestLoadV010Wallet verifies that wallets created with v0.1.0 (without AddressBook)
// can still be loaded and used in v0.2.0+
func TestLoadV010Wallet(t *testing.T) {
	// Create temporary directory for test wallet
	tmpDir := t.TempDir()
	walletID := "test-wallet-v010"
	walletDir := filepath.Join(tmpDir, walletID)

	if err := os.MkdirAll(walletDir, 0700); err != nil {
		t.Fatalf("Failed to create wallet directory: %v", err)
	}

	// Create v0.1.0-style wallet.json (no addressBook field)
	v010Wallet := map[string]interface{}{
		"id":                    walletID,
		"name":                  "Test Wallet v0.1.0",
		"createdAt":             time.Now().Format(time.RFC3339),
		"lastAccessedAt":        time.Now().Format(time.RFC3339),
		"encryptedMnemonicPath": filepath.Join(walletDir, "mnemonic.enc"),
		"usesPassphrase":        false,
		// NOTE: No "addressBook" field - this is v0.1.0 format
	}

	metadataPath := filepath.Join(walletDir, "wallet.json")
	metadataJSON, err := json.MarshalIndent(v010Wallet, "", "  ")
	if err != nil {
		t.Fatalf("Failed to marshal v0.1.0 wallet: %v", err)
	}

	if err := os.WriteFile(metadataPath, metadataJSON, 0600); err != nil {
		t.Fatalf("Failed to write v0.1.0 wallet.json: %v", err)
	}

	// Test 1: Load v0.1.0 wallet using WalletService
	walletService := wallet.NewWalletService(tmpDir)
	loadedWallet, err := walletService.LoadWallet(walletID)
	if err != nil {
		t.Fatalf("Failed to load v0.1.0 wallet: %v", err)
	}

	// Test 2: Verify wallet data is correct
	if loadedWallet.ID != walletID {
		t.Errorf("Expected wallet ID %s, got %s", walletID, loadedWallet.ID)
	}

	if loadedWallet.Name != "Test Wallet v0.1.0" {
		t.Errorf("Expected wallet name 'Test Wallet v0.1.0', got %s", loadedWallet.Name)
	}

	// Test 3: Verify AddressBook is nil (not initialized)
	if loadedWallet.AddressBook != nil {
		t.Errorf("Expected AddressBook to be nil for v0.1.0 wallet, got %+v", loadedWallet.AddressBook)
	}

	t.Log("✓ v0.1.0 wallet loaded successfully")
	t.Log("✓ AddressBook is nil as expected")
}

// TestV010WalletJSONOmitsAddressBook verifies that when marshaling a wallet
// with nil AddressBook, the "addressBook" field is omitted from JSON (due to omitempty tag)
func TestV010WalletJSONOmitsAddressBook(t *testing.T) {
	// Create wallet with nil AddressBook (v0.1.0 style)
	v010Wallet := &models.Wallet{
		ID:                    "test-wallet-omit",
		Name:                  "Test Wallet",
		CreatedAt:             time.Now(),
		LastAccessedAt:        time.Now(),
		EncryptedMnemonicPath: "/tmp/test.enc",
		UsesPassphrase:        false,
		AddressBook:           nil, // v0.1.0: AddressBook is nil
	}

	// Marshal to JSON
	jsonData, err := json.Marshal(v010Wallet)
	if err != nil {
		t.Fatalf("Failed to marshal wallet: %v", err)
	}

	// Parse JSON back to map to check fields
	var jsonMap map[string]interface{}
	if err := json.Unmarshal(jsonData, &jsonMap); err != nil {
		t.Fatalf("Failed to unmarshal JSON: %v", err)
	}

	// Test: Verify "addressBook" field is NOT present in JSON
	if _, exists := jsonMap["addressBook"]; exists {
		t.Errorf("Expected 'addressBook' field to be omitted when nil, but it was present: %+v", jsonMap)
	}

	t.Log("✓ nil AddressBook correctly omitted from JSON due to omitempty tag")
}

// TestV020WalletWithAddressBook verifies that v0.2.0 wallets with AddressBook
// serialize and deserialize correctly
func TestV020WalletWithAddressBook(t *testing.T) {
	// Create wallet with AddressBook (v0.2.0 style)
	v020Wallet := &models.Wallet{
		ID:                    "test-wallet-v020",
		Name:                  "Test Wallet v0.2.0",
		CreatedAt:             time.Now(),
		LastAccessedAt:        time.Now(),
		EncryptedMnemonicPath: "/tmp/test.enc",
		UsesPassphrase:        false,
		AddressBook: &models.AddressBook{
			Addresses: []models.DerivedAddress{
				{
					Symbol:         "BTC",
					CoinName:       "Bitcoin",
					CoinType:       0,
					Address:        "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
					DerivationPath: "m/44'/0'/0'/0/0",
					MarketCapRank:  1,
				},
				{
					Symbol:         "ETH",
					CoinName:       "Ethereum",
					CoinType:       60,
					Address:        "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
					DerivationPath: "m/44'/60'/0'/0/0",
					MarketCapRank:  2,
				},
			},
		},
	}

	// Marshal to JSON
	jsonData, err := json.Marshal(v020Wallet)
	if err != nil {
		t.Fatalf("Failed to marshal v0.2.0 wallet: %v", err)
	}

	// Parse JSON to verify addressBook is present
	var jsonMap map[string]interface{}
	if err := json.Unmarshal(jsonData, &jsonMap); err != nil {
		t.Fatalf("Failed to unmarshal JSON: %v", err)
	}

	// Test 1: Verify "addressBook" field exists
	addressBookData, exists := jsonMap["addressBook"]
	if !exists {
		t.Errorf("Expected 'addressBook' field to be present in v0.2.0 wallet JSON")
	}

	// Test 2: Verify addressBook contains addresses
	addressBook, ok := addressBookData.(map[string]interface{})
	if !ok {
		t.Fatalf("addressBook is not a map: %T", addressBookData)
	}

	addresses, ok := addressBook["addresses"].([]interface{})
	if !ok {
		t.Fatalf("addresses is not an array: %T", addressBook["addresses"])
	}

	if len(addresses) != 2 {
		t.Errorf("Expected 2 addresses, got %d", len(addresses))
	}

	// Test 3: Deserialize back to Wallet struct
	var deserializedWallet models.Wallet
	if err := json.Unmarshal(jsonData, &deserializedWallet); err != nil {
		t.Fatalf("Failed to deserialize v0.2.0 wallet: %v", err)
	}

	// Test 4: Verify AddressBook is correctly deserialized
	if deserializedWallet.AddressBook == nil {
		t.Fatalf("AddressBook should not be nil after deserialization")
	}

	if len(deserializedWallet.AddressBook.Addresses) != 2 {
		t.Errorf("Expected 2 addresses after deserialization, got %d", len(deserializedWallet.AddressBook.Addresses))
	}

	// Test 5: Verify address data
	btcAddr := deserializedWallet.AddressBook.Addresses[0]
	if btcAddr.Symbol != "BTC" {
		t.Errorf("Expected first address symbol to be BTC, got %s", btcAddr.Symbol)
	}
	if btcAddr.Address != "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa" {
		t.Errorf("BTC address mismatch")
	}

	t.Log("✓ v0.2.0 wallet with AddressBook serialized correctly")
	t.Log("✓ AddressBook correctly included in JSON")
	t.Log("✓ Deserialization preserved all address data")
}

// TestMixedWalletVersions verifies that both v0.1.0 and v0.2.0 wallets
// can coexist in the same storage directory
func TestMixedWalletVersions(t *testing.T) {
	tmpDir := t.TempDir()

	// Create v0.1.0 wallet (no AddressBook)
	v010WalletID := "wallet-v010"
	v010Dir := filepath.Join(tmpDir, v010WalletID)
	if err := os.MkdirAll(v010Dir, 0700); err != nil {
		t.Fatalf("Failed to create v0.1.0 wallet directory: %v", err)
	}

	v010Wallet := &models.Wallet{
		ID:                    v010WalletID,
		Name:                  "Old Wallet",
		CreatedAt:             time.Now(),
		LastAccessedAt:        time.Now(),
		EncryptedMnemonicPath: filepath.Join(v010Dir, "mnemonic.enc"),
		UsesPassphrase:        false,
		AddressBook:           nil, // v0.1.0: no AddressBook
	}

	v010JSON, _ := json.MarshalIndent(v010Wallet, "", "  ")
	os.WriteFile(filepath.Join(v010Dir, "wallet.json"), v010JSON, 0600)

	// Create v0.2.0 wallet (with AddressBook)
	v020WalletID := "wallet-v020"
	v020Dir := filepath.Join(tmpDir, v020WalletID)
	if err := os.MkdirAll(v020Dir, 0700); err != nil {
		t.Fatalf("Failed to create v0.2.0 wallet directory: %v", err)
	}

	v020Wallet := &models.Wallet{
		ID:                    v020WalletID,
		Name:                  "New Wallet",
		CreatedAt:             time.Now(),
		LastAccessedAt:        time.Now(),
		EncryptedMnemonicPath: filepath.Join(v020Dir, "mnemonic.enc"),
		UsesPassphrase:        false,
		AddressBook: &models.AddressBook{
			Addresses: []models.DerivedAddress{
				{
					Symbol:         "BTC",
					CoinName:       "Bitcoin",
					CoinType:       0,
					Address:        "1BTC...",
					DerivationPath: "m/44'/0'/0'/0/0",
					MarketCapRank:  1,
				},
			},
		},
	}

	v020JSON, _ := json.MarshalIndent(v020Wallet, "", "  ")
	os.WriteFile(filepath.Join(v020Dir, "wallet.json"), v020JSON, 0600)

	// Load both wallets using WalletService
	walletService := wallet.NewWalletService(tmpDir)

	// Load v0.1.0 wallet
	loaded010, err := walletService.LoadWallet(v010WalletID)
	if err != nil {
		t.Fatalf("Failed to load v0.1.0 wallet: %v", err)
	}

	if loaded010.AddressBook != nil {
		t.Errorf("v0.1.0 wallet should have nil AddressBook")
	}

	// Load v0.2.0 wallet
	loaded020, err := walletService.LoadWallet(v020WalletID)
	if err != nil {
		t.Fatalf("Failed to load v0.2.0 wallet: %v", err)
	}

	if loaded020.AddressBook == nil {
		t.Errorf("v0.2.0 wallet should have non-nil AddressBook")
	}

	if len(loaded020.AddressBook.Addresses) != 1 {
		t.Errorf("Expected 1 address in v0.2.0 wallet, got %d", len(loaded020.AddressBook.Addresses))
	}

	t.Log("✓ Both v0.1.0 and v0.2.0 wallets loaded successfully")
	t.Log("✓ v0.1.0 wallet has nil AddressBook")
	t.Log("✓ v0.2.0 wallet has populated AddressBook")
}
