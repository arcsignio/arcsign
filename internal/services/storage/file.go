package storage

import (
	"fmt"
	"os"
	"path/filepath"
)

// AtomicWriteFile writes data to a file atomically using temp-file-then-rename pattern.
// This prevents partial writes if the process crashes or USB is disconnected.
func AtomicWriteFile(filename string, data []byte, perm os.FileMode) error {
	// Ensure parent directory exists
	dir := filepath.Dir(filename)
	if err := os.MkdirAll(dir, 0700); err != nil {
		return fmt.Errorf("failed to create directory: %w", err)
	}

	// Create temp file in same directory (same filesystem for atomic rename)
	tmpFile, err := os.CreateTemp(dir, ".arcsign-tmp-*")
	if err != nil {
		return fmt.Errorf("failed to create temp file: %w", err)
	}
	tmpPath := tmpFile.Name()

	// Cleanup temp file on error
	defer func() {
		if tmpFile != nil {
			tmpFile.Close()
			os.Remove(tmpPath)
		}
	}()

	// Write data
	if _, err := tmpFile.Write(data); err != nil {
		return fmt.Errorf("failed to write data: %w", err)
	}

	// Sync to disk (critical for USB storage)
	if err := tmpFile.Sync(); err != nil {
		return fmt.Errorf("failed to sync to disk: %w", err)
	}

	// Set permissions before closing
	if err := tmpFile.Chmod(perm); err != nil {
		return fmt.Errorf("failed to set permissions: %w", err)
	}

	// Close temp file before rename
	if err := tmpFile.Close(); err != nil {
		return fmt.Errorf("failed to close temp file: %w", err)
	}
	tmpFile = nil // Prevent defer from trying to close again

	// Atomic rename (works on same filesystem)
	if err := os.Rename(tmpPath, filename); err != nil {
		return fmt.Errorf("failed to rename temp file: %w", err)
	}

	return nil
}
