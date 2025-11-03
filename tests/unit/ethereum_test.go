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
