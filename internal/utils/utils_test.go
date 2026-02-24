package utils

import (
	"regexp"
	"testing"
)

// --- ValidatePassword Tests ---

func TestValidatePassword_TooShort(t *testing.T) {
	if err := ValidatePassword("Short1!"); err == nil {
		t.Error("password with < 12 chars should be rejected")
	}
}

func TestValidatePassword_ExactlyMinLength_Valid(t *testing.T) {
	// 12 chars with upper + lower + digit (3 complexity types)
	if err := ValidatePassword("Abcdefghij1k"); err != nil {
		t.Errorf("12-char password with 3 complexity types should be accepted: %v", err)
	}
}

func TestValidatePassword_AllFourTypes(t *testing.T) {
	if err := ValidatePassword("TestP@ssw0rd!Secure"); err != nil {
		t.Errorf("password with all 4 types should be accepted: %v", err)
	}
}

func TestValidatePassword_ThreeTypes_UpperLowerDigit(t *testing.T) {
	// Upper + lower + digit = 3 types (no special)
	if err := ValidatePassword("Abcdefghij12"); err != nil {
		t.Errorf("upper+lower+digit should be accepted: %v", err)
	}
}

func TestValidatePassword_ThreeTypes_UpperLowerSpecial(t *testing.T) {
	// Upper + lower + special = 3 types (no digit)
	if err := ValidatePassword("Abcdefghij!!"); err != nil {
		t.Errorf("upper+lower+special should be accepted: %v", err)
	}
}

func TestValidatePassword_ThreeTypes_LowerDigitSpecial(t *testing.T) {
	// Lower + digit + special = 3 types (no upper)
	if err := ValidatePassword("abcdefghij1!"); err != nil {
		t.Errorf("lower+digit+special should be accepted: %v", err)
	}
}

func TestValidatePassword_ThreeTypes_UpperDigitSpecial(t *testing.T) {
	// Upper + digit + special = 3 types (no lower)
	if err := ValidatePassword("ABCDEFGHIJ1!"); err != nil {
		t.Errorf("upper+digit+special should be accepted: %v", err)
	}
}

func TestValidatePassword_TwoTypes_Rejected(t *testing.T) {
	// Only lower + digit = 2 types
	if err := ValidatePassword("abcdefghij12"); err == nil {
		t.Error("password with only 2 complexity types should be rejected")
	}
}

func TestValidatePassword_OnlyLowercase_Rejected(t *testing.T) {
	if err := ValidatePassword("abcdefghijklmnop"); err == nil {
		t.Error("password with only lowercase should be rejected")
	}
}

func TestValidatePassword_EmptyPassword(t *testing.T) {
	if err := ValidatePassword(""); err == nil {
		t.Error("empty password should be rejected")
	}
}

func TestValidatePassword_VeryLong(t *testing.T) {
	// 200 chars with all types
	long := ""
	for i := 0; i < 50; i++ {
		long += "Aa1!"
	}
	if err := ValidatePassword(long); err != nil {
		t.Errorf("very long password should be accepted: %v", err)
	}
}

// --- GenerateSecureUUID Tests ---

func TestGenerateSecureUUID_Format(t *testing.T) {
	uuid, err := GenerateSecureUUID()
	if err != nil {
		t.Fatalf("GenerateSecureUUID failed: %v", err)
	}

	// UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
	uuidRegex := regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`)
	if !uuidRegex.MatchString(uuid) {
		t.Errorf("UUID does not match v4 format: %q", uuid)
	}
}

func TestGenerateSecureUUID_Version4(t *testing.T) {
	uuid, err := GenerateSecureUUID()
	if err != nil {
		t.Fatalf("GenerateSecureUUID failed: %v", err)
	}

	// Character at position 14 (after removing hyphens) should be '4'
	if uuid[14] != '4' {
		t.Errorf("version nibble: got '%c', want '4'", uuid[14])
	}
}

func TestGenerateSecureUUID_Variant(t *testing.T) {
	uuid, err := GenerateSecureUUID()
	if err != nil {
		t.Fatalf("GenerateSecureUUID failed: %v", err)
	}

	// Character at position 19 should be 8, 9, a, or b (RFC 4122 variant)
	variant := uuid[19]
	if variant != '8' && variant != '9' && variant != 'a' && variant != 'b' {
		t.Errorf("variant nibble: got '%c', want 8/9/a/b", variant)
	}
}

func TestGenerateSecureUUID_Uniqueness(t *testing.T) {
	uuid1, _ := GenerateSecureUUID()
	uuid2, _ := GenerateSecureUUID()

	if uuid1 == uuid2 {
		t.Error("two UUID generations produced identical UUIDs")
	}
}

func TestGenerateSecureUUID_Length(t *testing.T) {
	uuid, err := GenerateSecureUUID()
	if err != nil {
		t.Fatalf("GenerateSecureUUID failed: %v", err)
	}

	// UUID format is 36 chars: 8-4-4-4-12
	if len(uuid) != 36 {
		t.Errorf("UUID length: got %d, want 36", len(uuid))
	}
}
