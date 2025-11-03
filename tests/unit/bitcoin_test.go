// Package unit provides unit tests for ChainAdapter implementations
package unit

import (
	"context"
	"encoding/json"
	"math/big"
	"testing"

	"github.com/arcsign/chainadapter"
	"github.com/arcsign/chainadapter/bitcoin"
	"github.com/arcsign/chainadapter/rpc"
	"github.com/arcsign/chainadapter/storage"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

// MockRPCClient is a test mock for rpc.RPCClient
type MockRPCClient struct {
	mock.Mock
}

func (m *MockRPCClient) Call(ctx context.Context, method string, params interface{}) (json.RawMessage, error) {
	args := m.Called(ctx, method, params)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(json.RawMessage), args.Error(1)
}

func (m *MockRPCClient) CallBatch(ctx context.Context, requests []rpc.RPCRequest) ([]json.RawMessage, error) {
	args := m.Called(ctx, requests)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]json.RawMessage), args.Error(1)
}

func (m *MockRPCClient) Close() error {
	args := m.Called()
	return args.Error(0)
}

// TestBitcoinBuilder_Validation tests transaction request validation
func TestBitcoinBuilder_Validation(t *testing.T) {
	builder, err := bitcoin.NewTransactionBuilder("regtest")
	require.NoError(t, err)

	testCases := []struct {
		name          string
		req           *chainadapter.TransactionRequest
		expectError   bool
		expectedCode  string
	}{
		{
			name: "Valid Request",
			req: &chainadapter.TransactionRequest{
				From:     "bcrt1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
				To:       "bcrt1q8c6fshw2dlwun7ekn9qwf37cu2rn755upcp6el",
				Amount:   big.NewInt(100000),
				Asset:    "BTC",
				FeeSpeed: chainadapter.FeeSpeedNormal,
			},
			expectError: false,
		},
		{
			name: "Empty From Address",
			req: &chainadapter.TransactionRequest{
				From:     "",
				To:       "bcrt1q8c6fshw2dlwun7ekn9qwf37cu2rn755upcp6el",
				Amount:   big.NewInt(100000),
				Asset:    "BTC",
				FeeSpeed: chainadapter.FeeSpeedNormal,
			},
			expectError:  true,
			expectedCode: chainadapter.ErrCodeInvalidAddress,
		},
		{
			name: "Invalid From Address",
			req: &chainadapter.TransactionRequest{
				From:     "invalid_address",
				To:       "bcrt1q8c6fshw2dlwun7ekn9qwf37cu2rn755upcp6el",
				Amount:   big.NewInt(100000),
				Asset:    "BTC",
				FeeSpeed: chainadapter.FeeSpeedNormal,
			},
			expectError:  true,
			expectedCode: chainadapter.ErrCodeInvalidAddress,
		},
		{
			name: "Empty To Address",
			req: &chainadapter.TransactionRequest{
				From:     "bcrt1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
				To:       "",
				Amount:   big.NewInt(100000),
				Asset:    "BTC",
				FeeSpeed: chainadapter.FeeSpeedNormal,
			},
			expectError:  true,
			expectedCode: chainadapter.ErrCodeInvalidAddress,
		},
		{
			name: "Invalid To Address",
			req: &chainadapter.TransactionRequest{
				From:     "bcrt1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
				To:       "invalid_address",
				Amount:   big.NewInt(100000),
				Asset:    "BTC",
				FeeSpeed: chainadapter.FeeSpeedNormal,
			},
			expectError:  true,
			expectedCode: chainadapter.ErrCodeInvalidAddress,
		},
		{
			name: "Zero Amount",
			req: &chainadapter.TransactionRequest{
				From:     "bcrt1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
				To:       "bcrt1q8c6fshw2dlwun7ekn9qwf37cu2rn755upcp6el",
				Amount:   big.NewInt(0),
				Asset:    "BTC",
				FeeSpeed: chainadapter.FeeSpeedNormal,
			},
			expectError:  true,
			expectedCode: chainadapter.ErrCodeInvalidAmount,
		},
		{
			name: "Negative Amount",
			req: &chainadapter.TransactionRequest{
				From:     "bcrt1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
				To:       "bcrt1q8c6fshw2dlwun7ekn9qwf37cu2rn755upcp6el",
				Amount:   big.NewInt(-1000),
				Asset:    "BTC",
				FeeSpeed: chainadapter.FeeSpeedNormal,
			},
			expectError:  true,
			expectedCode: chainadapter.ErrCodeInvalidAmount,
		},
		{
			name: "Unsupported Asset",
			req: &chainadapter.TransactionRequest{
				From:     "bcrt1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
				To:       "bcrt1q8c6fshw2dlwun7ekn9qwf37cu2rn755upcp6el",
				Amount:   big.NewInt(100000),
				Asset:    "ETH",
				FeeSpeed: chainadapter.FeeSpeedNormal,
			},
			expectError:  true,
			expectedCode: chainadapter.ErrCodeUnsupportedAsset,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// Create mock UTXOs
			mockUTXOs := []bitcoin.UTXO{
				{
					TxID:   "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
					Vout:   0,
					Amount: 500000, // 0.005 BTC
				},
			}

			unsigned, err := builder.Build(context.Background(), tc.req, mockUTXOs, 10)

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

// TestBitcoinBuilder_UTXOSelection tests UTXO selection logic
func TestBitcoinBuilder_UTXOSelection(t *testing.T) {
	builder, err := bitcoin.NewTransactionBuilder("regtest")
	require.NoError(t, err)

	testCases := []struct {
		name        string
		utxos       []bitcoin.UTXO
		amount      int64
		expectError bool
	}{
		{
			name: "Sufficient UTXOs",
			utxos: []bitcoin.UTXO{
				{TxID: "tx1", Vout: 0, Amount: 300000},
				{TxID: "tx2", Vout: 0, Amount: 200000},
			},
			amount:      100000,
			expectError: false,
		},
		{
			name: "Insufficient UTXOs",
			utxos: []bitcoin.UTXO{
				{TxID: "tx1", Vout: 0, Amount: 50000},
			},
			amount:      100000,
			expectError: true,
		},
		{
			name: "Exact Amount (accounting for fees)",
			utxos: []bitcoin.UTXO{
				{TxID: "tx1", Vout: 0, Amount: 105000}, // Amount + estimated fee
			},
			amount:      100000,
			expectError: false,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			req := &chainadapter.TransactionRequest{
				From:     "bcrt1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
				To:       "bcrt1q8c6fshw2dlwun7ekn9qwf37cu2rn755upcp6el",
				Amount:   big.NewInt(tc.amount),
				Asset:    "BTC",
				FeeSpeed: chainadapter.FeeSpeedNormal,
			}

			unsigned, err := builder.Build(context.Background(), req, tc.utxos, 10)

			if tc.expectError {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
				require.NotNil(t, unsigned)
				assert.NotNil(t, unsigned.Fee)
				assert.True(t, unsigned.Fee.Cmp(big.NewInt(0)) > 0, "Fee should be positive")
			}
		})
	}
}

// TestBitcoinAdapter_Build tests the full Build() method with mocked RPC
func TestBitcoinAdapter_Build(t *testing.T) {
	// Create mocks
	mockRPC := new(MockRPCClient)
	mockTxStore := storage.NewMemoryTxStore()

	// Create adapter
	adapter, err := bitcoin.NewBitcoinAdapter(mockRPC, mockTxStore, "regtest")
	require.NoError(t, err)

	// Mock listunspent response
	mockUTXOsJSON := []byte(`[
		{
			"txid": "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
			"vout": 0,
			"address": "bcrt1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
			"scriptPubKey": "0014",
			"amount": 0.005,
			"confirmations": 10,
			"spendable": true,
			"solvable": true
		}
	]`)

	mockRPC.On("Call", mock.Anything, "listunspent", mock.Anything).
		Return(json.RawMessage(mockUTXOsJSON), nil)

	// Mock estimatesmartfee response
	mockFeeJSON := []byte(`{
		"feerate": 0.00001,
		"blocks": 3
	}`)

	mockRPC.On("Call", mock.Anything, "estimatesmartfee", mock.Anything).
		Return(json.RawMessage(mockFeeJSON), nil)

	// Test valid build
	t.Run("Valid Build", func(t *testing.T) {
		req := &chainadapter.TransactionRequest{
			From:     "bcrt1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
			To:       "bcrt1q8c6fshw2dlwun7ekn9qwf37cu2rn755upcp6el",
			Amount:   big.NewInt(100000), // 0.001 BTC
			Asset:    "BTC",
			FeeSpeed: chainadapter.FeeSpeedNormal,
		}

		unsigned, err := adapter.Build(context.Background(), req)

		require.NoError(t, err)
		require.NotNil(t, unsigned)
		assert.Equal(t, "bitcoin-regtest", unsigned.ChainID)
		assert.Equal(t, req.From, unsigned.From)
		assert.Equal(t, req.To, unsigned.To)
		assert.Equal(t, req.Amount, unsigned.Amount)
		assert.NotNil(t, unsigned.Fee)
		assert.NotEmpty(t, unsigned.ID)
		assert.NotEmpty(t, unsigned.SigningPayload)
		assert.NotEmpty(t, unsigned.HumanReadable)

		// Verify chain-specific fields
		assert.NotNil(t, unsigned.ChainSpecific)
		assert.Contains(t, unsigned.ChainSpecific, "utxos")
		assert.Contains(t, unsigned.ChainSpecific, "fee_rate")
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
					From:     "bcrt1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
					To:       "bcrt1q8c6fshw2dlwun7ekn9qwf37cu2rn755upcp6el",
					Amount:   big.NewInt(100000),
					Asset:    "BTC",
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

// TestBitcoinAdapter_BuildDeterminism tests that Build() is deterministic
func TestBitcoinAdapter_BuildDeterminism(t *testing.T) {
	// Create mocks
	mockRPC := new(MockRPCClient)
	mockTxStore := storage.NewMemoryTxStore()

	// Create adapter
	adapter, err := bitcoin.NewBitcoinAdapter(mockRPC, mockTxStore, "regtest")
	require.NoError(t, err)

	// Mock RPC responses
	mockUTXOsJSON := []byte(`[
		{
			"txid": "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
			"vout": 0,
			"address": "bcrt1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
			"scriptPubKey": "0014",
			"amount": 0.01,
			"confirmations": 10,
			"spendable": true,
			"solvable": true
		}
	]`)

	mockFeeJSON := []byte(`{"feerate": 0.00001, "blocks": 3}`)

	mockRPC.On("Call", mock.Anything, "listunspent", mock.Anything).
		Return(json.RawMessage(mockUTXOsJSON), nil).Times(2)

	mockRPC.On("Call", mock.Anything, "estimatesmartfee", mock.Anything).
		Return(json.RawMessage(mockFeeJSON), nil).Times(2)

	// Build same transaction twice
	req := &chainadapter.TransactionRequest{
		From:     "bcrt1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
		To:       "bcrt1q8c6fshw2dlwun7ekn9qwf37cu2rn755upcp6el",
		Amount:   big.NewInt(100000),
		Asset:    "BTC",
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

	mockRPC.AssertExpectations(t)
}

// TestBitcoinAdapter_Capabilities tests the Capabilities() method
func TestBitcoinAdapter_Capabilities(t *testing.T) {
	mockRPC := new(MockRPCClient)
	mockTxStore := storage.NewMemoryTxStore()

	adapter, err := bitcoin.NewBitcoinAdapter(mockRPC, mockTxStore, "mainnet")
	require.NoError(t, err)

	caps := adapter.Capabilities()

	assert.Equal(t, "bitcoin", caps.ChainID)
	assert.False(t, caps.SupportsEIP1559, "Bitcoin doesn't support EIP-1559")
	assert.True(t, caps.SupportsMemo, "Bitcoin supports OP_RETURN")
	assert.True(t, caps.SupportsRBF, "Bitcoin supports Replace-By-Fee")
	assert.Equal(t, 80, caps.MaxMemoLength, "Bitcoin OP_RETURN max 80 bytes")
	assert.Equal(t, 6, caps.MinConfirmations, "Bitcoin recommended 6 confirmations")
}

// TestBitcoinAdapter_Estimate tests the Estimate() method
func TestBitcoinAdapter_Estimate(t *testing.T) {
	// Create mocks
	mockRPC := new(MockRPCClient)
	mockTxStore := storage.NewMemoryTxStore()

	// Create adapter
	adapter, err := bitcoin.NewBitcoinAdapter(mockRPC, mockTxStore, "mainnet")
	require.NoError(t, err)

	// Mock estimatesmartfee responses for different target blocks
	// Normal target (3 blocks)
	mockFeeJSON := []byte(`{"feerate": 0.00030000}`) // 30 sat/byte when converted
	mockRPC.On("Call", mock.Anything, "estimatesmartfee", []interface{}{3}).
		Return(json.RawMessage(mockFeeJSON), nil)

	// Slower target (6 blocks) - for min fee
	mockFeeSlowJSON := []byte(`{"feerate": 0.00020000}`) // 20 sat/byte
	mockRPC.On("Call", mock.Anything, "estimatesmartfee", []interface{}{6}).
		Return(json.RawMessage(mockFeeSlowJSON), nil)

	// Faster target (2 blocks) - for max fee
	mockFeeFastJSON := []byte(`{"feerate": 0.00040000}`) // 40 sat/byte
	mockRPC.On("Call", mock.Anything, "estimatesmartfee", []interface{}{2}).
		Return(json.RawMessage(mockFeeFastJSON), nil)

	t.Run("Valid Estimate - Normal Speed", func(t *testing.T) {
		req := &chainadapter.TransactionRequest{
			From:     "bc1qtest123",
			To:       "bc1qtest456",
			Amount:   big.NewInt(100000), // 0.001 BTC
			Asset:    "BTC",
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
		assert.Equal(t, "bitcoin", estimate.ChainID)

		// Verify estimated blocks
		assert.Equal(t, 3, estimate.EstimatedBlocks, "Normal speed should target 3 blocks")

		// Verify reason is provided
		assert.NotEmpty(t, estimate.Reason, "Reason should explain confidence level")

		// Bitcoin doesn't have base fee (UTXO-based)
		assert.Nil(t, estimate.BaseFee, "Bitcoin doesn't have base fee")
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

		// Mock responses for all speeds
		mockRPC.On("Call", mock.Anything, "estimatesmartfee", []interface{}{1}).
			Return(json.RawMessage(`{"feerate": 0.00050000}`), nil).Maybe() // 50 sat/byte
		mockRPC.On("Call", mock.Anything, "estimatesmartfee", []interface{}{2}).
			Return(json.RawMessage(mockFeeFastJSON), nil).Maybe()

		for _, tc := range speeds {
			t.Run(string(tc.speed), func(t *testing.T) {
				req := &chainadapter.TransactionRequest{
					From:     "bc1qtest123",
					To:       "bc1qtest456",
					Amount:   big.NewInt(100000),
					Asset:    "BTC",
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
		failAdapter, err := bitcoin.NewBitcoinAdapter(mockFailRPC, mockTxStore, "mainnet")
		require.NoError(t, err)

		// Mock RPC to return error
		mockFailRPC.On("Call", mock.Anything, "estimatesmartfee", mock.Anything).
			Return(json.RawMessage(nil), chainadapter.NewRetryableError(
				"ERR_RPC_CONNECTION",
				"RPC connection failed",
				nil,
			))

		req := &chainadapter.TransactionRequest{
			From:     "bc1qtest123",
			To:       "bc1qtest456",
			Amount:   big.NewInt(100000),
			Asset:    "BTC",
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
			From:     "bc1qtest123",
			To:       "bc1qtest456",
			Amount:   big.NewInt(100000),
			Asset:    "BTC",
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

	mockRPC.AssertExpectations(t)
}

// TestBitcoinAdapter_EstimateWithDifferentNetworks tests estimation across networks
func TestBitcoinAdapter_EstimateWithDifferentNetworks(t *testing.T) {
	networks := []struct {
		network         string
		expectedChainID string
	}{
		{"mainnet", "bitcoin"},
		{"testnet3", "bitcoin-testnet"},
		{"regtest", "bitcoin-regtest"},
	}

	for _, tc := range networks {
		t.Run(tc.network, func(t *testing.T) {
			mockRPC := new(MockRPCClient)
			mockTxStore := storage.NewMemoryTxStore()

			adapter, err := bitcoin.NewBitcoinAdapter(mockRPC, mockTxStore, tc.network)
			require.NoError(t, err)

			// Mock estimatesmartfee response
			mockFeeJSON := []byte(`{"feerate": 0.00030000}`)
			mockRPC.On("Call", mock.Anything, "estimatesmartfee", mock.Anything).
				Return(json.RawMessage(mockFeeJSON), nil)

			req := &chainadapter.TransactionRequest{
				From:     "bc1qtest123",
				To:       "bc1qtest456",
				Amount:   big.NewInt(100000),
				Asset:    "BTC",
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
