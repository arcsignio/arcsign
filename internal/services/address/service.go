package address

import (
	"crypto/sha256"
	"fmt"
	"log"

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

// T050: GenerateMultiCoinAddresses generates addresses for all coins in the registry
// T052: Implements graceful failure handling - continues with remaining coins if one fails
func (s *AddressService) GenerateMultiCoinAddresses(masterKey *hdkeychain.ExtendedKey, registry *coinregistry.Registry) (*models.AddressBook, error) {
	coins := registry.GetAllCoinsSortedByMarketCap()
	addresses := make([]models.DerivedAddress, 0, len(coins))

	successCount := 0
	failCount := 0

	// Generate address for each coin
	for _, coin := range coins {
		// Derive BIP44 path: m/44'/coin_type'/0'/0/0
		// Path components: purpose=44, coin_type, account=0, change=0, address_index=0

		// Derive account key: m/44'/coin_type'/0'
		purpose, err := masterKey.Derive(hdkeychain.HardenedKeyStart + 44)
		if err != nil {
			log.Printf("Failed to derive purpose for %s: %v", coin.Symbol, err)
			failCount++
			continue
		}

		coinTypeKey, err := purpose.Derive(hdkeychain.HardenedKeyStart + coin.CoinType)
		if err != nil {
			log.Printf("Failed to derive coin type for %s: %v", coin.Symbol, err)
			failCount++
			continue
		}

		accountKey, err := coinTypeKey.Derive(hdkeychain.HardenedKeyStart + 0)
		if err != nil {
			log.Printf("Failed to derive account for %s: %v", coin.Symbol, err)
			failCount++
			continue
		}

		// Derive external chain: m/44'/coin_type'/0'/0
		externalKey, err := accountKey.Derive(0)
		if err != nil {
			log.Printf("Failed to derive external chain for %s: %v", coin.Symbol, err)
			failCount++
			continue
		}

		// Derive first address: m/44'/coin_type'/0'/0/0
		addressKey, err := externalKey.Derive(0)
		if err != nil {
			log.Printf("Failed to derive address key for %s: %v", coin.Symbol, err)
			failCount++
			continue
		}

		// Generate address using appropriate formatter
		address, err := s.deriveAddressByFormatter(addressKey, coin.FormatterID)
		if err != nil {
			log.Printf("Failed to generate address for %s (%s): %v", coin.Symbol, coin.FormatterID, err)
			failCount++
			continue
		}

		// Create DerivedAddress
		derivedAddr := models.DerivedAddress{
			Symbol:         coin.Symbol,
			CoinName:       coin.Name,
			CoinType:       coin.CoinType,
			Address:        address,
			DerivationPath: fmt.Sprintf("m/44'/%d'/0'/0/0", coin.CoinType),
			MarketCapRank:  coin.MarketCapRank,
		}

		addresses = append(addresses, derivedAddr)
		successCount++
	}

	log.Printf("Multi-coin address generation complete: %d successful, %d failed", successCount, failCount)

	return &models.AddressBook{
		Addresses: addresses,
	}, nil
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
	default:
		return "", fmt.Errorf("unsupported formatter: %s", formatterID)
	}
}
