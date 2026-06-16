package provider

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
)

// --- Alchemy wrapper -----------------------------------------------------------

func TestAlchemyWDP_TokenBalances_SingleRequestForManyAddresses(t *testing.T) {
	var calls int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&calls, 1)
		// Minimal valid Alchemy token-balance response shape.
		w.Write([]byte(`{"data":{"tokens":[
			{"address":"0xA","network":"eth-mainnet","tokenAddress":"0xT","tokenBalance":"0x1","tokenMetadata":{"symbol":"TKA","decimals":18,"name":"Token A"}}
		]}}`))
	}))
	defer srv.Close()

	c := NewAlchemyClient("testkey")
	c.baseURL = srv.URL
	wdp := &alchemyWDP{client: c, hasKey: true}

	addrs := []AddressWithNetworks{
		{Address: "0xA", Networks: []string{"eth-mainnet"}},
		{Address: "0xB", Networks: []string{"eth-mainnet"}},
		{Address: "0xC", Networks: []string{"polygon-mainnet"}},
	}
	if _, err := wdp.GetTokenBalances(addrs); err != nil {
		t.Fatalf("GetTokenBalances: %v", err)
	}

	// CRITICAL: Alchemy must batch all addresses into ONE HTTP request.
	if got := atomic.LoadInt32(&calls); got != 1 {
		t.Errorf("expected 1 HTTP request for %d addresses, got %d (wrapper degraded to a loop?)", len(addrs), got)
	}
}

func TestAlchemyWDP_EmptyAddrsNoRequest(t *testing.T) {
	var calls int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&calls, 1)
		w.Write([]byte(`{"data":{"tokens":[]}}`))
	}))
	defer srv.Close()

	c := NewAlchemyClient("testkey")
	c.baseURL = srv.URL
	wdp := &alchemyWDP{client: c, hasKey: true}

	if _, err := wdp.GetTokenBalances(nil); err != nil {
		t.Fatalf("GetTokenBalances(nil): %v", err)
	}
	if got := atomic.LoadInt32(&calls); got != 0 {
		t.Errorf("expected 0 requests for empty input, got %d", got)
	}
}

// --- NodeReal wrapper (loops per address) --------------------------------------

func TestNodeRealWDP_TokenBalances_LoopsPerAddress(t *testing.T) {
	var calls int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&calls, 1)
		// NodeReal nr_getTokenHoldings JSON-RPC shape (empty result is fine).
		w.Write([]byte(`{"jsonrpc":"2.0","id":1,"result":{"totalCount":"0x0","details":[]}}`))
	}))
	defer srv.Close()

	c := NewBSCTraceClient("k")
	c.endpoint = srv.URL
	// hasKey=true so token holdings are queried; bnbRPC empty so native is skipped
	// here (covered by its own test below).
	wdp := &nodeRealWDP{client: c, hasKey: true}

	addrs := []AddressWithNetworks{{Address: "0xA"}, {Address: "0xB"}}
	if _, err := wdp.GetTokenBalances(addrs); err != nil {
		t.Fatalf("GetTokenBalances: %v", err)
	}
	// NodeReal has no batch endpoint — one call per address is expected/correct.
	if got := atomic.LoadInt32(&calls); got != 2 {
		t.Errorf("expected 2 requests for 2 addresses, got %d", got)
	}
}

// Without a NodeReal key, native BNB must still be returned via the public RPC.
func TestNodeRealWDP_NativeBNB_NoKey(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// eth_getBalance → 2 BNB (2e18 wei = 0x1bc16d674ec80000).
		w.Write([]byte(`{"jsonrpc":"2.0","id":1,"result":"0x1bc16d674ec80000"}`))
	}))
	defer srv.Close()

	// No key → hasKey false; bnbRPC set → native still queried.
	wdp := &nodeRealWDP{client: NewBSCTraceClient(""), hasKey: false, bnbRPC: srv.URL}

	out, err := wdp.GetTokenBalances([]AddressWithNetworks{{Address: "0xA"}})
	if err != nil {
		t.Fatalf("GetTokenBalances: %v", err)
	}
	if len(out) != 1 {
		t.Fatalf("expected 1 native BNB row (no key, no token holdings), got %d", len(out))
	}
	n := out[0]
	if n.TokenSymbol != "BNB" || n.TokenAddress != "" || n.Balance != "2" {
		t.Errorf("native BNB wrong: %+v", n)
	}
	if n.Network != NetworkBnbMainnet {
		t.Errorf("expected network %q, got %q", NetworkBnbMainnet, n.Network)
	}
}

func TestNodeRealWDP_Name(t *testing.T) {
	if NewNodeRealWDP("k", "").Name() != ProviderNodeReal {
		t.Error("NodeReal WDP name mismatch")
	}
}

// --- Glacier wrapper -----------------------------------------------------------

func TestGlacierWDP_TokenBalances(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !strings.Contains(r.URL.Path, "listErc20") {
			t.Errorf("unexpected path %s", r.URL.Path)
		}
		w.Write([]byte(`{"erc20TokenBalances":[{"address":"0xT","name":"T","symbol":"T","decimals":18,"balance":"1000000000000000000"}],"nextPageToken":""}`))
	}))
	defer srv.Close()

	c := NewGlacierClient("")
	c.baseURL = srv.URL
	wdp := &glacierWDP{client: c}

	tokens, err := wdp.GetTokenBalances([]AddressWithNetworks{{Address: "0x1"}})
	if err != nil {
		t.Fatalf("GetTokenBalances: %v", err)
	}
	if len(tokens) != 1 || tokens[0].Network != NetworkAvalancheMainnet {
		t.Errorf("unexpected tokens: %+v", tokens)
	}
	if wdp.Name() != ProviderGlacier {
		t.Error("Glacier WDP name mismatch")
	}
}
