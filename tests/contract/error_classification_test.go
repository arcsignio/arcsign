// Package contract - Error classification contract tests
package contract

import (
	"context"
	"math/big"
	"testing"

	"github.com/arcsign/chainadapter"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestErrorClassification verifies TC-003: Errors MUST be correctly classified.
//
// Contract: All errors must be classified as Retryable, NonRetryable, or UserIntervention.
//
// This test should be run against all ChainAdapter implementations.
func TestErrorClassification(t *testing.T, adapter chainadapter.ChainAdapter) {
	testCases := []struct {
		name          string
		req           *chainadapter.TransactionRequest
		expectedClass chainadapter.ErrorClassification
		expectedCode  string
	}{
		{
			name: "Invalid From Address",
			req: &chainadapter.TransactionRequest{
				From:     "invalid_address",
				To:       "valid_address",
				Amount:   big.NewInt(100000),
				Asset:    adapter.ChainID(),
				FeeSpeed: chainadapter.FeeSpeedNormal,
			},
			expectedClass: chainadapter.NonRetryable,
			expectedCode:  chainadapter.ErrCodeInvalidAddress,
		},
		{
			name: "Invalid To Address",
			req: &chainadapter.TransactionRequest{
				From:     "valid_address",
				To:       "invalid_address",
				Amount:   big.NewInt(100000),
				Asset:    adapter.ChainID(),
				FeeSpeed: chainadapter.FeeSpeedNormal,
			},
			expectedClass: chainadapter.NonRetryable,
			expectedCode:  chainadapter.ErrCodeInvalidAddress,
		},
		{
			name: "Zero Amount",
			req: &chainadapter.TransactionRequest{
				From:     "valid_address_1",
				To:       "valid_address_2",
				Amount:   big.NewInt(0),
				Asset:    adapter.ChainID(),
				FeeSpeed: chainadapter.FeeSpeedNormal,
			},
			expectedClass: chainadapter.NonRetryable,
			expectedCode:  chainadapter.ErrCodeInvalidAmount,
		},
		{
			name: "Negative Amount",
			req: &chainadapter.TransactionRequest{
				From:     "valid_address_1",
				To:       "valid_address_2",
				Amount:   big.NewInt(-1000),
				Asset:    adapter.ChainID(),
				FeeSpeed: chainadapter.FeeSpeedNormal,
			},
			expectedClass: chainadapter.NonRetryable,
			expectedCode:  chainadapter.ErrCodeInvalidAmount,
		},
		{
			name: "Unsupported Asset",
			req: &chainadapter.TransactionRequest{
				From:     "valid_address_1",
				To:       "valid_address_2",
				Amount:   big.NewInt(100000),
				Asset:    "INVALID_ASSET",
				FeeSpeed: chainadapter.FeeSpeedNormal,
			},
			expectedClass: chainadapter.NonRetryable,
			expectedCode:  chainadapter.ErrCodeUnsupportedAsset,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// Act: Call Build() with invalid request
			_, err := adapter.Build(context.Background(), tc.req)

			// Assert: Error should occur
			require.Error(t, err, "Build() should return error for invalid input")

			// Assert: Error must be ChainError
			chainErr, ok := err.(*chainadapter.ChainError)
			require.True(t, ok, "Error must be ChainError, got: %T", err)

			// Assert: Classification must match expected
			assert.Equal(t, tc.expectedClass, chainErr.Classification,
				"Error classification mismatch for %s", tc.name)

			// Assert: Error code should match (if specified)
			if tc.expectedCode != "" {
				assert.Equal(t, tc.expectedCode, chainErr.Code,
					"Error code mismatch for %s", tc.name)
			}

			// Assert: Message should not be empty
			assert.NotEmpty(t, chainErr.Message, "Error message should not be empty")

			// Assert: NonRetryable errors should not have RetryAfter
			if chainErr.Classification == chainadapter.NonRetryable {
				assert.Nil(t, chainErr.RetryAfter,
					"NonRetryable errors should not have RetryAfter duration")
			}
		})
	}
}

// TestErrorClassificationHelpers verifies that error classification helper functions work correctly.
func TestErrorClassificationHelpers(t *testing.T) {
	testCases := []struct {
		name          string
		err           error
		isRetryable   bool
		isNonRetryable bool
		isUserIntervention bool
	}{
		{
			name:          "Retryable Error",
			err:           chainadapter.NewRetryableError(chainadapter.ErrCodeRPCTimeout, "RPC timeout", nil, nil),
			isRetryable:   true,
			isNonRetryable: false,
			isUserIntervention: false,
		},
		{
			name:          "NonRetryable Error",
			err:           chainadapter.NewNonRetryableError(chainadapter.ErrCodeInvalidAddress, "Invalid address", nil),
			isRetryable:   false,
			isNonRetryable: true,
			isUserIntervention: false,
		},
		{
			name:          "UserIntervention Error",
			err:           chainadapter.NewUserInterventionError(chainadapter.ErrCodeFeeTooLow, "Fee too low", nil),
			isRetryable:   false,
			isNonRetryable: false,
			isUserIntervention: true,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.isRetryable, chainadapter.IsRetryable(tc.err),
				"IsRetryable() mismatch")
			assert.Equal(t, tc.isNonRetryable, chainadapter.IsNonRetryable(tc.err),
				"IsNonRetryable() mismatch")
			assert.Equal(t, tc.isUserIntervention, chainadapter.IsUserIntervention(tc.err),
				"IsUserIntervention() mismatch")
		})
	}
}

// TestErrorWrapping verifies that ChainError properly wraps underlying errors.
func TestErrorWrapping(t *testing.T) {
	// Arrange: Create a chain error with underlying cause
	underlyingErr := assert.AnError
	chainErr := chainadapter.NewNonRetryableError(
		chainadapter.ErrCodeInvalidAddress,
		"Invalid address format",
		underlyingErr,
	)

	// Assert: Error message includes both ChainError and cause
	assert.Contains(t, chainErr.Error(), "Invalid address format")
	assert.Contains(t, chainErr.Error(), "caused by")

	// Assert: Unwrap returns underlying error
	assert.Equal(t, underlyingErr, chainErr.Unwrap())
}
