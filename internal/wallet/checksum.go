package wallet

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
)

// T024: Checksum computation and validation for addresses.json

// ComputeAddressesChecksum computes SHA-256 hash of addresses array
// The checksum is computed from the JSON serialization of the addresses array
// and is used for tamper detection when reading addresses.json files.
func ComputeAddressesChecksum(addresses []Address) string {
	// Serialize addresses to compact JSON
	serialized, err := json.Marshal(addresses)
	if err != nil {
		// This should never happen with valid Address structs
		panic(fmt.Sprintf("Failed to serialize addresses for checksum: %v", err))
	}

	// Compute SHA-256 hash
	hash := sha256.Sum256(serialized)

	// Convert to lowercase hex string (64 characters)
	return hex.EncodeToString(hash[:])
}

// ValidateAddressesFileChecksum validates the checksum of an AddressesFile
// Returns nil if checksum is valid, error if mismatch detected
func ValidateAddressesFileChecksum(file *AddressesFile) error {
	if file == nil {
		return fmt.Errorf("addresses file is nil")
	}

	// Compute checksum from addresses array
	computed := ComputeAddressesChecksum(file.Addresses)

	// Compare with stored checksum
	if computed != file.Checksum {
		return fmt.Errorf("checksum mismatch: expected %s, got %s", file.Checksum, computed)
	}

	return nil
}
