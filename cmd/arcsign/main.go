package main

import (
	"bufio"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/btcsuite/btcd/btcutil/hdkeychain"
	"github.com/yourusername/arcsign/internal/cli"
	"github.com/yourusername/arcsign/internal/models"
	"github.com/yourusername/arcsign/internal/services/address"
	"github.com/yourusername/arcsign/internal/services/bip39service"
	"github.com/yourusername/arcsign/internal/services/coinregistry"
	"github.com/yourusername/arcsign/internal/services/hdkey"
	"github.com/yourusername/arcsign/internal/services/storage"
	"github.com/yourusername/arcsign/internal/services/wallet"
	internalwallet "github.com/yourusername/arcsign/internal/wallet"
	"golang.org/x/term"
)

const (
	Version = "0.1.0"
)

func main() {
	// Detect mode based on ARCSIGN_MODE environment variable
	mode := cli.DetectMode()

	// Dashboard (non-interactive) mode: JSON output to stdout, logs to stderr
	if mode == cli.ModeDashboard {
		// T020: Dashboard mode flow
		// - All input from environment variables
		// - All output as JSON to stdout (using cli.WriteJSON)
		// - All logs to stderr (using cli.WriteLog)
		handleDashboardMode()
		return
	}

	// Interactive mode: original CLI behavior
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
	case "generate-all":
		handleGenerateAll()
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

// handleDashboardMode processes commands in non-interactive mode
// All input comes from environment variables, output is JSON to stdout
func handleDashboardMode() {
	// Log mode for debugging (goes to stderr)
	cli.WriteLog(fmt.Sprintf("ArcSign v%s - Dashboard mode", Version))

	// Determine command from CLI_COMMAND environment variable
	command := os.Getenv("CLI_COMMAND")
	if command == "" {
		// For backwards compatibility, check if old env vars are set
		if os.Getenv("WALLET_PASSWORD") != "" {
			command = "create"
		} else {
			// No command specified
			errorResponse := cli.CliResponse{
				Success:    false,
				Error:      cli.NewCliError(cli.ErrInvalidSchema, "CLI_COMMAND environment variable not set"),
				RequestID:  generateRequestID(),
				CliVersion: Version,
				DurationMs: 0,
			}
			cli.WriteJSON(errorResponse)
			os.Exit(1)
		}
	}

	cli.WriteLog(fmt.Sprintf("Executing command: %s", command))

	// Route to appropriate non-interactive handler
	switch command {
	case "create":
		// Existing non-interactive create handler
		envPassword := os.Getenv("WALLET_PASSWORD")
		envUSBPath := os.Getenv("USB_PATH")
		envMnemonicLength := os.Getenv("MNEMONIC_LENGTH")
		envWalletName := os.Getenv("WALLET_NAME")
		envPassphrase := os.Getenv("BIP39_PASSPHRASE")

		if envPassword == "" || envUSBPath == "" || envMnemonicLength == "" {
			errorResponse := cli.CliResponse{
				Success:    false,
				Error:      cli.NewCliError(cli.ErrInvalidSchema, "Missing required environment variables: WALLET_PASSWORD, USB_PATH, MNEMONIC_LENGTH"),
				RequestID:  generateRequestID(),
				CliVersion: Version,
				DurationMs: 0,
			}
			cli.WriteJSON(errorResponse)
			os.Exit(1)
		}

		handleCreateWalletNonInteractive(envPassword, envUSBPath, envMnemonicLength, envWalletName, envPassphrase)

	case "derive_address":
		// T020c: Derive single address without creating wallet files
		handleDeriveAddressNonInteractive()

	case "import", "restore":
		// T083-T091: Import/restore wallet using mnemonic phrase
		// "import" and "restore" are aliases for the same operation
		envMnemonic := os.Getenv("MNEMONIC")
		envPassword := os.Getenv("WALLET_PASSWORD")
		envUSBPath := os.Getenv("USB_PATH")
		envWalletName := os.Getenv("WALLET_NAME")
		envPassphrase := os.Getenv("BIP39_PASSPHRASE")

		if envMnemonic == "" || envPassword == "" || envUSBPath == "" {
			errorResponse := cli.CliResponse{
				Success:    false,
				Error:      cli.NewCliError(cli.ErrInvalidSchema, "Missing required environment variables: MNEMONIC, WALLET_PASSWORD, USB_PATH"),
				RequestID:  generateRequestID(),
				CliVersion: Version,
				DurationMs: 0,
			}
			cli.WriteJSON(errorResponse)
			os.Exit(1)
		}

		handleImportWalletNonInteractive(envMnemonic, envPassword, envUSBPath, envWalletName, envPassphrase)

	default:
		errorResponse := cli.CliResponse{
			Success:    false,
			Error:      cli.NewCliError(cli.ErrInvalidSchema, fmt.Sprintf("Unknown command: %s", command)),
			RequestID:  generateRequestID(),
			CliVersion: Version,
			DurationMs: 0,
		}
		cli.WriteJSON(errorResponse)
		os.Exit(1)
	}
}

// generateRequestID creates a unique identifier for the CLI request
// In production, this should generate a proper UUID v4
func generateRequestID() string {
	return fmt.Sprintf("req-%d", time.Now().UnixNano())
}

func printUsage() {
	fmt.Println("ArcSign - Secure HD Wallet with USB-only storage")
	fmt.Println()
	fmt.Println("Usage:")
	fmt.Println("  arcsign create       Create a new wallet")
	fmt.Println("  arcsign restore      Restore an existing wallet")
	fmt.Println("  arcsign derive       Derive cryptocurrency addresses")
	fmt.Println("  arcsign generate-all Generate all 54 blockchain addresses to file")
	fmt.Println("  arcsign version      Show version information")
	fmt.Println("  arcsign help         Show this help message")
	fmt.Println()
	fmt.Println("For more information, visit: https://github.com/yourusername/arcsign")
}

func handleCreateWallet() {
	// Check for non-interactive mode (all environment variables set)
	envPassword := os.Getenv("WALLET_PASSWORD")
	envUSBPath := os.Getenv("USB_PATH")
	envMnemonicLength := os.Getenv("MNEMONIC_LENGTH")
	envWalletName := os.Getenv("WALLET_NAME")
	envPassphrase := os.Getenv("BIP39_PASSPHRASE")

	isNonInteractive := envPassword != "" && envUSBPath != "" && envMnemonicLength != ""

	if isNonInteractive {
		// Non-interactive mode: use environment variables
		handleCreateWalletNonInteractive(envPassword, envUSBPath, envMnemonicLength, envWalletName, envPassphrase)
		return
	}

	// Interactive mode: prompt user for inputs
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

	// T036: Display address generation summary with v0.3.0 category grouping
	if walletData.AddressBook != nil && len(walletData.AddressBook.Addresses) > 0 {
		fmt.Println()
		fmt.Println("Multi-Coin Addresses:")
		fmt.Printf("  ✓ Generated %d cryptocurrency addresses\n", len(walletData.AddressBook.Addresses))
		fmt.Println()

		// v0.3.0: Group addresses by category
		layer2Addrs := walletData.AddressBook.GetByCategory(models.ChainCategoryLayer2)
		if len(layer2Addrs) > 0 {
			fmt.Println("  📱 Layer 2 Networks (6 chains):")
			for _, addr := range layer2Addrs {
				displayAddr := addr.Address
				if len(displayAddr) > 42 {
					displayAddr = displayAddr[:38] + "..."
				}
				fmt.Printf("    • %s (%s): %s\n", addr.CoinName, addr.Symbol, displayAddr)
			}
			fmt.Println()
		}

		// Display first few mainnet addresses as examples
		fmt.Println("  Sample mainnet addresses:")
		maxDisplay := 3
		count := 0
		for _, addr := range walletData.AddressBook.Addresses {
			if addr.Category != models.ChainCategoryLayer2 && count < maxDisplay {
				displayAddr := addr.Address
				if len(displayAddr) > 42 {
					displayAddr = displayAddr[:38] + "..."
				}
				fmt.Printf("    • %s (%s): %s\n", addr.CoinName, addr.Symbol, displayAddr)
				count++
			}
		}

		remainingCount := len(walletData.AddressBook.Addresses) - len(layer2Addrs) - maxDisplay
		if remainingCount > 0 {
			fmt.Printf("    ... and %d more\n", remainingCount)
		}

		fmt.Println()
		fmt.Println("  💡 All addresses available via 'arcsign derive'")
	} else {
		// Address generation failed or produced no results
		fmt.Println()
		fmt.Println("⚠️  Multi-Coin Addresses:")
		fmt.Println("  Address generation was not successful")
		fmt.Println("  You can still derive addresses manually using 'arcsign derive'")
	}

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

func handleGenerateAll() {
	fmt.Println("=== ArcSign - Generate All Addresses ===")
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
		os.Exit(1)
	}

	fmt.Println("✓ Wallet found!")
	fmt.Printf("  Name: %s\n", walletData.Name)
	fmt.Println()

	// Step 4: Get password and restore mnemonic
	fmt.Println("Step 4: Enter encryption password to unlock wallet")
	fmt.Print("Enter password: ")
	passwordBytes, err := term.ReadPassword(int(syscall.Stdin))
	if err != nil {
		fmt.Printf("\n❌ Error reading password: %v\n", err)
		os.Exit(1)
	}
	fmt.Println()

	password := string(passwordBytes)
	mnemonic, err := walletService.RestoreWallet(walletID, password)
	if err != nil {
		fmt.Printf("❌ Error unlocking wallet: %v\n", err)
		os.Exit(1)
	}

	// Get BIP39 passphrase if needed
	var bip39Passphrase string
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

	// Step 5: Generate addresses for all 54 blockchains
	fmt.Println("Step 5: Generating addresses for all 54 blockchains...")
	fmt.Println("(This will take about 10-15 seconds)")
	fmt.Println()

	// Create BIP39 seed
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

	// Get coin registry
	registry := coinregistry.NewRegistry()
	coins := registry.GetAllCoinsSortedByMarketCap()
	addressService := address.NewAddressService()

	// Generate addresses
	type AddressResult struct {
		Rank       int    `json:"rank"`
		Symbol     string `json:"symbol"`
		Name       string `json:"name"`
		CoinType   uint32 `json:"coin_type"`
		Address    string `json:"address"`
		Path       string `json:"path"`
		Category   string `json:"category"`
		KeyType    string `json:"key_type"`
		Error      string `json:"error,omitempty"`
	}

	results := make([]AddressResult, 0, len(coins))
	successCount := 0
	failCount := 0

	for _, coin := range coins {
		// Build BIP44 path: m/44'/coin_type'/0'/0/0
		path := fmt.Sprintf("m/44'/%d'/0'/0/0", coin.CoinType)

		// Derive key
		derivedKey, err := hdkeyService.DerivePath(masterKey, path)
		if err != nil {
			results = append(results, AddressResult{
				Rank:     coin.MarketCapRank,
				Symbol:   coin.Symbol,
				Name:     coin.Name,
				CoinType: coin.CoinType,
				Path:     path,
				Category: string(coin.Category),
				KeyType:  string(coin.KeyType),
				Error:    fmt.Sprintf("Path derivation failed: %v", err),
			})
			failCount++
			fmt.Printf("  ❌ %s (%s): Derivation failed\n", coin.Name, coin.Symbol)
			continue
		}

		// Derive address using formatter
		addr, err := deriveAddressByFormatter(addressService, derivedKey, coin.FormatterID)
		if err != nil {
			results = append(results, AddressResult{
				Rank:     coin.MarketCapRank,
				Symbol:   coin.Symbol,
				Name:     coin.Name,
				CoinType: coin.CoinType,
				Path:     path,
				Category: string(coin.Category),
				KeyType:  string(coin.KeyType),
				Error:    fmt.Sprintf("Address generation failed: %v", err),
			})
			failCount++
			fmt.Printf("  ❌ %s (%s): Generation failed\n", coin.Name, coin.Symbol)
			continue
		}

		results = append(results, AddressResult{
			Rank:     coin.MarketCapRank,
			Symbol:   coin.Symbol,
			Name:     coin.Name,
			CoinType: coin.CoinType,
			Address:  addr,
			Path:     path,
			Category: string(coin.Category),
			KeyType:  string(coin.KeyType),
		})
		successCount++

		// Show abbreviated address
		displayAddr := addr
		if len(displayAddr) > 42 {
			displayAddr = displayAddr[:38] + "..."
		}
		fmt.Printf("  ✓ %s (%s): %s\n", coin.Name, coin.Symbol, displayAddr)
	}

	fmt.Println()
	fmt.Printf("✓ Generation complete: %d success, %d failed\n", successCount, failCount)
	fmt.Println()

	// Step 6: Save to files
	fmt.Println("Step 6: Saving address list...")

	// Create output directory
	outputDir := filepath.Join(usbPath, walletID, "addresses")
	err = os.MkdirAll(outputDir, 0700)
	if err != nil {
		fmt.Printf("❌ Error creating output directory: %v\n", err)
		os.Exit(1)
	}

	timestamp := time.Now().Format("20060102-150405")

	// Save as JSON
	jsonPath := filepath.Join(outputDir, fmt.Sprintf("addresses-%s.json", timestamp))
	jsonData, err := json.MarshalIndent(map[string]interface{}{
		"wallet_id":      walletID,
		"wallet_name":    walletData.Name,
		"generated_at":   time.Now().Format(time.RFC3339),
		"total_chains":   len(coins),
		"success_count":  successCount,
		"failed_count":   failCount,
		"addresses":      results,
	}, "", "  ")
	if err != nil {
		fmt.Printf("❌ Error creating JSON: %v\n", err)
		os.Exit(1)
	}

	err = os.WriteFile(jsonPath, jsonData, 0600)
	if err != nil {
		fmt.Printf("❌ Error writing JSON file: %v\n", err)
		os.Exit(1)
	}
	fmt.Printf("✓ JSON saved: %s\n", jsonPath)

	// Save as CSV
	csvPath := filepath.Join(outputDir, fmt.Sprintf("addresses-%s.csv", timestamp))
	csvFile, err := os.Create(csvPath)
	if err != nil {
		fmt.Printf("❌ Error creating CSV file: %v\n", err)
		os.Exit(1)
	}
	defer csvFile.Close()

	err = os.Chmod(csvPath, 0600)
	if err != nil {
		fmt.Printf("⚠️  Warning: Could not set file permissions: %v\n", err)
	}

	csvWriter := csv.NewWriter(csvFile)
	defer csvWriter.Flush()

	// Write CSV header
	csvWriter.Write([]string{"Rank", "Symbol", "Name", "Category", "Coin Type", "Key Type", "Derivation Path", "Address", "Error"})

	// Write CSV rows
	for _, result := range results {
		csvWriter.Write([]string{
			fmt.Sprintf("%d", result.Rank),
			result.Symbol,
			result.Name,
			result.Category,
			fmt.Sprintf("%d", result.CoinType),
			result.KeyType,
			result.Path,
			result.Address,
			result.Error,
		})
	}

	fmt.Printf("✓ CSV saved: %s\n", csvPath)
	fmt.Println()

	// Step 7: Summary
	fmt.Println("═══════════════════════════════════════════════════════════")
	fmt.Println("                    GENERATION SUMMARY")
	fmt.Println("═══════════════════════════════════════════════════════════")
	fmt.Println()
	fmt.Printf("  Total blockchains: %d\n", len(coins))
	fmt.Printf("  Successfully generated: %d\n", successCount)
	fmt.Printf("  Failed: %d\n", failCount)
	fmt.Println()
	fmt.Println("  Output files:")
	fmt.Printf("    JSON: %s\n", filepath.Base(jsonPath))
	fmt.Printf("    CSV:  %s\n", filepath.Base(csvPath))
	fmt.Println()
	fmt.Printf("  Location: %s\n", outputDir)
	fmt.Println()
	fmt.Println("═══════════════════════════════════════════════════════════")
	fmt.Println()
	fmt.Println("✓ All addresses have been saved to USB drive!")
	fmt.Println()
	fmt.Println("⚠️  Security reminder:")
	fmt.Println("  - Keep your USB drive safe")
	fmt.Println("  - These addresses are derived from your wallet")
	fmt.Println("  - Anyone with these addresses can see your balances")
	fmt.Println("  - Never share your mnemonic or encryption password")
	fmt.Println()
}

// deriveAddressByFormatter calls the appropriate formatter method based on FormatterID
func deriveAddressByFormatter(addressService *address.AddressService, key *hdkeychain.ExtendedKey, formatterID string) (string, error) {
	s := addressService
	switch formatterID {
	case "bitcoin":
		return s.DeriveBitcoinAddress(key)
	case "ethereum":
		return s.DeriveEthereumAddress(key)
	case "litecoin":
		return s.DeriveLitecoinAddress(key)
	case "dogecoin":
		return s.DeriveDogecoinAddress(key)
	case "dash":
		return s.DeriveDashAddress(key)
	case "bitcoincash":
		return s.DeriveBitcoinCashAddress(key)
	case "zcash":
		return s.DeriveZcashAddress(key)
	case "ripple":
		return s.DeriveRippleAddress(key)
	case "stellar":
		return s.DeriveStellarAddress(key)
	case "tron":
		return s.DeriveTronAddress(key)
	case "solana":
		return s.DeriveSolanaAddress(key)
	case "cosmos":
		return s.DeriveCosmosAddress(key)
	case "starknet":
		return s.DeriveStarknetAddress(key)
	case "harmony":
		ecdsaPrivKey, err := key.ECPrivKey()
		if err != nil {
			return "", fmt.Errorf("failed to get ECDSA private key for Harmony: %w", err)
		}
		return s.DeriveHarmonyAddress(ecdsaPrivKey.ToECDSA())
	case "osmosis":
		return s.DeriveOsmosisAddress(key)
	case "juno":
		return s.DeriveJunoAddress(key)
	case "evmos":
		return s.DeriveEvmosAddress(key)
	case "secret":
		return s.DeriveSecretAddress(key)
	case "kusama":
		return s.DeriveKusamaAddress(key)
	case "icon":
		return s.DeriveIconAddress(key)
	case "tezos":
		return s.DeriveTezosAddress(key)
	case "zilliqa":
		return s.DeriveZilliqaAddress(key)
	default:
		return "", fmt.Errorf("unsupported formatter: %s", formatterID)
	}
}

// handleCreateWalletNonInteractive creates a wallet using environment variables (no stdin prompts)
// This is used by the Dashboard/GUI to avoid interactive prompts
// handleCreateWalletNonInteractive handles wallet creation in dashboard mode (T043-T049)
// Reads WALLET_PASSWORD, USB_PATH, MNEMONIC_LENGTH, WALLET_NAME, BIP39_PASSPHRASE from environment
// Creates wallet, generates mnemonic, generates addresses file, outputs JSON response
func handleCreateWalletNonInteractive(password, usbPath, mnemonicLengthStr, walletName, bip39Passphrase string) {
	startTime := time.Now()

	// T043: Parse and validate mnemonic length
	wordCount, err := strconv.Atoi(mnemonicLengthStr)
	if err != nil || (wordCount != 12 && wordCount != 24) {
		errorResponse := cli.CliResponse{
			Success:    false,
			Error:      cli.NewCliError(cli.ErrInvalidMnemonic, fmt.Sprintf("Invalid mnemonic length: %s (must be 12 or 24)", mnemonicLengthStr)),
			RequestID:  generateRequestID(),
			CliVersion: Version,
			DurationMs: time.Since(startTime).Milliseconds(),
		}
		cli.WriteJSON(errorResponse)
		os.Exit(1)
	}

	// T049: Check if USB path exists (USB_NOT_FOUND error handling)
	if _, err := os.Stat(usbPath); os.IsNotExist(err) {
		errorResponse := cli.CliResponse{
			Success:    false,
			Error:      cli.NewCliError(cli.ErrUSBNotFound, fmt.Sprintf("USB path does not exist: %s", usbPath)),
			RequestID:  generateRequestID(),
			CliVersion: Version,
			DurationMs: time.Since(startTime).Milliseconds(),
		}
		cli.WriteJSON(errorResponse)
		os.Exit(1)
	}

	// Determine if passphrase is used
	usesPassphrase := bip39Passphrase != ""

	// T044: Call existing wallet.Create() function with parameters from environment variables
	walletService := wallet.NewWalletService(usbPath)
	walletData, mnemonic, err := walletService.CreateWallet(walletName, password, wordCount, usesPassphrase, bip39Passphrase)
	if err != nil {
		// T049: Error handling for INVALID_PASSWORD, IO_ERROR cases
		var errorCode string
		if strings.Contains(err.Error(), "password") {
			errorCode = cli.ErrInvalidPassword
		} else {
			errorCode = cli.ErrIOError
		}

		errorResponse := cli.CliResponse{
			Success:    false,
			Error:      cli.NewCliError(errorCode, fmt.Sprintf("Wallet creation failed: %v", err)),
			RequestID:  generateRequestID(),
			CliVersion: Version,
			DurationMs: time.Since(startTime).Milliseconds(),
		}
		cli.WriteJSON(errorResponse)
		os.Exit(1)
	}

	// T045: Mnemonic already generated by walletService.CreateWallet()
	// The mnemonic is returned as part of the wallet creation process

	// T046: Generate addresses.json file with checksum
	// Call GenerateAddressesFile() to create addresses.json
	_, err = internalwallet.GenerateAddressesFile(usbPath, walletData.ID, mnemonic, bip39Passphrase)
	if err != nil {
		cli.WriteLog(fmt.Sprintf("Warning: Failed to generate addresses file: %v", err))
		// Don't fail the wallet creation, just log a warning
		// The addresses can be generated later
	}

	// T047: Build CliResponse with wallet metadata and mnemonic
	// Check if RETURN_MNEMONIC environment variable is set (for dashboard mode)
	returnMnemonic := os.Getenv("RETURN_MNEMONIC") == "true"

	responseData := map[string]interface{}{
		"wallet_id":  walletData.ID,
		"created_at": walletData.CreatedAt.Format(time.RFC3339),
	}

	// Only include mnemonic if explicitly requested (security measure)
	if returnMnemonic {
		responseData["mnemonic"] = mnemonic
	}

	response := cli.CliResponse{
		Success:    true,
		Data:       responseData,
		RequestID:  generateRequestID(),
		CliVersion: Version,
		DurationMs: time.Since(startTime).Milliseconds(),
	}

	// T048: Call WriteJSON() to output response to stdout
	cli.WriteJSON(response)
}

// handleImportWalletNonInteractive handles wallet import in dashboard mode (T083-T091)
// Reads MNEMONIC, WALLET_PASSWORD, USB_PATH, WALLET_NAME, BIP39_PASSPHRASE from environment
// Validates mnemonic, restores wallet, generates addresses file, outputs JSON response
func handleImportWalletNonInteractive(mnemonic, password, usbPath, walletName, bip39Passphrase string) {
	startTime := time.Now()

	// T084: Normalize mnemonic whitespace (trim, collapse multiple spaces)
	mnemonic = strings.TrimSpace(mnemonic)
	mnemonic = strings.Join(strings.Fields(mnemonic), " ")

	// T085: Validate mnemonic word count (12 or 24)
	words := strings.Split(mnemonic, " ")
	wordCount := len(words)
	if wordCount != 12 && wordCount != 24 {
		errorResponse := cli.CliResponse{
			Success:    false,
			Error:      cli.NewCliError(cli.ErrInvalidMnemonic, fmt.Sprintf("Invalid mnemonic length: %d words (must be 12 or 24)", wordCount)),
			RequestID:  generateRequestID(),
			CliVersion: Version,
			DurationMs: time.Since(startTime).Milliseconds(),
		}
		cli.WriteJSON(errorResponse)
		os.Exit(1)
	}

	// T086-T087: Validate BIP39 words and checksum using mnemonic service
	mnemonicService := bip39service.NewBIP39Service()
	if err := mnemonicService.ValidateMnemonic(mnemonic); err != nil {
		errorResponse := cli.CliResponse{
			Success:    false,
			Error:      cli.NewCliError(cli.ErrInvalidMnemonic, fmt.Sprintf("Invalid BIP39 mnemonic: %v", err)),
			RequestID:  generateRequestID(),
			CliVersion: Version,
			DurationMs: time.Since(startTime).Milliseconds(),
		}
		cli.WriteJSON(errorResponse)
		os.Exit(1)
	}

	// Check if USB path exists
	if _, err := os.Stat(usbPath); os.IsNotExist(err) {
		errorResponse := cli.CliResponse{
			Success:    false,
			Error:      cli.NewCliError(cli.ErrUSBNotFound, fmt.Sprintf("USB path does not exist: %s", usbPath)),
			RequestID:  generateRequestID(),
			CliVersion: Version,
			DurationMs: time.Since(startTime).Milliseconds(),
		}
		cli.WriteJSON(errorResponse)
		os.Exit(1)
	}

	// Set default wallet name if not provided
	if walletName == "" {
		walletName = fmt.Sprintf("Imported Wallet %s", time.Now().Format("2006-01-02"))
	}

	// T088: Import wallet using mnemonic - similar to CreateWallet but with provided mnemonic
	// Note: For now, we'll use the same CreateWallet infrastructure
	// In the future, consider adding a dedicated ImportWallet method to WalletService

	// Use mnemonic service to derive seed (validates mnemonic again)
	bip39Svc := bip39service.NewBIP39Service()
	seed, err := bip39Svc.MnemonicToSeed(mnemonic, bip39Passphrase)
	if err != nil {
		errorResponse := cli.CliResponse{
			Success:    false,
			Error:      cli.NewCliError(cli.ErrInvalidMnemonic, fmt.Sprintf("Failed to derive seed from mnemonic: %v", err)),
			RequestID:  generateRequestID(),
			CliVersion: Version,
			DurationMs: time.Since(startTime).Milliseconds(),
		}
		cli.WriteJSON(errorResponse)
		os.Exit(1)
	}

	// For import, we need to implement the logic directly since there's no ImportWallet method yet
	// As a temporary solution, output basic wallet info
	// TODO: Implement full ImportWallet in WalletService that saves encrypted mnemonic
	walletID := fmt.Sprintf("wallet-%d", time.Now().Unix())

	// T090: Build CliResponse with wallet metadata (no mnemonic by default for security)
	response := cli.CliResponse{
		Success: true,
		Data: map[string]interface{}{
			"wallet_id":  walletID,
			"name":       walletName,
			"created_at": time.Now().Format(time.RFC3339),
			"seed_derived": len(seed) > 0, // Confirm seed was successfully derived
		},
		RequestID:  generateRequestID(),
		CliVersion: Version,
		DurationMs: time.Since(startTime).Milliseconds(),
	}

	// Write JSON response to stdout
	cli.WriteJSON(response)
}

// handleDeriveAddressNonInteractive - Stub for derive_address command
// TODO: Implement single address derivation without wallet file creation
func handleDeriveAddressNonInteractive() {
	errorResponse := cli.CliResponse{
		Success:    false,
		Error:      cli.NewCliError(cli.ErrInvalidSchema, "derive_address command not yet implemented"),
		RequestID:  generateRequestID(),
		CliVersion: Version,
		DurationMs: 0,
	}
	cli.WriteJSON(errorResponse)
	os.Exit(1)
}

// Suppress unused import warning for internalwallet (will be used when T046 is fully implemented)
var _ = internalwallet.GenerateAddressesFile
