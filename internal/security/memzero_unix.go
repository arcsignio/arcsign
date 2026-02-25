//go:build !windows

package security

import (
	"syscall"
	"unsafe"
)

// mlock locks memory pages to prevent swapping.
// Unix implementation using syscall.
func mlock(b []byte) error {
	if len(b) == 0 {
		return nil
	}

	// Get page-aligned address
	ptr := uintptr(unsafe.Pointer(&b[0]))
	pageSize := uintptr(syscall.Getpagesize())
	alignedPtr := ptr &^ (pageSize - 1) // Align down to page boundary
	length := uintptr(len(b)) + (ptr - alignedPtr)

	// Round up length to page boundary
	length = (length + pageSize - 1) &^ (pageSize - 1)

	_, _, errno := syscall.Syscall(syscall.SYS_MLOCK, alignedPtr, length, 0)
	if errno != 0 {
		return errno
	}
	return nil
}

// munlock unlocks previously locked memory pages.
func munlock(b []byte) error {
	if len(b) == 0 {
		return nil
	}

	ptr := uintptr(unsafe.Pointer(&b[0]))
	pageSize := uintptr(syscall.Getpagesize())
	alignedPtr := ptr &^ (pageSize - 1)
	length := uintptr(len(b)) + (ptr - alignedPtr)
	length = (length + pageSize - 1) &^ (pageSize - 1)

	_, _, errno := syscall.Syscall(syscall.SYS_MUNLOCK, alignedPtr, length, 0)
	if errno != 0 {
		return errno
	}
	return nil
}

// DisableCoreDump sets RLIMIT_CORE to 0 to prevent core dumps.
//
// This should be called early in the application startup to prevent
// sensitive data from being written to disk in case of a crash.
//
// Returns error if the syscall fails (non-fatal, can be ignored).
func DisableCoreDump() error {
	var rlimit syscall.Rlimit
	rlimit.Cur = 0
	rlimit.Max = 0

	return syscall.Setrlimit(syscall.RLIMIT_CORE, &rlimit)
}
