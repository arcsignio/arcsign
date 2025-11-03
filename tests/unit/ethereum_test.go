// Package unit - Ethereum adapter unit tests
package unit

import (
	"context"
	"encoding/json"
	"math/big"
	"testing"

	"github.com/arcsign/chainadapter"
	"github.com/arcsign/chainadapter/ethereum"
	"github.com/arcsign/chainadapter/storage"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

// TestEthereumBuilder_Validation tests transaction request validation
func TestEthereumBuilder_Validation(t *testing.T) {
	builder := ethereum.NewTransactionBuilder(1) // Mainnet

	testCases := []struct {
		name          string
		req           *chainadapter.TransactionRequest
		expectError   bool
		expectedCode  string
	}{
		{
			name: "Valid Request",
			req: &chainadapter.TransactionRequest{
				From:     "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
				To:       "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed",
				Amount:   big.NewInt(1000000000000000000), // 1 ETH
				Asset:    "ETH",
				FeeSpeed: chainadapter.FeeSpeedNormal,
			},
			expectError: false,
		},
		{
			name: "Empty From Address",
			req: &chainadapter.TransactionRequest{
				From:     "",
				To:       "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed",
				Amount:   big.NewInt(1e18),
				Asset:    "ETH",
				FeeSpeed: chainadapter.FeeSpeedNormal,
			},
			expectError:  true,
			expectedCode: chainadapter.ErrCodeInvalidAddress,
		},
		{
			name: "Invalid From Address",
			req: &chainadapter.TransactionRequest{
				From:     "invalid_address",
				To:       "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed",
				Amount:   big.NewInt(1e18),
				Asset:    "ETH",
				FeeSpeed: chainadapter.FeeSpeedNormal,
			},
			expectError:  true,
			expectedCode: chainadapter.ErrCodeInvalidAddress,
		},
		{
			name: "Empty To Address",
			req: &chainadapter.TransactionRequest{
				From:     "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
				To:       "",
				Amount:   big.NewInt(1e18),
				Asset:    "ETH",
				FeeSpeed: chainadapter.FeeSpeedNormal,
			},
			expectError:  true,
			expectedCode: chainadapter.ErrCodeInvalidAddress,
		},
		{
			name: "Invalid To Address",
			req: &chainadapter.TransactionRequest{
				From:     "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
				To:       "invalid_address",
				Amount:   big.NewInt(1e18),
				Asset:    "ETH",
				FeeSpeed: chainadapter.FeeSpeedNormal,
			},
			expectError:  true,
			expectedCode: chainadapter.ErrCodeInvalidAddress,
		},
		{
			name: "Negative Amount",
			req: &chainadapter.TransactionRequest{
				From:     "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
				To:       "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed",
				Amount:   big.NewInt(-1000),
				Asset:    "ETH",
				FeeSpeed: chainadapter.FeeSpeedNormal,
			},
			expectError:  true,
			expectedCode: chainadapter.ErrCodeInvalidAmount,
		},
		{
			name: "Unsupported Asset",
			req: &chainadapter.TransactionRequest{
				From:     "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
				To:       "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed",
				Amount:   big.NewInt(1e18),
				Asset:    "BTC",
				FeeSpeed: chainadapter.FeeSpeedNormal,
			},
			expectError:  true,
			expectedCode: chainadapter.ErrCodeUnsupportedAsset,
		},
		{
			name: "Zero Amount (Valid for Ethereum)",
			req: &chainadapter.TransactionRequest{
				From:     "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
				To:       "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed",
				Amount:   big.NewInt(0),
				Asset:    "ETH",
				FeeSpeed: chainadapter.FeeSpeedNormal,
			},
			expectError: false, // Ethereum allows 0-value transactions
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			unsigned, err := builder.Build(
				context.Background(),
				tc.req,
				0,     // nonce
				21000, // gas limit
				big.NewInt(50e9), // maxFeePerGas (50 Gwei)
				big.NewInt(2e9),  // maxPriorityFeePerGas (2 Gwei)
			)

			if tc.expectError {
				require.Error(t, err)
				chainErr, ok := err.(*chainadapter.ChainError)
				require.True(t, ok, "Error should be ChainError")
				if tc.expectedCode != "" {
					assert.Equal(t, tc.expectedCode, chainErr.Code)
				}
			} else {
				require.NoError(t, err)
				require.NotNil(t, unsigned)
				assert.Equal(t, tc.req.From, unsigned.From)
				assert.Equal(t, tc.req.To, unsigned.To)
				assert.Equal(t, tc.req.Amount, unsigned.Amount)
			}
		})
	}
}

// TestEthereumAdapter_Build tests the full Build() method with mocked RPC
func TestEthereumAdapter_Build(t *testing.T) {
	// Create mocks
	mockRPC := new(MockRPCClient)
	mockTxStore := storage.NewMemoryTxStore()

	// Create adapter
	adapter, err := ethereum.NewEthereumAdapter(mockRPC, mockTxStore, 1) // Mainnet
	require.NoError(t, err)

	// Mock eth_getTransactionCount response (nonce)
	mockNonceJSON := []byte(`"0x5"`) // Nonce = 5
	mockRPC.On("Call", mock.Anything, "eth_getTransactionCount", mock.Anything).
		Return(json.RawMessage(mockNonceJSON), nil)

	// Mock eth_estimateGas response
	mockGasJSON := []byte(`"0x5208"`) // 21000 gas
	mockRPC.On("Call", mock.Anything, "eth_estimateGas", mock.Anything).
		Return(json.RawMessage(mockGasJSON), nil)

	// Mock eth_getBlockByNumber response (base fee)
	mockBlockJSON := []byte(`{
		"baseFeePerGas": "0x6fc23ac00"
	}`) // 30 Gwei
	mockRPC.On("Call", mock.Anything, "eth_getBlockByNumber", mock.Anything).
		Return(json.RawMessage(mockBlockJSON), nil)

	// Mock eth_feeHistory response (priority fee)
	mockFeeHistoryJSON := []byte(`{
		"reward": [
			["0x77359400"],
			["0x77359400"]
		]
	}`) // 2 Gwei
	mockRPC.On("Call", mock.Anything, "eth_feeHistory", mock.Anything).
		Return(json.RawMessage(mockFeeHistoryJSON), nil)

	// Test valid build
	t.Run("Valid Build", func(t *testing.T) {
		req := &chainadapter.TransactionRequest{
			From:     "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
			To:       "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed",
			Amount:   big.NewInt(1e18), // 1 ETH
			Asset:    "ETH",
			FeeSpeed: chainadapter.FeeSpeedNormal,
		}

		unsigned, err := adapter.Build(context.Background(), req)

		require.NoError(t, err)
		require.NotNil(t, unsigned)
		assert.Equal(t, "ethereum", unsigned.ChainID)
		assert.Equal(t, req.From, unsigned.From)
		assert.Equal(t, req.To, unsigned.To)
		assert.Equal(t, req.Amount, unsigned.Amount)
		assert.NotNil(t, unsigned.Fee)
		assert.NotNil(t, unsigned.Nonce)
		assert.Equal(t, uint64(5), *unsigned.Nonce)
		assert.NotEmpty(t, unsigned.ID)
		assert.NotEmpty(t, unsigned.SigningPayload)
		assert.NotEmpty(t, unsigned.HumanReadable)

		// Verify chain-specific fields
		assert.NotNil(t, unsigned.ChainSpecific)
		assert.Contains(t, unsigned.ChainSpecific, "chain_id")
		assert.Contains(t, unsigned.ChainSpecific, "nonce")
		assert.Contains(t, unsigned.ChainSpecific, "gas_limit")
		assert.Contains(t, unsigned.ChainSpecific, "max_fee_per_gas")
		assert.Contains(t, unsigned.ChainSpecific, "max_priority_fee_per_gas")
	})

	// Test fee speed variations
	t.Run("Fee Speed Variations", func(t *testing.T) {
		speeds := []chainadapter.FeeSpeed{
			chainadapter.FeeSpeedFast,
			chainadapter.FeeSpeedNormal,
			chainadapter.FeeSpeedSlow,
		}

		for _, speed := range speeds {
			t.Run(string(speed), func(t *testing.T) {
				req := &chainadapter.TransactionRequest{
					From:     "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
					To:       "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed",
					Amount:   big.NewInt(1e18),
					Asset:    "ETH",
					FeeSpeed: speed,
				}

				unsigned, err := adapter.Build(context.Background(), req)
				require.NoError(t, err)
				require.NotNil(t, unsigned)
			})
		}
	})

	mockRPC.AssertExpectations(t)
}

// TestEthereumAdapter_BuildDeterminism tests that Build() is deterministic
func TestEthereumAdapter_BuildDeterminism(t *testing.T) {
	// Create mocks
	mockRPC := new(MockRPCClient)
	mockTxStore := storage.NewMemoryTxStore()

	// Create adapter
	adapter, err := ethereum.NewEthereumAdapter(mockRPC, mockTxStore, 1)
	require.NoError(t, err)

	// Mock RPC responses
	mockNonceJSON := []byte(`"0x5"`)
	mockGasJSON := []byte(`"0x5208"`)
	mockBlockJSON := []byte(`{"baseFeePerGas": "0x6fc23ac00"}`)
	mockFeeHistoryJSON := []byte(`{"reward": [["0x77359400"], ["0x77359400"]]}`)

	mockRPC.On("Call", mock.Anything, "eth_getTransactionCount", mock.Anything).
		Return(json.RawMessage(mockNonceJSON), nil).Times(2)
	mockRPC.On("Call", mock.Anything, "eth_estimateGas", mock.Anything).
		Return(json.RawMessage(mockGasJSON), nil).Times(2)
	mockRPC.On("Call", mock.Anything, "eth_getBlockByNumber", mock.Anything).
		Return(json.RawMessage(mockBlockJSON), nil).Times(2)
	mockRPC.On("Call", mock.Anything, "eth_feeHistory", mock.Anything).
		Return(json.RawMessage(mockFeeHistoryJSON), nil).Times(2)

	// Build same transaction twice
	req := &chainadapter.TransactionRequest{
		From:     "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
		To:       "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed",
		Amount:   big.NewInt(1e18),
		Asset:    "ETH",
		FeeSpeed: chainadapter.FeeSpeedNormal,
	}

	unsigned1, err1 := adapter.Build(context.Background(), req)
	unsigned2, err2 := adapter.Build(context.Background(), req)

	require.NoError(t, err1)
	require.NoError(t, err2)
	require.NotNil(t, unsigned1)
	require.NotNil(t, unsigned2)

	// Verify determinism
	assert.Equal(t, unsigned1.ID, unsigned2.ID, "Transaction IDs should match")
	assert.Equal(t, unsigned1.SigningPayload, unsigned2.SigningPayload, "Signing payloads should match")
	assert.Equal(t, unsigned1.Amount, unsigned2.Amount, "Amounts should match")
	assert.Equal(t, unsigned1.Fee, unsigned2.Fee, "Fees should match")
	assert.Equal(t, unsigned1.Nonce, unsigned2.Nonce, "Nonces should match")

	mockRPC.AssertExpectations(t)
}

// TestEthereumAdapter_Capabilities tests the Capabilities() method
func TestEthereumAdapter_Capabilities(t *testing.T) {
	mockRPC := new(MockRPCClient)
	mockTxStore := storage.NewMemoryTxStore()

	adapter, err := ethereum.NewEthereumAdapter(mockRPC, mockTxStore, 1) // Mainnet
	require.NoError(t, err)

	caps := adapter.Capabilities()

	assert.Equal(t, "ethereum", caps.ChainID)
	assert.True(t, caps.SupportsEIP1559, "Ethereum supports EIP-1559")
	assert.True(t, caps.SupportsMemo, "Ethereum supports data field")
	assert.False(t, caps.SupportsRBF, "Ethereum doesn't support Replace-By-Fee")
	assert.Equal(t, 0, caps.MaxMemoLength, "Ethereum has no hard memo limit")
	assert.Equal(t, 12, caps.MinConfirmations, "Ethereum recommended 12 confirmations")
}

// TestEthereumBuilder_HumanReadable tests the human-readable output
func TestEthereumBuilder_HumanReadable(t *testing.T) {
	builder := ethereum.NewTransactionBuilder(1)

	req := &chainadapter.TransactionRequest{
		From:     "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
		To:       "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed",
		Amount:   big.NewInt(1e18), // 1 ETH
		Asset:    "ETH",
		FeeSpeed: chainadapter.FeeSpeedNormal,
		Memo:     "Test transaction",
	}

	unsigned, err := builder.Build(
		context.Background(),
		req,
		5,     // nonce
		21000, // gas limit
		big.NewInt(50e9), // 50 Gwei
		big.NewInt(2e9),  // 2 Gwei
	)

	require.NoError(t, err)
	require.NotNil(t, unsigned)

	// Verify human-readable contains key information
	assert.Contains(t, unsigned.HumanReadable, req.From)
	assert.Contains(t, unsigned.HumanReadable, req.To)
	assert.Contains(t, unsigned.HumanReadable, "ETH")
	assert.Contains(t, unsigned.HumanReadable, "nonce")
	assert.Contains(t, unsigned.HumanReadable, "gas_limit")
	assert.Contains(t, unsigned.HumanReadable, req.Memo)
}

// TestEthereumAdapter_Estimate tests the Estimate() method
func TestEthereumAdapter_Estimate(t *testing.T) {
	// Create mocks
	mockRPC := new(MockRPCClient)
	mockTxStore := storage.NewMemoryTxStore()

	// Create adapter
	adapter, err := ethereum.NewEthereumAdapter(mockRPC, mockTxStore, 1) // Mainnet
	require.NoError(t, err)

	// Mock eth_getBlockByNumber response (base fee)
	mockBlockJSON := []byte(`{"baseFeePerGas": "0x6fc23ac00"}`) // 30 Gwei
	mockRPC.On("Call", mock.Anything, "eth_getBlockByNumber", mock.Anything).
		Return(json.RawMessage(mockBlockJSON), nil)

	// Mock eth_feeHistory response (priority fee)
	mockFeeHistoryJSON := []byte(`{
		"reward": [
			["0x77359400"],
			["0x77359400"]
		]
	}`) // 2 Gwei
	mockRPC.On("Call", mock.Anything, "eth_feeHistory", mock.Anything).
		Return(json.RawMessage(mockFeeHistoryJSON), nil)

	t.Run("Valid Estimate - Normal Speed", func(t *testing.T) {
		req := &chainadapter.TransactionRequest{
			From:     "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
			To:       "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed",
			Amount:   big.NewInt(1e18), // 1 ETH
			Asset:    "ETH",
			FeeSpeed: chainadapter.FeeSpeedNormal,
		}

		estimate, err := adapter.Estimate(context.Background(), req)

		require.NoError(t, err)
		require.NotNil(t, estimate)

		// Verify fee bounds (MinFee <= Recommended <= MaxFee)
		assert.True(t, estimate.MinFee.Cmp(estimate.Recommended) <= 0,
			"MinFee (%s) must be <= Recommended (%s)",
			estimate.MinFee.String(), estimate.Recommended.String())
		assert.True(t, estimate.Recommended.Cmp(estimate.MaxFee) <= 0,
			"Recommended (%s) must be <= MaxFee (%s)",
			estimate.Recommended.String(), estimate.MaxFee.String())

		// Verify all fees are positive
		assert.True(t, estimate.MinFee.Cmp(big.NewInt(0)) > 0, "MinFee must be positive")
		assert.True(t, estimate.Recommended.Cmp(big.NewInt(0)) > 0, "Recommended must be positive")
		assert.True(t, estimate.MaxFee.Cmp(big.NewInt(0)) > 0, "MaxFee must be positive")

		// Verify confidence is in valid range
		assert.GreaterOrEqual(t, estimate.Confidence, 0, "Confidence must be >= 0")
		assert.LessOrEqual(t, estimate.Confidence, 100, "Confidence must be <= 100")

		// Verify chain ID matches
		assert.Equal(t, "ethereum", estimate.ChainID)

		// Verify estimated blocks
		assert.Equal(t, 3, estimate.EstimatedBlocks, "Normal speed should target 3 blocks")

		// Verify reason is provided
		assert.NotEmpty(t, estimate.Reason, "Reason should explain confidence level")

		// Ethereum has base fee (EIP-1559)
		assert.NotNil(t, estimate.BaseFee, "Ethereum should have base fee")
		assert.True(t, estimate.BaseFee.Cmp(big.NewInt(0)) > 0, "Base fee should be positive")
	})

	t.Run("Fee Speed Variations", func(t *testing.T) {
		speeds := []struct {
			speed          chainadapter.FeeSpeed
			expectedBlocks int
		}{
			{chainadapter.FeeSpeedFast, 1},
			{chainadapter.FeeSpeedNormal, 3},
			{chainadapter.FeeSpeedSlow, 6},
		}

		for _, tc := range speeds {
			t.Run(string(tc.speed), func(t *testing.T) {
				req := &chainadapter.TransactionRequest{
					From:     "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
					To:       "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed",
					Amount:   big.NewInt(1e18),
					Asset:    "ETH",
					FeeSpeed: tc.speed,
				}

				estimate, err := adapter.Estimate(context.Background(), req)
				require.NoError(t, err)
				require.NotNil(t, estimate)

				assert.Equal(t, tc.expectedBlocks, estimate.EstimatedBlocks,
					"Expected %d blocks for %s speed", tc.expectedBlocks, tc.speed)
			})
		}
	})

	t.Run("RPC Failure - Fallback Estimate", func(t *testing.T) {
		// Create a separate mock that returns errors
		mockFailRPC := new(MockRPCClient)
		failAdapter, err := ethereum.NewEthereumAdapter(mockFailRPC, mockTxStore, 1)
		require.NoError(t, err)

		// Mock RPC to return error
		mockFailRPC.On("Call", mock.Anything, "eth_getBlockByNumber", mock.Anything).
			Return(json.RawMessage(nil), chainadapter.NewRetryableError(
				"ERR_RPC_CONNECTION",
				"RPC connection failed",
				nil,
			))

		req := &chainadapter.TransactionRequest{
			From:     "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
			To:       "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed",
			Amount:   big.NewInt(1e18),
			Asset:    "ETH",
			FeeSpeed: chainadapter.FeeSpeedNormal,
		}

		estimate, err := failAdapter.Estimate(context.Background(), req)

		// Should succeed with fallback estimates
		require.NoError(t, err)
		require.NotNil(t, estimate)

		// Verify fee bounds are still valid
		assert.True(t, estimate.MinFee.Cmp(estimate.Recommended) <= 0)
		assert.True(t, estimate.Recommended.Cmp(estimate.MaxFee) <= 0)

		// Fallback should have lower confidence (50%)
		assert.Equal(t, 50, estimate.Confidence, "Fallback estimates should have 50%% confidence")

		// Reason should indicate fallback
		assert.Contains(t, estimate.Reason, "fallback", "Reason should mention fallback")

		mockFailRPC.AssertExpectations(t)
	})

	t.Run("Estimate Idempotency", func(t *testing.T) {
		req := &chainadapter.TransactionRequest{
			From:     "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
			To:       "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed",
			Amount:   big.NewInt(1e18),
			Asset:    "ETH",
			FeeSpeed: chainadapter.FeeSpeedNormal,
		}

		// Call Estimate twice
		estimate1, err1 := adapter.Estimate(context.Background(), req)
		estimate2, err2 := adapter.Estimate(context.Background(), req)

		require.NoError(t, err1)
		require.NoError(t, err2)
		require.NotNil(t, estimate1)
		require.NotNil(t, estimate2)

		// Estimates should be very similar (within 10%)
		diff := new(big.Int).Sub(estimate1.Recommended, estimate2.Recommended)
		diff.Abs(diff)

		threshold := new(big.Int).Div(estimate1.Recommended, big.NewInt(10))

		assert.True(t, diff.Cmp(threshold) <= 0,
			"Consecutive estimates should be within 10%%, got diff=%s, threshold=%s",
			diff.String(), threshold.String())
	})

	t.Run("High Base Fee - Lower Confidence", func(t *testing.T) {
		// Create separate mock with high base fee
		mockHighFeeRPC := new(MockRPCClient)
		highFeeAdapter, err := ethereum.NewEthereumAdapter(mockHighFeeRPC, mockTxStore, 1)
		require.NoError(t, err)

		// Mock high base fee (150 Gwei = congested network)
		mockHighBlockJSON := []byte(`{"baseFeePerGas": "0x22ecb25c00"}`) // 150 Gwei
		mockHighFeeRPC.On("Call", mock.Anything, "eth_getBlockByNumber", mock.Anything).
			Return(json.RawMessage(mockHighBlockJSON), nil)

		// Mock normal priority fee
		mockHighFeeRPC.On("Call", mock.Anything, "eth_feeHistory", mock.Anything).
			Return(json.RawMessage(mockFeeHistoryJSON), nil)

		req := &chainadapter.TransactionRequest{
			From:     "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
			To:       "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed",
			Amount:   big.NewInt(1e18),
			Asset:    "ETH",
			FeeSpeed: chainadapter.FeeSpeedNormal,
		}

		estimate, err := highFeeAdapter.Estimate(context.Background(), req)
		require.NoError(t, err)
		require.NotNil(t, estimate)

		// High base fee should result in lower confidence
		assert.LessOrEqual(t, estimate.Confidence, 70,
			"High base fee should result in confidence <= 70%%")

		mockHighFeeRPC.AssertExpectations(t)
	})

	mockRPC.AssertExpectations(t)
}

// TestEthereumAdapter_EstimateWithDifferentNetworks tests estimation across networks
func TestEthereumAdapter_EstimateWithDifferentNetworks(t *testing.T) {
	networks := []struct {
		networkID       int64
		expectedChainID string
	}{
		{1, "ethereum"},
		{5, "ethereum-goerli"},
		{11155111, "ethereum-sepolia"},
	}

	for _, tc := range networks {
		t.Run(tc.expectedChainID, func(t *testing.T) {
			mockRPC := new(MockRPCClient)
			mockTxStore := storage.NewMemoryTxStore()

			adapter, err := ethereum.NewEthereumAdapter(mockRPC, mockTxStore, tc.networkID)
			require.NoError(t, err)

			// Mock RPC responses
			mockBlockJSON := []byte(`{"baseFeePerGas": "0x6fc23ac00"}`) // 30 Gwei
			mockRPC.On("Call", mock.Anything, "eth_getBlockByNumber", mock.Anything).
				Return(json.RawMessage(mockBlockJSON), nil)

			mockFeeHistoryJSON := []byte(`{
				"reward": [
					["0x77359400"],
					["0x77359400"]
				]
			}`) // 2 Gwei
			mockRPC.On("Call", mock.Anything, "eth_feeHistory", mock.Anything).
				Return(json.RawMessage(mockFeeHistoryJSON), nil)

			req := &chainadapter.TransactionRequest{
				From:     "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
				To:       "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed",
				Amount:   big.NewInt(1e18),
				Asset:    "ETH",
				FeeSpeed: chainadapter.FeeSpeedNormal,
			}

			estimate, err := adapter.Estimate(context.Background(), req)
			require.NoError(t, err)
			require.NotNil(t, estimate)

			assert.Equal(t, tc.expectedChainID, estimate.ChainID,
				"ChainID should match network")

			mockRPC.AssertExpectations(t)
		})
	}
}
