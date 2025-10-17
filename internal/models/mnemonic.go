package models

import "errors"

// EncryptedMnemonic represents the encrypted BIP39 mnemonic stored on USB
type EncryptedMnemonic struct {
	Salt          []byte `json:"salt"`          // 16 bytes
	Nonce         []byte `json:"nonce"`         // 12 bytes
	Ciphertext    []byte `json:"ciphertext"`    // variable + 16-byte auth tag
	Argon2Time    uint32 `json:"argon2Time"`    // iterations
	Argon2Memory  uint32 `json:"argon2Memory"`  // KiB
	Argon2Threads uint8  `json:"argon2Threads"` // threads
	Version       uint8  `json:"version"`       // encryption format version
}

// ValidateArgon2Params validates Argon2id parameters
func ValidateArgon2Params(time uint32, memory uint32, threads uint8) error {
	if time < 3 || time > 10 {
		return errors.New("argon2 time must be between 3 and 10")
	}
	if memory < 65536 { // 64 MiB minimum
		return errors.New("argon2 memory must be at least 64 MiB (65536 KiB)")
	}
	if threads == 0 || threads > 16 {
		return errors.New("argon2 threads must be between 1 and 16")
	}
	return nil
}
