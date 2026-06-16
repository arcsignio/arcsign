package provider

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"
)

// ================================================================================
// DefiLlama price client — free, no-API-key USD prices by contract address.
//
// Fills the pricing gap left by providers that don't return USD value (NodeReal
// for BSC, native BNB via public RPC, etc). Queries DefiLlama's coins API with
// `chain:contract` ids (native uses the zero address, which DefiLlama resolves
// to the chain's native coin). Anonymous — no key.
//
// Docs/endpoint: https://coins.llama.fi/prices/current/<comma-separated ids>
// ================================================================================

const (
	// DefiLlamaBaseURL is the public coins price API (no key).
	DefiLlamaBaseURL = "https://coins.llama.fi"
	// defiLlamaBatchSize caps ids per request to keep the URL a sane length.
	defiLlamaBatchSize = 80
)

// DefiLlamaClient queries the DefiLlama coins price API.
type DefiLlamaClient struct {
	httpClient *http.Client
	baseURL    string // overridable for testing; defaults to DefiLlamaBaseURL
}

// NewDefiLlamaClient creates a DefiLlama price client (anonymous, no key).
func NewDefiLlamaClient() *DefiLlamaClient {
	return &DefiLlamaClient{
		httpClient: &http.Client{Timeout: 15 * time.Second},
		baseURL:    DefiLlamaBaseURL,
	}
}

// internalToLlamaChain maps our canonical internal network ids to DefiLlama's
// chain prefixes. Add a row here when adding a chain — nothing else changes.
var internalToLlamaChain = map[string]string{
	NetworkEthMainnet:       "ethereum",
	NetworkPolygonMainnet:   "polygon",
	NetworkArbitrumMainnet:  "arbitrum",
	NetworkOptimismMainnet:  "optimism",
	NetworkBaseMainnet:      "base",
	NetworkBnbMainnet:       "bsc",
	"bsc-mainnet":           "bsc", // BSC alias (the chain has two spellings)
	"bsc":                   "bsc",
	NetworkAvalancheMainnet: "avalanche",
	"avax-mainnet":          "avalanche",
}

// zeroAddress is DefiLlama's stand-in for a chain's native coin.
const zeroAddress = "0x0000000000000000000000000000000000000000"

// LlamaCoinID builds the DefiLlama coin id for a token. Native coins (empty or
// zero TokenAddress) use the chain's zero address — DefiLlama resolves that to
// the native coin (ETH/BNB/AVAX/...). Returns "" if the network is unmapped.
func LlamaCoinID(t SimplifiedTokenBalance) string {
	chain, ok := internalToLlamaChain[NormalizeToInternalNetwork(t.Network)]
	if !ok {
		return ""
	}
	addr := strings.ToLower(t.TokenAddress)
	if addr == "" || addr == zeroAddress || addr == "0x0" {
		addr = zeroAddress // native
	}
	return chain + ":" + addr
}

// LlamaPrice is a single token's price entry from DefiLlama.
type LlamaPrice struct {
	Price      float64 `json:"price"`
	Symbol     string  `json:"symbol"`
	Decimals   int     `json:"decimals"`
	Confidence float64 `json:"confidence"`
}

type llamaResponse struct {
	Coins map[string]LlamaPrice `json:"coins"`
}

// GetPrices fetches current USD prices for the given coin ids (e.g.
// "bsc:0xabc...", or "ethereum:0x000...0" for native ETH). Ids are queried in
// batches and merged. Returns the prices that DefiLlama knew about; unknown ids
// are simply absent from the map. A batch that fails to fetch is skipped (best
// effort) — pricing is an enrichment and must never break balance display.
func (c *DefiLlamaClient) GetPrices(coins []string) (map[string]LlamaPrice, error) {
	out := make(map[string]LlamaPrice)
	if len(coins) == 0 {
		return out, nil
	}

	base := c.baseURL
	if base == "" {
		base = DefiLlamaBaseURL
	}

	var firstErr error
	for start := 0; start < len(coins); start += defiLlamaBatchSize {
		end := start + defiLlamaBatchSize
		if end > len(coins) {
			end = len(coins)
		}
		batch := coins[start:end]

		url := base + "/prices/current/" + strings.Join(batch, ",")
		resp, err := c.httpClient.Get(url)
		if err != nil {
			if firstErr == nil {
				firstErr = fmt.Errorf("defillama: %w", err)
			}
			continue
		}

		func() {
			defer resp.Body.Close()
			if resp.StatusCode < 200 || resp.StatusCode >= 300 {
				if firstErr == nil {
					firstErr = fmt.Errorf("defillama: HTTP %d", resp.StatusCode)
				}
				return
			}
			var parsed llamaResponse
			if err := json.NewDecoder(resp.Body).Decode(&parsed); err != nil {
				if firstErr == nil {
					firstErr = fmt.Errorf("defillama decode: %w", err)
				}
				return
			}
			for id, price := range parsed.Coins {
				out[id] = price
			}
		}()
	}

	return out, firstErr
}

// EnrichPricesWithDefiLlama fills in USD price/value for tokens that came back
// without pricing (e.g. NodeReal/BSC, native BNB). It mutates tokens in place.
// Tokens that ALREADY have a price are left untouched (provider price wins).
// Best-effort: any DefiLlama failure is swallowed so balances still display.
func EnrichPricesWithDefiLlama(tokens []SimplifiedTokenBalance) {
	// Collect unique coin ids for tokens lacking a price.
	idSet := make(map[string]bool)
	for _, t := range tokens {
		if t.PriceUSD > 0 {
			continue // already priced
		}
		if id := LlamaCoinID(t); id != "" {
			idSet[id] = true
		}
	}
	if len(idSet) == 0 {
		return
	}
	ids := make([]string, 0, len(idSet))
	for id := range idSet {
		ids = append(ids, id)
	}

	prices, _ := NewDefiLlamaClient().GetPrices(ids) // error ignored: enrichment
	if len(prices) == 0 {
		return
	}

	for i := range tokens {
		if tokens[i].PriceUSD > 0 {
			continue
		}
		id := LlamaCoinID(tokens[i])
		p, ok := prices[id]
		if !ok || p.Price <= 0 {
			continue
		}
		tokens[i].PriceUSD = p.Price
		if bal, err := strconv.ParseFloat(strings.TrimSpace(tokens[i].Balance), 64); err == nil {
			tokens[i].USDValue = p.Price * bal
		}
	}
}
