package simulation

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestIsChainSupported(t *testing.T) {
	tests := []struct {
		chain    string
		expected bool
	}{
		{"ethereum", true},
		{"polygon", true},
		{"arbitrum", true},
		{"optimism", true},
		{"base", true},
		{"bnb", false},
		{"bsc", false},
		{"", false},
	}

	for _, tt := range tests {
		if got := IsChainSupported(tt.chain); got != tt.expected {
			t.Errorf("IsChainSupported(%q) = %v, want %v", tt.chain, got, tt.expected)
		}
	}
}

func TestSimulateTransaction_UnsupportedChain(t *testing.T) {
	s := NewSimulator()
	result, err := s.SimulateTransaction(context.Background(), "bnb", "test-key", TxParams{
		From: "0x1", To: "0x2", Value: "0x0",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Success {
		t.Error("expected failure for unsupported chain")
	}
	if result.Error == "" {
		t.Error("expected error message")
	}
}

func TestSimulateTransaction_NoAPIKey(t *testing.T) {
	s := NewSimulator()
	result, err := s.SimulateTransaction(context.Background(), "ethereum", "", TxParams{
		From: "0x1", To: "0x2",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Success {
		t.Error("expected failure without API key")
	}
}

func TestSimulateTransaction_Success(t *testing.T) {
	// Mock Alchemy response
	alchemyResp := alchemyRPCResponse{
		JSONRPC: "2.0",
		ID:      1,
		Result: alchemySimulateResult{
			GasUsed: "21000",
			Changes: []alchemyAssetChange{
				{
					AssetType:  "NATIVE",
					ChangeType: "TRANSFER",
					From:       "0xSender",
					To:         "0xReceiver",
					RawAmount:  "1000000000000000000",
					Amount:     "1.0",
					Symbol:     "ETH",
					Decimals:   18,
					Logo:       "https://example.com/eth.png",
				},
			},
		},
	}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Verify request
		var req alchemyRPCRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			t.Errorf("failed to decode request: %v", err)
		}
		if req.Method != "alchemy_simulateAssetChanges" {
			t.Errorf("expected method alchemy_simulateAssetChanges, got %s", req.Method)
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(alchemyResp)
	}))
	defer server.Close()

	// Override the URL by creating a custom simulator
	s := &Simulator{httpClient: server.Client()}

	// We need to test with the mock server URL
	// Since SimulateTransaction builds the URL internally, we test convertAlchemyResult directly
	result := convertAlchemyResult(&alchemyResp.Result)

	if !result.Success {
		t.Fatalf("expected success, got error: %s", result.Error)
	}
	if result.GasUsed != "21000" {
		t.Errorf("expected gasUsed 21000, got %s", result.GasUsed)
	}
	if len(result.AssetChanges) != 1 {
		t.Fatalf("expected 1 asset change, got %d", len(result.AssetChanges))
	}

	change := result.AssetChanges[0]
	if change.AssetType != "NATIVE" {
		t.Errorf("expected NATIVE, got %s", change.AssetType)
	}
	if change.Symbol != "ETH" {
		t.Errorf("expected ETH, got %s", change.Symbol)
	}
	if change.Amount != "1000000000000000000" {
		t.Errorf("expected raw amount, got %s", change.Amount)
	}

	_ = s // use the simulator variable
}

func TestSimulateTransaction_RPCError(t *testing.T) {
	result := convertAlchemyResult(&alchemySimulateResult{
		Error: &alchemySimError{
			Message: "execution reverted",
		},
		GasUsed: "50000",
	})

	if result.Success {
		t.Error("expected failure for RPC error")
	}
	if result.Error != "execution reverted" {
		t.Errorf("expected 'execution reverted', got %s", result.Error)
	}
	if result.GasUsed != "50000" {
		t.Errorf("expected gasUsed 50000, got %s", result.GasUsed)
	}
}

func TestSimulateTransaction_NilResult(t *testing.T) {
	result := convertAlchemyResult(nil)
	if result.Success {
		t.Error("expected failure for nil result")
	}
}

func TestSimulateBSCTransaction_Success(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"jsonrpc":"2.0","id":1,"result":"0x"}`))
	}))
	defer server.Close()

	s := NewSimulator()
	result, err := s.SimulateBSCTransaction(context.Background(), server.URL, TxParams{
		From:  "0xSender",
		To:    "0xReceiver",
		Value: "0x0",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !result.Success {
		t.Errorf("expected success, got error: %s", result.Error)
	}
}

func TestSimulateBSCTransaction_Revert(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"jsonrpc":"2.0","id":1,"error":{"code":-32000,"message":"execution reverted: insufficient balance"}}`))
	}))
	defer server.Close()

	s := NewSimulator()
	result, err := s.SimulateBSCTransaction(context.Background(), server.URL, TxParams{
		From:  "0xSender",
		To:    "0xReceiver",
		Value: "0xDE0B6B3A7640000",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Success {
		t.Error("expected failure for reverted transaction")
	}
	if result.Error == "" {
		t.Error("expected error message for revert")
	}
}

func TestSimulateTransaction_MultipleAssetChanges(t *testing.T) {
	result := convertAlchemyResult(&alchemySimulateResult{
		GasUsed: "150000",
		Changes: []alchemyAssetChange{
			{
				AssetType:  "NATIVE",
				ChangeType: "TRANSFER",
				From:       "0xSender",
				To:         "0xRouter",
				RawAmount:  "500000000000000000",
				Symbol:     "ETH",
				Decimals:   18,
			},
			{
				AssetType:  "ERC20",
				ChangeType: "TRANSFER",
				From:       "0xRouter",
				To:         "0xSender",
				RawAmount:  "1000000000",
				Symbol:     "USDC",
				Decimals:   6,
			},
		},
	})

	if !result.Success {
		t.Fatal("expected success")
	}
	if len(result.AssetChanges) != 2 {
		t.Fatalf("expected 2 changes, got %d", len(result.AssetChanges))
	}
	if result.AssetChanges[0].Symbol != "ETH" {
		t.Error("first change should be ETH")
	}
	if result.AssetChanges[1].Symbol != "USDC" {
		t.Error("second change should be USDC")
	}
}
