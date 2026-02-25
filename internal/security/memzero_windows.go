//go:build windows

package security

// mlock is a no-op on Windows.
// Windows does not support mlock via syscall; VirtualLock is available
// but not critical for this use case.
func mlock(b []byte) error {
	return nil
}

// munlock is a no-op on Windows.
func munlock(b []byte) error {
	return nil
}

// DisableCoreDump is a no-op on Windows.
// Windows uses different crash dump mechanisms (WER).
func DisableCoreDump() error {
	return nil
}
