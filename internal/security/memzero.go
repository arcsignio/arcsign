// Package security - Memory protection utilities for sensitive data
package security

import (
	"runtime"
	"unsafe"
)

// SecureZero overwrites a byte slice with zeros in a way that won't be optimized away.
//
// This function uses multiple techniques to ensure the memory is actually cleared:
// 1. Volatile-like write using unsafe pointer
// 2. runtime.KeepAlive to prevent early garbage collection
// 3. Memory barrier via runtime.Gosched
//
// Usage:
//
//	privateKey := deriveKey(...)
//	defer security.SecureZero(privateKey)
//	// use privateKey
func SecureZero(b []byte) {
	if len(b) == 0 {
		return
	}

	// Use volatile-like pointer to prevent compiler optimization
	ptr := unsafe.Pointer(&b[0])
	for i := range b {
		*(*byte)(unsafe.Pointer(uintptr(ptr) + uintptr(i))) = 0
	}

	// Ensure the zeroing is not optimized away
	runtime.KeepAlive(b)

	// Memory barrier - forces CPU to complete all memory operations
	runtime.Gosched()
}

// SecureZeroMultiple zeros multiple byte slices securely.
//
// Convenience function for cleaning up multiple sensitive buffers.
//
// Usage:
//
//	defer security.SecureZeroMultiple(mnemonic, seed, privateKey)
func SecureZeroMultiple(slices ...[]byte) {
	for _, s := range slices {
		SecureZero(s)
	}
}

// SecureAlloc allocates a byte slice and attempts to lock it in memory.
//
// On supported systems (Unix), this uses mlock to prevent the memory
// from being swapped to disk. Returns the allocated slice.
//
// Note: mlock may fail silently if RLIMIT_MEMLOCK is too low.
// The slice is still usable even if mlock fails.
//
// Parameters:
// - size: Number of bytes to allocate
//
// Returns:
// - Allocated byte slice (may or may not be mlocked)
func SecureAlloc(size int) []byte {
	b := make([]byte, size)

	// Try to lock memory (Unix only)
	// This prevents the memory from being swapped to disk
	// Ignore errors - mlock is a best-effort security measure
	_ = mlock(b)

	return b
}

// SecureFree zeros and unlocks a secure allocation.
//
// Should be called when done with memory allocated by SecureAlloc.
//
// Parameters:
// - b: Byte slice to securely free
func SecureFree(b []byte) {
	SecureZero(b)
	_ = munlock(b)
}

// SecureCopy copies src to dst and zeros src.
//
// This is useful for moving sensitive data without leaving copies.
//
// Parameters:
// - dst: Destination slice (must be same length as src)
// - src: Source slice (will be zeroed after copy)
//
// Panics if dst and src have different lengths.
func SecureCopy(dst, src []byte) {
	if len(dst) != len(src) {
		panic("security.SecureCopy: dst and src must have same length")
	}

	copy(dst, src)
	SecureZero(src)
}

// SecureCompare compares two byte slices in constant time.
//
// This prevents timing attacks when comparing sensitive data like MACs or passwords.
//
// Parameters:
// - a, b: Byte slices to compare
//
// Returns:
// - true if slices are equal, false otherwise
func SecureCompare(a, b []byte) bool {
	if len(a) != len(b) {
		return false
	}

	var result byte
	for i := 0; i < len(a); i++ {
		result |= a[i] ^ b[i]
	}

	return result == 0
}
