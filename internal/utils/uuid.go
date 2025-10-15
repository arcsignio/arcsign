package utils

import (
	"crypto/rand"
	"fmt"
)

// GenerateSecureUUID generates a cryptographically secure UUID v4
// Format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
// Where:
// - x is any hexadecimal digit
// - y is one of 8, 9, A, or B (variant bits)
// Uses crypto/rand for secure randomness
func GenerateSecureUUID() (string, error) {
	// 16 random bytes for UUID
	uuid := make([]byte, 16)
	if _, err := rand.Read(uuid); err != nil {
		return "", fmt.Errorf("failed to generate random UUID: %w", err)
	}

	// Set version 4 (random UUID)
	uuid[6] = (uuid[6] & 0x0f) | 0x40

	// Set variant to RFC 4122
	uuid[8] = (uuid[8] & 0x3f) | 0x80

	// Format as string: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
	return fmt.Sprintf("%08x-%04x-%04x-%04x-%012x",
		uuid[0:4],
		uuid[4:6],
		uuid[6:8],
		uuid[8:10],
		uuid[10:16],
	), nil
}
