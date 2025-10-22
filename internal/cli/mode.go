package cli

import (
	"os"
	"strings"
)

// Mode represents the CLI operating mode
type Mode string

const (
	// ModeInteractive represents interactive mode (stdin prompts, human-readable output)
	ModeInteractive Mode = "interactive"

	// ModeDashboard represents non-interactive mode (env vars, JSON output)
	ModeDashboard Mode = "dashboard"
)

// DetectMode determines the CLI operating mode based on the ARCSIGN_MODE environment variable.
//
// Returns:
//   - ModeDashboard if ARCSIGN_MODE=dashboard (case-insensitive)
//   - ModeInteractive otherwise (default for invalid values or unset)
//
// This function is called at CLI startup to branch between:
//   - Interactive mode: Prompts user via stdin, outputs human-readable text
//   - Dashboard mode: Reads from env vars, outputs single-line JSON to stdout
func DetectMode() Mode {
	modeEnv := os.Getenv("ARCSIGN_MODE")

	// Normalize to lowercase for case-insensitive comparison
	modeEnv = strings.ToLower(strings.TrimSpace(modeEnv))

	if modeEnv == "dashboard" {
		return ModeDashboard
	}

	// Default to interactive mode for any other value (including empty)
	return ModeInteractive
}

// IsInteractive returns true if the current mode is interactive
func IsInteractive() bool {
	return DetectMode() == ModeInteractive
}

// IsDashboard returns true if the current mode is dashboard (non-interactive)
func IsDashboard() bool {
	return DetectMode() == ModeDashboard
}
