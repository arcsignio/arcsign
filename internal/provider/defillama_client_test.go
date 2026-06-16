package provider

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
)

func TestDefiLlamaGetPrices(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Echo back prices for whatever was asked (path carries the ids).
		w.Write([]byte(`{"coins":{
			"bsc:0xUSDC":{"price":0.9998,"symbol":"USDC","decimals":18,"confidence":0.99},
			"bsc:0x0000000000000000000000000000000000000000":{"price":616.5,"symbol":"BNB","decimals":18,"confidence":0.99}
		}}`))
	}))
	defer srv.Close()

	c := NewDefiLlamaClient()
	c.baseURL = srv.URL

	prices, err := c.GetPrices([]string{"bsc:0xUSDC", "bsc:0x0000000000000000000000000000000000000000"})
	if err != nil {
		t.Fatalf("GetPrices: %v", err)
	}
	if p := prices["bsc:0xUSDC"]; p.Price != 0.9998 || p.Symbol != "USDC" {
		t.Errorf("USDC price wrong: %+v", p)
	}
	if p := prices["bsc:0x0000000000000000000000000000000000000000"]; p.Price != 616.5 || p.Symbol != "BNB" {
		t.Errorf("native BNB price wrong: %+v", p)
	}
}

func TestDefiLlamaBatching(t *testing.T) {
	var requests int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&requests, 1)
		w.Write([]byte(`{"coins":{}}`))
	}))
	defer srv.Close()

	c := NewDefiLlamaClient()
	c.baseURL = srv.URL

	// 200 ids with batch size 80 → ceil(200/80) = 3 requests.
	ids := make([]string, 200)
	for i := range ids {
		ids[i] = fmt.Sprintf("ethereum:0x%040x", i)
	}
	if _, err := c.GetPrices(ids); err != nil {
		t.Fatalf("GetPrices: %v", err)
	}
	if got := atomic.LoadInt32(&requests); got != 3 {
		t.Errorf("expected 3 batched requests for 200 ids, got %d", got)
	}
}

func TestDefiLlamaEmptyInput(t *testing.T) {
	c := NewDefiLlamaClient()
	out, err := c.GetPrices(nil)
	if err != nil || len(out) != 0 {
		t.Errorf("empty input should yield empty map, no error; got %v / %v", out, err)
	}
}

func TestDefiLlamaHTTPErrorTolerant(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer srv.Close()

	c := NewDefiLlamaClient()
	c.baseURL = srv.URL
	// Must return an error but NOT panic — pricing is best-effort.
	out, err := c.GetPrices([]string{"bsc:0xUSDC"})
	if err == nil {
		t.Error("expected error on HTTP 500")
	}
	if out == nil {
		t.Error("should still return a (possibly empty) map, not nil")
	}
}

func TestLlamaCoinID(t *testing.T) {
	cases := []struct {
		name string
		tok  SimplifiedTokenBalance
		want string
	}{
		{"ERC-20 on Ethereum", SimplifiedTokenBalance{Network: NetworkEthMainnet, TokenAddress: "0xABC"}, "ethereum:0xabc"},
		{"native ETH (empty addr)", SimplifiedTokenBalance{Network: NetworkEthMainnet, TokenAddress: ""}, "ethereum:" + zeroAddress},
		{"native BNB on bnb-mainnet", SimplifiedTokenBalance{Network: NetworkBnbMainnet, TokenAddress: ""}, "bsc:" + zeroAddress},
		{"BSC token via bsc-mainnet alias", SimplifiedTokenBalance{Network: "bsc-mainnet", TokenAddress: "0xUSDC"}, "bsc:0xusdc"},
		{"Avalanche token", SimplifiedTokenBalance{Network: NetworkAvalancheMainnet, TokenAddress: "0xDEF"}, "avalanche:0xdef"},
		{"unmapped network", SimplifiedTokenBalance{Network: "solana", TokenAddress: "0x1"}, ""},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := LlamaCoinID(tc.tok); got != tc.want {
				t.Errorf("LlamaCoinID = %q, want %q", got, tc.want)
			}
		})
	}
}

func TestEnrichPricesPreservesExisting(t *testing.T) {
	// A token that already has a price must NOT be overwritten or re-queried.
	tokens := []SimplifiedTokenBalance{
		{Network: NetworkEthMainnet, TokenAddress: "0xABC", Balance: "10", PriceUSD: 5, USDValue: 50},
	}
	EnrichPricesWithDefiLlama(tokens)
	if tokens[0].PriceUSD != 5 || tokens[0].USDValue != 50 {
		t.Errorf("existing price was overwritten: %+v", tokens[0])
	}
}

// guard against accidentally hard-coding an API key into the URL.
func TestDefiLlamaNoKeyInURL(t *testing.T) {
	if strings.Contains(DefiLlamaBaseURL, "key") || strings.Contains(DefiLlamaBaseURL, "?") {
		t.Errorf("DefiLlama base URL should carry no key/query: %q", DefiLlamaBaseURL)
	}
}
