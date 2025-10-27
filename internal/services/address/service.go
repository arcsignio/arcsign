package address

import (
	"crypto/sha256"
	"fmt"
	"log"
	"time"

	"github.com/btcsuite/btcd/btcutil"
	"github.com/btcsuite/btcd/btcutil/hdkeychain"
	"github.com/btcsuite/btcd/chaincfg"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/yourusername/arcsign/internal/models"
	"github.com/yourusername/arcsign/internal/services/coinregistry"
	"golang.org/x/crypto/ripemd160"
)

// AddressService handles cryptocurrency address derivation
type AddressService struct {
	btcParams *chaincfg.Params
}

// NewAddressService creates a new address service
func NewAddressService() *AddressService {
	return &AddressService{
		btcParams: &chaincfg.MainNetParams,
	}
}

// DeriveBitcoinAddress derives a Bitcoin P2PKH address from an extended key
// Returns a base58-encoded Bitcoin address (e.g., 1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa)
func (s *AddressService) DeriveBitcoinAddress(key *hdkeychain.ExtendedKey) (string, error) {
	// Get public key
	pubKey, err := key.ECPubKey()
	if err != nil {
		return "", fmt.Errorf("failed to get public key: %w", err)
	}

	// Create Bitcoin address (P2PKH - Pay to Public Key Hash)
	address, err := btcutil.NewAddressPubKey(pubKey.SerializeCompressed(), s.btcParams)
	if err != nil {
		return "", fmt.Errorf("failed to create Bitcoin address: %w", err)
	}

	// Return the P2PKH address string
	return address.EncodeAddress(), nil
}

// DeriveEthereumAddress derives an Ethereum address from an extended key
// Returns a hex-encoded Ethereum address (e.g., 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb)
func (s *AddressService) DeriveEthereumAddress(key *hdkeychain.ExtendedKey) (string, error) {
	// Get public key
	pubKey, err := key.ECPubKey()
	if err != nil {
		return "", fmt.Errorf("failed to get public key: %w", err)
	}

	// Convert to uncompressed format (65 bytes: 0x04 + X + Y)
	uncompressed := pubKey.SerializeUncompressed()

	// Ethereum address = last 20 bytes of Keccak256(uncompressed public key without 0x04 prefix)
	// Skip the first byte (0x04) and hash the remaining 64 bytes
	hash := crypto.Keccak256(uncompressed[1:])

	// Take last 20 bytes and add 0x prefix
	address := fmt.Sprintf("0x%x", hash[len(hash)-20:])

	return address, nil
}

// GetPublicKeyHash returns the RIPEMD160(SHA256(pubkey)) hash
// Used for Bitcoin address derivation
func (s *AddressService) GetPublicKeyHash(publicKey []byte) []byte {
	// SHA256
	sha := sha256.Sum256(publicKey)

	// RIPEMD160
	ripemd := ripemd160.New()
	ripemd.Write(sha[:])
	return ripemd.Sum(nil)
}

// FormatAddressWithLabel returns a formatted address string with label
func (s *AddressService) FormatAddressWithLabel(coinType string, address string, path string) string {
	return fmt.Sprintf("[%s] %s\n  Derivation Path: %s", coinType, address, path)
}

// retryOnce executes a function once, and retries one more time if it fails (v0.3.0+)
// Returns: result, attempts (1 or 2), error
func retryOnce(fn func() (string, error)) (string, int, error) {
	// First attempt
	result, err := fn()
	if err == nil {
		return result, 1, nil
	}

	// Retry once
	result, retryErr := fn()
	if retryErr == nil {
		return result, 2, nil
	}

	// Both attempts failed, return the retry error
	return "", 2, retryErr
}

// T050: GenerateMultiCoinAddresses generates addresses for all coins in the registry
// T052: Implements graceful failure handling - continues with remaining coins if one fails
// v0.3.0+: Now includes retry-once logic and generation metrics tracking
func (s *AddressService) GenerateMultiCoinAddresses(masterKey *hdkeychain.ExtendedKey, registry *coinregistry.Registry) (*models.AddressBook, *models.GenerationMetrics, error) {
	startTime := time.Now()
	coins := registry.GetAllCoinsSortedByMarketCap()
	addresses := make([]models.DerivedAddress, 0, len(coins))

	// Initialize metrics
	metrics := &models.GenerationMetrics{
		TotalChains:     len(coins),
		SuccessCount:    0,
		FailureCount:    0,
		RetryCount:      0,
		PerChainMetrics: make(map[string]models.ChainMetric),
	}

	// Generate address for each coin
	for _, coin := range coins {
		chainStart := time.Now()

		// Wrap address generation in retry-once logic
		address, attempts, err := retryOnce(func() (string, error) {
			// Derive BIP44 path: m/44'/coin_type'/0'/0/0
			purpose, err := masterKey.Derive(hdkeychain.HardenedKeyStart + 44)
			if err != nil {
				return "", fmt.Errorf("failed to derive purpose: %w", err)
			}

			coinTypeKey, err := purpose.Derive(hdkeychain.HardenedKeyStart + coin.CoinType)
			if err != nil {
				return "", fmt.Errorf("failed to derive coin type: %w", err)
			}

			accountKey, err := coinTypeKey.Derive(hdkeychain.HardenedKeyStart + 0)
			if err != nil {
				return "", fmt.Errorf("failed to derive account: %w", err)
			}

			externalKey, err := accountKey.Derive(0)
			if err != nil {
				return "", fmt.Errorf("failed to derive external chain: %w", err)
			}

			addressKey, err := externalKey.Derive(0)
			if err != nil {
				return "", fmt.Errorf("failed to derive address key: %w", err)
			}

			return s.deriveAddressByFormatter(addressKey, coin.FormatterID)
		})

		chainDuration := time.Since(chainStart)

		// Track metrics for this chain
		chainMetric := models.ChainMetric{
			Symbol:   coin.Symbol,
			Duration: chainDuration,
			Attempts: attempts,
		}

		if err != nil {
			// Generation failed
			log.Printf("Failed to generate address for %s after %d attempt(s): %v", coin.Symbol, attempts, err)
			chainMetric.Success = false
			chainMetric.ErrorMessage = err.Error()
			metrics.FailureCount++
			if attempts > 1 {
				metrics.RetryCount++
			}
		} else {
			// Generation succeeded
			chainMetric.Success = true
			metrics.SuccessCount++
			if attempts > 1 {
				metrics.RetryCount++
			}

			// Create DerivedAddress with Category field (v0.3.0+)
			derivedAddr := models.DerivedAddress{
				Symbol:         coin.Symbol,
				CoinName:       coin.Name,
				CoinType:       coin.CoinType,
				Address:        address,
				DerivationPath: fmt.Sprintf("m/44'/%d'/0'/0/0", coin.CoinType),
				MarketCapRank:  coin.MarketCapRank,
				Category:       coin.Category,
			}

			addresses = append(addresses, derivedAddr)
		}

		metrics.PerChainMetrics[coin.Symbol] = chainMetric
	}

	metrics.TotalDuration = time.Since(startTime)

	log.Printf("Multi-coin address generation complete: %d successful, %d failed, %d retries, %.2f%% success rate, total time: %v",
		metrics.SuccessCount, metrics.FailureCount, metrics.RetryCount, metrics.SuccessRate(), metrics.TotalDuration)

	return &models.AddressBook{
		Addresses: addresses,
	}, metrics, nil
}

// deriveAddressByFormatter calls the appropriate formatter method based on FormatterID
func (s *AddressService) deriveAddressByFormatter(key *hdkeychain.ExtendedKey, formatterID string) (string, error) {
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
		// T049: Harmony uses Ethereum derivation + Bech32 encoding
		ecdsaPrivKey, err := key.ECPrivKey()
		if err != nil {
			return "", fmt.Errorf("failed to get ECDSA private key for Harmony: %w", err)
		}
		return s.DeriveHarmonyAddress(ecdsaPrivKey.ToECDSA())
	// T069: Cosmos ecosystem chains (User Story 3)
	case "osmosis":
		return s.DeriveOsmosisAddress(key)
	case "juno":
		return s.DeriveJunoAddress(key)
	case "evmos":
		return s.DeriveEvmosAddress(key)
	case "secret":
		return s.DeriveSecretAddress(key)
	// T090, T095, T101, T108: Specialized chains (User Story 5 - complete)
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
