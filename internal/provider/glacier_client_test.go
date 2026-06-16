package provider

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// newTestGlacier returns a GlacierClient pointed at a stub server.
func newTestGlacier(t *testing.T, handler http.HandlerFunc) (*GlacierClient, func()) {
	t.Helper()
	srv := httptest.NewServer(handler)
	c := NewGlacierClient("")
	c.baseURL = srv.URL // override for testing
	return c, srv.Close
}

func TestGlacierGetTokenHoldings(t *testing.T) {
	const body = `{
		"nativeTokenBalance": {"name":"Avalanche","symbol":"AVAX","decimals":18,"balance":"3000000000000000000","price":{"value":6.5,"currencyCode":"usd"},"balanceValue":{"value":19.5,"currencyCode":"usd"}},
		"erc20TokenBalances": [
			{"address":"0xAAA","name":"Token A","symbol":"TKA","decimals":18,"balance":"1000000000000000000","price":{"value":2.5,"currencyCode":"usd"},"balanceValue":{"value":2.5,"currencyCode":"usd"}},
			{"address":"0xBBB","name":"Token B","symbol":"TKB","decimals":6,"balance":"5000000"}
		],
		"nextPageToken": ""
	}`
	c, done := newTestGlacier(t, func(w http.ResponseWriter, r *http.Request) {
		if !strings.Contains(r.URL.Path, "balances:listErc20") {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}
		w.Write([]byte(body))
	})
	defer done()

	tokens, err := c.GetTokenHoldingsAVAX("0x123")
	if err != nil {
		t.Fatalf("GetTokenHoldingsAVAX: %v", err)
	}
	// native AVAX (index 0) + 2 ERC-20.
	if len(tokens) != 3 {
		t.Fatalf("expected 3 tokens (native + 2 erc20), got %d", len(tokens))
	}
	// Native AVAX must be present with an empty contract address and its price.
	native := tokens[0]
	if native.TokenSymbol != "AVAX" || native.TokenAddress != "" {
		t.Errorf("expected native AVAX at index 0, got symbol=%q addr=%q", native.TokenSymbol, native.TokenAddress)
	}
	if native.Balance != "3" || native.USDValue != 19.5 {
		t.Errorf("native AVAX wrong: balance=%q usd=%v", native.Balance, native.USDValue)
	}
	tka := tokens[1]
	if tka.TokenSymbol != "TKA" || tka.Balance != "1" {
		t.Errorf("token TKA wrong: symbol=%q balance=%q", tka.TokenSymbol, tka.Balance)
	}
	// Critical: network must be tagged for the frontend to map it correctly.
	if tka.Network != NetworkAvalancheMainnet || tka.NetworkLabel != "Avalanche" {
		t.Errorf("network tag wrong: %q / %q", tka.Network, tka.NetworkLabel)
	}
	if tokens[2].Decimals != 6 || tokens[2].Balance != "5" {
		t.Errorf("token TKB wrong: decimals=%d balance=%q", tokens[2].Decimals, tokens[2].Balance)
	}
	// Glacier supplies pricing — it must flow into USDValue/PriceUSD.
	if tka.PriceUSD != 2.5 || tka.USDValue != 2.5 {
		t.Errorf("TKA pricing not surfaced: priceUSD=%v usdValue=%v", tka.PriceUSD, tka.USDValue)
	}
	// Token without price stays at 0 (no panic on nil price).
	if tokens[2].PriceUSD != 0 || tokens[2].USDValue != 0 {
		t.Errorf("TKB should have zero pricing, got priceUSD=%v usdValue=%v", tokens[2].PriceUSD, tokens[2].USDValue)
	}
}

func TestGlacierGetNFTHoldings(t *testing.T) {
	c, done := newTestGlacier(t, func(w http.ResponseWriter, r *http.Request) {
		switch {
		case strings.Contains(r.URL.Path, "listErc721"):
			w.Write([]byte(`{"erc721TokenBalances":[{"address":"0xNFT","name":"Cool","symbol":"COOL","tokenId":"7","ercType":"ERC-721","metadata":{"imageUri":"https://img/7.png"}}],"nextPageToken":""}`))
		case strings.Contains(r.URL.Path, "listErc1155"):
			w.Write([]byte(`{"erc1155TokenBalances":[],"nextPageToken":""}`))
		default:
			t.Errorf("unexpected path: %s", r.URL.Path)
		}
	})
	defer done()

	nfts, err := c.GetNFTHoldingsAVAX("0x123")
	if err != nil {
		t.Fatalf("GetNFTHoldingsAVAX: %v", err)
	}
	if len(nfts) != 1 {
		t.Fatalf("expected 1 NFT, got %d", len(nfts))
	}
	n := nfts[0]
	if n.TokenType != "ERC721" || n.TokenID != "7" || n.ContractAddress != "0xNFT" {
		t.Errorf("nft fields wrong: %+v", n)
	}
	if n.ImageURL != "https://img/7.png" {
		t.Errorf("expected image url, got %q", n.ImageURL)
	}
	if n.Network != NetworkAvalancheMainnet {
		t.Errorf("expected network %q, got %q", NetworkAvalancheMainnet, n.Network)
	}
}

func TestGlacierGetAssetTransfers(t *testing.T) {
	// Glacier nests fields under "nativeTransaction" — the parser must unwrap it.
	const body = `{
		"transactions": [
			{"nativeTransaction": {
				"txHash":"0xHASH","blockNumber":"100","blockTimestamp":1700000000,
				"from":{"address":"0xFROM"},"to":{"address":"0xTO"},"value":"2000000000000000000"
			}}
		],
		"nextPageToken": "next123"
	}`
	c, done := newTestGlacier(t, func(w http.ResponseWriter, r *http.Request) {
		if !strings.Contains(r.URL.Path, "/transactions") {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}
		w.Write([]byte(body))
	})
	defer done()

	transfers, pageKey, err := c.GetAssetTransfersAVAX("0x123", 10, "")
	if err != nil {
		t.Fatalf("GetAssetTransfersAVAX: %v", err)
	}
	if pageKey != "next123" {
		t.Errorf("expected pageKey next123, got %q", pageKey)
	}
	if len(transfers) != 1 {
		t.Fatalf("expected 1 transfer, got %d", len(transfers))
	}
	tr := transfers[0]
	if tr.Hash != "0xHASH" {
		t.Errorf("hash empty/wrong (nativeTransaction unwrap broken?): %q", tr.Hash)
	}
	if tr.From != "0xFROM" || tr.To != "0xTO" || tr.Asset != "AVAX" || tr.Category != "external" {
		t.Errorf("transfer fields wrong: %+v", tr)
	}
	if tr.Value != 2 {
		t.Errorf("expected value 2, got %v", tr.Value)
	}
}

func TestGlacierHTTPErrorPropagates(t *testing.T) {
	c, done := newTestGlacier(t, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	})
	defer done()

	if _, err := c.GetTokenHoldingsAVAX("0x123"); err == nil {
		t.Error("expected error on HTTP 500, got nil")
	}
}
