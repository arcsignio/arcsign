// Package security - XOR-based secret sharing for private key protection
package security

import (
	"crypto/rand"
	"fmt"
)

// SecretShares holds XOR-split shares of a secret.
//
// The original secret can be reconstructed by XORing all shares together.
// This provides defense-in-depth: even if an attacker dumps memory,
// they need to find and combine all shares to recover the secret.
//
// Design:
// - 3 shares for 32-byte private key = 96 bytes of random-looking data
// - Shares are stored in separate memory locations
// - Original secret is never stored; only reconstructed momentarily for signing
type SecretShares struct {
	share1 []byte // Random bytes
	share2 []byte // Random bytes
	share3 []byte // secret XOR share1 XOR share2
}

// SplitSecret splits a secret into 3 XOR shares.
//
// Algorithm:
//  1. Generate share1 = random bytes
//  2. Generate share2 = random bytes
//  3. Compute share3 = secret XOR share1 XOR share2
//
// The original secret is zeroed after splitting.
//
// Parameters:
// - secret: The secret to split (e.g., 32-byte private key)
//
// Returns:
// - SecretShares containing 3 XOR shares
// - Error if random generation fails
//
// Security Note: The input secret is zeroed after splitting.
func SplitSecret(secret []byte) (*SecretShares, error) {
	if len(secret) == 0 {
		return nil, fmt.Errorf("secret cannot be empty")
	}

	size := len(secret)

	// Allocate shares with mlock (best-effort)
	share1 := SecureAlloc(size)
	share2 := SecureAlloc(size)
	share3 := SecureAlloc(size)

	// Generate random share1
	if _, err := rand.Read(share1); err != nil {
		SecureFree(share1)
		SecureFree(share2)
		SecureFree(share3)
		return nil, fmt.Errorf("failed to generate share1: %w", err)
	}

	// Generate random share2
	if _, err := rand.Read(share2); err != nil {
		SecureFree(share1)
		SecureFree(share2)
		SecureFree(share3)
		return nil, fmt.Errorf("failed to generate share2: %w", err)
	}

	// Compute share3 = secret XOR share1 XOR share2
	for i := 0; i < size; i++ {
		share3[i] = secret[i] ^ share1[i] ^ share2[i]
	}

	// Zero the original secret immediately
	SecureZero(secret)

	return &SecretShares{
		share1: share1,
		share2: share2,
		share3: share3,
	}, nil
}

// Reconstruct combines all shares to recover the original secret.
//
// Algorithm: secret = share1 XOR share2 XOR share3
//
// IMPORTANT: The returned slice should be zeroed immediately after use.
// Use SignAndZeroize pattern or defer SecureZero(reconstructed).
//
// Returns:
// - Reconstructed secret (same length as original)
func (s *SecretShares) Reconstruct() []byte {
	if s.share1 == nil || s.share2 == nil || s.share3 == nil {
		return nil
	}

	size := len(s.share1)
	result := SecureAlloc(size)

	// Reconstruct: secret = share1 XOR share2 XOR share3
	for i := 0; i < size; i++ {
		result[i] = s.share1[i] ^ s.share2[i] ^ s.share3[i]
	}

	return result
}

// ReconstructInto reconstructs the secret into an existing buffer.
//
// This avoids an extra allocation, useful when you already have
// a pre-allocated secure buffer.
//
// Parameters:
// - dst: Destination buffer (must be same length as shares)
//
// Returns error if buffer size doesn't match.
func (s *SecretShares) ReconstructInto(dst []byte) error {
	if s.share1 == nil || s.share2 == nil || s.share3 == nil {
		return fmt.Errorf("shares not initialized")
	}

	if len(dst) != len(s.share1) {
		return fmt.Errorf("destination buffer size mismatch: expected %d, got %d",
			len(s.share1), len(dst))
	}

	for i := range dst {
		dst[i] = s.share1[i] ^ s.share2[i] ^ s.share3[i]
	}

	return nil
}

// Zeroize securely clears all shares from memory.
//
// This should be called when the shares are no longer needed.
// After calling Zeroize, Reconstruct will return nil.
func (s *SecretShares) Zeroize() {
	if s.share1 != nil {
		SecureFree(s.share1)
		s.share1 = nil
	}
	if s.share2 != nil {
		SecureFree(s.share2)
		s.share2 = nil
	}
	if s.share3 != nil {
		SecureFree(s.share3)
		s.share3 = nil
	}
}

// Refresh re-randomizes the shares without changing the secret.
//
// This can be called periodically to limit the window for memory attacks.
// The secret value remains unchanged (share1 XOR share2 XOR share3 = same).
//
// Algorithm:
//  1. Generate new random r1
//  2. Generate new random r2
//  3. Compute r3 = (secret XOR share1 XOR share2) = share3 XOR (old_share1 XOR new_share1) XOR (old_share2 XOR new_share2)
//
// Actually simpler: just reconstruct, then re-split.
//
// Returns error if refresh fails.
func (s *SecretShares) Refresh() error {
	// Reconstruct current secret
	secret := s.Reconstruct()
	if secret == nil {
		return fmt.Errorf("cannot refresh: shares not initialized")
	}
	defer SecureZero(secret)

	// Generate new random shares
	size := len(secret)

	newShare1 := SecureAlloc(size)
	newShare2 := SecureAlloc(size)
	newShare3 := SecureAlloc(size)

	if _, err := rand.Read(newShare1); err != nil {
		SecureFree(newShare1)
		SecureFree(newShare2)
		SecureFree(newShare3)
		return fmt.Errorf("failed to refresh share1: %w", err)
	}

	if _, err := rand.Read(newShare2); err != nil {
		SecureFree(newShare1)
		SecureFree(newShare2)
		SecureFree(newShare3)
		return fmt.Errorf("failed to refresh share2: %w", err)
	}

	for i := 0; i < size; i++ {
		newShare3[i] = secret[i] ^ newShare1[i] ^ newShare2[i]
	}

	// Swap and zero old shares
	oldShare1, oldShare2, oldShare3 := s.share1, s.share2, s.share3
	s.share1, s.share2, s.share3 = newShare1, newShare2, newShare3

	SecureFree(oldShare1)
	SecureFree(oldShare2)
	SecureFree(oldShare3)

	return nil
}

// Size returns the size of the secret in bytes.
func (s *SecretShares) Size() int {
	if s.share1 == nil {
		return 0
	}
	return len(s.share1)
}

// IsValid returns true if shares are properly initialized.
func (s *SecretShares) IsValid() bool {
	return s.share1 != nil && s.share2 != nil && s.share3 != nil &&
		len(s.share1) == len(s.share2) && len(s.share2) == len(s.share3)
}
