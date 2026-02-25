// Package app provides application-level services for arcSign.
// This file implements the Developer Mode session manager for auto-signing.
//
// Security Design:
// - Private keys are stored using SecureSigner (XOR-split into 3 shares)
// - Sessions auto-expire after the configured duration
// - Periodic cleanup removes expired sessions
// - Only testnet chains can be auto-signed
//
// Created: 2026-02-09
package app

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"math/big"
	"strings"
	"sync"
	"time"

	"github.com/arcsign/chainadapter"
	ethcrypto "github.com/ethereum/go-ethereum/crypto"
	"github.com/yourusername/arcsign/internal/security"
	"github.com/yourusername/arcsign/internal/services/bip39service"
	chainadapterService "github.com/yourusername/arcsign/internal/services/chainadapter"
	"github.com/yourusername/arcsign/internal/services/hdkey"
	"github.com/yourusername/arcsign/internal/services/wallet"
)

var (
	ErrDevSessionNotFound     = errors.New("developer session not found or expired")
	ErrDevSessionExpired      = errors.New("developer session has expired")
	ErrDevSessionInvalidAuth  = errors.New("invalid wallet credentials")
	ErrDevSessionAddressNotFound = errors.New("address not found in wallet")
	ErrDevSessionMainnetBlocked  = errors.New("mainnet transactions require manual approval")
	ErrDevSessionNetworkNotTrusted = errors.New("network not in trusted networks list")
)

// Testnet chain IDs that can be auto-signed
var TestnetChainIDs = map[int64]string{
	5:        "goerli",
	11155111: "sepolia",
	97:       "bsc-testnet",
	80001:    "mumbai",
	421613:   "arbitrum-goerli",
	420:      "optimism-goerli",
	84531:    "base-goerli",
}

// Mainnet chain IDs that ALWAYS require manual approval
var MainnetChainIDs = map[int64]string{
	1:     "ethereum",
	56:    "bsc",
	137:   "polygon",
	42161: "arbitrum",
	10:    "optimism",
	8453:  "base",
}

// DevSessionManager manages developer sessions for auto-signing
type DevSessionManager struct {
	sessions map[string]*DevSession
	mu       sync.RWMutex

	// Services
	chainAdapterSvc *chainadapterService.Service
}

// DevSession represents an active developer session
type DevSession struct {
	Token           string
	WalletID        string
	UsbPath         string
	CreatedAt       time.Time
	ExpiresAt       time.Time
	LastUsed        time.Time
	SignCount       int
	TrustedNetworks []string // e.g., ["sepolia", "goerli", "bsc-testnet"]

	// Stored signers per address (XOR-split key storage)
	signers map[string]*security.SecureSigner // address -> signer
	mu      sync.RWMutex
}

// DevSessionConfig contains configuration for creating a new session
type DevSessionConfig struct {
	WalletID        string
	Password        string
	Passphrase      string // BIP39 passphrase (optional)
	UsbPath         string
	DurationMinutes int
	TrustedNetworks []string
}

// NewDevSessionManager creates a new developer session manager
func NewDevSessionManager(chainAdapterSvc *chainadapterService.Service) *DevSessionManager {
	dsm := &DevSessionManager{
		sessions:        make(map[string]*DevSession),
		chainAdapterSvc: chainAdapterSvc,
	}

	// Start cleanup goroutine
	go dsm.cleanupExpiredSessions()

	return dsm
}

// CreateSession creates a new developer session with pre-loaded signing keys
func (dsm *DevSessionManager) CreateSession(config DevSessionConfig) (*DevSession, error) {
	// Validate duration (max 120 minutes)
	if config.DurationMinutes <= 0 {
		config.DurationMinutes = 30 // Default
	}
	if config.DurationMinutes > 120 {
		config.DurationMinutes = 120
	}

	// Default trusted networks (all testnets)
	if len(config.TrustedNetworks) == 0 {
		config.TrustedNetworks = []string{"sepolia", "goerli", "bsc-testnet", "mumbai"}
	}

	// Step 1: Decrypt wallet to get mnemonic
	walletSvc := wallet.NewWalletService(config.UsbPath)
	mnemonic, err := walletSvc.RestoreWallet(config.WalletID, config.Password)
	if err != nil {
		return nil, ErrDevSessionInvalidAuth
	}
	defer secureZeroString(&mnemonic)

	// Step 2: Load wallet metadata to get AddressBook
	walletObj, err := walletSvc.LoadWallet(config.WalletID)
	if err != nil {
		return nil, fmt.Errorf("failed to load wallet: %w", err)
	}

	if walletObj.AddressBook == nil || len(walletObj.AddressBook.Addresses) == 0 {
		return nil, errors.New("wallet has no addresses")
	}

	// Step 3: Create session
	token, err := generateSecureDevToken()
	if err != nil {
		return nil, err
	}

	now := time.Now()
	session := &DevSession{
		Token:           token,
		WalletID:        config.WalletID,
		UsbPath:         config.UsbPath,
		CreatedAt:       now,
		ExpiresAt:       now.Add(time.Duration(config.DurationMinutes) * time.Minute),
		LastUsed:        now,
		SignCount:       0,
		TrustedNetworks: config.TrustedNetworks,
		signers:         make(map[string]*security.SecureSigner),
	}

	// Step 4: Pre-derive signing keys for EVM addresses
	bip39Svc := bip39service.NewBIP39Service()
	hdkeySvc := hdkey.NewHDKeyService()

	seed, err := bip39Svc.MnemonicToSeed(mnemonic, config.Passphrase)
	if err != nil {
		return nil, fmt.Errorf("failed to derive seed: %w", err)
	}

	masterKey, err := hdkeySvc.NewMasterKey(seed)
	if err != nil {
		return nil, fmt.Errorf("failed to create master key: %w", err)
	}

	// Pre-load signers for all EVM addresses
	for _, addr := range walletObj.AddressBook.Addresses {
		// Only handle EVM chains for now
		if !isEVMChain(addr.CoinType) {
			continue
		}

		childKey, err := hdkeySvc.DerivePath(masterKey, addr.DerivationPath)
		if err != nil {
			continue // Skip this address
		}

		privateKeyBytes, err := hdkeySvc.GetPrivateKey(childKey)
		if err != nil {
			continue
		}

		// Verify the derived address matches
		ethPrivKey, err := ethcrypto.ToECDSA(privateKeyBytes)
		if err != nil {
			security.SecureZero(privateKeyBytes)
			continue
		}
		derivedAddr := ethcrypto.PubkeyToAddress(ethPrivKey.PublicKey)

		if !strings.EqualFold(derivedAddr.Hex(), addr.Address) {
			security.SecureZero(privateKeyBytes)
			continue // Address mismatch
		}

		// Create SecureSigner (XOR-splits the key for protection)
		signer, err := security.NewSecureSigner(privateKeyBytes, addr.Address, "ethereum")
		if err != nil {
			security.SecureZero(privateKeyBytes)
			continue
		}

		session.signers[strings.ToLower(addr.Address)] = signer
	}

	if len(session.signers) == 0 {
		return nil, errors.New("no valid signing keys could be derived")
	}

	// Step 5: Store session
	dsm.mu.Lock()
	dsm.sessions[token] = session
	dsm.mu.Unlock()

	return session, nil
}

// GetSession retrieves a session by token
func (dsm *DevSessionManager) GetSession(token string) (*DevSession, error) {
	dsm.mu.RLock()
	session, exists := dsm.sessions[token]
	dsm.mu.RUnlock()

	if !exists {
		return nil, ErrDevSessionNotFound
	}

	if time.Now().After(session.ExpiresAt) {
		_ = dsm.EndSession(token)
		return nil, ErrDevSessionExpired
	}

	// Update last used
	session.mu.Lock()
	session.LastUsed = time.Now()
	session.mu.Unlock()

	return session, nil
}

// SignTransaction signs a transaction using the session's stored keys
func (dsm *DevSessionManager) SignTransaction(
	token string,
	chainID int64,
	from string,
	to string,
	data []byte,
	value *big.Int,
	gasLimit uint64,
	gasPrice *big.Int,
	maxFeePerGas *big.Int,
	maxPriorityFeePerGas *big.Int,
	nonce uint64,
) (*chainadapter.SignedTransaction, error) {
	// Step 1: Get session
	session, err := dsm.GetSession(token)
	if err != nil {
		return nil, err
	}

	// Step 2: Check if this is a mainnet (blocked)
	if _, isMainnet := MainnetChainIDs[chainID]; isMainnet {
		return nil, ErrDevSessionMainnetBlocked
	}

	// Step 3: Check if this is a trusted network
	networkName := chainIDToNetworkName(chainID)
	trusted := false
	for _, n := range session.TrustedNetworks {
		if n == networkName {
			trusted = true
			break
		}
	}
	if !trusted {
		return nil, ErrDevSessionNetworkNotTrusted
	}

	// Step 4: Get signer for this address
	session.mu.RLock()
	signer, exists := session.signers[strings.ToLower(from)]
	session.mu.RUnlock()

	if !exists {
		return nil, ErrDevSessionAddressNotFound
	}

	// Step 5: Build unsigned transaction
	adapterChainID := chainIDToAdapterID(chainID)
	unsigned := &chainadapter.UnsignedTransaction{
		ID:            fmt.Sprintf("dev-%d", time.Now().UnixNano()),
		ChainID:       adapterChainID,
		From:          from,
		To:            to,
		Amount:        value,
		ChainSpecific: make(map[string]interface{}),
	}

	// Set chain-specific parameters (use snake_case to match Ethereum adapter)
	unsigned.ChainSpecific["chain_id"] = chainID
	unsigned.ChainSpecific["nonce"] = nonce
	unsigned.ChainSpecific["gas_limit"] = gasLimit
	unsigned.ChainSpecific["data"] = data // Pass raw bytes, adapter handles encoding

	// Use EIP-1559 if available
	if maxFeePerGas != nil && maxPriorityFeePerGas != nil {
		unsigned.ChainSpecific["max_fee_per_gas"] = maxFeePerGas.String()
		unsigned.ChainSpecific["max_priority_fee_per_gas"] = maxPriorityFeePerGas.String()
		unsigned.ChainSpecific["type"] = 2 // EIP-1559
	} else if gasPrice != nil {
		unsigned.ChainSpecific["gas_price"] = gasPrice.String()
		unsigned.ChainSpecific["type"] = 0 // Legacy
	}

	// Step 6: Sign using ChainAdapter
	ctx := context.Background()
	signed, err := dsm.chainAdapterSvc.SignTransaction(ctx, unsigned.ChainID, unsigned, signer, "")
	if err != nil {
		return nil, fmt.Errorf("signing failed: %w", err)
	}

	// Step 7: Increment sign count
	session.mu.Lock()
	session.SignCount++
	session.mu.Unlock()

	return signed, nil
}

// SignMessage signs a message using EIP-191 (personal_sign)
func (dsm *DevSessionManager) SignMessage(token string, address string, message []byte) ([]byte, error) {
	session, err := dsm.GetSession(token)
	if err != nil {
		return nil, err
	}

	session.mu.RLock()
	signer, exists := session.signers[strings.ToLower(address)]
	session.mu.RUnlock()

	if !exists {
		return nil, ErrDevSessionAddressNotFound
	}

	// Sign using SecureSigner (requires address for verification)
	signature, err := signer.Sign(message, address)
	if err != nil {
		return nil, fmt.Errorf("signing failed: %w", err)
	}

	session.mu.Lock()
	session.SignCount++
	session.mu.Unlock()

	return signature, nil
}

// EndSession ends a developer session and clears all stored keys
func (dsm *DevSessionManager) EndSession(token string) error {
	dsm.mu.Lock()
	session, exists := dsm.sessions[token]
	if exists {
		delete(dsm.sessions, token)
	}
	dsm.mu.Unlock()

	if !exists {
		return ErrDevSessionNotFound
	}

	// Securely clear all stored signers
	session.mu.Lock()
	for _, signer := range session.signers {
		signer.Zeroize()
	}
	session.signers = nil
	session.mu.Unlock()

	return nil
}

// GetSessionInfo returns session info without exposing signers
func (dsm *DevSessionManager) GetSessionInfo(token string) (map[string]interface{}, error) {
	session, err := dsm.GetSession(token)
	if err != nil {
		return nil, err
	}

	session.mu.RLock()
	addresses := make([]string, 0, len(session.signers))
	for addr := range session.signers {
		addresses = append(addresses, addr)
	}
	session.mu.RUnlock()

	return map[string]interface{}{
		"walletId":        session.WalletID,
		"createdAt":       session.CreatedAt.UnixMilli(),
		"expiresAt":       session.ExpiresAt.UnixMilli(),
		"remainingMs":     time.Until(session.ExpiresAt).Milliseconds(),
		"signCount":       session.SignCount,
		"trustedNetworks": session.TrustedNetworks,
		"addresses":       addresses,
	}, nil
}

// cleanupExpiredSessions periodically removes expired sessions
func (dsm *DevSessionManager) cleanupExpiredSessions() {
	ticker := time.NewTicker(1 * time.Minute)
	defer ticker.Stop()

	for range ticker.C {
		dsm.mu.Lock()
		now := time.Now()
		for token, session := range dsm.sessions {
			if now.After(session.ExpiresAt) {
				// Securely clear signers
				session.mu.Lock()
				for _, signer := range session.signers {
					signer.Zeroize()
				}
				session.signers = nil
				session.mu.Unlock()

				delete(dsm.sessions, token)
			}
		}
		dsm.mu.Unlock()
	}
}

// Helper functions

func generateSecureDevToken() (string, error) {
	bytes := make([]byte, 32) // 256 bits
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return "dev_" + hex.EncodeToString(bytes), nil
}

func chainIDToNetworkName(chainID int64) string {
	if name, ok := TestnetChainIDs[chainID]; ok {
		return name
	}
	if name, ok := MainnetChainIDs[chainID]; ok {
		return name
	}
	return fmt.Sprintf("chain-%d", chainID)
}

// chainIDToAdapterID converts numeric chain ID to ChainAdapter format
// e.g., 11155111 -> "ethereum-sepolia", 97 -> "bsc-testnet"
func chainIDToAdapterID(chainID int64) string {
	switch chainID {
	// Mainnets
	case 1:
		return "ethereum"
	case 56:
		return "bsc"
	case 137:
		return "polygon"
	case 42161:
		return "arbitrum"
	case 10:
		return "optimism"
	case 8453:
		return "base"
	// Testnets
	case 5:
		return "ethereum-goerli"
	case 11155111:
		return "ethereum-sepolia"
	case 97:
		return "bsc-testnet"
	case 80001:
		return "polygon-mumbai"
	case 421613:
		return "arbitrum-goerli"
	case 420:
		return "optimism-goerli"
	case 84531:
		return "base-goerli"
	default:
		return fmt.Sprintf("ethereum-%d", chainID)
	}
}

func isEVMChain(coinType uint32) bool {
	// Ethereum and EVM-compatible chains
	// BIP44 coin types: 60 = ETH, 714 = BNB, etc.
	evmCoinTypes := map[uint32]bool{
		60:  true, // Ethereum
		714: true, // Binance Smart Chain
		966: true, // Polygon
	}
	return evmCoinTypes[coinType]
}

// secureZeroString securely zeros a string's underlying bytes
// Note: named differently from session.go's zeroString to avoid redeclaration
func secureZeroString(s *string) {
	if s == nil {
		return
	}
	bytes := []byte(*s)
	for i := range bytes {
		bytes[i] = 0
	}
	*s = ""
}
