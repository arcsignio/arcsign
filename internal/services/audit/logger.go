package audit

import (
	"encoding/json"
	"fmt"
	"os"
	"sync"
	"time"
)

// AuditLogEntry represents a wallet operation logged for security monitoring
type AuditLogEntry struct {
	ID            string    `json:"id"`
	WalletID      string    `json:"walletId"`
	Timestamp     time.Time `json:"timestamp"`
	Operation     string    `json:"operation"` // WALLET_CREATE, WALLET_ACCESS, etc.
	Status        string    `json:"status"`    // SUCCESS, FAILURE
	FailureReason string    `json:"failureReason,omitempty"`
	IPAddress     string    `json:"ipAddress,omitempty"`     // Future API use
	UserAgent     string    `json:"userAgent,omitempty"`     // Future API use
}

// AuditLogger handles append-only audit logging
type AuditLogger struct {
	filePath string
	mu       sync.Mutex // Thread-safe logging
}

// NewAuditLogger creates a new audit logger with the specified file path
func NewAuditLogger(filePath string) (*AuditLogger, error) {
	// Create parent directory if needed
	dir := filePath[:len(filePath)-len(filePath[len(filePath)-1:])]
	if err := os.MkdirAll(dir, 0700); err != nil {
		return nil, fmt.Errorf("failed to create audit log directory: %w", err)
	}

	return &AuditLogger{
		filePath: filePath,
	}, nil
}

// LogOperation appends an audit log entry to the log file (NDJSON format)
func (l *AuditLogger) LogOperation(entry AuditLogEntry) error {
	l.mu.Lock()
	defer l.mu.Unlock()

	// Open file in append mode with secure permissions
	file, err := os.OpenFile(l.filePath, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0600)
	if err != nil {
		return fmt.Errorf("failed to open audit log: %w", err)
	}
	defer file.Close()

	// Marshal entry to JSON
	jsonData, err := json.Marshal(entry)
	if err != nil {
		return fmt.Errorf("failed to marshal audit entry: %w", err)
	}

	// Write JSON line (NDJSON format)
	if _, err := file.Write(append(jsonData, '\n')); err != nil {
		return fmt.Errorf("failed to write audit entry: %w", err)
	}

	// Sync to disk (important for audit logs)
	if err := file.Sync(); err != nil {
		return fmt.Errorf("failed to sync audit log: %w", err)
	}

	return nil
}

// ReadLog reads all audit log entries from the log file
func (l *AuditLogger) ReadLog() ([]AuditLogEntry, error) {
	l.mu.Lock()
	defer l.mu.Unlock()

	data, err := os.ReadFile(l.filePath)
	if err != nil {
		if os.IsNotExist(err) {
			return []AuditLogEntry{}, nil // Empty log
		}
		return nil, fmt.Errorf("failed to read audit log: %w", err)
	}

	// Parse NDJSON
	var entries []AuditLogEntry
	lines := string(data)

	// Split by newline and parse each JSON line
	start := 0
	for i := 0; i < len(lines); i++ {
		if lines[i] == '\n' {
			if i > start {
				var entry AuditLogEntry
				if err := json.Unmarshal([]byte(lines[start:i]), &entry); err != nil {
					// Skip malformed lines
					continue
				}
				entries = append(entries, entry)
			}
			start = i + 1
		}
	}

	// Handle last line if no trailing newline
	if start < len(lines) {
		var entry AuditLogEntry
		if err := json.Unmarshal([]byte(lines[start:]), &entry); err == nil {
			entries = append(entries, entry)
		}
	}

	return entries, nil
}
