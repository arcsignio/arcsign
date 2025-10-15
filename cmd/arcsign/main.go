package main

import (
	"bufio"
	"fmt"
	"os"
	"strconv"
	"strings"
	"syscall"

	"github.com/yourusername/arcsign/internal/services/address"
	"github.com/yourusername/arcsign/internal/services/bip39service"
	"github.com/yourusername/arcsign/internal/services/hdkey"
	"github.com/yourusername/arcsign/internal/services/storage"
	"github.com/yourusername/arcsign/internal/services/wallet"
	"golang.org/x/term"
)

const (
	Version = "0.1.0"
)

func main() {
	if len(os.Args) < 2 {
		printUsage()
		os.Exit(1)
	}

	command := os.Args[1]

	switch command {
	case "create":
		handleCreateWallet()
	case "restore":
		handleRestoreWallet()
	case "derive":
		handleDeriveAddress()
	case "version":
		fmt.Printf("ArcSign v%s\n", Version)
	case "help", "--help", "-h":
		printUsage()
	default:
		fmt.Printf("Unknown command: %s\n\n", command)
		printUsage()
		os.Exit(1)
	}
}

func printUsage() {
	fmt.Println("ArcSign - Secure HD Wallet with USB-only storage")
	fmt.Println()
	fmt.Println("Usage:")
	fmt.Println("  arcsign create       Create a new wallet")
	fmt.Println("  arcsign restore      Restore an existing wallet")
	fmt.Println("  arcsign derive       Derive cryptocurrency addresses")
	fmt.Println("  arcsign version      Show version information")
	fmt.Println("  arcsign help         Show this help message")
	fmt.Println()
	fmt.Println("For more information, visit: https://github.com/yourusername/arcsign")
}

func handleCreateWallet() {
	fmt.Println("=== ArcSign Wallet Creation ===")
	fmt.Println()

	// Step 1: Detect USB device
	fmt.Println("Step 1: Detecting USB storage...")
	devices, err := storage.DetectUSBDevices()
	if err != nil || len(devices) == 0 {
		fmt.Println("❌ Error: No USB storage device found")
		fmt.Println("Please insert a USB drive and try again.")
		os.Exit(1)
	}

	// Use first USB device
	usbPath := devices[0]
	fmt.Printf("✓ USB device detected: %s\n\n", usbPath)

	// Check available space
	availableSpace, err := storage.GetAvailableSpace(usbPath)
	if err != nil {
		fmt.Printf("❌ Error checking USB space: %v\n", err)
		os.Exit(1)
	}

	// Require at least 10 MB
	const minSpaceRequired = 10 * 1024 * 1024
	if availableSpace < minSpaceRequired {
		fmt.Printf("❌ Error: Insufficient USB space (need 10 MB, have %.2f MB)\n", float64(availableSpace)/(1024*1024))
		os.Exit(1)
	}

	fmt.Printf("✓ Available space: %.2f MB\n\n", float64(availableSpace)/(1024*1024))

	// Step 2: Get wallet name
	reader := bufio.NewReader(os.Stdin)
	fmt.Print("Step 2: Enter wallet name (optional, press Enter to skip): ")
	walletName, _ := reader.ReadString('\n')
	walletName = strings.TrimSpace(walletName)

	// Step 3: Choose mnemonic word count
	fmt.Println()
	fmt.Println("Step 3: Choose mnemonic length:")
	fmt.Println("  1) 12 words (recommended for most users)")
	fmt.Println("  2) 24 words (maximum security)")
	fmt.Print("Enter choice (1 or 2): ")

	choiceStr, _ := reader.ReadString('\n')
	choiceStr = strings.TrimSpace(choiceStr)

	wordCount := 12
	if choiceStr == "2" {
		wordCount = 24
	} else if choiceStr != "1" {
		fmt.Println("Invalid choice, using 12 words (default)")
	}

	// Step 4: Ask about BIP39 passphrase
	fmt.Println()
	fmt.Println("Step 4: BIP39 passphrase (advanced)")
	fmt.Println("A BIP39 passphrase adds an extra layer of security.")
	fmt.Println("⚠️  Warning: If you forget the passphrase, you cannot recover your wallet!")
	fmt.Print("Use BIP39 passphrase? (y/N): ")

	passphraseChoice, _ := reader.ReadString('\n')
	passphraseChoice = strings.ToLower(strings.TrimSpace(passphraseChoice))

	usesPassphrase := false
	bip39Passphrase := ""

	if passphraseChoice == "y" || passphraseChoice == "yes" {
		usesPassphrase = true
		fmt.Print("Enter BIP39 passphrase: ")
		bip39Passphrase, _ = reader.ReadString('\n')
		bip39Passphrase = strings.TrimSpace(bip39Passphrase)
	}

	// Step 5: Get encryption password
	fmt.Println()
	fmt.Println("Step 5: Set encryption password")
	fmt.Println("Requirements:")
	fmt.Println("  - At least 12 characters")
	fmt.Println("  - At least 3 of: uppercase, lowercase, numbers, special characters")
	fmt.Println()

	var password string
	for {
		fmt.Print("Enter password: ")
		passwordBytes, err := term.ReadPassword(int(syscall.Stdin))
		if err != nil {
			fmt.Printf("\n❌ Error reading password: %v\n", err)
			os.Exit(1)
		}
		fmt.Println()

		fmt.Print("Confirm password: ")
		confirmBytes, err := term.ReadPassword(int(syscall.Stdin))
		if err != nil {
			fmt.Printf("\n❌ Error reading password: %v\n", err)
			os.Exit(1)
		}
		fmt.Println()

		if string(passwordBytes) != string(confirmBytes) {
			fmt.Println("❌ Passwords don't match. Please try again.")
			fmt.Println()
			continue
		}

		password = string(passwordBytes)
		break
	}

	// Step 6: Create wallet
	fmt.Println()
	fmt.Println("Step 6: Creating wallet...")
	fmt.Println("(This may take a few seconds due to encryption)")

	walletService := wallet.NewWalletService(usbPath)
	walletData, mnemonic, err := walletService.CreateWallet(walletName, password, wordCount, usesPassphrase, bip39Passphrase)
	if err != nil {
		fmt.Printf("❌ Error creating wallet: %v\n", err)
		os.Exit(1)
	}

	// Step 7: Display mnemonic (CRITICAL)
	fmt.Println()
	fmt.Println("✓ Wallet created successfully!")
	fmt.Println()
	fmt.Println("═══════════════════════════════════════════════════════════")
	fmt.Println("                  ⚠️  BACKUP YOUR MNEMONIC  ⚠️")
	fmt.Println("═══════════════════════════════════════════════════════════")
	fmt.Println()
	fmt.Println("Write down these words in order and store them safely:")
	fmt.Println()
	fmt.Printf("  %s\n", mnemonic)
	fmt.Println()
	fmt.Println("═══════════════════════════════════════════════════════════")
	fmt.Println()
	fmt.Println("⚠️  IMPORTANT:")
	fmt.Println("  - Anyone with this mnemonic can access your wallet")
	fmt.Println("  - Store it in a secure, offline location")
	fmt.Println("  - Never share it with anyone")
	fmt.Println("  - Never store it digitally (no photos, no text files)")
	fmt.Println()
	fmt.Println("═══════════════════════════════════════════════════════════")
	fmt.Println()

	// Wait for user confirmation
	fmt.Print("Press Enter after you have safely backed up your mnemonic...")
	reader.ReadString('\n')

	// Step 8: Summary
	fmt.Println()
	fmt.Println("✓ Setup complete!")
	fmt.Println()
	fmt.Println("Wallet Information:")
	fmt.Printf("  ID: %s\n", walletData.ID)
	if walletData.Name != "" {
		fmt.Printf("  Name: %s\n", walletData.Name)
	}
	fmt.Printf("  Created: %s\n", walletData.CreatedAt.Format("2006-01-02 15:04:05"))
	fmt.Printf("  Mnemonic: %d words\n", wordCount)
	if usesPassphrase {
		fmt.Println("  BIP39 Passphrase: Enabled")
	}
	fmt.Printf("  Storage: %s\n", usbPath)
	fmt.Println()
	fmt.Println("Your wallet is now ready to use!")
}

func handleRestoreWallet() {
	fmt.Println("=== ArcSign Wallet Restoration ===")
	fmt.Println()

	// Step 1: Detect USB device
	fmt.Println("Step 1: Detecting USB storage...")
	devices, err := storage.DetectUSBDevices()
	if err != nil || len(devices) == 0 {
		fmt.Println("❌ Error: No USB storage device found")
		fmt.Println("Please insert the USB drive containing your wallet.")
		os.Exit(1)
	}

	usbPath := devices[0]
	fmt.Printf("✓ USB device detected: %s\n\n", usbPath)

	// Step 2: Get wallet ID
	reader := bufio.NewReader(os.Stdin)
	fmt.Print("Step 2: Enter wallet ID: ")
	walletID, _ := reader.ReadString('\n')
	walletID = strings.TrimSpace(walletID)

	if walletID == "" {
		fmt.Println("❌ Error: Wallet ID cannot be empty")
		os.Exit(1)
	}

	// Step 3: Load wallet metadata
	fmt.Println()
	fmt.Println("Step 3: Loading wallet...")
	walletService := wallet.NewWalletService(usbPath)
	walletData, err := walletService.LoadWallet(walletID)
	if err != nil {
		fmt.Printf("❌ Error loading wallet: %v\n", err)
		fmt.Println()
		fmt.Println("Possible reasons:")
		fmt.Println("  - Wallet ID is incorrect")
		fmt.Println("  - Wallet is on a different USB drive")
		fmt.Println("  - Wallet files are corrupted")
		os.Exit(1)
	}

	fmt.Println("✓ Wallet found!")
	fmt.Println()
	fmt.Println("Wallet Information:")
	fmt.Printf("  ID: %s\n", walletData.ID)
	if walletData.Name != "" {
		fmt.Printf("  Name: %s\n", walletData.Name)
	}
	fmt.Printf("  Created: %s\n", walletData.CreatedAt.Format("2006-01-02 15:04:05"))
	fmt.Printf("  Last Accessed: %s\n", walletData.LastAccessedAt.Format("2006-01-02 15:04:05"))
	if walletData.UsesPassphrase {
		fmt.Println("  BIP39 Passphrase: Enabled (you will need it)")
	}
	fmt.Println()

	// Step 4: Get password
	fmt.Println("Step 4: Enter encryption password")
	fmt.Println("⚠️  Warning: You have 3 attempts before rate limiting activates")
	fmt.Println()

	var mnemonic string
	maxAttempts := 3
	for attempt := 1; attempt <= maxAttempts; attempt++ {
		fmt.Printf("Enter password (attempt %d/%d): ", attempt, maxAttempts)
		passwordBytes, err := term.ReadPassword(int(syscall.Stdin))
		if err != nil {
			fmt.Printf("\n❌ Error reading password: %v\n", err)
			os.Exit(1)
		}
		fmt.Println()

		password := string(passwordBytes)

		// Try to restore wallet
		mnemonic, err = walletService.RestoreWallet(walletID, password)
		if err == nil {
			// Success!
			break
		}

		// Check if rate limited
		if strings.Contains(err.Error(), "rate limit") {
			fmt.Println("❌ Rate limit exceeded!")
			fmt.Println("Too many failed attempts. Please wait 1 minute and try again.")
			os.Exit(1)
		}

		// Wrong password
		fmt.Printf("❌ Wrong password (attempt %d/%d failed)\n", attempt, maxAttempts)
		if attempt < maxAttempts {
			fmt.Println("Please try again...")
			fmt.Println()
		}
	}

	if mnemonic == "" {
		fmt.Println()
		fmt.Println("❌ Wallet restoration failed after 3 attempts")
		fmt.Println("Rate limiting is now active. Please wait 1 minute before trying again.")
		os.Exit(1)
	}

	// Step 5: Display mnemonic
	fmt.Println()
	fmt.Println("✓ Wallet restored successfully!")
	fmt.Println()
	fmt.Println("═══════════════════════════════════════════════════════════")
	fmt.Println("                    YOUR RECOVERY PHRASE")
	fmt.Println("═══════════════════════════════════════════════════════════")
	fmt.Println()
	fmt.Printf("  %s\n", mnemonic)
	fmt.Println()
	fmt.Println("═══════════════════════════════════════════════════════════")
	fmt.Println()

	if walletData.UsesPassphrase {
		fmt.Println("⚠️  REMINDER: This wallet uses a BIP39 passphrase")
		fmt.Println("You need BOTH the mnemonic phrase above AND your BIP39 passphrase")
		fmt.Println("to fully restore this wallet.")
		fmt.Println()
	}

	fmt.Print("Press Enter to continue...")
	reader.ReadString('\n')

	fmt.Println()
	fmt.Println("✓ Restoration complete!")
	fmt.Println()
	fmt.Println("You can now use your mnemonic phrase to:")
	fmt.Println("  - Restore your wallet in another device")
	fmt.Println("  - Derive cryptocurrency addresses")
	fmt.Println("  - Access your funds")
	fmt.Println()
	fmt.Println("Remember to keep your mnemonic phrase secure!")
}

func handleDeriveAddress() {
	fmt.Println("=== ArcSign Address Derivation ===")
	fmt.Println()

	// Step 1: Detect USB device
	fmt.Println("Step 1: Detecting USB storage...")
	devices, err := storage.DetectUSBDevices()
	if err != nil || len(devices) == 0 {
		fmt.Println("❌ Error: No USB storage device found")
		fmt.Println("Please insert the USB drive containing your wallet.")
		os.Exit(1)
	}

	usbPath := devices[0]
	fmt.Printf("✓ USB device detected: %s\n\n", usbPath)

	// Step 2: Get wallet ID
	reader := bufio.NewReader(os.Stdin)
	fmt.Print("Step 2: Enter wallet ID: ")
	walletID, _ := reader.ReadString('\n')
	walletID = strings.TrimSpace(walletID)

	if walletID == "" {
		fmt.Println("❌ Error: Wallet ID cannot be empty")
		os.Exit(1)
	}

	// Step 3: Load wallet metadata
	fmt.Println()
	fmt.Println("Step 3: Loading wallet...")
	walletService := wallet.NewWalletService(usbPath)
	walletData, err := walletService.LoadWallet(walletID)
	if err != nil {
		fmt.Printf("❌ Error loading wallet: %v\n", err)
		fmt.Println()
		fmt.Println("Possible reasons:")
		fmt.Println("  - Wallet ID is incorrect")
		fmt.Println("  - Wallet is on a different USB drive")
		fmt.Println("  - Wallet files are corrupted")
		os.Exit(1)
	}

	fmt.Println("✓ Wallet found!")
	fmt.Println()
	fmt.Println("Wallet Information:")
	fmt.Printf("  ID: %s\n", walletData.ID)
	if walletData.Name != "" {
		fmt.Printf("  Name: %s\n", walletData.Name)
	}
	fmt.Println()

	// Step 4: Get password and restore mnemonic
	fmt.Println("Step 4: Enter encryption password to unlock wallet")
	fmt.Println("⚠️  Warning: You have 3 attempts before rate limiting activates")
	fmt.Println()

	var mnemonic string
	var bip39Passphrase string
	maxAttempts := 3
	for attempt := 1; attempt <= maxAttempts; attempt++ {
		fmt.Printf("Enter password (attempt %d/%d): ", attempt, maxAttempts)
		passwordBytes, err := term.ReadPassword(int(syscall.Stdin))
		if err != nil {
			fmt.Printf("\n❌ Error reading password: %v\n", err)
			os.Exit(1)
		}
		fmt.Println()

		password := string(passwordBytes)

		// Try to restore wallet
		mnemonic, err = walletService.RestoreWallet(walletID, password)
		if err == nil {
			// Success!
			break
		}

		// Check if rate limited
		if strings.Contains(err.Error(), "rate limit") {
			fmt.Println("❌ Rate limit exceeded!")
			fmt.Println("Too many failed attempts. Please wait 1 minute and try again.")
			os.Exit(1)
		}

		// Wrong password
		fmt.Printf("❌ Wrong password (attempt %d/%d failed)\n", attempt, maxAttempts)
		if attempt < maxAttempts {
			fmt.Println("Please try again...")
			fmt.Println()
		}
	}

	if mnemonic == "" {
		fmt.Println()
		fmt.Println("❌ Wallet unlock failed after 3 attempts")
		fmt.Println("Rate limiting is now active. Please wait 1 minute before trying again.")
		os.Exit(1)
	}

	// Get BIP39 passphrase if wallet uses one
	if walletData.UsesPassphrase {
		fmt.Println()
		fmt.Println("⚠️  This wallet uses a BIP39 passphrase")
		fmt.Print("Enter BIP39 passphrase: ")
		bip39Passphrase, _ = reader.ReadString('\n')
		bip39Passphrase = strings.TrimSpace(bip39Passphrase)
	}

	fmt.Println()
	fmt.Println("✓ Wallet unlocked successfully!")
	fmt.Println()

	// Step 5: Select cryptocurrency
	fmt.Println("Step 5: Select cryptocurrency")
	fmt.Println("  1) Bitcoin (BTC)")
	fmt.Println("  2) Ethereum (ETH)")
	fmt.Print("Enter choice (1 or 2): ")

	coinChoice, _ := reader.ReadString('\n')
	coinChoice = strings.TrimSpace(coinChoice)

	var coinType uint32
	var coinName string
	switch coinChoice {
	case "1":
		coinType = 0 // Bitcoin
		coinName = "Bitcoin"
	case "2":
		coinType = 60 // Ethereum
		coinName = "Ethereum"
	default:
		fmt.Println("❌ Invalid choice. Please select 1 or 2.")
		os.Exit(1)
	}

	// Step 6: Get account index
	fmt.Println()
	fmt.Println("Step 6: Enter account index")
	fmt.Println("(Most users should use 0 for the first account)")
	fmt.Print("Account index (default 0): ")

	accountInput, _ := reader.ReadString('\n')
	accountInput = strings.TrimSpace(accountInput)

	accountIndex := uint32(0)
	if accountInput != "" {
		parsed, err := strconv.ParseUint(accountInput, 10, 32)
		if err != nil {
			fmt.Println("❌ Invalid account index. Please enter a number.")
			os.Exit(1)
		}
		accountIndex = uint32(parsed)
	}

	// Step 7: Get address index
	fmt.Println()
	fmt.Println("Step 7: Enter address index")
	fmt.Println("(Use 0 for the first address, 1 for the second, etc.)")
	fmt.Print("Address index (default 0): ")

	addressInput, _ := reader.ReadString('\n')
	addressInput = strings.TrimSpace(addressInput)

	addressIndex := uint32(0)
	if addressInput != "" {
		parsed, err := strconv.ParseUint(addressInput, 10, 32)
		if err != nil {
			fmt.Println("❌ Invalid address index. Please enter a number.")
			os.Exit(1)
		}
		addressIndex = uint32(parsed)
	}

	// Step 8: Derive address
	fmt.Println()
	fmt.Println("Step 8: Deriving address...")
	fmt.Println("(This may take a moment)")

	// Create BIP39 seed from mnemonic
	bip39Service := bip39service.NewBIP39Service()
	seed, err := bip39Service.MnemonicToSeed(mnemonic, bip39Passphrase)
	if err != nil {
		fmt.Printf("❌ Error generating seed: %v\n", err)
		os.Exit(1)
	}

	// Create master key
	hdkeyService := hdkey.NewHDKeyService()
	masterKey, err := hdkeyService.NewMasterKey(seed)
	if err != nil {
		fmt.Printf("❌ Error creating master key: %v\n", err)
		os.Exit(1)
	}

	// Build BIP44 path: m/44'/coin_type'/account'/0/address_index
	// 0 = external chain (receiving addresses)
	path := fmt.Sprintf("m/44'/%d'/%d'/0/%d", coinType, accountIndex, addressIndex)

	// Derive key at path
	derivedKey, err := hdkeyService.DerivePath(masterKey, path)
	if err != nil {
		fmt.Printf("❌ Error deriving key: %v\n", err)
		os.Exit(1)
	}

	// Generate address
	addressService := address.NewAddressService()
	var derivedAddress string

	switch coinName {
	case "Bitcoin":
		derivedAddress, err = addressService.DeriveBitcoinAddress(derivedKey)
		if err != nil {
			fmt.Printf("❌ Error generating Bitcoin address: %v\n", err)
			os.Exit(1)
		}
	case "Ethereum":
		derivedAddress, err = addressService.DeriveEthereumAddress(derivedKey)
		if err != nil {
			fmt.Printf("❌ Error generating Ethereum address: %v\n", err)
			os.Exit(1)
		}
	}

	// Step 9: Display result
	fmt.Println()
	fmt.Println("✓ Address derived successfully!")
	fmt.Println()
	fmt.Println("═══════════════════════════════════════════════════════════")
	fmt.Printf("                    %s ADDRESS\n", strings.ToUpper(coinName))
	fmt.Println("═══════════════════════════════════════════════════════════")
	fmt.Println()
	fmt.Printf("  Address: %s\n", derivedAddress)
	fmt.Println()
	fmt.Printf("  Derivation Path: %s\n", path)
	fmt.Printf("  Coin: %s\n", coinName)
	fmt.Printf("  Account: %d\n", accountIndex)
	fmt.Printf("  Index: %d\n", addressIndex)
	fmt.Println()
	fmt.Println("═══════════════════════════════════════════════════════════")
	fmt.Println()
	fmt.Println("You can use this address to receive funds.")
	fmt.Println()
}
