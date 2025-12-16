package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"github.com/yourusername/arcsign/internal/services/wallet"
)

func main() {
	// 測試參數
	mnemonic := "charge asthma excess rule dizzy resist sheriff fringe found gun candy excess"
	password := "TestPassword123!"
	passphrase := "" // BIP39 passphrase
	walletName := "Test Import Wallet"
	testUSBPath := "/tmp/test_import_wallet"

	fmt.Println("=========================================")
	fmt.Println("   Import Wallet Function Test")
	fmt.Println("=========================================")
	fmt.Println()
	fmt.Printf("Mnemonic: %s\n", mnemonic)
	fmt.Printf("Passphrase: '%s'\n", passphrase)
	fmt.Printf("Test USB Path: %s\n\n", testUSBPath)

	// 清理舊測試目錄
	os.RemoveAll(testUSBPath)
	
	// 創建測試目錄
	if err := os.MkdirAll(testUSBPath, 0700); err != nil {
		fmt.Printf("❌ Failed to create test directory: %v\n", err)
		os.Exit(1)
	}
	defer os.RemoveAll(testUSBPath) // 測試完清理

	fmt.Println("✓ Test directory created")

	// 創建 wallet service
	svc := wallet.NewWalletService(testUSBPath)

	// 測試 ImportWalletFromMnemonic
	fmt.Println("\n=== Testing ImportWalletFromMnemonic ===")
	walletObj, err := svc.ImportWalletFromMnemonic(
		walletName,
		mnemonic,
		password,
		passphrase != "",
		passphrase,
	)

	if err != nil {
		fmt.Printf("❌ ImportWalletFromMnemonic failed: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("✓ Wallet imported successfully\n")
	fmt.Printf("  Wallet ID: %s\n", walletObj.ID)
	fmt.Printf("  Wallet Name: %s\n", walletObj.Name)

	// 檢查生成的地址
	fmt.Println("\n=== Checking Generated Addresses ===")
	
	if walletObj.AddressBook == nil {
		fmt.Println("❌ AddressBook is nil!")
		os.Exit(1)
	}

	fmt.Printf("✓ AddressBook exists with %d addresses\n\n", len(walletObj.AddressBook.Addresses))

	// 找出 Ethereum 地址
	var ethAddress string
	for _, addr := range walletObj.AddressBook.Addresses {
		if addr.Symbol == "ETH" {
			ethAddress = addr.Address
			fmt.Printf("Found ETH address:\n")
			fmt.Printf("  Symbol: %s\n", addr.Symbol)
			fmt.Printf("  Coin Name: %s\n", addr.CoinName)
			fmt.Printf("  Coin Type: %d\n", addr.CoinType)
			fmt.Printf("  Address: %s\n", addr.Address)
			fmt.Printf("  Derivation Path: %s\n", addr.DerivationPath)
			break
		}
	}

	if ethAddress == "" {
		fmt.Println("❌ ETH address not found in AddressBook!")
		os.Exit(1)
	}

	// 驗證地址是否正確
	expectedAddress := "0x59a3ed049ebf5483e32513b1cd9557b570f6f5de"
	
	fmt.Println("\n=== Address Verification ===")
	fmt.Printf("Generated:  %s\n", ethAddress)
	fmt.Printf("Expected:   %s\n", expectedAddress)

	if ethAddress == expectedAddress {
		fmt.Println("\n✅ SUCCESS! Address matches expected value!")
	} else {
		fmt.Println("\n❌ MISMATCH! Address does not match!")
		
		// 檢查 wallet.json 檔案內容
		walletJSONPath := filepath.Join(testUSBPath, walletObj.ID, "wallet.json")
		data, err := os.ReadFile(walletJSONPath)
		if err != nil {
			fmt.Printf("Failed to read wallet.json: %v\n", err)
		} else {
			fmt.Println("\n=== wallet.json content ===")
			var prettyJSON map[string]interface{}
			json.Unmarshal(data, &prettyJSON)
			prettyData, _ := json.MarshalIndent(prettyJSON, "", "  ")
			fmt.Println(string(prettyData))
		}
		
		os.Exit(1)
	}

	fmt.Println("\n=== Test Summary ===")
	fmt.Println("✓ ImportWalletFromMnemonic works correctly")
	fmt.Println("✓ Address derivation is correct")
	fmt.Println("✓ AddressBook is properly populated")
	fmt.Println("\n=========================================")
}
