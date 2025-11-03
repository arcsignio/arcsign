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
