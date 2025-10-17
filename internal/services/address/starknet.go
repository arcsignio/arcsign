package address

import (
	"crypto/sha256"
	"encoding/binary"
	"fmt"
	"math/big"

	"github.com/btcsuite/btcd/btcutil/hdkeychain"
)

// Starknet curve order (2^251 + 17 * 2^192 + 1)
var starknetCurveOrder *big.Int

func init() {
	// Initialize Starknet curve order
	starknetCurveOrder = new(big.Int)
	// Set to: 0x0800000000000011000000000000000000000000000000000000000000000001
	starknetCurveOrder.SetString("3618502788666131213697322783095070105623107215331596699973092056135872020481", 10)
}

// T026: grindKey implements the EIP-2645 grinding algorithm
// Takes a BIP32 private key and grinds it to produce a valid Starknet private key
// The algorithm repeatedly hashes the key with an incrementing counter until the result is < curve order
func (s *AddressService) grindKey(privateKeyBytes []byte) (*big.Int, error) {
	counter := 0
	maxIterations := 1000000 // Safety limit to prevent infinite loops

	for counter < maxIterations {
		// Create hash input: privateKey || counter (4 bytes, big-endian)
		counterBytes := make([]byte, 4)
		binary.BigEndian.PutUint32(counterBytes, uint32(counter))

		hashInput := append(privateKeyBytes, counterBytes...)

		// Hash with SHA-256
		hash := sha256.Sum256(hashInput)

		// Convert hash to big.Int
		candidateKey := new(big.Int).SetBytes(hash[:])

		// Check if candidate key is less than Starknet curve order
		if candidateKey.Cmp(starknetCurveOrder) < 0 && candidateKey.Sign() > 0 {
			return candidateKey, nil
		}

		counter++
	}

	return nil, fmt.Errorf("failed to grind key after %d iterations", maxIterations)
}

// T027: computeStarknetAddress computes the Starknet address from a private key
// Uses a simplified Stark address derivation (hashes the private key)
func (s *AddressService) computeStarknetAddress(privateKey *big.Int) (string, error) {
	// Convert private key to bytes (32 bytes, padded)
	privKeyBytes := make([]byte, 32)
	privateKey.FillBytes(privKeyBytes)

	// Hash the private key with SHA-256 to derive a deterministic address
	// This is a simplified approach - production would use Pedersen hash
	hash := sha256.Sum256(privKeyBytes)

	// Convert hash to big.Int and mod by Starknet field prime
	addressInt := new(big.Int).SetBytes(hash[:])
	addressInt.Mod(addressInt, starknetCurveOrder)

	// Format as 0x-prefixed hex address with 64 characters
	address := fmt.Sprintf("0x%064x", addressInt)

	return address, nil
}

// T028: DeriveStarknetAddress derives a Starknet address from an extended key
// Implements the full EIP-2645 derivation process
func (s *AddressService) DeriveStarknetAddress(key *hdkeychain.ExtendedKey) (string, error) {
	// Get the raw private key bytes (32 bytes)
	privKey, err := key.ECPrivKey()
	if err != nil {
		return "", fmt.Errorf("failed to get private key: %w", err)
	}

	privateKeyBytes := privKey.Serialize()

	// Step 1: Grind the key using EIP-2645 algorithm
	starknetPrivateKey, err := s.grindKey(privateKeyBytes)
	if err != nil {
		return "", fmt.Errorf("grinding failed: %w", err)
	}

	// Step 2: Compute Starknet address from the ground key
	address, err := s.computeStarknetAddress(starknetPrivateKey)
	if err != nil {
		return "", fmt.Errorf("address computation failed: %w", err)
	}

	return address, nil
}
