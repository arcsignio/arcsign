// Package mocks - Mock implementations for Signer and KeySource
package mocks

import (
	"github.com/stretchr/testify/mock"
)

// MockSigner is a mock implementation of Signer for testing.
type MockSigner struct {
	mock.Mock
}

// Sign mocks the Sign method.
func (m *MockSigner) Sign(payload []byte, address string) ([]byte, error) {
	args := m.Called(payload, address)

	if args.Get(0) == nil {
		return nil, args.Error(1)
	}

	return args.Get(0).([]byte), args.Error(1)
}

// GetAddress mocks the GetAddress method.
func (m *MockSigner) GetAddress() string {
	args := m.Called()
	return args.String(0)
}

// MockKeySource is a mock implementation of KeySource for testing.
type MockKeySource struct {
	mock.Mock
}

// Type mocks the Type method.
func (m *MockKeySource) Type() string {
	args := m.Called()
	return args.String(0)
}

// GetPublicKey mocks the GetPublicKey method.
func (m *MockKeySource) GetPublicKey(path string) ([]byte, error) {
	args := m.Called(path)

	if args.Get(0) == nil {
		return nil, args.Error(1)
	}

	return args.Get(0).([]byte), args.Error(1)
}
