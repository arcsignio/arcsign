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

// Without a NodeReal key, BSC must take the UNIFIED degraded path (the same
// helper the Alchemy chains use) — it must NOT hit the NodeReal enhanced API.
// A failing NodeReal endpoint proves the no-key path never calls it.
func TestNodeRealWDP_NoKey_UsesDegradedPath(t *testing.T) {
	var noderealCalls int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&noderealCalls, 1)
		w.WriteHeader(http.StatusInternalServerError) // would fail if called
	}))
	defer srv.Close()

	c := NewBSCTraceClient("") // no key
	c.endpoint = srv.URL
	wdp := &nodeRealWDP{client: c, hasKey: false}

	// Must report degraded and must not error (degraded path is best-effort).
	if !wdp.IsDegraded() {
		t.Error("no-key NodeReal should report IsDegraded() == true")
	}
	if _, err := wdp.GetTokenBalances([]AddressWithNetworks{{Address: "0xA", Networks: []string{NetworkBnbMainnet}}}); err != nil {
		t.Fatalf("no-key GetTokenBalances should not error, got %v", err)
	}
	// The NodeReal enhanced endpoint must NOT have been called on the no-key path.
	if got := atomic.LoadInt32(&noderealCalls); got != 0 {
		t.Errorf("no-key path must not call the NodeReal API, got %d calls", got)
	}
}

func TestNodeRealWDP_Name(t *testing.T) {
	if NewNodeRealWDP("k").Name() != ProviderNodeReal {
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
