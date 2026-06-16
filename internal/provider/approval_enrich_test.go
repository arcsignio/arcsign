package provider

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
)

// newCodeStub returns a server that answers eth_getCode with `code`, counting calls.
func newCodeStub(t *testing.T, code string, calls *int32) *httptest.Server {
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(calls, 1)
		w.Write([]byte(`{"jsonrpc":"2.0","id":1,"result":"` + code + `"}`))
	}))
}

func TestEthGetCodeEOAvsContract(t *testing.T) {
	c := &AlchemyClient{httpClient: http.DefaultClient}

	var n int32
	eoa := newCodeStub(t, "0x", &n)
	defer eoa.Close()
	code, err := c.ethGetCode(eoa.URL, "0xspender")
	if err != nil || !isEmptyCode(code) {
		t.Errorf("expected EOA (empty code), got %q err=%v", code, err)
	}

	contract := newCodeStub(t, "0x60806040", &n)
	defer contract.Close()
	code, err = c.ethGetCode(contract.URL, "0xspender")
	if err != nil || isEmptyCode(code) {
		t.Errorf("expected contract (non-empty code), got %q err=%v", code, err)
	}
}

// A known spender must be labelled from the registry WITHOUT calling eth_getCode.
func TestEnrichApprovalKnownSpenderSkipsGetCode(t *testing.T) {
	var calls int32
	srv := newCodeStub(t, "0x", &calls)
	defer srv.Close()
	c := &AlchemyClient{httpClient: http.DefaultClient}

	entry := &ApprovalEntry{
		Network:     NetworkEthMainnet,
		Spender:     "0x111111125421ca6dc452d289314280a0f8842a65", // 1inch v6 (known)
		IsUnlimited: true,
	}
	c.enrichApproval(srv.URL, entry, map[string]bool{})

	if atomic.LoadInt32(&calls) != 0 {
		t.Errorf("known spender must NOT trigger eth_getCode, got %d calls", calls)
	}
	if !strings.Contains(strings.ToLower(entry.SpenderName), "1inch") {
		t.Errorf("expected 1inch label, got %q", entry.SpenderName)
	}
	if entry.RiskLevel != RiskYellow { // unlimited + known
		t.Errorf("unlimited to known spender should be yellow, got %q", entry.RiskLevel)
	}
}

// An unknown EOA spender must probe getCode once and be flagged red.
func TestEnrichApprovalUnknownEOAIsRed(t *testing.T) {
	var calls int32
	srv := newCodeStub(t, "0x", &calls) // empty code → EOA
	defer srv.Close()
	c := &AlchemyClient{httpClient: http.DefaultClient}

	entry := &ApprovalEntry{
		Network:     NetworkEthMainnet,
		Spender:     "0x000000000000000000000000000000000000beef", // unknown
		IsUnlimited: false,
	}
	c.enrichApproval(srv.URL, entry, map[string]bool{})

	if atomic.LoadInt32(&calls) != 1 {
		t.Errorf("unknown spender should probe getCode once, got %d", calls)
	}
	if !entry.IsEOA || entry.RiskLevel != RiskRed || entry.SpenderType != "eoa" {
		t.Errorf("unknown EOA should be red/eoa, got isEOA=%v risk=%q type=%q", entry.IsEOA, entry.RiskLevel, entry.SpenderType)
	}
}

// The eoaCache must dedupe getCode across multiple approvals to the same spender.
func TestEnrichApprovalEOACacheDedup(t *testing.T) {
	var calls int32
	srv := newCodeStub(t, "0x60806040", &calls) // contract
	defer srv.Close()
	c := &AlchemyClient{httpClient: http.DefaultClient}
	cache := map[string]bool{}

	for i := 0; i < 3; i++ {
		entry := &ApprovalEntry{Network: NetworkEthMainnet, Spender: "0x00000000000000000000000000000000cafe0001"}
		c.enrichApproval(srv.URL, entry, cache)
	}
	if atomic.LoadInt32(&calls) != 1 {
		t.Errorf("same unknown spender across 3 approvals should probe once, got %d", calls)
	}
}

// A blocklisted spender is red and skips the getCode probe.
func TestEnrichApprovalMaliciousIsRed(t *testing.T) {
	var sample string
	for a := range maliciousSet {
		sample = a
		break
	}
	var calls int32
	srv := newCodeStub(t, "0x", &calls)
	defer srv.Close()
	c := &AlchemyClient{httpClient: http.DefaultClient}

	entry := &ApprovalEntry{Network: NetworkEthMainnet, Spender: sample, IsUnlimited: false}
	c.enrichApproval(srv.URL, entry, map[string]bool{})

	if !entry.IsMalicious || entry.RiskLevel != RiskRed {
		t.Errorf("malicious spender should be red, got malicious=%v risk=%q", entry.IsMalicious, entry.RiskLevel)
	}
	if atomic.LoadInt32(&calls) != 0 {
		t.Errorf("malicious spender should skip getCode, got %d calls", calls)
	}
}
