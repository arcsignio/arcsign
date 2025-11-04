// Package chainadapter - Transaction signing abstractions
package chainadapter

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
