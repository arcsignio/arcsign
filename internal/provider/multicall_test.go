package provider

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"

	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/common/hexutil"
)

// --- common token table -------------------------------------------------------

func TestCommonTokensTable(t *testing.T) {
	mustHave := []string{
		NetworkEthMainnet, NetworkPolygonMainnet, NetworkArbitrumMainnet,
		NetworkOptimismMainnet, NetworkBaseMainnet, NetworkBnbMainnet,
	}
	for _, net := range mustHave {
		toks := CommonTokensFor(net)
		if len(toks) < 4 {
			t.Errorf("%s should have several common tokens, got %d", net, len(toks))
		}
		for _, tk := range toks {
			if !strings.HasPrefix(tk.Address, "0x") || len(tk.Address) != 42 {
				t.Errorf("%s/%s bad address %q", net, tk.Symbol, tk.Address)
			}
			if tk.Address != strings.ToLower(tk.Address) {
				t.Errorf("%s/%s address should be lowercase", net, tk.Symbol)
			}
		}
	}
}

func TestCommonTokensIncludeStaking(t *testing.T) {
	ethSyms := symbolsOf(CommonTokensFor(NetworkEthMainnet))
	for _, want := range []string{"stETH", "ankrETH", "eETH"} {
		if !ethSyms[want] {
			t.Errorf("Ethereum common tokens missing staking receipt %q", want)
		}
	}
	if !symbolsOf(CommonTokensFor(NetworkBnbMainnet))["ankrBNB"] {
		t.Error("BSC common tokens missing ankrBNB")
	}
}

func symbolsOf(toks []CommonToken) map[string]bool {
	m := make(map[string]bool)
	for _, t := range toks {
		m[t.Symbol] = true
	}
	return m
}

func balanceSymbols(bals []SimplifiedTokenBalance) map[string]bool {
	m := make(map[string]bool)
	for _, b := range bals {
		m[b.TokenSymbol] = true
	}
	return m
}

// --- multicall ----------------------------------------------------------------

// stubMulticallServer returns a server that decodes the aggregate3 request and
// answers each balanceOf with the provided per-target balances (by lowercase
// address). It also records how many requests it received.
func stubMulticallServer(t *testing.T, balances map[string]int64, calls *int32) *httptest.Server {
	parsed, err := abi.JSON(strings.NewReader(multicall3ABI))
	if err != nil {
		t.Fatal(err)
	}
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(calls, 1)
		// We don't fully parse the inbound calldata; we answer based on the
		// known token order isn't available, so encode results for ALL targets
		// in the request by decoding the aggregate3 args.
		// Simpler: read body, extract the calls, map target->balance.
		var req struct {
			Params []json.RawMessage `json:"params"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			t.Fatal(err)
		}
		var callObj struct {
			Data string `json:"data"`
		}
		if err := json.Unmarshal(req.Params[0], &callObj); err != nil {
			t.Fatal(err)
		}
		args, err := parsed.Methods["aggregate3"].Inputs.Unpack(common.FromHex(callObj.Data)[4:])
		if err != nil {
			t.Fatal(err)
		}
		// args[0] decodes to []struct{Target common.Address; AllowFailure bool; CallData []byte}
		inCalls := args[0].([]struct {
			Target       common.Address `json:"target"`
			AllowFailure bool           `json:"allowFailure"`
			CallData     []byte         `json:"callData"`
		})

		type outRes struct {
			Success    bool
			ReturnData []byte
		}
		results := make([]outRes, len(inCalls))
		for i, c := range inCalls {
			bal := balances[strings.ToLower(c.Target.Hex())]
			b := make([]byte, 32)
			big := uint64(bal)
			for j := 0; j < 8; j++ {
				b[31-j] = byte(big >> (8 * j))
			}
			results[i] = outRes{Success: true, ReturnData: b}
		}
		packed, err := parsed.Methods["aggregate3"].Outputs.Pack(results)
		if err != nil {
			t.Fatal(err)
		}
		w.Write([]byte(`{"jsonrpc":"2.0","id":1,"result":"` + hexutil.Encode(packed) + `"}`))
	}))
}

func TestGetTokenBalancesMulticall(t *testing.T) {
	tokens := []CommonToken{
		{"USDC", "0x000000000000000000000000000000000000aaaa", 6},
		{"USDT", "0x000000000000000000000000000000000000bbbb", 6},
		{"ZERO", "0x000000000000000000000000000000000000cccc", 18},
	}
	var calls int32
	srv := stubMulticallServer(t, map[string]int64{
		"0x000000000000000000000000000000000000aaaa": 5_000_000, // 5 USDC
		"0x000000000000000000000000000000000000bbbb": 2_000_000, // 2 USDT
		// cccc has zero — should be omitted
	}, &calls)
	defer srv.Close()

	out, err := GetTokenBalancesMulticall(srv.URL, "0x1234", NetworkEthMainnet, tokens)
	if err != nil {
		t.Fatalf("multicall: %v", err)
	}
	if got := atomic.LoadInt32(&calls); got != 1 {
		t.Errorf("expected ONE batched eth_call, got %d", got)
	}
	if len(out) != 2 {
		t.Fatalf("expected 2 non-zero tokens (zero omitted), got %d: %+v", len(out), out)
	}
	got := balanceSymbols(out)
	if !got["USDC"] || !got["USDT"] || got["ZERO"] {
		t.Errorf("wrong tokens returned: %v", got)
	}
}

func TestMulticallFallback(t *testing.T) {
	// First endpoint is broken (returns non-JSON), second works.
	bad := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("error code: 521"))
	}))
	defer bad.Close()
	var calls int32
	good := stubMulticallServer(t, map[string]int64{
		"0x000000000000000000000000000000000000aaaa": 1_000_000,
	}, &calls)
	defer good.Close()

	tokens := []CommonToken{{"USDC", "0x000000000000000000000000000000000000aaaa", 6}}
	out, err := GetTokenBalancesMulticallFallback([]string{bad.URL, good.URL}, "0x1", NetworkEthMainnet, tokens)
	if err != nil {
		t.Fatalf("fallback should succeed via second endpoint: %v", err)
	}
	if len(out) != 1 || out[0].TokenSymbol != "USDC" {
		t.Errorf("unexpected result: %+v", out)
	}
}
