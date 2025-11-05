package cli

import (
	"encoding/json"
	"fmt"
	"os"
)

// WriteJSON serializes the provided value to JSON and writes it to stdout
// as a single line (no pretty-printing). This is used for dashboard mode
// where the CLI outputs machine-readable JSON responses.
//
// Parameters:
//   - v: Any JSON-serializable value (typically CliResponse)
//
// Returns:
//   - error: Returns error if JSON marshaling or writing fails
//
// Output format:
//   - Single-line JSON written to stdout with trailing newline
//   - No indentation or pretty-printing
//   - Proper escaping of special characters
func WriteJSON(v interface{}) error {
	// Marshal to JSON without indentation (single line)
	data, err := json.Marshal(v)
	if err != nil {
		return fmt.Errorf("failed to marshal JSON: %w", err)
	}

	// Write to stdout with trailing newline
	// Using fmt.Fprintln ensures atomic write with newline
	_, err = fmt.Fprintf(os.Stdout, "%s\n", data)
	if err != nil {
		return fmt.Errorf("failed to write JSON to stdout: %w", err)
	}

	return nil
}

// WriteLog writes a human-readable log message to stderr.
// This is used for debugging and operational logging in dashboard mode,
// where stdout is reserved for JSON responses.
//
// Parameters:
//   - message: The log message to write (human-readable text)
//
// Returns:
//   - error: Returns error if writing to stderr fails
//
// Output format:
//   - Plain text message written to stderr with trailing newline
//   - No escaping or formatting (human-readable)
//   - Can be viewed in logs for debugging purposes
func WriteLog(message string) error {
	// Write message to stderr with trailing newline
	_, err := fmt.Fprintf(os.Stderr, "%s\n", message)
	if err != nil {
		return fmt.Errorf("failed to write log to stderr: %w", err)
	}

	return nil
}
