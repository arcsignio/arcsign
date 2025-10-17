package utils

import (
	"errors"
	"unicode"
)

// ValidatePassword validates password strength according to OWASP guidelines
// Requirements:
// - Minimum 12 characters
// - At least 3 of the following 4 complexity types:
//   1. Uppercase letters (A-Z)
//   2. Lowercase letters (a-z)
//   3. Numbers (0-9)
//   4. Special characters (!@#$%^&*()_+-=[]{}|;:,.<>?)
func ValidatePassword(password string) error {
	if len(password) < 12 {
		return errors.New("password must be at least 12 characters long")
	}

	var (
		hasUpper   bool
		hasLower   bool
		hasNumber  bool
		hasSpecial bool
	)

	for _, char := range password {
		switch {
		case unicode.IsUpper(char):
			hasUpper = true
		case unicode.IsLower(char):
			hasLower = true
		case unicode.IsDigit(char):
			hasNumber = true
		case unicode.IsPunct(char) || unicode.IsSymbol(char):
			hasSpecial = true
		}
	}

	// Count complexity types
	complexityCount := 0
	if hasUpper {
		complexityCount++
	}
	if hasLower {
		complexityCount++
	}
	if hasNumber {
		complexityCount++
	}
	if hasSpecial {
		complexityCount++
	}

	if complexityCount < 3 {
		return errors.New("password must contain at least 3 of the following: uppercase letters, lowercase letters, numbers, special characters")
	}

	return nil
}
