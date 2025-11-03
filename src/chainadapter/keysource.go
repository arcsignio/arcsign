// Package chainadapter - Key source and signing abstractions
package chainadapter

// KeySource abstracts key material sources for address derivation.
// Implementations MUST NOT expose private key material directly.
type KeySource interface {
	// Type returns the type of key source
	Type() KeySourceType

	// GetPublicKey derives the public key for the given BIP44 derivation path.
	// Path format: m/44'/cointype'/account'/change/index
	//
	// Returns:
	// - Public key bytes (compressed format)
	// - Error if path is invalid or derivation fails
	GetPublicKey(path string) ([]byte, error)
}

// KeySourceType identifies the type of key source
type KeySourceType string

const (
	// KeySourceMnemonic represents a BIP39 mnemonic phrase
	KeySourceMnemonic KeySourceType = "mnemonic"

	// KeySourceXPub represents an extended public key (xpub/ypub/zpub)
	KeySourceXPub KeySourceType = "xpub"

	// KeySourceHardwareWallet represents a hardware wallet (Ledger/Trezor)
	KeySourceHardwareWallet KeySourceType = "hardware"
)

// Signer abstracts transaction signing.
// Implementations MUST verify that the signing address matches the requested address.
type Signer interface {
	// Sign signs the given payload for the specified address.
	//
	// Contract:
	// - MUST verify that the signer controls the given address
	// - MUST return raw signature bytes (chain-specific format)
	// - MUST NOT leak private key material
	//
	// Parameters:
	// - payload: Binary data to sign (e.g., transaction hash)
	// - address: Address that should sign (for verification)
	//
	// Returns:
	// - Signature bytes
	// - Error if address doesn't match or signing fails
	Sign(payload []byte, address string) ([]byte, error)

	// GetAddress returns the address controlled by this signer
	GetAddress() string
}
