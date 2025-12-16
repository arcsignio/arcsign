package main

import (
	"fmt"
	"log"
	"strings"

	"github.com/btcsuite/btcd/btcutil/hdkeychain"
	"github.com/btcsuite/btcd/chaincfg"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/tyler-smith/go-bip39"
)

func main() {
	// ========================================
	// 在這裡填寫你的助記詞
	// ========================================
	mnemonic := "charge asthma excess rule dizzy resist sheriff fringe found gun candy excess"
	passphrase := "" // 通常為空字串,除非你設定了密碼片語
	// ========================================
	
	// 清理助記詞(去除前後空格)
	mnemonic = strings.TrimSpace(mnemonic)

	fmt.Println("=========================================")
	fmt.Println("    Ethereum Address Derivation Test")
	fmt.Println("=========================================")
	fmt.Println()
	
	// Display mnemonic info
	words := strings.Fields(mnemonic)
	fmt.Printf("Mnemonic word count: %d\n", len(words))
	fmt.Printf("Mnemonic: %s\n", mnemonic)
	fmt.Printf("Passphrase: '%s'\n\n", passphrase)

	// Validate mnemonic
	if !bip39.IsMnemonicValid(mnemonic) {
		log.Fatal("❌ Invalid mnemonic phrase")
	}
	fmt.Println("✓ Mnemonic is valid")

	// Generate seed
	seed := bip39.NewSeed(mnemonic, passphrase)
	fmt.Printf("✓ Seed generated (%d bytes)\n", len(seed))
	fmt.Printf("  Seed (first 32 bytes): %x...\n\n", seed[:32])

	// Create master key
	masterKey, err := hdkeychain.NewMaster(seed, &chaincfg.MainNetParams)
	if err != nil {
		log.Fatal("❌ Failed to create master key:", err)
	}
	fmt.Println("✓ Master key created")

	// Derivation path: m/44'/60'/0'/0/0
	path := "m/44'/60'/0'/0/0"
	fmt.Printf("\nDerivation Path: %s\n", path)
	fmt.Println("\n=== Step-by-step Derivation ===")

	// m/44'
	key1, err := masterKey.Derive(hdkeychain.HardenedKeyStart + 44)
	if err != nil {
		log.Fatal("❌ Failed at m/44':", err)
	}
	fmt.Println("✓ m/44' (purpose)")

	// m/44'/60'
	key2, err := key1.Derive(hdkeychain.HardenedKeyStart + 60)
	if err != nil {
		log.Fatal("❌ Failed at m/44'/60':", err)
	}
	fmt.Println("✓ m/44'/60' (coin type: Ethereum)")

	// m/44'/60'/0'
	key3, err := key2.Derive(hdkeychain.HardenedKeyStart + 0)
	if err != nil {
		log.Fatal("❌ Failed at m/44'/60'/0':", err)
	}
	fmt.Println("✓ m/44'/60'/0' (account)")

	// m/44'/60'/0'/0
	key4, err := key3.Derive(0)
	if err != nil {
		log.Fatal("❌ Failed at m/44'/60'/0'/0:", err)
	}
	fmt.Println("✓ m/44'/60'/0'/0 (external chain)")

	// m/44'/60'/0'/0/0
	finalKey, err := key4.Derive(0)
	if err != nil {
		log.Fatal("❌ Failed at m/44'/60'/0'/0/0:", err)
	}
	fmt.Println("✓ m/44'/60'/0'/0/0 (address index)")

	// Get public key
	pubKey, err := finalKey.ECPubKey()
	if err != nil {
		log.Fatal("❌ Failed to get public key:", err)
	}

	// Get compressed and uncompressed public keys
	compressed := pubKey.SerializeCompressed()
	uncompressed := pubKey.SerializeUncompressed()

	fmt.Println("\n=== Public Keys ===")
	fmt.Printf("Compressed (%d bytes):\n  %x\n", len(compressed), compressed)
	fmt.Printf("\nUncompressed (%d bytes):\n  %x\n", len(uncompressed), uncompressed)

	// Derive Ethereum address
	// Ethereum address = last 20 bytes of Keccak256(uncompressed public key without 0x04 prefix)
	fmt.Println("\n=== Ethereum Address Calculation ===")
	fmt.Printf("1. Take uncompressed public key (without 0x04 prefix):\n   %x\n", uncompressed[1:])

	hash := crypto.Keccak256(uncompressed[1:])
	fmt.Printf("\n2. Apply Keccak256 hash:\n   %x\n", hash)

	addressBytes := hash[len(hash)-20:]
	fmt.Printf("\n3. Take last 20 bytes:\n   %x\n", addressBytes)

	address := fmt.Sprintf("0x%x", addressBytes)

	// Also generate checksummed address
	checksummedAddress := crypto.PubkeyToAddress(*pubKey.ToECDSA())

	fmt.Println("\n=========================================")
	fmt.Println("              RESULTS")
	fmt.Println("=========================================")
	fmt.Printf("\nGenerated Address:\n  %s\n", address)
	fmt.Printf("\nChecksummed Address:\n  %s\n", checksummedAddress.Hex())
	fmt.Printf("\nExpected Address:\n  0x59a3ed049ebf5483E32513b1Cd9557B570f6f5dE\n")

	// Compare
	expectedLower := "0x59a3ed049ebf5483e32513b1cd9557b570f6f5de"
	if address == expectedLower {
		fmt.Println("\n✅ SUCCESS! Address matches expected value!")
	} else {
		fmt.Println("\n❌ MISMATCH! Address does not match expected value.")
		fmt.Println("\nPlease verify:")
		fmt.Println("  1. Mnemonic is correct")
		fmt.Println("  2. Passphrase is empty (or correct if you used one)")
		fmt.Println("  3. Derivation path is m/44'/60'/0'/0/0")
	}

	fmt.Println("\n=========================================")
}