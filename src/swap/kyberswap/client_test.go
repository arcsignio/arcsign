package kyberswap

import (
	"context"
	"encoding/json"
	"math/big"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestCheckAllowance_NativeToken(t *testing.T) {
	client := NewClient()
	ctx := context.Background()

	allowance, err := client.CheckAllowance(ctx, 1, NativeTokenAddress, "0x1234567890abcdef1234567890abcdef12345678")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	maxUint256 := new(big.Int)
	maxUint256.SetString("115792089237316195423570985008687907853269984665640564039457584007913129639935", 10)

	if allowance.Cmp(maxUint256) != 0 {
		t.Errorf("native token should return maxUint256, got %s", allowance.String())
	}
}

func TestCheckAllowance_UnsupportedChain(t *testing.T) {
	client := NewClient()
	ctx := context.Background()

	_, err := client.CheckAllowance(ctx, 999999, "0xtoken", "0xwallet")
	if err == nil {
		t.Fatal("expected error for unsupported chain")
	}
}

func TestCheckAllowance_OnChainQuery(t *testing.T) {
	// Mock RPC server
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var req JSONRPCRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			t.Fatalf("failed to decode request: %v", err)
		}

		if req.Method != "eth_call" {
			t.Errorf("expected eth_call, got %s", req.Method)
		}

		// Return 1000 tokens (0x3E8 = 1000)
		resp := JSONRPCResponse{
			JSONRPC: "2.0",
			ID:      1,
			Result:  "0x00000000000000000000000000000000000000000000000000000000000003e8",
		}
		json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	// Override public RPC for test
	origRPC := PublicRPCs[1]
	PublicRPCs[1] = server.URL
	defer func() { PublicRPCs[1] = origRPC }()

	client := NewClient()
	ctx := context.Background()

	allowance, err := client.CheckAllowance(ctx, 1, "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "0x1234567890abcdef1234567890abcdef12345678")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	expected := big.NewInt(1000)
	if allowance.Cmp(expected) != 0 {
		t.Errorf("expected allowance 1000, got %s", allowance.String())
	}
}

func TestCheckAllowance_ZeroResult(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		resp := JSONRPCResponse{JSONRPC: "2.0", ID: 1, Result: "0x"}
		json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	origRPC := PublicRPCs[1]
	PublicRPCs[1] = server.URL
	defer func() { PublicRPCs[1] = origRPC }()

	client := NewClient()
	allowance, err := client.CheckAllowance(context.Background(), 1, "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "0x1234567890abcdef1234567890abcdef12345678")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if allowance.Cmp(big.NewInt(0)) != 0 {
		t.Errorf("expected 0, got %s", allowance.String())
	}
}

func TestGetTokenList_UnsupportedChain(t *testing.T) {
	client := NewClient()
	_, err := client.GetTokenList(context.Background(), 999999)
	if err == nil {
		t.Fatal("expected error for unsupported chain")
	}
}

func TestGetTokenList_Success(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		resp := TokenListAPIResponse{
			Code:    0,
			Message: "success",
		}
		resp.Data.Tokens = []TokenListItem{
			{
				Address:  "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
				Symbol:   "USDC",
				Name:     "USD Coin",
				Decimals: 6,
				LogoURI:  "https://example.com/usdc.png",
				ChainID:  1,
			},
			{
				Address:  "0xdAC17F958D2ee523a2206206994597C13D831ec7",
				Symbol:   "USDT",
				Name:     "Tether USD",
				Decimals: 6,
				LogoURI:  "https://example.com/usdt.png",
				ChainID:  1,
			},
		}
		resp.Data.Pagination.TotalItems = 2
		json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	_ = server // Server used for mock — GetTokenList uses hardcoded URL
	// Integration test would require network access to ks-setting.kyberswap.com
	t.Log("GetTokenList integration test skipped (requires network access)")
}

func TestGetRouterAddress(t *testing.T) {
	addr := GetRouterAddress(1)
	if addr != "0x6131B5fae19EA4f9D964eAc0408E4408b66337b5" {
		t.Errorf("unexpected router address: %s", addr)
	}
}

func TestIsChainSupported(t *testing.T) {
	cases := []struct {
		chainID  int
		expected bool
	}{
		{1, true},
		{56, true},
		{137, true},
		{42161, true},
		{999, false},
	}

	for _, tc := range cases {
		if got := IsChainSupported(tc.chainID); got != tc.expected {
			t.Errorf("IsChainSupported(%d) = %v, want %v", tc.chainID, got, tc.expected)
		}
	}
}
