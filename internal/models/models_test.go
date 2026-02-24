package models

import (
	"strings"
	"testing"
)

// --- ValidateWalletName Tests ---

func TestValidateWalletName_EmptyAllowed(t *testing.T) {
	if err := ValidateWalletName(""); err != nil {
		t.Errorf("empty name should be allowed: %v", err)
	}
}

func TestValidateWalletName_ExactLimit(t *testing.T) {
	name := strings.Repeat("a", 64)
	if err := ValidateWalletName(name); err != nil {
		t.Errorf("64-char name should be allowed: %v", err)
	}
}

func TestValidateWalletName_TooLong(t *testing.T) {
	name := strings.Repeat("a", 65)
	if err := ValidateWalletName(name); err == nil {
		t.Error("65-char name should be rejected")
	}
}

func TestValidateWalletName_NormalName(t *testing.T) {
	if err := ValidateWalletName("My Wallet"); err != nil {
		t.Errorf("normal name should be allowed: %v", err)
	}
}

// --- ValidateArgon2Params Tests ---

func TestValidateArgon2Params_Valid(t *testing.T) {
	if err := ValidateArgon2Params(4, 256*1024, 4); err != nil {
		t.Errorf("valid params should be accepted: %v", err)
	}
}

func TestValidateArgon2Params_TimeTooLow(t *testing.T) {
	if err := ValidateArgon2Params(2, 256*1024, 4); err == nil {
		t.Error("time=2 should be rejected (min 3)")
	}
}

func TestValidateArgon2Params_TimeTooHigh(t *testing.T) {
	if err := ValidateArgon2Params(11, 256*1024, 4); err == nil {
		t.Error("time=11 should be rejected (max 10)")
	}
}

func TestValidateArgon2Params_TimeAtBoundary(t *testing.T) {
	if err := ValidateArgon2Params(3, 256*1024, 4); err != nil {
		t.Errorf("time=3 should be accepted: %v", err)
	}
	if err := ValidateArgon2Params(10, 256*1024, 4); err != nil {
		t.Errorf("time=10 should be accepted: %v", err)
	}
}

func TestValidateArgon2Params_MemoryTooLow(t *testing.T) {
	if err := ValidateArgon2Params(4, 32*1024, 4); err == nil {
		t.Error("memory=32MiB should be rejected (min 64MiB)")
	}
}

func TestValidateArgon2Params_MemoryAtMinimum(t *testing.T) {
	if err := ValidateArgon2Params(4, 65536, 4); err != nil {
		t.Errorf("memory=64MiB should be accepted: %v", err)
	}
}

func TestValidateArgon2Params_ThreadsZero(t *testing.T) {
	if err := ValidateArgon2Params(4, 256*1024, 0); err == nil {
		t.Error("threads=0 should be rejected")
	}
}

func TestValidateArgon2Params_ThreadsTooHigh(t *testing.T) {
	if err := ValidateArgon2Params(4, 256*1024, 17); err == nil {
		t.Error("threads=17 should be rejected (max 16)")
	}
}

func TestValidateArgon2Params_ThreadsAtBoundary(t *testing.T) {
	if err := ValidateArgon2Params(4, 256*1024, 1); err != nil {
		t.Errorf("threads=1 should be accepted: %v", err)
	}
	if err := ValidateArgon2Params(4, 256*1024, 16); err != nil {
		t.Errorf("threads=16 should be accepted: %v", err)
	}
}
