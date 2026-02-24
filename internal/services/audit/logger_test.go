package audit

import (
	"os"
	"path/filepath"
	"sync"
	"testing"
	"time"
)

func newTestLogger(t *testing.T) *AuditLogger {
	t.Helper()
	logPath := filepath.Join(t.TempDir(), "audit.log")
	logger, err := NewAuditLogger(logPath)
	if err != nil {
		t.Fatalf("NewAuditLogger failed: %v", err)
	}
	return logger
}

func TestNewAuditLogger_CreatesDirectory(t *testing.T) {
	dir := filepath.Join(t.TempDir(), "nested", "dir")
	logPath := filepath.Join(dir, "audit.log")

	_, err := NewAuditLogger(logPath)
	if err != nil {
		t.Fatalf("NewAuditLogger failed: %v", err)
	}

	// Parent directory should exist
	if _, err := os.Stat(dir); os.IsNotExist(err) {
		t.Error("parent directory was not created")
	}
}

func TestLogOperation_WritesEntry(t *testing.T) {
	logger := newTestLogger(t)

	entry := AuditLogEntry{
		ID:        "test-1",
		WalletID:  "wallet-123",
		Timestamp: time.Now(),
		Operation: "WALLET_CREATE",
		Status:    "SUCCESS",
	}

	if err := logger.LogOperation(entry); err != nil {
		t.Fatalf("LogOperation failed: %v", err)
	}

	// File should exist
	if _, err := os.Stat(logger.filePath); os.IsNotExist(err) {
		t.Error("log file was not created")
	}
}

func TestLogOperation_NDJSONFormat(t *testing.T) {
	logger := newTestLogger(t)

	entry := AuditLogEntry{
		ID:        "test-1",
		WalletID:  "wallet-123",
		Timestamp: time.Now(),
		Operation: "WALLET_CREATE",
		Status:    "SUCCESS",
	}

	if err := logger.LogOperation(entry); err != nil {
		t.Fatalf("LogOperation failed: %v", err)
	}

	data, err := os.ReadFile(logger.filePath)
	if err != nil {
		t.Fatalf("failed to read log file: %v", err)
	}

	content := string(data)
	// NDJSON: each entry is followed by a newline
	if content[len(content)-1] != '\n' {
		t.Error("NDJSON entry should end with newline")
	}
}

func TestLogOperation_AppendOnly(t *testing.T) {
	logger := newTestLogger(t)

	for i := 0; i < 3; i++ {
		entry := AuditLogEntry{
			ID:        "test-" + string(rune('1'+i)),
			WalletID:  "wallet-123",
			Timestamp: time.Now(),
			Operation: "WALLET_ACCESS",
			Status:    "SUCCESS",
		}
		if err := logger.LogOperation(entry); err != nil {
			t.Fatalf("LogOperation %d failed: %v", i, err)
		}
	}

	entries, err := logger.ReadLog()
	if err != nil {
		t.Fatalf("ReadLog failed: %v", err)
	}
	if len(entries) != 3 {
		t.Errorf("expected 3 entries, got %d", len(entries))
	}
}

func TestReadLog_Empty(t *testing.T) {
	logPath := filepath.Join(t.TempDir(), "nonexistent.log")
	logger := &AuditLogger{filePath: logPath}

	entries, err := logger.ReadLog()
	if err != nil {
		t.Fatalf("ReadLog failed: %v", err)
	}
	if len(entries) != 0 {
		t.Errorf("expected 0 entries, got %d", len(entries))
	}
}

func TestReadLog_SingleEntry(t *testing.T) {
	logger := newTestLogger(t)

	entry := AuditLogEntry{
		ID:            "read-test",
		WalletID:      "wallet-456",
		Timestamp:     time.Now(),
		Operation:     "WALLET_ACCESS",
		Status:        "FAILURE",
		FailureReason: "wrong_password",
	}

	if err := logger.LogOperation(entry); err != nil {
		t.Fatalf("LogOperation failed: %v", err)
	}

	entries, err := logger.ReadLog()
	if err != nil {
		t.Fatalf("ReadLog failed: %v", err)
	}
	if len(entries) != 1 {
		t.Fatalf("expected 1 entry, got %d", len(entries))
	}

	got := entries[0]
	if got.ID != "read-test" {
		t.Errorf("ID: got %q, want %q", got.ID, "read-test")
	}
	if got.WalletID != "wallet-456" {
		t.Errorf("WalletID: got %q, want %q", got.WalletID, "wallet-456")
	}
	if got.Operation != "WALLET_ACCESS" {
		t.Errorf("Operation: got %q, want %q", got.Operation, "WALLET_ACCESS")
	}
	if got.Status != "FAILURE" {
		t.Errorf("Status: got %q, want %q", got.Status, "FAILURE")
	}
	if got.FailureReason != "wrong_password" {
		t.Errorf("FailureReason: got %q, want %q", got.FailureReason, "wrong_password")
	}
}

func TestReadLog_MalformedLinesDoNotCrash(t *testing.T) {
	logPath := filepath.Join(t.TempDir(), "malformed.log")

	// Write valid entry followed by malformed line at the end
	content := `{"id":"valid-1","walletId":"wallet","operation":"TEST","status":"SUCCESS"}
this is not json
`
	if err := os.WriteFile(logPath, []byte(content), 0600); err != nil {
		t.Fatalf("failed to write test file: %v", err)
	}

	logger := &AuditLogger{filePath: logPath}
	entries, err := logger.ReadLog()
	if err != nil {
		t.Fatalf("ReadLog should not error on malformed lines: %v", err)
	}

	// Valid entries before the malformed line should be parsed
	if len(entries) < 1 {
		t.Error("should parse at least 1 valid entry before malformed line")
	}
	if entries[0].ID != "valid-1" {
		t.Errorf("first entry ID: got %q, want %q", entries[0].ID, "valid-1")
	}
}

func TestLogOperation_ConcurrentWrites(t *testing.T) {
	logger := newTestLogger(t)

	var wg sync.WaitGroup
	for i := 0; i < 20; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			entry := AuditLogEntry{
				ID:        "concurrent-" + string(rune('A'+idx)),
				WalletID:  "wallet",
				Timestamp: time.Now(),
				Operation: "TEST",
				Status:    "SUCCESS",
			}
			logger.LogOperation(entry)
		}(i)
	}
	wg.Wait()

	entries, err := logger.ReadLog()
	if err != nil {
		t.Fatalf("ReadLog failed: %v", err)
	}
	if len(entries) != 20 {
		t.Errorf("expected 20 entries from concurrent writes, got %d", len(entries))
	}
}

func TestLogOperation_AllFields(t *testing.T) {
	logger := newTestLogger(t)

	now := time.Now()
	entry := AuditLogEntry{
		ID:            "full-entry",
		WalletID:      "wallet-789",
		Timestamp:     now,
		Operation:     "WALLET_DELETE",
		Status:        "SUCCESS",
		FailureReason: "",
		IPAddress:     "192.168.1.1",
		UserAgent:     "ArcSign/1.0",
	}

	if err := logger.LogOperation(entry); err != nil {
		t.Fatalf("LogOperation failed: %v", err)
	}

	entries, err := logger.ReadLog()
	if err != nil {
		t.Fatalf("ReadLog failed: %v", err)
	}
	if len(entries) != 1 {
		t.Fatalf("expected 1 entry, got %d", len(entries))
	}

	got := entries[0]
	if got.IPAddress != "192.168.1.1" {
		t.Errorf("IPAddress: got %q, want %q", got.IPAddress, "192.168.1.1")
	}
	if got.UserAgent != "ArcSign/1.0" {
		t.Errorf("UserAgent: got %q, want %q", got.UserAgent, "ArcSign/1.0")
	}
}
