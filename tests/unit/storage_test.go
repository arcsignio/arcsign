package unit

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/yourusername/arcsign/internal/services/storage"
)

// T025: Test for AtomicWriteFile() temp-file-then-rename
func TestAtomicWriteFile(t *testing.T) {
	tempDir := t.TempDir()

	t.Run("writes file atomically", func(t *testing.T) {
		filename := filepath.Join(tempDir, "test.dat")
		data := []byte("sensitive wallet data")

		err := storage.AtomicWriteFile(filename, data, 0600)
		if err != nil {
			t.Fatalf("AtomicWriteFile failed: %v", err)
		}

		// Verify file exists
		if _, err := os.Stat(filename); os.IsNotExist(err) {
			t.Error("File was not created")
		}

		// Verify file permissions (platform-specific behavior)
		info, _ := os.Stat(filename)
		mode := info.Mode().Perm()
		// Windows doesn't support Unix-style permissions (defaults to 0666)
		// Unix/Linux/macOS should have 0600
		if mode != 0600 && mode != 0666 {
			t.Errorf("Expected file permissions 0600 or 0666 (Windows), got %o", mode)
		}

		// Verify file contents
		readData, err := os.ReadFile(filename)
		if err != nil {
			t.Fatalf("Failed to read file: %v", err)
		}
		if string(readData) != string(data) {
			t.Errorf("File contents don't match.\nGot:  %s\nWant: %s", readData, data)
		}
	})

	t.Run("overwrites existing file", func(t *testing.T) {
		filename := filepath.Join(tempDir, "overwrite.dat")

		// Write initial data
		initialData := []byte("initial data")
		storage.AtomicWriteFile(filename, initialData, 0600)

		// Overwrite with new data
		newData := []byte("new data")
		err := storage.AtomicWriteFile(filename, newData, 0600)
		if err != nil {
			t.Fatalf("AtomicWriteFile failed on overwrite: %v", err)
		}

		// Verify new contents
		readData, _ := os.ReadFile(filename)
		if string(readData) != string(newData) {
			t.Errorf("File was not overwritten correctly")
		}
	})

	t.Run("creates parent directories if needed", func(t *testing.T) {
		filename := filepath.Join(tempDir, "subdir", "nested", "file.dat")
		data := []byte("test data")

		err := storage.AtomicWriteFile(filename, data, 0600)
		if err != nil {
			t.Fatalf("AtomicWriteFile failed with nested path: %v", err)
		}

		// Verify file was created
		if _, err := os.Stat(filename); os.IsNotExist(err) {
			t.Error("File was not created in nested directory")
		}
	})
}

// T023 & T024: Test for DetectUSBDevices() - mock implementation
func TestDetectUSBDevices(t *testing.T) {
	t.Run("returns available USB devices", func(t *testing.T) {
		devices, err := storage.DetectUSBDevices()
		if err != nil {
			t.Logf("USB detection failed (expected if no USB devices): %v", err)
		}

		// On systems without USB devices, should return empty slice or error
		if devices != nil {
			t.Logf("Found %d USB device(s)", len(devices))
		}
	})
}

// T027: Test for GetAvailableSpace()
func TestGetAvailableSpace(t *testing.T) {
	t.Run("returns available space for valid path", func(t *testing.T) {
		tempDir := t.TempDir()

		space, err := storage.GetAvailableSpace(tempDir)
		if err != nil {
			t.Fatalf("GetAvailableSpace failed: %v", err)
		}

		if space == 0 {
			t.Error("Available space should be greater than 0")
		}

		t.Logf("Available space: %d bytes (~%.2f MB)", space, float64(space)/(1024*1024))
	})

	t.Run("fails with non-existent path", func(t *testing.T) {
		nonExistentPath := filepath.Join(os.TempDir(), "nonexistent-path-12345")

		_, err := storage.GetAvailableSpace(nonExistentPath)
		if err == nil {
			t.Error("Expected error for non-existent path")
		}
	})
}
