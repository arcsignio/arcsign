// Package bitcoin - Integration tests for Bitcoin adapter
package bitcoin

import (
	"context"
	"encoding/json"
	"math/big"
	"testing"
	"time"

	"github.com/arcsign/chainadapter"
	"github.com/arcsign/chainadapter/rpc"
	"github.com/arcsign/chainadapter/storage"
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

// TestBitcoinAdapter_Build tests the Build() method
func TestBitcoinAdapter_Build(t *testing.T) {
	ctx := context.Background()

	// Create mock RPC client
	mockRPC := NewMockRPCClient()

	// Use valid Bitcoin addresses for testing
	fromAddr := "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4" // Valid P2WPKH address
	toAddr := "bc1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0gdcccefvpysxf3qccfmv3"

	// Configure mock responses
	mockRPC.SetResponse("listunspent", []ListUnspentResult{
		{
			TxID:          "abcd1234",
			Vout:          0,
			Address:       fromAddr,
			ScriptPubKey:  "0014abcd",
			Amount:        0.001, // 100,000 satoshis
			Confirmations: 6,
			Spendable:     true,
			Solvable:      true,
		},
	})

	mockRPC.SetResponse("estimatesmartfee", EstimateSmartFeeResult{
		FeeRate: 0.00001, // 1 sat/byte
		Blocks:  3,
	})

	// Create Bitcoin adapter
	adapter, err := NewBitcoinAdapter(mockRPC, nil, "mainnet")
	if err != nil {
		t.Fatalf("failed to create adapter: %v", err)
	}

	// Test Build()
	req := &chainadapter.TransactionRequest{
		From:     fromAddr,
		To:       toAddr,
		Asset:    "BTC",
		Amount:   big.NewInt(50000), // 50,000 satoshis
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

	if unsigned.ChainID != "bitcoin" {
		t.Errorf("expected ChainID 'bitcoin', got '%s'", unsigned.ChainID)
	}

	if unsigned.From != req.From {
		t.Errorf("expected From '%s', got '%s'", req.From, unsigned.From)
	}

	if unsigned.To != req.To {
		t.Errorf("expected To '%s', got '%s'", req.To, unsigned.To)
	}

	if unsigned.SigningPayload == nil {
		t.Error("SigningPayload is nil")
	}
}

// TestBitcoinAdapter_Build_InsufficientFunds tests insufficient funds error
func TestBitcoinAdapter_Build_InsufficientFunds(t *testing.T) {
	ctx := context.Background()

	// Create mock RPC client with no UTXOs
	mockRPC := NewMockRPCClient()
	mockRPC.SetResponse("listunspent", []ListUnspentResult{})

	adapter, err := NewBitcoinAdapter(mockRPC, nil, "mainnet")
	if err != nil {
		t.Fatalf("failed to create adapter: %v", err)
	}

	req := &chainadapter.TransactionRequest{
		From:     "bc1qtest",
		To:       "bc1qdest",
		Asset:    "BTC",
		Amount:   big.NewInt(50000),
		FeeSpeed: chainadapter.FeeSpeedNormal,
	}

	_, err = adapter.Build(ctx, req)
	if err == nil {
		t.Fatal("Build() should fail with insufficient funds")
	}

	// Verify it's a NonRetryableError
	if chainErr, ok := err.(*chainadapter.ChainError); ok {
		if chainErr.Classification != chainadapter.NonRetryable {
			t.Error("expected NonRetryableError for insufficient funds")
		}
		if chainErr.Code != chainadapter.ErrCodeInsufficientFunds {
			t.Errorf("expected error code %s, got %s", chainadapter.ErrCodeInsufficientFunds, chainErr.Code)
		}
	}
}

// TestBitcoinAdapter_Derive tests the Derive() method
func TestBitcoinAdapter_Derive(t *testing.T) {
	ctx := context.Background()

	// Create adapter
	mockRPC := NewMockRPCClient()
	adapter, err := NewBitcoinAdapter(mockRPC, nil, "mainnet")
	if err != nil {
		t.Fatalf("failed to create adapter: %v", err)
	}

	// Test with a valid compressed public key (example from BIP32 test vectors)
	// This is the public key for m/44'/0'/0'/0/0
	pubKey := []byte{
		0x03, 0x39, 0xa3, 0x6c, 0xe2, 0xb7, 0x87, 0x1a, 0x8d, 0xb3, 0x5c, 0x07, 0x6c, 0xb4, 0xa7, 0x3c,
		0xd9, 0x29, 0x8e, 0x3b, 0xf3, 0x6d, 0x7a, 0x4b, 0x9c, 0x5f, 0x8e, 0x1f, 0x48, 0x3c, 0x6e, 0x8a, 0x8b,
	}

	keySource := NewMockKeySource(pubKey)

	// Test valid path
	testCases := []struct {
		name        string
		path        string
		expectError bool
	}{
		{"valid path", "m/44'/0'/0'/0/0", false},
		{"valid path with higher index", "m/44'/0'/0'/0/100", false},
		{"invalid coin type", "m/44'/60'/0'/0/0", true},
		{"invalid format", "m/44/0/0/0/0", true},
		{"wrong purpose", "m/49'/0'/0'/0/0", true},
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

			if address.ChainID != "bitcoin" {
				t.Errorf("expected ChainID 'bitcoin', got '%s'", address.ChainID)
			}

			if address.DerivationPath != tc.path {
				t.Errorf("expected path '%s', got '%s'", tc.path, address.DerivationPath)
			}

			if address.Format != "P2WPKH" {
				t.Errorf("expected format 'P2WPKH', got '%s'", address.Format)
			}

			// Verify address starts with bc1q (mainnet P2WPKH)
			if len(address.Address) < 4 || address.Address[:4] != "bc1q" {
				t.Errorf("expected P2WPKH address starting with 'bc1q', got '%s'", address.Address)
			}

			if len(address.PublicKey) != 33 {
				t.Errorf("expected 33-byte public key, got %d bytes", len(address.PublicKey))
			}
		})
	}
}

// TestBitcoinAdapter_Derive_Testnet tests Derive() for testnet
func TestBitcoinAdapter_Derive_Testnet(t *testing.T) {
	ctx := context.Background()

	mockRPC := NewMockRPCClient()
	adapter, err := NewBitcoinAdapter(mockRPC, nil, "testnet3")
	if err != nil {
		t.Fatalf("failed to create adapter: %v", err)
	}

	pubKey := []byte{
		0x03, 0x39, 0xa3, 0x6c, 0xe2, 0xb7, 0x87, 0x1a, 0x8d, 0xb3, 0x5c, 0x07, 0x6c, 0xb4, 0xa7, 0x3c,
		0xd9, 0x29, 0x8e, 0x3b, 0xf3, 0x6d, 0x7a, 0x4b, 0x9c, 0x5f, 0x8e, 0x1f, 0x48, 0x3c, 0x6e, 0x8a, 0x8b,
	}

	keySource := NewMockKeySource(pubKey)

	// For testnet, coin type is still 0 (BIP44), but address prefix is different
	address, err := adapter.Derive(ctx, keySource, "m/44'/0'/0'/0/0")
	if err != nil {
		t.Fatalf("Derive() failed: %v", err)
	}

	// Verify address starts with tb1q (testnet P2WPKH)
	if len(address.Address) < 4 || address.Address[:4] != "tb1q" {
		t.Errorf("expected testnet P2WPKH address starting with 'tb1q', got '%s'", address.Address)
	}

	if address.ChainID != "bitcoin-testnet" {
		t.Errorf("expected ChainID 'bitcoin-testnet', got '%s'", address.ChainID)
	}
}

// TestBitcoinAdapter_QueryStatus tests the QueryStatus() method
func TestBitcoinAdapter_QueryStatus(t *testing.T) {
	ctx := context.Background()

	mockRPC := NewMockRPCClient()
	adapter, err := NewBitcoinAdapter(mockRPC, nil, "mainnet")
	if err != nil {
		t.Fatalf("failed to create adapter: %v", err)
	}

	txHash := "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"

	testCases := []struct {
		name             string
		confirmations    int
		blockHash        string
		expectedStatus   chainadapter.TxStatus
		expectedBlockNum uint64
	}{
		{"pending", 0, "", chainadapter.TxStatusPending, 0},
		{"confirmed_1", 1, "block123", chainadapter.TxStatusConfirmed, 100},
		{"confirmed_5", 5, "block123", chainadapter.TxStatusConfirmed, 100},
		{"finalized", 6, "block123", chainadapter.TxStatusFinalized, 100},
		{"finalized_10", 10, "block123", chainadapter.TxStatusFinalized, 100},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// Configure mock response
			mockRPC.SetResponse("getrawtransaction", RawTransactionResult{
				TxID:          txHash,
				Confirmations: tc.confirmations,
				BlockHash:     tc.blockHash,
			})

			if tc.blockHash != "" {
				mockRPC.SetResponse("getblock", BlockResult{
					Height: int64(tc.expectedBlockNum),
				})
			}

			status, err := adapter.QueryStatus(ctx, txHash)
			if err != nil {
				t.Fatalf("QueryStatus() failed: %v", err)
			}

			if status.Status != tc.expectedStatus {
				t.Errorf("expected status %s, got %s", tc.expectedStatus, status.Status)
			}

			if status.Confirmations != tc.confirmations {
				t.Errorf("expected %d confirmations, got %d", tc.confirmations, status.Confirmations)
			}

			if tc.blockHash != "" {
				if status.BlockNumber == nil {
					t.Error("BlockNumber should not be nil for confirmed tx")
				} else if *status.BlockNumber != tc.expectedBlockNum {
					t.Errorf("expected block number %d, got %d", tc.expectedBlockNum, *status.BlockNumber)
				}
			}
		})
	}
}

// TestBitcoinAdapter_Capabilities tests the Capabilities() method
func TestBitcoinAdapter_Capabilities(t *testing.T) {
	mockRPC := NewMockRPCClient()
	adapter, err := NewBitcoinAdapter(mockRPC, nil, "mainnet")
	if err != nil {
		t.Fatalf("failed to create adapter: %v", err)
	}

	caps := adapter.Capabilities()

	if caps.ChainID != "bitcoin" {
		t.Errorf("expected ChainID 'bitcoin', got '%s'", caps.ChainID)
	}

	if caps.SupportsEIP1559 {
		t.Error("Bitcoin should not support EIP-1559")
	}

	if !caps.SupportsMemo {
		t.Error("Bitcoin should support memo (OP_RETURN)")
	}

	if !caps.SupportsRBF {
		t.Error("Bitcoin should support RBF")
	}

	if caps.MinConfirmations != 6 {
		t.Errorf("expected MinConfirmations 6, got %d", caps.MinConfirmations)
	}

	if caps.MaxMemoLength != 80 {
		t.Errorf("expected MaxMemoLength 80, got %d", caps.MaxMemoLength)
	}
}

// TestBitcoinAdapter_SubscribeStatus tests the SubscribeStatus() method
func TestBitcoinAdapter_SubscribeStatus(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	mockRPC := NewMockRPCClient()
	adapter, err := NewBitcoinAdapter(mockRPC, nil, "mainnet")
	if err != nil {
		t.Fatalf("failed to create adapter: %v", err)
	}

	txHash := "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"

	// Configure initial status (pending)
	mockRPC.SetResponse("getrawtransaction", RawTransactionResult{
		TxID:          txHash,
		Confirmations: 0,
	})

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

// TestBitcoinAdapter_Broadcast tests the Broadcast() method
func TestBitcoinAdapter_Broadcast(t *testing.T) {
	ctx := context.Background()

	mockRPC := NewMockRPCClient()
	txStore := storage.NewMemoryTxStore()
	adapter, err := NewBitcoinAdapter(mockRPC, txStore, "mainnet")
	if err != nil {
		t.Fatalf("failed to create adapter: %v", err)
	}

	txHash := "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"

	// Configure mock response
	mockRPC.SetResponse("sendrawtransaction", txHash)

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

	if receipt.ChainID != "bitcoin" {
		t.Errorf("expected ChainID 'bitcoin', got '%s'", receipt.ChainID)
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

	// Verify retry count remains the same (idempotency - returns early)
	state2, _ := txStore.Get(txHash)
	if state2.RetryCount != 1 {
		t.Errorf("expected RetryCount 1 (unchanged due to idempotency), got %d", state2.RetryCount)
	}
}
