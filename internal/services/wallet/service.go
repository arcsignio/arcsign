package wallet

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/yourusername/arcsign/internal/models"
	"github.com/yourusername/arcsign/internal/services/address"
	"github.com/yourusername/arcsign/internal/services/audit"
	"github.com/yourusername/arcsign/internal/services/bip39service"
	"github.com/yourusername/arcsign/internal/services/coinregistry"
	"github.com/yourusername/arcsign/internal/services/crypto"
	"github.com/yourusername/arcsign/internal/services/hdkey"
	"github.com/yourusername/arcsign/internal/services/ratelimit"
	"github.com/yourusername/arcsign/internal/services/storage"
	"github.com/yourusername/arcsign/internal/utils"
)

// WalletService handles wallet creation and management operations
type WalletService struct {
	storagePath  string
	bip39Service *bip39service.BIP39Service
	rateLimiter  *ratelimit.RateLimiter
}

// NewWalletService creates a new wallet service instance
// storagePath: base directory for wallet storage (usually USB drive path)
func NewWalletService(storagePath string) *WalletService {
	return &WalletService{
		storagePath:  storagePath,
		bip39Service: bip39service.NewBIP39Service(),
		rateLimiter:  ratelimit.NewRateLimiter(3, 1*time.Minute), // 3 attempts per minute
	}
}

// CreateWallet creates a new HD wallet with encrypted mnemonic storage
//
// Parameters:
//   - name: Optional wallet name (max 64 chars, empty string allowed)
//   - password: Encryption password (validated for strength)
//   - wordCount: BIP39 mnemonic word count (12 or 24)
//   - usesPassphrase: Whether wallet uses BIP39 passphrase extension
//   - bip39Passphrase: Optional BIP39 passphrase (empty if usesPassphrase is false)
//
// Returns:
//   - *models.Wallet: Wallet metadata
//   - string: Plaintext mnemonic (MUST be shown to user once and cleared)
//   - error: Any error during creation
func (s *WalletService) CreateWallet(
	name string,
	password string,
	wordCount int,
	usesPassphrase bool,
	bip39Passphrase string,
) (*models.Wallet, string, error) {
	// 1. Validate inputs
	if err := utils.ValidatePassword(password); err != nil {
		return nil, "", fmt.Errorf("password validation failed: %w", err)
	}

	if err := models.ValidateWalletName(name); err != nil {
		return nil, "", fmt.Errorf("wallet name validation failed: %w", err)
	}

	// 2. Generate secure wallet ID
	walletID, err := utils.GenerateSecureUUID()
	if err != nil {
		return nil, "", fmt.Errorf("failed to generate wallet ID: %w", err)
	}

	// 3. Generate BIP39 mnemonic
	mnemonic, err := s.bip39Service.GenerateMnemonic(wordCount)
	if err != nil {
		return nil, "", fmt.Errorf("failed to generate mnemonic: %w", err)
	}

	// 4. Encrypt mnemonic with password
	encryptedMnemonic, err := crypto.EncryptMnemonic(mnemonic, password)
	if err != nil {
		return nil, "", fmt.Errorf("failed to encrypt mnemonic: %w", err)
	}

	// 5. Create wallet directory structure
	walletDir := filepath.Join(s.storagePath, walletID)
	mnemonicPath := filepath.Join(walletDir, "mnemonic.enc")

	// 6. Serialize and save encrypted mnemonic
	encryptedData := crypto.SerializeEncryptedData(encryptedMnemonic)
	if err := storage.AtomicWriteFile(mnemonicPath, encryptedData, 0600); err != nil {
		return nil, "", fmt.Errorf("failed to save encrypted mnemonic: %w", err)
	}

	// 7. T054: Generate multi-coin addresses from mnemonic
	addressBook, addressGenErr := s.generateMultiCoinAddresses(mnemonic, bip39Passphrase, walletID)
	// Non-fatal: wallet creation continues even if address generation fails
	// Addresses can be regenerated later if needed

	// 8. Create wallet metadata
	now := time.Now()
	wallet := &models.Wallet{
		ID:                    walletID,
		Name:                  name,
		CreatedAt:             now,
		LastAccessedAt:        now,
		EncryptedMnemonicPath: mnemonicPath,
		UsesPassphrase:        usesPassphrase,
		AddressBook:           addressBook, // T054: Include generated addresses
	}

	// 9. T056: Save wallet metadata as JSON (includes AddressBook automatically)
	metadataPath := filepath.Join(walletDir, "wallet.json")
	metadataJSON, err := json.MarshalIndent(wallet, "", "  ")
	if err != nil {
		return nil, "", fmt.Errorf("failed to marshal wallet metadata: %w", err)
	}

	if err := storage.AtomicWriteFile(metadataPath, metadataJSON, 0600); err != nil {
		return nil, "", fmt.Errorf("failed to save wallet metadata: %w", err)
	}

	// 10. Create audit log entries
	auditPath := filepath.Join(walletDir, "audit.log")
	auditLogger, err := audit.NewAuditLogger(auditPath)
	if err != nil {
		// Non-fatal: log error but don't fail wallet creation
		fmt.Printf("Warning: failed to create audit logger: %v\n", err)
	} else {
		// Log wallet creation
		auditEntry := audit.AuditLogEntry{
			ID:        walletID + "-create",
			WalletID:  walletID,
			Timestamp: now,
			Operation: "WALLET_CREATE",
			Status:    "SUCCESS",
		}
		if err := auditLogger.LogOperation(auditEntry); err != nil {
			fmt.Printf("Warning: failed to log audit entry: %v\n", err)
		}

		// T058: Log address generation results
		if addressBook != nil {
			addressEntry := audit.AuditLogEntry{
				ID:        walletID + "-addresses",
				WalletID:  walletID,
				Timestamp: now,
				Operation: "ADDRESS_GENERATION",
				Status:    "SUCCESS",
			}
			if addressGenErr != nil {
				addressEntry.Status = "PARTIAL_FAILURE"
				addressEntry.FailureReason = fmt.Sprintf("Address generation errors: %v", addressGenErr)
			}
			if err := auditLogger.LogOperation(addressEntry); err != nil {
				fmt.Printf("Warning: failed to log address generation audit entry: %v\n", err)
			}
		} else if addressGenErr != nil {
			// Address generation completely failed
			addressEntry := audit.AuditLogEntry{
				ID:            walletID + "-addresses-fail",
				WalletID:      walletID,
				Timestamp:     now,
				Operation:     "ADDRESS_GENERATION",
				Status:        "FAILURE",
				FailureReason: addressGenErr.Error(),
			}
			if err := auditLogger.LogOperation(addressEntry); err != nil {
				fmt.Printf("Warning: failed to log address generation failure: %v\n", err)
			}
		}
	}

	// 11. Return wallet metadata and plaintext mnemonic
	// IMPORTANT: Caller MUST display mnemonic to user and clear it from memory
	return wallet, mnemonic, nil
}

// LoadWallet loads wallet metadata from disk
// Returns the wallet metadata without decrypting the mnemonic
func (s *WalletService) LoadWallet(walletID string) (*models.Wallet, error) {
	// Load wallet metadata
	metadataPath := filepath.Join(s.storagePath, walletID, "wallet.json")

	data, err := os.ReadFile(metadataPath)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, utils.ErrWalletNotFound
		}
		return nil, fmt.Errorf("failed to read wallet metadata: %w", err)
	}

	var wallet models.Wallet
	if err := json.Unmarshal(data, &wallet); err != nil {
		return nil, fmt.Errorf("failed to parse wallet metadata: %w", err)
	}

	return &wallet, nil
}

// RestoreWallet decrypts and returns the mnemonic for a wallet
// Implements rate limiting to prevent brute-force attacks
// Logs all access attempts (success and failure) to audit log
func (s *WalletService) RestoreWallet(walletID string, password string) (string, error) {
	// 1. Check rate limit
	if !s.rateLimiter.AllowAttempt(walletID) {
		return "", utils.ErrRateLimitExceeded
	}

	// 2. Load wallet metadata
	wallet, err := s.LoadWallet(walletID)
	if err != nil {
		return "", err
	}

	// 3. Read encrypted mnemonic
	encryptedData, err := os.ReadFile(wallet.EncryptedMnemonicPath)
	if err != nil {
		s.logAuditFailure(walletID, "file_read_error")
		return "", fmt.Errorf("failed to read encrypted mnemonic: %w", err)
	}

	// 4. Deserialize encrypted data
	encryptedMnemonic, err := crypto.DeserializeEncryptedData(encryptedData)
	if err != nil {
		s.logAuditFailure(walletID, "corrupted_data")
		return "", fmt.Errorf("failed to deserialize encrypted data: %w", err)
	}

	// 5. Decrypt mnemonic
	mnemonic, err := crypto.DecryptMnemonic(encryptedMnemonic, password)
	if err != nil {
		// Failed decryption - log and return
		s.logAuditFailure(walletID, "wrong_password")
		return "", utils.ErrDecryptionFailed
	}

	// 6. Success! Reset rate limiter and log access
	s.rateLimiter.ResetWallet(walletID)
	s.logAuditSuccess(walletID)

	// 7. Update last accessed time
	wallet.LastAccessedAt = time.Now()
	s.saveWalletMetadata(wallet)

	return mnemonic, nil
}

// logAuditSuccess logs successful wallet access
func (s *WalletService) logAuditSuccess(walletID string) {
	auditPath := filepath.Join(s.storagePath, walletID, "audit.log")
	auditLogger, err := audit.NewAuditLogger(auditPath)
	if err != nil {
		return // Non-fatal
	}

	entry := audit.AuditLogEntry{
		ID:        walletID + "-access-" + fmt.Sprintf("%d", time.Now().Unix()),
		WalletID:  walletID,
		Timestamp: time.Now(),
		Operation: "WALLET_ACCESS",
		Status:    "SUCCESS",
	}
	auditLogger.LogOperation(entry)
}

// logAuditFailure logs failed wallet access attempt
func (s *WalletService) logAuditFailure(walletID string, reason string) {
	auditPath := filepath.Join(s.storagePath, walletID, "audit.log")
	auditLogger, err := audit.NewAuditLogger(auditPath)
	if err != nil {
		return // Non-fatal
	}

	entry := audit.AuditLogEntry{
		ID:            walletID + "-access-fail-" + fmt.Sprintf("%d", time.Now().Unix()),
		WalletID:      walletID,
		Timestamp:     time.Now(),
		Operation:     "WALLET_ACCESS",
		Status:        "FAILURE",
		FailureReason: reason,
	}
	auditLogger.LogOperation(entry)
}

// saveWalletMetadata updates wallet metadata on disk
func (s *WalletService) saveWalletMetadata(wallet *models.Wallet) error {
	metadataPath := filepath.Join(s.storagePath, wallet.ID, "wallet.json")
	metadataJSON, err := json.MarshalIndent(wallet, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal wallet metadata: %w", err)
	}

	return storage.AtomicWriteFile(metadataPath, metadataJSON, 0600)
}

// T054: generateMultiCoinAddresses generates addresses for multiple cryptocurrencies
// from a BIP39 mnemonic. This is called during wallet creation to pre-generate
// addresses for 30+ mainstream coins.
func (s *WalletService) generateMultiCoinAddresses(mnemonic string, passphrase string, walletID string) (*models.AddressBook, error) {
	// 1. Convert mnemonic to seed
	seed, err := s.bip39Service.MnemonicToSeed(mnemonic, passphrase)
	if err != nil {
		return nil, fmt.Errorf("failed to convert mnemonic to seed: %w", err)
	}

	// Security: Clear seed from memory when done (defense in depth)
	defer func() {
		for i := range seed {
			seed[i] = 0
		}
	}()

	// 2. Create HD key service and derive master key
	hdKeyService := hdkey.NewHDKeyService()
	masterKey, err := hdKeyService.NewMasterKey(seed)
	if err != nil {
		return nil, fmt.Errorf("failed to derive master key: %w", err)
	}

	// 3. Initialize coin registry
	registry := coinregistry.NewRegistry()

	// 4. Initialize address service
	addressService := address.NewAddressService()

	// 5. Generate addresses for all coins in registry
	addressBook, metrics, err := addressService.GenerateMultiCoinAddresses(masterKey, registry)
	if err != nil {
		return nil, fmt.Errorf("failed to generate multi-coin addresses: %w", err)
	}

	// v0.3.0: Log generation metrics
	if metrics != nil {
		fmt.Printf("Address generation metrics: %d/%d chains (%.2f%% success rate), %d retries, duration: %v\n",
			metrics.SuccessCount, metrics.TotalChains, metrics.SuccessRate(), metrics.RetryCount, metrics.TotalDuration)
	}

	// 6. Return generated address book
	return addressBook, nil
}

// ListWallets enumerates all wallets in the storage path
// Returns a slice of wallet metadata for all valid wallets found
func (s *WalletService) ListWallets() ([]*models.Wallet, error) {
	// 1. Read storage directory
	entries, err := os.ReadDir(s.storagePath)
	if err != nil {
		if os.IsNotExist(err) {
			// Storage path doesn't exist - return empty list
			return []*models.Wallet{}, nil
		}
		return nil, fmt.Errorf("failed to read storage directory: %w", err)
	}

	wallets := make([]*models.Wallet, 0)

	// 2. Iterate through each entry
	for _, entry := range entries {
		// Skip files, only process directories
		if !entry.IsDir() {
			continue
		}

		// Each directory name should be a wallet ID
		walletID := entry.Name()

		// 3. Try to load wallet metadata
		wallet, err := s.LoadWallet(walletID)
		if err != nil {
			// Skip invalid wallets (missing or corrupted wallet.json)
			fmt.Printf("Warning: skipping invalid wallet directory %s: %v\n", walletID, err)
			continue
		}

		wallets = append(wallets, wallet)
	}

	return wallets, nil
}
