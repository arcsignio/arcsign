package cli_test

import (
	"bytes"
	"encoding/json"
	"io"
	"os"
	"strings"
	"testing"

	"github.com/yourusername/arcsign/internal/cli"
)

// T013: Test for single-line JSON output to stdout
// This test verifies that WriteJSON outputs valid, single-line JSON
// without pretty-printing, with proper escaping.

func TestWriteJSON_ValidOutput(t *testing.T) {
	// Arrange: Capture stdout
	oldStdout := os.Stdout
	r, w, _ := os.Pipe()
	os.Stdout = w

	testData := map[string]interface{}{
		"success": true,
		"data": map[string]string{
			"message": "test output",
		},
		"request_id": "test-123",
	}

	// Act: Write JSON to stdout
	err := cli.WriteJSON(testData)

	// Restore stdout and read captured output
	w.Close()
	os.Stdout = oldStdout
	var buf bytes.Buffer
	io.Copy(&buf, r)
	output := buf.String()

	// Assert: No error occurred
	if err != nil {
		t.Fatalf("WriteJSON returned error: %v", err)
	}

	// Assert: Output is valid JSON
	var parsed map[string]interface{}
	if err := json.Unmarshal([]byte(output), &parsed); err != nil {
		t.Errorf("Output is not valid JSON: %v\nOutput: %s", err, output)
	}

	// Assert: Output is single line (no newlines except trailing)
	lines := strings.Split(strings.TrimSpace(output), "\n")
	if len(lines) != 1 {
		t.Errorf("Expected single-line output, got %d lines: %v", len(lines), lines)
	}

	// Assert: Parsed data matches input
	if parsed["success"] != true {
		t.Errorf("Expected success=true, got %v", parsed["success"])
	}
}

func TestWriteJSON_SpecialCharacters(t *testing.T) {
	// Arrange: Capture stdout
	oldStdout := os.Stdout
	r, w, _ := os.Pipe()
	os.Stdout = w

	testData := map[string]interface{}{
		"message": "Special chars: \"quotes\", \nnewline, \ttab",
		"path":    "/usr/local/bin",
	}

	// Act: Write JSON with special characters
	err := cli.WriteJSON(testData)

	// Restore stdout and read captured output
	w.Close()
	os.Stdout = oldStdout
	var buf bytes.Buffer
	io.Copy(&buf, r)
	output := buf.String()

	// Assert: No error occurred
	if err != nil {
		t.Fatalf("WriteJSON returned error: %v", err)
	}

	// Assert: Output is valid JSON (proper escaping)
	var parsed map[string]interface{}
	if err := json.Unmarshal([]byte(output), &parsed); err != nil {
		t.Errorf("Output is not valid JSON with special chars: %v\nOutput: %s", err, output)
	}

	// Assert: Special characters properly escaped
	if !strings.Contains(output, "\\n") {
		t.Errorf("Expected escaped newline (\\n) in output: %s", output)
	}
	if !strings.Contains(output, "\\t") {
		t.Errorf("Expected escaped tab (\\t) in output: %s", output)
	}
}

func TestWriteJSON_EmptyData(t *testing.T) {
	// Arrange: Capture stdout
	oldStdout := os.Stdout
	r, w, _ := os.Pipe()
	os.Stdout = w

	testData := map[string]interface{}{}

	// Act: Write empty JSON object
	err := cli.WriteJSON(testData)

	// Restore stdout and read captured output
	w.Close()
	os.Stdout = oldStdout
	var buf bytes.Buffer
	io.Copy(&buf, r)
	output := buf.String()

	// Assert: No error occurred
	if err != nil {
		t.Fatalf("WriteJSON returned error: %v", err)
	}

	// Assert: Output is valid empty JSON object
	expected := "{}"
	if !strings.Contains(output, expected) {
		t.Errorf("Expected output to contain %s, got: %s", expected, output)
	}
}

func TestWriteJSON_NestedStructures(t *testing.T) {
	// Arrange: Capture stdout
	oldStdout := os.Stdout
	r, w, _ := os.Pipe()
	os.Stdout = w

	testData := map[string]interface{}{
		"data": map[string]interface{}{
			"wallet": map[string]interface{}{
				"id":   "wallet-123",
				"name": "My Wallet",
				"addresses": []string{
					"bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
					"bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4",
				},
			},
		},
	}

	// Act: Write nested JSON structure
	err := cli.WriteJSON(testData)

	// Restore stdout and read captured output
	w.Close()
	os.Stdout = oldStdout
	var buf bytes.Buffer
	io.Copy(&buf, r)
	output := buf.String()

	// Assert: No error occurred
	if err != nil {
		t.Fatalf("WriteJSON returned error: %v", err)
	}

	// Assert: Output is valid JSON
	var parsed map[string]interface{}
	if err := json.Unmarshal([]byte(output), &parsed); err != nil {
		t.Errorf("Output is not valid JSON: %v\nOutput: %s", err, output)
	}

	// Assert: Still single line despite nesting
	lines := strings.Split(strings.TrimSpace(output), "\n")
	if len(lines) != 1 {
		t.Errorf("Expected single-line output for nested structure, got %d lines", len(lines))
	}
}
