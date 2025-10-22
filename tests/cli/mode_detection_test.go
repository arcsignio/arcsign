package cli_test

import (
	"os"
	"testing"

	"github.com/yourusername/arcsign/internal/cli"
)

// T011: Test for CLI mode detection with ARCSIGN_MODE=dashboard
// This test verifies that the CLI can detect when it should operate in
// non-interactive mode (for dashboard integration) vs interactive mode.

func TestDetectMode_Dashboard(t *testing.T) {
	// Arrange: Set ARCSIGN_MODE environment variable
	os.Setenv("ARCSIGN_MODE", "dashboard")
	defer os.Unsetenv("ARCSIGN_MODE")

	// Act: Call DetectMode() function
	mode := cli.DetectMode()

	// Assert: Mode should be "dashboard" (non-interactive)
	expected := cli.ModeDashboard
	if mode != expected {
		t.Errorf("Expected mode %s, got %s", expected, mode)
	}
}

func TestDetectMode_Interactive(t *testing.T) {
	// Arrange: Ensure ARCSIGN_MODE is not set
	os.Unsetenv("ARCSIGN_MODE")

	// Act: Call DetectMode() function
	mode := cli.DetectMode()

	// Assert: Mode should be "interactive" (default)
	expected := cli.ModeInteractive
	if mode != expected {
		t.Errorf("Expected mode %s, got %s", expected, mode)
	}
}

func TestDetectMode_InvalidValue(t *testing.T) {
	// Arrange: Set ARCSIGN_MODE to invalid value
	os.Setenv("ARCSIGN_MODE", "invalid")
	defer os.Unsetenv("ARCSIGN_MODE")

	// Act: Call DetectMode() function
	mode := cli.DetectMode()

	// Assert: Should default to "interactive" for invalid values
	expected := cli.ModeInteractive
	if mode != expected {
		t.Errorf("Expected mode %s for invalid value, got %s", expected, mode)
	}
}

func TestDetectMode_CaseInsensitive(t *testing.T) {
	// Arrange: Set ARCSIGN_MODE with mixed case
	os.Setenv("ARCSIGN_MODE", "DASHBOARD")
	defer os.Unsetenv("ARCSIGN_MODE")

	// Act: Call DetectMode() function
	mode := cli.DetectMode()

	// Assert: Should still detect dashboard mode (case-insensitive)
	expected := cli.ModeDashboard
	if mode != expected {
		t.Errorf("Expected mode %s for uppercase value, got %s", expected, mode)
	}
}
