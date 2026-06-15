package provider

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

// ================================================================================
// Glacier (Avalanche Data API) client — Avalanche C-Chain indexer
//
// Avalanche is not covered by Alchemy's free tier, so token / NFT / transfer
// enrichment uses Avalanche's official Data API (Glacier). The Glacier API has
// an anonymous (no API key) tier, so users do NOT need to register or paste a
// key to get full Avalanche data. An optional key raises the rate limit and is
// passed via the x-glacier-api-key header when present.
//
// Docs: https://developers.avacloud.io/data-api/
// REST (not JSON-RPC), so this client is self-contained and does not reuse the
// NodeReal JSON-RPC helper.
// ================================================================================

const (
	// GlacierBaseURL is the anonymous Avalanche Data API endpoint.
	GlacierBaseURL = "https://glacier-api.avax.network"
	// AvalancheCChainID is the Glacier path chain id for Avalanche C-Chain.
	AvalancheCChainID = "43114"
)

// GlacierClient talks to the Avalanche Data API (Glacier) REST endpoints.
type GlacierClient struct {
	httpClient *http.Client
	apiKey     string // optional; empty = anonymous tier
	baseURL    string // overridable for testing; defaults to GlacierBaseURL
}

// NewGlacierClient creates a Glacier client. apiKey is optional — pass "" for
// the anonymous (no key) tier. Signature mirrors NewBSCTraceClient so the FFI
// dispatch layer can treat all enhanced providers uniformly.
func NewGlacierClient(apiKey string) *GlacierClient {
	return &GlacierClient{
		httpClient: &http.Client{Timeout: 30 * time.Second},
		apiKey:     apiKey,
		baseURL:    GlacierBaseURL,
	}
}

// get issues a GET against the Glacier REST API and unmarshals into out.
func (c *GlacierClient) get(path string, query url.Values, out interface{}) error {
	base := c.baseURL
	if base == "" {
		base = GlacierBaseURL
	}
	u := base + path
	if len(query) > 0 {
		u += "?" + query.Encode()
	}

	req, err := http.NewRequest(http.MethodGet, u, nil)
	if err != nil {
		return fmt.Errorf("glacier: build request: %w", err)
	}
	req.Header.Set("Accept", "application/json")
	if c.apiKey != "" {
		req.Header.Set("x-glacier-api-key", c.apiKey)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("glacier: request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("glacier: HTTP %d for %s", resp.StatusCode, path)
	}

	if err := json.NewDecoder(resp.Body).Decode(out); err != nil {
		return fmt.Errorf("glacier: decode response: %w", err)
	}
	return nil
}

// ================================================================================
// ERC-20 token balances
// GET /v1/chains/43114/addresses/{address}/balances:listErc20
// ================================================================================

type glacierErc20Response struct {
	NextPageToken      string              `json:"nextPageToken"`
	Erc20TokenBalances []glacierErc20Token `json:"erc20TokenBalances"`
}

type glacierErc20Token struct {
	Address  string `json:"address"`
	Name     string `json:"name"`
	Symbol   string `json:"symbol"`
	Decimals int    `json:"decimals"`
	Balance  string `json:"balance"` // raw integer string
	LogoURI  string `json:"logoUri"`
}

// GetTokenHoldingsAVAX fetches ERC-20 balances for an address on Avalanche
// C-Chain and returns them in the shared SimplifiedTokenBalance format.
func (c *GlacierClient) GetTokenHoldingsAVAX(address string) ([]SimplifiedTokenBalance, error) {
	var all []SimplifiedTokenBalance
	networkLabel := NetworkLabels[NetworkAvalancheMainnet]

	pageToken := ""
	maxPages := 5
	for page := 0; page < maxPages; page++ {
		q := url.Values{}
		q.Set("pageSize", "100")
		if pageToken != "" {
			q.Set("pageToken", pageToken)
		}

		var resp glacierErc20Response
		path := fmt.Sprintf("/v1/chains/%s/addresses/%s/balances:listErc20", AvalancheCChainID, address)
		if err := c.get(path, q, &resp); err != nil {
			return nil, err
		}

		for _, t := range resp.Erc20TokenBalances {
			decimals := t.Decimals
			if decimals == 0 {
				decimals = 18
			}
			all = append(all, SimplifiedTokenBalance{
				Address:      address,
				Network:      NetworkAvalancheMainnet,
				NetworkLabel: networkLabel,
				TokenAddress: t.Address,
				TokenSymbol:  t.Symbol,
				TokenName:    t.Name,
				TokenLogo:    t.LogoURI,
				Balance:      formatTokenBalance(t.Balance, decimals),
				RawBalance:   t.Balance,
				Decimals:     decimals,
				USDValue:     0, // pricing not requested
				PriceUSD:     0,
			})
		}

		if resp.NextPageToken == "" {
			break
		}
		pageToken = resp.NextPageToken
	}

	return all, nil
}

// ================================================================================
// NFT balances (ERC-721 + ERC-1155)
// GET /v1/chains/43114/addresses/{address}/balances:listErc721 (and :listErc1155)
// ================================================================================

type glacierNFTResponse struct {
	NextPageToken string            `json:"nextPageToken"`
	NFTBalances   []glacierNFTToken `json:"nftBalances"`
	// Some Glacier responses key the array by the erc type; accept both.
	Erc721Balances  []glacierNFTToken `json:"erc721TokenBalances"`
	Erc1155Balances []glacierNFTToken `json:"erc1155TokenBalances"`
}

type glacierNFTToken struct {
	Address  string `json:"address"` // contract address
	Name     string `json:"name"`
	Symbol   string `json:"symbol"`
	TokenID  string `json:"tokenId"`
	ErcType  string `json:"ercType"`
	Balance  string `json:"balance"`
	Metadata struct {
		Name     string `json:"name"`
		ImageURI string `json:"imageUri"`
	} `json:"metadata"`
}

// GetNFTHoldingsAVAX fetches ERC-721 and ERC-1155 holdings for an address and
// returns them in the shared SimplifiedNFT format.
func (c *GlacierClient) GetNFTHoldingsAVAX(address string) ([]SimplifiedNFT, error) {
	var all []SimplifiedNFT

	for _, ercType := range []struct {
		path      string
		tokenType string
	}{
		{"balances:listErc721", "ERC721"},
		{"balances:listErc1155", "ERC1155"},
	} {
		nfts, err := c.getNFTsByType(address, ercType.path, ercType.tokenType)
		if err != nil {
			// Don't fail the whole call if one type errors out.
			fmt.Printf("glacier: %s for %s failed: %v\n", ercType.tokenType, safePrefix(address), err)
			continue
		}
		all = append(all, nfts...)
	}

	return all, nil
}

func (c *GlacierClient) getNFTsByType(address, listPath, tokenType string) ([]SimplifiedNFT, error) {
	networkLabel := NetworkLabels[NetworkAvalancheMainnet]
	var out []SimplifiedNFT

	pageToken := ""
	maxPages := 5
	for page := 0; page < maxPages; page++ {
		q := url.Values{}
		q.Set("pageSize", "100")
		if pageToken != "" {
			q.Set("pageToken", pageToken)
		}

		var resp glacierNFTResponse
		path := fmt.Sprintf("/v1/chains/%s/addresses/%s/%s", AvalancheCChainID, address, listPath)
		if err := c.get(path, q, &resp); err != nil {
			return nil, err
		}

		items := resp.NFTBalances
		if len(items) == 0 {
			items = resp.Erc721Balances
		}
		if len(items) == 0 {
			items = resp.Erc1155Balances
		}

		for _, n := range items {
			balance := n.Balance
			if balance == "" {
				balance = "1"
			}
			name := n.Metadata.Name
			if name == "" {
				name = n.Name
			}
			out = append(out, SimplifiedNFT{
				Address:         address,
				Network:         NetworkAvalancheMainnet,
				NetworkLabel:    networkLabel,
				ContractAddress: n.Address,
				TokenID:         n.TokenID,
				TokenType:       tokenType,
				Name:            name,
				ImageURL:        n.Metadata.ImageURI,
				ThumbnailURL:    n.Metadata.ImageURI,
				CollectionName:  n.Name,
				Balance:         balance,
			})
		}

		if resp.NextPageToken == "" {
			break
		}
		pageToken = resp.NextPageToken
	}

	return out, nil
}

// ================================================================================
// Transaction history
// GET /v1/chains/43114/addresses/{address}/transactions
// ================================================================================

type glacierTxResponse struct {
	NextPageToken string            `json:"nextPageToken"`
	Transactions  []glacierTxnEntry `json:"transactions"`
}

// glacierTxnEntry wraps each transaction; the actual fields live under
// "nativeTransaction" in the Glacier /transactions response.
type glacierTxnEntry struct {
	NativeTransaction glacierNativeTxn `json:"nativeTransaction"`
}

type glacierNativeTxn struct {
	TxHash         string            `json:"txHash"`
	BlockNumber    string            `json:"blockNumber"`
	BlockTimestamp int64             `json:"blockTimestamp"`
	From           glacierAddressRef `json:"from"`
	To             glacierAddressRef `json:"to"`
	Value          string            `json:"value"`
}

type glacierAddressRef struct {
	Address string `json:"address"`
}

// GetAssetTransfersAVAX fetches recent transactions for an address and returns
// them in the shared AssetTransfer format. Returns (transfers, nextPageToken, error).
func (c *GlacierClient) GetAssetTransfersAVAX(address string, maxCount int, pageToken string) ([]AssetTransfer, string, error) {
	if maxCount <= 0 || maxCount > 100 {
		maxCount = 100
	}

	q := url.Values{}
	q.Set("pageSize", strconv.Itoa(maxCount))
	q.Set("sortOrder", "desc")
	if pageToken != "" {
		q.Set("pageToken", pageToken)
	}

	var resp glacierTxResponse
	path := fmt.Sprintf("/v1/chains/%s/addresses/%s/transactions", AvalancheCChainID, address)
	if err := c.get(path, q, &resp); err != nil {
		return nil, "", err
	}

	var transfers []AssetTransfer
	for _, entry := range resp.Transactions {
		tx := entry.NativeTransaction
		ts := time.Unix(tx.BlockTimestamp, 0).UTC().Format(time.RFC3339)
		transfers = append(transfers, AssetTransfer{
			Hash:     tx.TxHash,
			BlockNum: tx.BlockNumber,
			UniqueID: tx.TxHash,
			From:     tx.From.Address,
			To:       tx.To.Address,
			Value:    formatFloatBalance(tx.Value, 18),
			Asset:    "AVAX",
			Category: "external",
			Metadata: &TransferMetadataBlock{BlockTimestamp: ts},
		})
	}

	return transfers, resp.NextPageToken, nil
}

// safePrefix returns a short prefix of an address for logging without leaking
// the full value.
func safePrefix(s string) string {
	if len(s) <= 10 {
		return s
	}
	return s[:10]
}

// formatFloatBalance converts a raw integer balance string to a float64-as-string
// human-readable value, reusing the existing formatTokenBalance helper.
func formatFloatBalance(raw string, decimals int) float64 {
	human := formatTokenBalance(raw, decimals)
	human = strings.TrimSpace(human)
	f, err := strconv.ParseFloat(human, 64)
	if err != nil {
		return 0
	}
	return f
}
