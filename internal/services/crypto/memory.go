package crypto

import "runtime"

// ClearBytes securely zeros out a byte slice to prevent sensitive data
// from remaining in memory. Uses runtime.KeepAlive to prevent compiler
// optimization from eliminating the zeroing operation.
func ClearBytes(b []byte) {
	if b == nil || len(b) == 0 {
		return
	}

	for i := range b {
		b[i] = 0
	}

	// Prevent compiler from optimizing away the zeroing
	runtime.KeepAlive(b)
}
