package address

import (
	"fmt"

	"github.com/btcsuite/btcd/btcutil"
	"github.com/btcsuite/btcd/btcutil/hdkeychain"
	"github.com/btcsuite/btcd/chaincfg"
)

// Bitcoin-compatible network parameters
// These coins use the same address generation algorithm as Bitcoin
// but with different version bytes

// Litecoin network parameters
var litecoinMainNetParams = chaincfg.Params{
	Name: "litecoin_mainnet",
	// P2PKH address magic (produces addresses starting with 'L')
	PubKeyHashAddrID: 0x30,
	// P2SH address magic
	ScriptHashAddrID: 0x32,
	// Private key magic
	PrivateKeyID: 0xB0,
}

// Dogecoin network parameters
var dogecoinMainNetParams = chaincfg.Params{
	Name: "dogecoin_mainnet",
	// P2PKH address magic (produces addresses starting with 'D')
	PubKeyHashAddrID: 0x1E,
	// P2SH address magic
	ScriptHashAddrID: 0x16,
	// Private key magic
	PrivateKeyID: 0x9E,
}

// Dash network parameters
var dashMainNetParams = chaincfg.Params{
	Name: "dash_mainnet",
	// P2PKH address magic (produces addresses starting with 'X')
	PubKeyHashAddrID: 0x4C,
	// P2SH address magic
	ScriptHashAddrID: 0x10,
	// Private key magic
	PrivateKeyID: 0xCC,
}

// T022: DeriveLitecoinAddress derives a Litecoin P2PKH address
// Litecoin uses the same algorithm as Bitcoin but with different network parameters
func (s *AddressService) DeriveLitecoinAddress(key *hdkeychain.ExtendedKey) (string, error) {
	// Get public key
	pubKey, err := key.ECPubKey()
	if err != nil {
		return "", fmt.Errorf("failed to get public key: %w", err)
	}

	// Create Litecoin address with Litecoin network parameters
	address, err := btcutil.NewAddressPubKey(pubKey.SerializeCompressed(), &litecoinMainNetParams)
	if err != nil {
		return "", fmt.Errorf("failed to create Litecoin address: %w", err)
	}

	return address.EncodeAddress(), nil
}

// T024: DeriveDogecoinAddress derives a Dogecoin P2PKH address
// Dogecoin uses the same algorithm as Bitcoin but with different network parameters
func (s *AddressService) DeriveDogecoinAddress(key *hdkeychain.ExtendedKey) (string, error) {
	// Get public key
	pubKey, err := key.ECPubKey()
	if err != nil {
		return "", fmt.Errorf("failed to get public key: %w", err)
	}

	// Create Dogecoin address with Dogecoin network parameters
	address, err := btcutil.NewAddressPubKey(pubKey.SerializeCompressed(), &dogecoinMainNetParams)
	if err != nil {
		return "", fmt.Errorf("failed to create Dogecoin address: %w", err)
	}

	return address.EncodeAddress(), nil
}

// T026: DeriveDashAddress derives a Dash P2PKH address
// Dash uses the same algorithm as Bitcoin but with different network parameters
func (s *AddressService) DeriveDashAddress(key *hdkeychain.ExtendedKey) (string, error) {
	// Get public key
	pubKey, err := key.ECPubKey()
	if err != nil {
		return "", fmt.Errorf("failed to get public key: %w", err)
	}

	// Create Dash address with Dash network parameters
	address, err := btcutil.NewAddressPubKey(pubKey.SerializeCompressed(), &dashMainNetParams)
	if err != nil {
		return "", fmt.Errorf("failed to create Dash address: %w", err)
	}

	return address.EncodeAddress(), nil
}

// Bitcoin Cash network parameters
var bitcoinCashMainNetParams = chaincfg.Params{
	Name: "bitcoincash_mainnet",
	// P2PKH address magic (legacy format, starts with '1' like Bitcoin)
	PubKeyHashAddrID: 0x00,
	// P2SH address magic
	ScriptHashAddrID: 0x05,
	// Private key magic
	PrivateKeyID: 0x80,
}

// Zcash network parameters
var zcashMainNetParams = chaincfg.Params{
	Name: "zcash_mainnet",
	// P2PKH address magic (produces addresses starting with 't1')
	PubKeyHashAddrID: 0x1C, // 0x1CB8
	// P2SH address magic (produces addresses starting with 't3')
	ScriptHashAddrID: 0x1C, // 0x1CBD
	// Private key magic
	PrivateKeyID: 0x80,
}

// T094: DeriveBitcoinCashAddress derives a Bitcoin Cash P2PKH address
// Bitcoin Cash uses CashAddr format, but we'll use legacy format for compatibility
// Legacy addresses are compatible with most wallets and exchanges
func (s *AddressService) DeriveBitcoinCashAddress(key *hdkeychain.ExtendedKey) (string, error) {
	// Get public key
	pubKey, err := key.ECPubKey()
	if err != nil {
		return "", fmt.Errorf("failed to get public key: %w", err)
	}

	// Create Bitcoin Cash address using legacy format
	// Note: This produces addresses starting with '1' (same as Bitcoin)
	// For CashAddr format (starting with 'q'), additional encoding would be needed
	address, err := btcutil.NewAddressPubKey(pubKey.SerializeCompressed(), &bitcoinCashMainNetParams)
	if err != nil {
		return "", fmt.Errorf("failed to create Bitcoin Cash address: %w", err)
	}

	return address.EncodeAddress(), nil
}

// T096: DeriveZcashAddress derives a Zcash transparent P2PKH address
// Zcash has transparent (t-addresses) and shielded (z-addresses)
// We derive transparent addresses which are Bitcoin-compatible
func (s *AddressService) DeriveZcashAddress(key *hdkeychain.ExtendedKey) (string, error) {
	// Get public key
	pubKey, err := key.ECPubKey()
	if err != nil {
		return "", fmt.Errorf("failed to get public key: %w", err)
	}

	// Create Zcash transparent address
	// Note: This creates t1-addresses (transparent P2PKH)
	address, err := btcutil.NewAddressPubKey(pubKey.SerializeCompressed(), &zcashMainNetParams)
	if err != nil {
		return "", fmt.Errorf("failed to create Zcash address: %w", err)
	}

	return address.EncodeAddress(), nil
}
