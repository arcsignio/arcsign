package cli

// CliResponse represents the standard JSON response structure
// returned by the CLI in non-interactive (dashboard) mode.
//
// This structure matches the OpenAPI 3.0 specification in
// /specs/004-dashboard/contracts/wallet-api.yaml
//
// All CLI commands in dashboard mode MUST output this structure
// as single-line JSON to stdout.
type CliResponse struct {
	// Success indicates whether the operation succeeded (true) or failed (false)
	Success bool `json:"success"`

	// Data contains the command-specific response data (e.g., wallet, addresses)
	// Only present when Success is true
	Data interface{} `json:"data,omitempty"`

	// Error contains error details when Success is false
	// Only present when Success is false
	Error *CliError `json:"error,omitempty"`

	// RequestID is a unique identifier for this CLI invocation (UUID v4)
	// Used for log correlation and debugging
	RequestID string `json:"request_id"`

	// CliVersion is the semantic version of the CLI (e.g., "1.0.0")
	CliVersion string `json:"cli_version"`

	// DurationMs is the execution time of the command in milliseconds
	DurationMs int64 `json:"duration_ms"`

	// Warnings contains non-fatal warning messages (e.g., "USB unmount recommended")
	// Present even when Success is true
	Warnings []string `json:"warnings,omitempty"`
}

// CliError represents error details in the CLI response.
//
// This structure provides both machine-readable error codes
// (for programmatic handling) and human-readable messages
// (for display in the UI).
//
// Error codes are defined in errors.go and match the enumeration
// in FR-042 of the specification.
type CliError struct {
	// Code is the error code from the enumerated set (e.g., "INVALID_PASSWORD")
	// Must match one of the constants defined in errors.go
	Code string `json:"code"`

	// Message is a human-readable error message
	// Should be clear, actionable, and safe to display to users
	Message string `json:"message"`
}
