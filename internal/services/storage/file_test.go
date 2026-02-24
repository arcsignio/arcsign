package storage

import (
	"bytes"
	"os"
	"path/filepath"
	"testing"
)

func TestAtomicWriteFile_Basic(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "test.dat")
	data := []byte("hello world")

	if err := AtomicWriteFile(path, data, 0600); err != nil {
		t.Fatalf("AtomicWriteFile failed: %v", err)
	}

	readBack, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("failed to read file: %v", err)
	}

	if !bytes.Equal(readBack, data) {
		t.Errorf("data mismatch: got %q, want %q", readBack, data)
	}
}

func TestAtomicWriteFile_CreatesParentDir(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "nested", "deep", "test.dat")
	data := []byte("nested data")

	if err := AtomicWriteFile(path, data, 0600); err != nil {
		t.Fatalf("AtomicWriteFile failed: %v", err)
	}

	readBack, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("failed to read file: %v", err)
	}

	if !bytes.Equal(readBack, data) {
		t.Error("data mismatch")
	}
}

func TestAtomicWriteFile_FilePermissions(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "perms.dat")

	if err := AtomicWriteFile(path, []byte("test"), 0600); err != nil {
		t.Fatalf("AtomicWriteFile failed: %v", err)
	}

	info, err := os.Stat(path)
	if err != nil {
		t.Fatalf("failed to stat file: %v", err)
	}

	perm := info.Mode().Perm()
	if perm != 0600 {
		t.Errorf("file permissions: got %o, want 0600", perm)
	}
}

func TestAtomicWriteFile_Overwrite(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "overwrite.dat")

	// Write first version
	if err := AtomicWriteFile(path, []byte("version 1"), 0600); err != nil {
		t.Fatalf("first write failed: %v", err)
	}

	// Write second version
	if err := AtomicWriteFile(path, []byte("version 2"), 0600); err != nil {
		t.Fatalf("second write failed: %v", err)
	}

	readBack, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("failed to read file: %v", err)
	}

	if string(readBack) != "version 2" {
		t.Errorf("overwrite failed: got %q, want %q", readBack, "version 2")
	}
}

func TestAtomicWriteFile_NoTempFileLeftOnSuccess(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "clean.dat")

	if err := AtomicWriteFile(path, []byte("data"), 0600); err != nil {
		t.Fatalf("AtomicWriteFile failed: %v", err)
	}

	// Check no temp files remain
	entries, err := os.ReadDir(dir)
	if err != nil {
		t.Fatalf("failed to read dir: %v", err)
	}

	for _, entry := range entries {
		if entry.Name() != "clean.dat" {
			t.Errorf("unexpected file remaining: %s", entry.Name())
		}
	}
}

func TestAtomicWriteFile_LargeData(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "large.dat")

	// 1 MB of data
	data := make([]byte, 1024*1024)
	for i := range data {
		data[i] = byte(i % 256)
	}

	if err := AtomicWriteFile(path, data, 0600); err != nil {
		t.Fatalf("AtomicWriteFile failed: %v", err)
	}

	readBack, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("failed to read file: %v", err)
	}

	if !bytes.Equal(readBack, data) {
		t.Error("large data mismatch")
	}
}

func TestAtomicWriteFile_EmptyData(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "empty.dat")

	if err := AtomicWriteFile(path, []byte{}, 0600); err != nil {
		t.Fatalf("AtomicWriteFile with empty data failed: %v", err)
	}

	readBack, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("failed to read file: %v", err)
	}

	if len(readBack) != 0 {
		t.Errorf("expected empty file, got %d bytes", len(readBack))
	}
}

func TestAtomicWriteFile_BinaryData(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "binary.dat")

	// Binary data with null bytes
	data := []byte{0x00, 0x01, 0xff, 0x00, 0xfe, 0x00, 0xab, 0xcd}

	if err := AtomicWriteFile(path, data, 0600); err != nil {
		t.Fatalf("AtomicWriteFile failed: %v", err)
	}

	readBack, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("failed to read file: %v", err)
	}

	if !bytes.Equal(readBack, data) {
		t.Error("binary data mismatch")
	}
}
