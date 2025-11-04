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

// MockKeySource implements chainadapter.KeySource for testing
type MockKeySource struct {
	pubKey []byte
}

func NewMockKeySource(pubKey []byte) *MockKeySource {
	return &MockKeySource{pubKey: pubKey}
}

func (m *MockKeySource) Type() chainadapter.KeySourceType {
	return chainadapter.KeySourceMnemonic
}

func (m *MockKeySource) GetPublicKey(path string) ([]byte, error) {
	return m.pubKey, nil
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
	adapter, err := NewEthereumAdapter(mockRPC, nil, 1) // mainnet
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

// TestEthereumAdapter_Derive tests the Derive() method
func TestEthereumAdapter_Derive(t *testing.T) {
	ctx := context.Background()

	// Create adapter
	mockRPC := NewMockRPCClient()
	adapter, err := NewEthereumAdapter(mockRPC, nil, 1)
	if err != nil {
		t.Fatalf("failed to create adapter: %v", err)
	}

	// Test with a valid uncompressed public key
	pubKey := []byte{
		0x04, // Uncompressed prefix
		0x79, 0xbe, 0x66, 0x7e, 0xf9, 0xdc, 0xbb, 0xac, 0x55, 0xa0, 0x62, 0x95, 0xce, 0x87, 0x0b, 0x07,
		0x02, 0x9b, 0xfc, 0xdb, 0x2d, 0xce, 0x28, 0xd9, 0x59, 0xf2, 0x81, 0x5b, 0x16, 0xf8, 0x17, 0x98,
		0x48, 0x3a, 0xda, 0x77, 0x26, 0xa3, 0xc4, 0x65, 0x5d, 0xa4, 0xfb, 0xfc, 0x0e, 0x11, 0x08, 0xa8,
		0xfd, 0x17, 0xb4, 0x48, 0xa6, 0x85, 0x54, 0x19, 0x9c, 0x47, 0xd0, 0x8f, 0xfb, 0x10, 0xd4, 0xb8,
	}

	keySource := NewMockKeySource(pubKey)

	// Test valid path
	testCases := []struct {
		name        string
		path        string
		expectError bool
	}{
		{"valid path", "m/44'/60'/0'/0/0", false},
		{"valid path with higher index", "m/44'/60'/0'/0/100", false},
		{"invalid coin type", "m/44'/0'/0'/0/0", true},
		{"invalid format", "m/44/60/0/0/0", true},
		{"wrong purpose", "m/49'/60'/0'/0/0", true},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			address, err := adapter.Derive(ctx, keySource, tc.path)

			if tc.expectError {
				if err == nil {
					t.Error("expected error but got none")
				}
				return
			}

			if err != nil {
				t.Fatalf("Derive() failed: %v", err)
			}

			// Verify result
			if address == nil {
				t.Fatal("Derive() returned nil address")
			}

			if address.ChainID != "ethereum" {
				t.Errorf("expected ChainID 'ethereum', got '%s'", address.ChainID)
			}

			if address.DerivationPath != tc.path {
				t.Errorf("expected path '%s', got '%s'", tc.path, address.DerivationPath)
			}

			if address.Format != "checksummed" {
				t.Errorf("expected format 'checksummed', got '%s'", address.Format)
			}

			// Verify address starts with 0x
			if len(address.Address) < 2 || address.Address[:2] != "0x" {
				t.Errorf("expected Ethereum address starting with '0x', got '%s'", address.Address)
			}

			// Verify address is 42 characters (0x + 40 hex chars)
			if len(address.Address) != 42 {
				t.Errorf("expected address length 42, got %d", len(address.Address))
			}
		})
	}
}

// TestEthereumAdapter_QueryStatus tests the QueryStatus() method
func TestEthereumAdapter_QueryStatus(t *testing.T) {
	ctx := context.Background()

	mockRPC := NewMockRPCClient()
	adapter, err := NewEthereumAdapter(mockRPC, nil, 1)
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
	adapter, err := NewEthereumAdapter(mockRPC, nil, 1)
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
	adapter, err := NewEthereumAdapter(mockRPC, nil, 1)
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
	adapter, err := NewEthereumAdapter(mockRPC, txStore, 1)
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
