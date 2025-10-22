package cli_test

import (
	"bytes"
	"io"
	"os"
	"strings"
	"testing"

	"github.com/yourusername/arcsign/internal/cli"
)

// T015: Test for stderr logging (human-readable)
// This test verifies that WriteLog outputs human-readable messages to stderr
// for debugging and operational logging purposes.

func TestWriteLog_BasicMessage(t *testing.T) {
	// Arrange: Capture stderr
	oldStderr := os.Stderr
	r, w, _ := os.Pipe()
	os.Stderr = w

	message := "Test log message"

	// Act: Write log to stderr
	err := cli.WriteLog(message)

	// Restore stderr and read captured output
	w.Close()
	os.Stderr = oldStderr
	var buf bytes.Buffer
	io.Copy(&buf, r)
	output := buf.String()

	// Assert: No error occurred
	if err != nil {
		t.Fatalf("WriteLog returned error: %v", err)
	}

	// Assert: Output contains the message
	if !strings.Contains(output, message) {
		t.Errorf("Expected output to contain %q, got: %s", message, output)
	}
}

func TestWriteLog_MultipleLines(t *testing.T) {
	// Arrange: Capture stderr
	oldStderr := os.Stderr
	r, w, _ := os.Pipe()
	os.Stderr = w

	messages := []string{
		"First log message",
		"Second log message",
		"Third log message",
	}

	// Act: Write multiple logs to stderr
	for _, msg := range messages {
		err := cli.WriteLog(msg)
		if err != nil {
			t.Fatalf("WriteLog returned error: %v", err)
		}
	}

	// Restore stderr and read captured output
	w.Close()
	os.Stderr = oldStderr
	var buf bytes.Buffer
	io.Copy(&buf, r)
	output := buf.String()

	// Assert: Output contains all messages
	for _, msg := range messages {
		if !strings.Contains(output, msg) {
			t.Errorf("Expected output to contain %q, got: %s", msg, output)
		}
	}
}

func TestWriteLog_EmptyString(t *testing.T) {
	// Arrange: Capture stderr
	oldStderr := os.Stderr
	r, w, _ := os.Pipe()
	os.Stderr = w

	message := ""

	// Act: Write empty log to stderr
	err := cli.WriteLog(message)

	// Restore stderr and read captured output
	w.Close()
	os.Stderr = oldStderr
	var buf bytes.Buffer
	io.Copy(&buf, r)
	output := buf.String()

	// Assert: No error occurred
	if err != nil {
		t.Fatalf("WriteLog returned error: %v", err)
	}

	// Assert: Output contains a newline (empty message still logged)
	if output != "\n" {
		t.Errorf("Expected empty log with newline, got: %q", output)
	}
}

func TestWriteLog_SpecialCharacters(t *testing.T) {
	// Arrange: Capture stderr
	oldStderr := os.Stderr
	r, w, _ := os.Pipe()
	os.Stderr = w

	message := "Special chars: \"quotes\", \nnewline, \ttab, /path/to/file"

	// Act: Write log with special characters
	err := cli.WriteLog(message)

	// Restore stderr and read captured output
	w.Close()
	os.Stderr = oldStderr
	var buf bytes.Buffer
	io.Copy(&buf, r)
	output := buf.String()

	// Assert: No error occurred
	if err != nil {
		t.Fatalf("WriteLog returned error: %v", err)
	}

	// Assert: Output contains the message (no escaping for human-readable logs)
	if !strings.Contains(output, message) {
		t.Errorf("Expected output to contain %q, got: %s", message, output)
	}
}

func TestWriteLog_LongMessage(t *testing.T) {
	// Arrange: Capture stderr
	oldStderr := os.Stderr
	r, w, _ := os.Pipe()
	os.Stderr = w

	// Create long message (> 1KB)
	message := strings.Repeat("This is a long log message. ", 100)

	// Act: Write long log to stderr
	err := cli.WriteLog(message)

	// Restore stderr and read captured output
	w.Close()
	os.Stderr = oldStderr
	var buf bytes.Buffer
	io.Copy(&buf, r)
	output := buf.String()

	// Assert: No error occurred
	if err != nil {
		t.Fatalf("WriteLog returned error: %v", err)
	}

	// Assert: Output contains the full message
	if !strings.Contains(output, message) {
		t.Errorf("Expected output to contain long message, got truncated: %s...", output[:100])
	}
}
