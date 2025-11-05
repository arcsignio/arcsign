// Package ethereum - Integration tests for Ethereum adapter
package ethereum

import (
	"context"
	"encoding/json"
	"math/big"
	"testing"
	"time"

	"github.com/arcsign/chainadapter"
	"github.com/arcsign/chainadapter/rpc"
	"github.com/arcsign/chainadapter/storage"
	"github.com/ethereum/go-ethereum/common/hexutil"
)

// MockRPCClient implements rpc.RPCClient for testing
type MockRPCClient struct {
	responses map[string]interface{}
}

func NewMockRPCClient() *MockRPCClient {
	return &MockRPCClient{
		responses: make(map[string]interface{}),
	}
}

func (m *MockRPCClient) Call(ctx context.Context, method string, params interface{}) (json.RawMessage, error) {
	if response, ok := m.responses[method]; ok {
		data, _ := json.Marshal(response)
		return data, nil
	}
	return nil, chainadapter.NewRetryableError(
		chainadapter.ErrCodeRPCUnavailable,
		"mock RPC method not configured: "+method,
		nil,
		nil,
	)
}

func (m *MockRPCClient) CallBatch(ctx context.Context, requests []rpc.RPCRequest) ([]json.RawMessage, error) {
	return nil, nil
}

func (m *MockRPCClient) Close() error {
	return nil
}

func (m *MockRPCClient) SetResponse(method string, response interface{}) {
	m.responses[method] = response
}

// TestEthereumAdapter_Build tests the Build() method
func TestEthereumAdapter_Build(t *testing.T) {
	ctx := context.Background()

	// Create mock RPC client
	mockRPC := NewMockRPCClient()

	// Configure mock responses
	mockRPC.SetResponse("eth_getTransactionCount", hexutil.EncodeUint64(5)) // nonce = 5
	mockRPC.SetResponse("eth_estimateGas", hexutil.EncodeUint64(21000))     // gas = 21000
	mockRPC.SetResponse("eth_getBlockByNumber", map[string]interface{}{
		"baseFeePerGas": hexutil.EncodeBig(big.NewInt(30e9)), // 30 Gwei
	})
	mockRPC.SetResponse("eth_feeHistory", map[string]interface{}{
		"reward": [][]string{{hexutil.EncodeBig(big.NewInt(2e9))}}, // 2 Gwei priority fee
	})

	// Create Ethereum adapter
	adapter, err := NewEthereumAdapter(mockRPC, nil, 1, nil) // mainnet
	if err != nil {
		t.Fatalf("failed to create adapter: %v", err)
	}

	// Test Build() - use valid Ethereum addresses
	fromAddr := "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0"
	toAddr := "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed"

	req := &chainadapter.TransactionRequest{
		From:     fromAddr,
		To:       toAddr,
		Asset:    "ETH",
		Amount:   big.NewInt(1e18), // 1 ETH
		FeeSpeed: chainadapter.FeeSpeedNormal,
	}

	unsigned, err := adapter.Build(ctx, req)
	if err != nil {
		t.Fatalf("Build() failed: %v", err)
	}

	// Verify result
	if unsigned == nil {
		t.Fatal("Build() returned nil unsigned transaction")
	}

	if unsigned.ChainID != "ethereum" {
		t.Errorf("expected ChainID 'ethereum', got '%s'", unsigned.ChainID)
	}

	if *unsigned.Nonce != 5 {
		t.Errorf("expected nonce 5, got %d", *unsigned.Nonce)
	}

	if unsigned.SigningPayload == nil {
		t.Error("SigningPayload is nil")
	}
}

// TestEthereumAdapter_QueryStatus tests the QueryStatus() method
func TestEthereumAdapter_QueryStatus(t *testing.T) {
	ctx := context.Background()

	mockRPC := NewMockRPCClient()
	adapter, err := NewEthereumAdapter(mockRPC, nil, 1, nil)
	if err != nil {
		t.Fatalf("failed to create adapter: %v", err)
	}

	txHash := "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"

	testCases := []struct {
		name           string
		txResult       *TransactionResult
		receipt        *TransactionReceipt
		currentBlock   uint64
		expectedStatus chainadapter.TxStatus
	}{
		{
			name: "pending",
			txResult: &TransactionResult{
				Hash: txHash,
			},
			receipt:        nil,
			expectedStatus: chainadapter.TxStatusPending,
		},
		{
			name: "confirmed_success",
			txResult: &TransactionResult{
				Hash:        txHash,
				BlockNumber: hexutil.EncodeUint64(100),
			},
			receipt: &TransactionReceipt{
				BlockNumber: hexutil.EncodeUint64(100),
				Status:      "0x1", // Success
			},
			currentBlock:   105,
			expectedStatus: chainadapter.TxStatusConfirmed,
		},
		{
			name: "finalized",
			txResult: &TransactionResult{
				Hash:        txHash,
				BlockNumber: hexutil.EncodeUint64(100),
			},
			receipt: &TransactionReceipt{
				BlockNumber: hexutil.EncodeUint64(100),
				Status:      "0x1",
			},
			currentBlock:   115, // 15 confirmations
			expectedStatus: chainadapter.TxStatusFinalized,
		},
		{
			name: "failed",
			txResult: &TransactionResult{
				Hash:        txHash,
				BlockNumber: hexutil.EncodeUint64(100),
			},
			receipt: &TransactionReceipt{
				BlockNumber: hexutil.EncodeUint64(100),
				Status:      "0x0", // Failed
			},
			currentBlock:   105,
			expectedStatus: chainadapter.TxStatusFailed,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// Configure mock responses
			mockRPC.SetResponse("eth_getTransactionByHash", tc.txResult)
			mockRPC.SetResponse("eth_getTransactionReceipt", tc.receipt)
			if tc.currentBlock > 0 {
				mockRPC.SetResponse("eth_blockNumber", hexutil.EncodeUint64(tc.currentBlock))
			}

			status, err := adapter.QueryStatus(ctx, txHash)
			if err != nil {
				t.Fatalf("QueryStatus() failed: %v", err)
			}

			if status.Status != tc.expectedStatus {
				t.Errorf("expected status %s, got %s", tc.expectedStatus, status.Status)
			}

			if tc.expectedStatus == chainadapter.TxStatusFailed {
				if status.Error == nil {
					t.Error("expected Error to be set for failed transaction")
				}
			}
		})
	}
}

// TestEthereumAdapter_Capabilities tests the Capabilities() method
func TestEthereumAdapter_Capabilities(t *testing.T) {
	mockRPC := NewMockRPCClient()
	adapter, err := NewEthereumAdapter(mockRPC, nil, 1, nil)
	if err != nil {
		t.Fatalf("failed to create adapter: %v", err)
	}

	caps := adapter.Capabilities()

	if caps.ChainID != "ethereum" {
		t.Errorf("expected ChainID 'ethereum', got '%s'", caps.ChainID)
	}

	if !caps.SupportsEIP1559 {
		t.Error("Ethereum should support EIP-1559")
	}

	if !caps.SupportsMemo {
		t.Error("Ethereum should support memo (data field)")
	}

	if caps.SupportsRBF {
		t.Error("Ethereum should not support RBF")
	}

	if caps.MinConfirmations != 12 {
		t.Errorf("expected MinConfirmations 12, got %d", caps.MinConfirmations)
	}
}

// TestEthereumAdapter_SubscribeStatus tests the SubscribeStatus() method
func TestEthereumAdapter_SubscribeStatus(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	mockRPC := NewMockRPCClient()
	adapter, err := NewEthereumAdapter(mockRPC, nil, 1, nil)
	if err != nil {
		t.Fatalf("failed to create adapter: %v", err)
	}

	txHash := "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"

	// Configure initial status (pending)
	mockRPC.SetResponse("eth_getTransactionByHash", &TransactionResult{
		Hash: txHash,
	})
	mockRPC.SetResponse("eth_getTransactionReceipt", nil)

	statusChan, err := adapter.SubscribeStatus(ctx, txHash)
	if err != nil {
		t.Fatalf("SubscribeStatus() failed: %v", err)
	}

	// Should receive initial status immediately
	select {
	case status := <-statusChan:
		if status.Status != chainadapter.TxStatusPending {
			t.Errorf("expected initial status pending, got %s", status.Status)
		}
	case <-time.After(1 * time.Second):
		t.Fatal("timeout waiting for initial status")
	}

	// Cancel context to close channel
	cancel()

	// Channel should close
	select {
	case _, ok := <-statusChan:
		if ok {
			t.Error("channel should be closed after context cancellation")
		}
	case <-time.After(2 * time.Second):
		t.Fatal("channel not closed after context cancellation")
	}
}

// TestEthereumAdapter_Broadcast tests the Broadcast() method
func TestEthereumAdapter_Broadcast(t *testing.T) {
	ctx := context.Background()

	mockRPC := NewMockRPCClient()
	txStore := storage.NewMemoryTxStore()
	adapter, err := NewEthereumAdapter(mockRPC, txStore, 1, nil)
	if err != nil {
		t.Fatalf("failed to create adapter: %v", err)
	}

	txHash := "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"

	// Configure mock response
	mockRPC.SetResponse("eth_sendRawTransaction", txHash)

	signed := &chainadapter.SignedTransaction{
		TxHash:       txHash,
		SerializedTx: []byte("mock_tx_data"),
		SignedAt:     time.Now(),
	}

	receipt, err := adapter.Broadcast(ctx, signed)
	if err != nil {
		t.Fatalf("Broadcast() failed: %v", err)
	}

	if receipt.TxHash != txHash {
		t.Errorf("expected TxHash '%s', got '%s'", txHash, receipt.TxHash)
	}

	if receipt.ChainID != "ethereum" {
		t.Errorf("expected ChainID 'ethereum', got '%s'", receipt.ChainID)
	}

	// Verify state was stored
	state, err := txStore.Get(txHash)
	if err != nil {
		t.Fatalf("failed to get state: %v", err)
	}

	if state.RetryCount != 1 {
		t.Errorf("expected RetryCount 1, got %d", state.RetryCount)
	}

	// Test idempotency - broadcast again
	receipt2, err := adapter.Broadcast(ctx, signed)
	if err != nil {
		t.Fatalf("second Broadcast() failed: %v", err)
	}

	if receipt2.TxHash != txHash {
		t.Errorf("expected same TxHash on retry, got '%s'", receipt2.TxHash)
	}

	// Verify retry count remains the same (idempotency)
	state2, _ := txStore.Get(txHash)
	if state2.RetryCount != 1 {
		t.Errorf("expected RetryCount 1 (unchanged due to idempotency), got %d", state2.RetryCount)
	}
}
