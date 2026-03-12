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

	// 6. Generate new wallet ID
	walletID, err := utils.GenerateSecureUUID()
	if err != nil {
		return nil, fmt.Errorf("failed to generate wallet ID: %w", err)
	}

	// 7. Determine wallet name
	walletName := payload.WalletName
	if newName != "" {
		walletName = newName
	}
	if err := models.ValidateWalletName(walletName); err != nil {
		return nil, fmt.Errorf("wallet name validation failed: %w", err)
	}

	// 8. Create wallet directory and write mnemonic.enc
	walletDir := filepath.Join(s.storagePath, walletID)
	mnemonicPath := filepath.Join(walletDir, "mnemonic.enc")

	if err := storage.AtomicWriteFile(mnemonicPath, mnemonicEncBytes, 0600); err != nil {
		return nil, fmt.Errorf("failed to save encrypted mnemonic: %w", err)
	}

	// 9. Create wallet metadata
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

	// 10. Save wallet.json
	metadataPath := filepath.Join(walletDir, "wallet.json")
	metadataJSON, err := json.MarshalIndent(wallet, "", "  ")
	if err != nil {
		return nil, fmt.Errorf("failed to marshal wallet metadata: %w", err)
	}

	if err := storage.AtomicWriteFile(metadataPath, metadataJSON, 0600); err != nil {
		return nil, fmt.Errorf("failed to save wallet metadata: %w", err)
	}

	// 11. Audit log (non-fatal)
	auditPath := filepath.Join(walletDir, "audit.log")
	if auditLogger, err := audit.NewAuditLogger(auditPath); err == nil {
		entry := audit.AuditLogEntry{
			ID:        walletID + "-import-backup",
			WalletID:  walletID,
			Timestamp: now,
			Operation: "WALLET_IMPORT_BACKUP",
			Status:    "SUCCESS",
		}
		_ = auditLogger.LogOperation(entry)
	}

	return wallet, nil
}
