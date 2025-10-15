//go:build windows

package storage

import (
	"fmt"
	"syscall"
	"unsafe"

	"golang.org/x/sys/windows"
)

// GetAvailableSpace returns available disk space in bytes for the given path (Windows implementation).
func GetAvailableSpace(path string) (uint64, error) {
	pathPtr, err := syscall.UTF16PtrFromString(path)
	if err != nil {
		return 0, fmt.Errorf("invalid path: %w", err)
	}

	var freeBytesAvailable uint64
	var totalBytes uint64
	var totalFreeBytes uint64

	err = windows.GetDiskFreeSpaceEx(
		(*uint16)(unsafe.Pointer(pathPtr)),
		&freeBytesAvailable,
		&totalBytes,
		&totalFreeBytes,
	)
	if err != nil {
		return 0, fmt.Errorf("failed to get disk space: %w", err)
	}

	return freeBytesAvailable, nil
}
