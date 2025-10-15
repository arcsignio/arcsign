//go:build !windows

package storage

import (
	"fmt"

	"golang.org/x/sys/unix"
)

// GetAvailableSpace returns available disk space in bytes for the given path (Unix implementation).
func GetAvailableSpace(path string) (uint64, error) {
	var stat unix.Statfs_t
	if err := unix.Statfs(path, &stat); err != nil {
		return 0, fmt.Errorf("failed to get disk space: %w", err)
	}

	// Available blocks * block size
	availableSpace := stat.Bavail * uint64(stat.Bsize)
	return availableSpace, nil
}
