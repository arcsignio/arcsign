package provider

import (
	"bytes"
	"encoding/json"
	"fmt"
	"math/big"
	"net/http"
	"strings"
	"time"

	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/common/hexutil"
)

// Multicall3 is deployed at the same address on every chain we support, so one
// eth_call can batch many balanceOf calls into a single RPC round-trip (no key).
// https://www.multicall3.com/
const multicall3Address = "0xcA11bde05977b3631167028862bE2a173976CA11"

// erc20BalanceOfSelector is keccak256("balanceOf(address)")[:4].
const erc20BalanceOfSelector = "0x70a08231"

// multicall3ABI defines aggregate3((address,bool,bytes)[]) returns ((bool,bytes)[]).
const multicall3ABI = `[{"inputs":[{"components":[{"name":"target","type":"address"},{"name":"allowFailure","type":"bool"},{"name":"callData","type":"bytes"}],"name":"calls","type":"tuple[]"}],"name":"aggregate3","outputs":[{"components":[{"name":"success","type":"bool"},{"name":"returnData","type":"bytes"}],"name":"returnData","type":"tuple[]"}],"stateMutability":"payable","type":"function"}]`

type multicall3Call struct {
	Target       common.Address
	AllowFailure bool
	CallData     []byte
}

type multicall3Result struct {
	Success    bool
	ReturnData []byte
}

// GetTokenBalancesMulticallFallback tries each RPC endpoint in turn (public RPCs
// are flaky — e.g. a 521 from one) and returns the first success. Use the
// registry's GetAllRPCEndpoints to supply primary + backups.
func GetTokenBalancesMulticallFallback(endpoints []string, address, network string, tokens []CommonToken) ([]SimplifiedTokenBalance, error) {
	var lastErr error
	for _, ep := range endpoints {
		if ep == "" {
			continue
		}
		bals, err := GetTokenBalancesMulticall(ep, address, network, tokens)
		if err == nil {
			return bals, nil
		}
		lastErr = err
	}
	return nil, lastErr
}

// GetTokenBalancesMulticall queries balanceOf for many tokens in ONE eth_call via
// Multicall3, over a public RPC (no key). Tokens with zero balance are omitted.
// USD value is left 0 (filled by DefiLlama later). On any multicall failure the
// caller should fall back to per-token eth_call.
func GetTokenBalancesMulticall(rpcEndpoint, address, network string, tokens []CommonToken) ([]SimplifiedTokenBalance, error) {
	if len(tokens) == 0 {
		return nil, nil
	}

	parsed, err := abi.JSON(strings.NewReader(multicall3ABI))
	if err != nil {
		return nil, fmt.Errorf("multicall abi: %w", err)
	}

	owner := common.HexToAddress(address)
	calls := make([]multicall3Call, len(tokens))
	for i, tok := range tokens {
		// balanceOf(owner) calldata: selector + 32-byte left-padded address.
		data := common.FromHex(erc20BalanceOfSelector + fmt.Sprintf("%064x", owner.Bytes()))
		calls[i] = multicall3Call{
			Target:       common.HexToAddress(tok.Address),
			AllowFailure: true, // one bad token shouldn't fail the batch
			CallData:     data,
		}
	}

	callData, err := parsed.Pack("aggregate3", calls)
	if err != nil {
		return nil, fmt.Errorf("multicall pack: %w", err)
	}

	// eth_call to Multicall3.
	raw, err := ethCallRaw(rpcEndpoint, multicall3Address, hexutil.Encode(callData))
	if err != nil {
		return nil, err
	}

	out, err := parsed.Unpack("aggregate3", raw)
	if err != nil || len(out) == 0 {
		return nil, fmt.Errorf("multicall unpack: %w", err)
	}

	// out[0] is []struct{Success bool; ReturnData []byte}.
	results := make([]multicall3Result, 0, len(tokens))
	b, _ := json.Marshal(out[0])
	if err := json.Unmarshal(b, &results); err != nil {
		return nil, fmt.Errorf("multicall result decode: %w", err)
	}
	if len(results) != len(tokens) {
		return nil, fmt.Errorf("multicall result count %d != %d", len(results), len(tokens))
	}

	networkLabel := NetworkLabels[network]
	var balances []SimplifiedTokenBalance
	for i, res := range results {
		if !res.Success || len(res.ReturnData) == 0 {
			continue
		}
		bal := new(big.Int).SetBytes(res.ReturnData)
		if bal.Sign() == 0 {
			continue // zero balance — omit
		}
		tok := tokens[i]
		rawHex := "0x" + bal.Text(16)
		balances = append(balances, SimplifiedTokenBalance{
			Address:      address,
			Network:      network,
			NetworkLabel: networkLabel,
			TokenAddress: tok.Address,
			TokenSymbol:  tok.Symbol,
			TokenName:    tok.Symbol,
			Balance:      formatTokenBalance(rawHex, tok.Decimals),
			RawBalance:   rawHex,
			Decimals:     tok.Decimals,
			USDValue:     0, // filled by DefiLlama
			PriceUSD:     0,
		})
	}
	return balances, nil
}

// ethCallRaw performs an eth_call and returns the raw result bytes.
func ethCallRaw(rpcEndpoint, to, data string) ([]byte, error) {
	reqBody, _ := json.Marshal(jsonRPCRequest{
		JSONRPC: "2.0",
		Method:  "eth_call",
		Params:  []interface{}{map[string]string{"to": to, "data": data}, "latest"},
		ID:      1,
	})
	resp, err := (&http.Client{Timeout: 20 * time.Second}).Post(rpcEndpoint, "application/json", bytes.NewReader(reqBody))
	if err != nil {
		return nil, fmt.Errorf("eth_call: %w", err)
	}
	defer resp.Body.Close()

	var rpcResp jsonRPCResponse
	if err := json.NewDecoder(resp.Body).Decode(&rpcResp); err != nil {
		return nil, fmt.Errorf("eth_call decode: %w", err)
	}
	if rpcResp.Error != nil {
		return nil, fmt.Errorf("eth_call rpc error: %s", rpcResp.Error.Message)
	}
	var hexResult string
	if err := json.Unmarshal(rpcResp.Result, &hexResult); err != nil {
		return nil, fmt.Errorf("eth_call result: %w", err)
	}
	return common.FromHex(hexResult), nil
}
