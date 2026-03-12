package backup

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/yourusername/arcsign/internal/models"
	"github.com/yourusername/arcsign/internal/services/audit"
	"github.com/yourusername/arcsign/internal/services/crypto"
	"github.com/yourusername/arcsign/internal/services/storage"
	"github.com/yourusername/arcsign/internal/utils"
)

const (
	BackupFormat  = "arcsign-backup"
	BackupVersion = 1

	BundleFormat  = "arcsign-bundle"
	BundleVersion = 1
)

// BackupPayload is the JSON structure of a .arcsign backup file
type BackupPayload struct {
	Format         string              `json:"format"`
	Version        int                 `json:"version"`
	WalletName     string              `json:"walletName"`
	CreatedAt      time.Time           `json:"createdAt"`
	UsesPassphrase bool                `json:"usesPassphrase"`
	MnemonicEncData string             `json:"mnemonicEncData"` // base64 of mnemonic.enc binary
	AddressBook    *models.AddressBook `json:"addressBook,omitempty"`
	ExportedAt     string              `json:"exportedAt"`
}

// BackupService handles wallet export and import via .arcsign backup files
type BackupService struct {
	storagePath string
}

// NewBackupService creates a new backup service instance
func NewBackupService(storagePath string) *BackupService {
	return &BackupService{
		storagePath: storagePath,
	}
}

// ExportBackup packages a wallet into a .arcsign backup file (no password needed — mnemonic.enc is already encrypted)
func (s *BackupService) ExportBackup(walletID string) ([]byte, string, error) {
	walletDir := filepath.Join(s.storagePath, walletID)

	// 1. Read wallet metadata
	metadataPath := filepath.Join(walletDir, "wallet.json")
	metadataBytes, err := os.ReadFile(metadataPath)
	if err != nil {
		return nil, "", fmt.Errorf("failed to read wallet metadata: %w", err)
	}

	var wallet models.Wallet
	if err := json.Unmarshal(metadataBytes, &wallet); err != nil {
		return nil, "", fmt.Errorf("failed to parse wallet metadata: %w", err)
	}

	// 2. Read encrypted mnemonic binary
	mnemonicPath := filepath.Join(walletDir, "mnemonic.enc")
	mnemonicEncBytes, err := os.ReadFile(mnemonicPath)
	if err != nil {
		return nil, "", fmt.Errorf("failed to read encrypted mnemonic: %w", err)
	}

	// 3. Validate mnemonic.enc structure
	if _, err := crypto.DeserializeEncryptedData(mnemonicEncBytes); err != nil {
		return nil, "", fmt.Errorf("encrypted mnemonic data is corrupted: %w", err)
	}

	// 4. Construct backup payload
	payload := BackupPayload{
		Format:          BackupFormat,
		Version:         BackupVersion,
		WalletName:      wallet.Name,
		CreatedAt:       wallet.CreatedAt,
		UsesPassphrase:  wallet.UsesPassphrase,
		MnemonicEncData: base64.StdEncoding.EncodeToString(mnemonicEncBytes),
		AddressBook:     wallet.AddressBook,
		ExportedAt:      time.Now().Format(time.RFC3339),
	}

	// 5. Marshal to JSON
	backupData, err := json.MarshalIndent(payload, "", "  ")
	if err != nil {
		return nil, "", fmt.Errorf("failed to marshal backup payload: %w", err)
	}

	// 6. Audit log (non-fatal)
	auditPath := filepath.Join(walletDir, "audit.log")
	if auditLogger, err := audit.NewAuditLogger(auditPath); err == nil {
		entry := audit.AuditLogEntry{
			ID:        walletID + "-export",
			WalletID:  walletID,
			Timestamp: time.Now(),
			Operation: "WALLET_EXPORT",
			Status:    "SUCCESS",
		}
		_ = auditLogger.LogOperation(entry)
	}

	return backupData, wallet.Name, nil
}

// BundlePayload is the JSON structure of a .arcsign-bundle file (before outer encryption)
type BundlePayload struct {
	Format      string          `json:"format"`
	Version     int             `json:"version"`
	WalletCount int             `json:"walletCount"`
	Wallets     []BackupPayload `json:"wallets"`
	ExportedAt  string          `json:"exportedAt"`
}

// ImportBackup restores a wallet from a .arcsign backup file
// Password is required to verify the user has the right to use this wallet
func (s *BackupService) ImportBackup(backupData []byte, password string, newName string) (*models.Wallet, error) {
	// 1. Parse backup payload
	var payload BackupPayload
	if err := json.Unmarshal(backupData, &payload); err != nil {
		return nil, fmt.Errorf("invalid backup file format: %w", err)
	}

	// 2. Validate format and version
	if payload.Format != BackupFormat {
		return nil, fmt.Errorf("invalid backup format: expected %q, got %q", BackupFormat, payload.Format)
	}
	if payload.Version != BackupVersion {
		return nil, fmt.Errorf("unsupported backup version: %d", payload.Version)
	}

	// 3. Decode mnemonic.enc data
	mnemonicEncBytes, err := base64.StdEncoding.DecodeString(payload.MnemonicEncData)
	if err != nil {
		return nil, fmt.Errorf("corrupted backup: failed to decode mnemonic data: %w", err)
	}

	// 4. Validate mnemonic.enc structure
	encrypted, err := crypto.DeserializeEncryptedData(mnemonicEncBytes)
	if err != nil {
		return nil, fmt.Errorf("corrupted backup: invalid mnemonic data: %w", err)
	}

	// 5. Verify password by decrypting mnemonic
	mnemonic, err := crypto.DecryptMnemonic(encrypted, password)
	if err != nil {
		return nil, fmt.Errorf("wrong password or corrupted backup")
	}
	// Zero mnemonic immediately — we only needed it to verify the password
	mnemonicBytes := []byte(mnemonic)
	crypto.ClearBytes(mnemonicBytes)

	// 6. Use shared helper to create wallet from payload
	if newName != "" {
		payload.WalletName = newName
	}
	return s.importWalletFromPayload(payload, "WALLET_IMPORT_BACKUP")
}

// importWalletFromPayload creates a wallet on disk from a BackupPayload.
// Shared by single ImportBackup (with password verification) and batch ImportAllBackups (without).
func (s *BackupService) importWalletFromPayload(payload BackupPayload, auditOperation string) (*models.Wallet, error) {
	// 1. Decode mnemonic.enc data
	mnemonicEncBytes, err := base64.StdEncoding.DecodeString(payload.MnemonicEncData)
	if err != nil {
		return nil, fmt.Errorf("corrupted backup: failed to decode mnemonic data: %w", err)
	}

	// 2. Validate mnemonic.enc structure
	if _, err := crypto.DeserializeEncryptedData(mnemonicEncBytes); err != nil {
		return nil, fmt.Errorf("corrupted backup: invalid mnemonic data: %w", err)
	}

	// 3. Generate new wallet ID
	walletID, err := utils.GenerateSecureUUID()
	if err != nil {
		return nil, fmt.Errorf("failed to generate wallet ID: %w", err)
	}

	// 4. Validate wallet name
	walletName := payload.WalletName
	if err := models.ValidateWalletName(walletName); err != nil {
		return nil, fmt.Errorf("wallet name validation failed: %w", err)
	}

	// 5. Create wallet directory and write mnemonic.enc
	walletDir := filepath.Join(s.storagePath, walletID)
	mnemonicPath := filepath.Join(walletDir, "mnemonic.enc")

	if err := storage.AtomicWriteFile(mnemonicPath, mnemonicEncBytes, 0600); err != nil {
		return nil, fmt.Errorf("failed to save encrypted mnemonic: %w", err)
	}

	// 6. Create wallet metadata
	now := time.Now()
	wallet := &models.Wallet{
		ID:                    walletID,
		Name:                  walletName,
		CreatedAt:             payload.CreatedAt,
		LastAccessedAt:        now,
		EncryptedMnemonicPath: mnemonicPath,
		UsesPassphrase:        payload.UsesPassphrase,
		AddressBook:           payload.AddressBook,
	}

	// 7. Save wallet.json
	metadataPath := filepath.Join(walletDir, "wallet.json")
	metadataJSON, err := json.MarshalIndent(wallet, "", "  ")
	if err != nil {
		return nil, fmt.Errorf("failed to marshal wallet metadata: %w", err)
	}

	if err := storage.AtomicWriteFile(metadataPath, metadataJSON, 0600); err != nil {
		return nil, fmt.Errorf("failed to save wallet metadata: %w", err)
	}

	// 8. Audit log (non-fatal)
	auditPath := filepath.Join(walletDir, "audit.log")
	if auditLogger, err := audit.NewAuditLogger(auditPath); err == nil {
		entry := audit.AuditLogEntry{
			ID:        walletID + "-" + auditOperation,
			WalletID:  walletID,
			Timestamp: now,
			Operation: auditOperation,
			Status:    "SUCCESS",
		}
		_ = auditLogger.LogOperation(entry)
	}

	return wallet, nil
}

// ExportAllBackups packages all wallets into an encrypted .arcsign-bundle file
// Password is used to encrypt the outer layer (Argon2id + AES-256-GCM)
func (s *BackupService) ExportAllBackups(password string) ([]byte, int, error) {
	// 1. List all wallet directories
	entries, err := os.ReadDir(s.storagePath)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, 0, fmt.Errorf("storage path does not exist")
		}
		return nil, 0, fmt.Errorf("failed to read storage directory: %w", err)
	}

	var walletPayloads []BackupPayload
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		// Check if it looks like a wallet directory (has wallet.json)
		walletDir := filepath.Join(s.storagePath, entry.Name())
		if _, err := os.Stat(filepath.Join(walletDir, "wallet.json")); err != nil {
			continue
		}

		backupData, _, err := s.ExportBackup(entry.Name())
		if err != nil {
			continue // Skip wallets that fail to export
		}

		var payload BackupPayload
		if err := json.Unmarshal(backupData, &payload); err != nil {
			continue
		}
		walletPayloads = append(walletPayloads, payload)
	}

	if len(walletPayloads) == 0 {
		return nil, 0, fmt.Errorf("no wallets to export")
	}

	walletCount := len(walletPayloads)

	// 2. Build bundle payload
	bundle := BundlePayload{
		Format:      BundleFormat,
		Version:     BundleVersion,
		WalletCount: walletCount,
		Wallets:     walletPayloads,
		ExportedAt:  time.Now().Format(time.RFC3339),
	}

	bundleJSON, err := json.Marshal(bundle)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to marshal bundle: %w", err)
	}

	// 3. Encrypt with password
	encryptedData, err := crypto.Encrypt(bundleJSON, password)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to encrypt bundle: %w", err)
	}

	// Clear plaintext
	crypto.ClearBytes(bundleJSON)

	return encryptedData, walletCount, nil
}

// ImportAllBackups restores all wallets from an encrypted .arcsign-bundle file
// Password is used to decrypt the outer layer; individual wallet passwords are not needed
func (s *BackupService) ImportAllBackups(bundleData []byte, password string) ([]*models.Wallet, error) {
	// 1. Decrypt outer layer
	decryptedJSON, err := crypto.Decrypt(bundleData, password)
	if err != nil {
		return nil, fmt.Errorf("wrong password or corrupted bundle")
	}
	defer crypto.ClearBytes(decryptedJSON)

	// 2. Parse bundle payload
	var bundle BundlePayload
	if err := json.Unmarshal(decryptedJSON, &bundle); err != nil {
		return nil, fmt.Errorf("corrupted bundle: invalid JSON after decryption: %w", err)
	}

	// 3. Validate format and version
	if bundle.Format != BundleFormat {
		return nil, fmt.Errorf("invalid bundle format: expected %q, got %q", BundleFormat, bundle.Format)
	}
	if bundle.Version != BundleVersion {
		return nil, fmt.Errorf("unsupported bundle version: %d", bundle.Version)
	}

	// 4. Import each wallet
	var wallets []*models.Wallet
	for _, walletPayload := range bundle.Wallets {
		wallet, err := s.importWalletFromPayload(walletPayload, "WALLET_IMPORT_BUNDLE")
		if err != nil {
			// Log warning but continue with other wallets
			continue
		}
		wallets = append(wallets, wallet)
	}

	if len(wallets) == 0 {
		return nil, fmt.Errorf("corrupted bundle: failed to import any wallets")
	}

	return wallets, nil
}
