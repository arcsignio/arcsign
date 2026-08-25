package openocean

import (
	"context"
	"math/big"
	"net/http"
	"net/http/httptest"
	"testing"
)

// TestGetQuote_NoReferrerParams 守住「ArcSign 不對使用者抽成」：即使有人繞過
// QuoteParams/SwapQuote 的欄位守門，直接在 client.go 組 query string 時寫死
// referrer/referrerFee，這個測試也會用真實 HTTP request 抓到。
func TestGetQuote_NoReferrerParams(t *testing.T) {
	var gotQuery map[string][]string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotQuery = r.URL.Query()
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"code":200,"data":{"inToken":{"symbol":"ETH","decimals":18},"outToken":{"symbol":"USDC","decimals":6},"outAmount":"1000000","estimatedGas":"21000","priceImpact":"0"}}`))
	}))
	defer srv.Close()

	c := NewClient()
	c.baseURL = srv.URL

	_, err := c.GetQuote(context.Background(), &QuoteRequest{
		FromTokenAddress: NativeTokenAddress,
		ToTokenAddress:   "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
		Amount:           big.NewInt(1000000000000000000),
		GasPrice:         big.NewInt(1000000000),
		Slippage:         1,
		ChainID:          1,
	})
	if err != nil {
		t.Fatalf("GetQuote error: %v", err)
	}

	if _, found := gotQuery["referrer"]; found {
		t.Errorf("GetQuote 送出的 request 含 referrer 參數 —— ArcSign 不對使用者抽成，禁止在 OpenOcean 請求夾帶 referrer")
	}
	if _, found := gotQuery["referrerFee"]; found {
		t.Errorf("GetQuote 送出的 request 含 referrerFee 參數 —— ArcSign 不對使用者抽成，禁止在 OpenOcean 請求夾帶 referrerFee")
	}
}

// TestGetSwap_NoReferrerParams 同上，涵蓋 GetSwap（實際組交易）路徑。
func TestGetSwap_NoReferrerParams(t *testing.T) {
	var gotQuery map[string][]string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotQuery = r.URL.Query()
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"code":200,"data":{"from":"0xabc","to":"0xdef","data":"0x","value":"0","gasPrice":"1000000000","estimatedGas":"21000"}}`))
	}))
	defer srv.Close()

	c := NewClient()
	c.baseURL = srv.URL

	_, err := c.GetSwap(context.Background(), &SwapRequest{
		FromTokenAddress: NativeTokenAddress,
		ToTokenAddress:   "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
		Amount:           big.NewInt(1000000000000000000),
		GasPrice:         big.NewInt(1000000000),
		Slippage:         1,
		FromAddress:      "0x1111111111111111111111111111111111111",
		ChainID:          1,
	})
	if err != nil {
		t.Fatalf("GetSwap error: %v", err)
	}

	if _, found := gotQuery["referrer"]; found {
		t.Errorf("GetSwap 送出的 request 含 referrer 參數 —— ArcSign 不對使用者抽成，禁止在 OpenOcean 請求夾帶 referrer")
	}
	if _, found := gotQuery["referrerFee"]; found {
		t.Errorf("GetSwap 送出的 request 含 referrerFee 參數 —— ArcSign 不對使用者抽成，禁止在 OpenOcean 請求夾帶 referrerFee")
	}
}
