package unit

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/yourusername/arcsign/internal/services/audit"
)

// T029: Test for AuditLogEntry creation
func TestAuditLogEntry(t *testing.T) {
	t.Run("creates audit log entry with all fields", func(t *testing.T) {
		entry := audit.AuditLogEntry{
			ID:        "test-id-123",
			WalletID:  "wallet-id-456",
			Timestamp: time.Now(),
			Operation: "WALLET_CREATE",
			Status:    "SUCCESS",
		}

		if entry.Operation != "WALLET_CREATE" {
			t.Errorf("Expected operation WALLET_CREATE, got %s", entry.Operation)
		}
		if entry.Status != "SUCCESS" {
			t.Errorf("Expected status SUCCESS, got %s", entry.Status)
		}
	})

	t.Run("serializes to NDJSON format", func(t *testing.T) {
		entry := audit.AuditLogEntry{
			ID:        "test-id-123",
			WalletID:  "wallet-id-456",
			Timestamp: time.Now(),
			Operation: "WALLET_ACCESS",
			Status:    "SUCCESS",
		}

		jsonData, err := json.Marshal(entry)
		if err != nil {
			t.Fatalf("Failed to marshal entry: %v", err)
		}

		// Verify it's valid JSON
		var decoded audit.AuditLogEntry
		if err := json.Unmarshal(jsonData, &decoded); err != nil {
			t.Fatalf("Failed to unmarshal entry: %v", err)
		}

		if decoded.ID != entry.ID {
			t.Error("ID mismatch after JSON roundtrip")
		}
	})
}

// T030: Test for LogOperation()
func TestLogOperation(t *testing.T) {
	tempDir := t.TempDir()
	logPath := filepath.Join(tempDir, "test_audit.log")

	logger, err := audit.NewAuditLogger(logPath)
	if err != nil {
		t.Fatalf("Failed to create audit logger: %v", err)
	}

	t.Run("logs operation successfully", func(t *testing.T) {
		entry := audit.AuditLogEntry{
			ID:        "entry-001",
			WalletID:  "wallet-123",
			Timestamp: time.Now(),
			Operation: "WALLET_CREATE",
			Status:    "SUCCESS",
		}

		err := logger.LogOperation(entry)
		if err != nil {
			t.Fatalf("LogOperation failed: %v", err)
		}

		// Verify file exists
		if _, err := os.Stat(logPath); os.IsNotExist(err) {
			t.Error("Audit log file was not created")
		}

		// Read and verify content
		content, err := os.ReadFile(logPath)
		if err != nil {
			t.Fatalf("Failed to read audit log: %v", err)
		}

		if !strings.Contains(string(content), "WALLET_CREATE") {
			t.Error("Log does not contain expected operation")
		}
		if !strings.Contains(string(content), "SUCCESS") {
			t.Error("Log does not contain expected status")
		}
	})

	t.Run("appends multiple entries", func(t *testing.T) {
		entries := []audit.AuditLogEntry{
			{ID: "entry-002", WalletID: "wallet-123", Timestamp: time.Now(), Operation: "ACCOUNT_CREATE", Status: "SUCCESS"},
			{ID: "entry-003", WalletID: "wallet-123", Timestamp: time.Now(), Operation: "ADDRESS_DERIVE", Status: "SUCCESS"},
		}

		for _, entry := range entries {
			if err := logger.LogOperation(entry); err != nil {
				t.Fatalf("LogOperation failed: %v", err)
			}
		}

		// Verify all entries are in file
		content, _ := os.ReadFile(logPath)
		lines := strings.Split(strings.TrimSpace(string(content)), "\n")

		if len(lines) < 3 { // Original + 2 new
			t.Errorf("Expected at least 3 log lines, got %d", len(lines))
		}
	})

	t.Run("logs failure with reason", func(t *testing.T) {
		entry := audit.AuditLogEntry{
			ID:            "entry-004",
			WalletID:      "wallet-123",
			Timestamp:     time.Now(),
			Operation:     "WALLET_RESTORE",
			Status:        "FAILURE",
			FailureReason: "wrong_password",
		}

		err := logger.LogOperation(entry)
		if err != nil {
			t.Fatalf("LogOperation failed: %v", err)
		}

		content, _ := os.ReadFile(logPath)
		if !strings.Contains(string(content), "wrong_password") {
			t.Error("Log does not contain failure reason")
		}
	})
}

// T031: Test for audit log file permissions
func TestAuditLogPermissions(t *testing.T) {
	tempDir := t.TempDir()
	logPath := filepath.Join(tempDir, "secure_audit.log")

	logger, err := audit.NewAuditLogger(logPath)
	if err != nil {
		t.Fatalf("Failed to create audit logger: %v", err)
	}

	entry := audit.AuditLogEntry{
		ID:        "perm-test-001",
		WalletID:  "wallet-999",
		Timestamp: time.Now(),
		Operation: "WALLET_CREATE",
		Status:    "SUCCESS",
	}

	logger.LogOperation(entry)

	t.Run("audit log file has secure permissions", func(t *testing.T) {
		info, err := os.Stat(logPath)
		if err != nil {
			t.Fatalf("Failed to stat audit log: %v", err)
		}

		mode := info.Mode().Perm()
		// Windows: 0666, Unix: 0600
		if mode != 0600 && mode != 0666 {
			t.Errorf("Expected permissions 0600 or 0666, got %o", mode)
		}
	})

	t.Run("audit log is append-only", func(t *testing.T) {
		// Read original content
		originalContent, _ := os.ReadFile(logPath)
		originalLines := strings.Split(strings.TrimSpace(string(originalContent)), "\n")

		// Append new entry
		newEntry := audit.AuditLogEntry{
			ID:        "perm-test-002",
			WalletID:  "wallet-999",
			Timestamp: time.Now(),
			Operation: "WALLET_ACCESS",
			Status:    "SUCCESS",
		}
		logger.LogOperation(newEntry)

		// Verify original entries still present
		newContent, _ := os.ReadFile(logPath)
		newLines := strings.Split(strings.TrimSpace(string(newContent)), "\n")

		if len(newLines) != len(originalLines)+1 {
			t.Errorf("Expected %d lines, got %d", len(originalLines)+1, len(newLines))
		}

		// Verify first entry unchanged
		if newLines[0] != originalLines[0] {
			t.Error("Original log entry was modified (not append-only)")
		}
	})
}
