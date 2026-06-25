// Package swap provides DEX aggregation for token swaps
// Supports multiple DEX aggregators that users can choose from
package swap

import (
	"context"
	"fmt"
	"log"
	"math/big"
	"sync"

	"github.com/arcsignio/arcsign/src/swap/kyberswap"
	"github.com/arcsignio/arcsign/src/swap/openocean"
)

// Provider represents a DEX aggregator provider
type Provider string

const (
	ProviderOpenOcean Provider = "openocean"
	ProviderKyberSwap Provider = "kyberswap"
	// Future providers:
	// ProviderParaSwap  Provider = "paraswap"
	// Provider0x        Provider = "0x"
)

// ProviderInfo contains information about a DEX provider
type ProviderInfo struct {
	ID          Provider `json:"id"`
	Name        string   `json:"name"`
	Description string   `json:"description"`
	LogoURL     string   `json:"logoUrl"`
	Website     string   `json:"website"`
	RequiresKey bool     `json:"requiresKey"` // Whether API key is required
}

// AvailableProviders returns list of all supported DEX providers
func AvailableProviders() []ProviderInfo {
	return []ProviderInfo{
		{
			ID:          ProviderOpenOcean,
			Name:        "OpenOcean",
			Description: "Cross-chain DEX aggregator with best rates",
			LogoURL:     "https://openocean.finance/favicon.ico",
			Website:     "https://openocean.finance",
			RequiresKey: false,
		},
		{
			ID:          ProviderKyberSwap,
			Name:        "KyberSwap",
			Description: "Multi-chain DEX aggregator by Kyber Network",
			LogoURL:     "https://kyberswap.com/favicon.ico",
			Website:     "https://kyberswap.com",
			RequiresKey: false,
		},
	}
}

// Aggregator provides a unified interface for multiple DEX aggregators
type Aggregator struct {
	openoceanClient *openocean.Client
	kyberswapClient *kyberswap.Client
	defaultProvider Provider
}

// Config for initializing the aggregator
type Config struct {
	DefaultProvider Provider // Default provider to use
}

// NewAggregator creates a new swap aggregator with all providers
func NewAggregator(cfg *Config) *Aggregator {
	defaultProvider := ProviderOpenOcean
	if cfg != nil && cfg.DefaultProvider != "" {
		defaultProvider = cfg.DefaultProvider
	}

	return &Aggregator{
		openoceanClient: openocean.NewClient(),
		kyberswapClient: kyberswap.NewClient(),
		defaultProvider: defaultProvider,
	}
}

// FeeConfig for referrer fee collection
type FeeConfig struct {
	ReferrerAddress string  // EVM address to receive fees
	FeeRate         float64 // Fee percentage (0.1 = 0.1%)
}

// QuoteParams for requesting a swap quote
type QuoteParams struct {
	Provider         Provider   // Which DEX provider to use (optional, uses default if empty)
	ChainID          int        // Chain ID
	FromTokenAddress string     // Source token address
	ToTokenAddress   string     // Destination token address
	Amount           *big.Int   // Amount in smallest unit
	FromAddress      string     // User's wallet address
	Slippage         float64    // Slippage tolerance (e.g., 0.5 for 0.5%)
	GasPrice         *big.Int   // Gas price in wei
	IsPro            bool       // Pro user — best route, no fee
	Fee              *FeeConfig // Non-nil for Free users
}

// SwapQuote represents a standardized swap quote
type SwapQuote struct {
	Provider        Provider  `json:"provider"` // Which provider this quote is from
	Dex             string    `json:"dex"`
	FromToken       TokenInfo `json:"fromToken"`
	ToToken         TokenInfo `json:"toToken"`
	FromAmount      string    `json:"fromAmount"`
	ToAmount        string    `json:"toAmount"`
	ToAmountMin     string    `json:"toAmountMin"`
	ExchangeRate    string    `json:"exchangeRate"`
	PriceImpact     string    `json:"priceImpact"`
	EstimatedGas    string    `json:"estimatedGas"`
	GasCostETH      string    `json:"gasCostETH"`
	Route           []string  `json:"route"`
	Protocols       []string  `json:"protocols"`
	ValidUntil      int64     `json:"validUntil"`
	NeedsApproval   bool      `json:"needsApproval"`
	ApprovalAddress string    `json:"approvalAddress"`
	RouteType       string    `json:"routeType"` // "best" | "standard" | "standard-fallback"
	FeeRate         string    `json:"feeRate"`    // "0" | "0.1" (percentage)
	FeeAmount       string    `json:"feeAmount"`  // Actual fee in input token units
}

// TokenInfo represents a token with its metadata
type TokenInfo struct {
	Symbol   string `json:"symbol"`
	Name     string `json:"name"`
	Address  string `json:"address"`
	Decimals int    `json:"decimals"`
	LogoURI  string `json:"logoURI"`
}

// TxData represents transaction data for signing
type TxData struct {
	From     string `json:"from"`
	To       string `json:"to"`
	Data     string `json:"data"`
	Value    string `json:"value"`
	Gas      string `json:"gas"`
	GasPrice string `json:"gasPrice"`
}

// SwapTransaction is the complete transaction ready for signing
type SwapTransaction struct {
	Quote   SwapQuote `json:"quote"`
	TxData  TxData    `json:"txData"`
	ChainID int       `json:"chainId"`
}

// ApproveResponse represents the approval transaction data
type ApproveResponse struct {
	To    string `json:"to"`
	Value string `json:"value"`
	Data  string `json:"data"`
}

// getProvider returns the provider to use, falling back to default
func (a *Aggregator) getProvider(p Provider) Provider {
	if p == "" {
		return a.defaultProvider
	}
	return p
}

// GetQuote fetches a swap quote from the specified provider
// Pro users get best route (parallel query), Free users get OpenOcean with fee
func (a *Aggregator) GetQuote(ctx context.Context, params *QuoteParams) (*SwapQuote, error) {
	if params.IsPro {
		return a.getBestRouteQuote(ctx, params)
	}

	// Free user: OpenOcean (with referrer fee), fall back to KyberSwap on failure.
	ooQuote, ooErr := a.getOpenOceanQuote(ctx, params)
	if ooErr == nil {
		ooQuote.RouteType = "standard"
		if params.Fee != nil {
			ooQuote.FeeRate = fmt.Sprintf("%.1f", params.Fee.FeeRate)
			ooQuote.FeeAmount = a.calculateFeeAmount(ooQuote.FromAmount, params.Fee.FeeRate)
		} else {
			ooQuote.FeeRate = "0"
			ooQuote.FeeAmount = "0"
		}
		return ooQuote, nil
	}
	return resolveFreeQuote(nil, ooErr, kyberswap.IsChainSupported(params.ChainID), func() (*SwapQuote, error) {
		return a.getKyberSwapQuote(ctx, params)
	})
}

// resolveFreeQuote decides the free-user quote: prefer the OpenOcean result;
// on OpenOcean failure fall back to KyberSwap (which loses the OpenOcean-only
// referrer fee — a quote with no fee beats no quote). ksSupported gates whether
// the fallback is attempted; getKS is called lazily only when needed.
func resolveFreeQuote(ooQuote *SwapQuote, ooErr error, ksSupported bool, getKS func() (*SwapQuote, error)) (*SwapQuote, error) {
	if ooErr == nil && ooQuote != nil {
		return ooQuote, nil
	}
	if !ksSupported {
		return nil, fmt.Errorf("openocean failed and kyberswap not available on this chain: %w", ooErr)
	}
	log.Printf("[DIAG swap] OpenOcean quote failed, falling back to KyberSwap: %v", ooErr)
	ksQuote, ksErr := getKS()
	if ksErr != nil {
		return nil, fmt.Errorf("both providers failed: openocean: %w; kyberswap: %v", ooErr, ksErr)
	}
	ksQuote.Provider = ProviderKyberSwap
	ksQuote.RouteType = "standard-fallback"
	ksQuote.FeeRate = "0"
	ksQuote.FeeAmount = "0"
	return ksQuote, nil
}

// BuildSwapTransaction builds a complete swap transaction from the specified provider
// Pro users get best route (parallel query), Free users get OpenOcean with fee
func (a *Aggregator) BuildSwapTransaction(ctx context.Context, params *QuoteParams) (*SwapTransaction, error) {
	if params.IsPro {
		return a.buildBestRouteTransaction(ctx, params)
	}

	// Free user: OpenOcean only, with referrer fee
	tx, err := a.buildOpenOceanTransaction(ctx, params)
	if err != nil {
		return nil, err
	}
	tx.Quote.RouteType = "standard"
	if params.Fee != nil {
		tx.Quote.FeeRate = fmt.Sprintf("%.1f", params.Fee.FeeRate)
		tx.Quote.FeeAmount = a.calculateFeeAmount(tx.Quote.FromAmount, params.Fee.FeeRate)
	} else {
		tx.Quote.FeeRate = "0"
		tx.Quote.FeeAmount = "0"
	}
	return tx, nil
}

// getBestRouteQuote queries both providers in parallel and returns the best quote
func (a *Aggregator) getBestRouteQuote(ctx context.Context, params *QuoteParams) (*SwapQuote, error) {
	type quoteResult struct {
		quote *SwapQuote
		err   error
	}

	var (
		ooResult, ksResult quoteResult
		wg                 sync.WaitGroup
	)

	// Query OpenOcean
	if openocean.IsChainSupported(params.ChainID) {
		wg.Add(1)
		go func() {
			defer wg.Done()
			q, err := a.getOpenOceanQuote(ctx, params)
			ooResult = quoteResult{quote: q, err: err}
		}()
	}

	// Query KyberSwap
	if kyberswap.IsChainSupported(params.ChainID) {
		wg.Add(1)
		go func() {
			defer wg.Done()
			q, err := a.getKyberSwapQuote(ctx, params)
			ksResult = quoteResult{quote: q, err: err}
		}()
	}

	wg.Wait()

	// Pick best quote by toAmount
	var best *SwapQuote
	if ooResult.err == nil && ooResult.quote != nil {
		best = ooResult.quote
	}
	if ksResult.err == nil && ksResult.quote != nil {
		if best == nil {
			best = ksResult.quote
		} else {
			// Compare toAmount — pick the larger one
			bestAmt := new(big.Int)
			bestAmt.SetString(best.ToAmount, 10)
			ksAmt := new(big.Int)
			ksAmt.SetString(ksResult.quote.ToAmount, 10)
			if ksAmt.Cmp(bestAmt) > 0 {
				best = ksResult.quote
			}
		}
	}

	if best == nil {
		// Both providers failed (or neither supported the chain). Surface BOTH
		// errors instead of discarding KyberSwap's — the previous code returned
		// only ooResult.err, and when a chain was supported by neither provider
		// both errs were nil, yielding a confusing nil-error/nil-quote return.
		ooSupported := openocean.IsChainSupported(params.ChainID)
		ksSupported := kyberswap.IsChainSupported(params.ChainID)
		log.Printf("[DIAG swap] GetBestRoute no quote: chain=%d from=%s to=%s amount=%s | OpenOcean(supported=%v) err=%v | KyberSwap(supported=%v) err=%v",
			params.ChainID, params.FromTokenAddress, params.ToTokenAddress, params.Amount,
			ooSupported, ooResult.err, ksSupported, ksResult.err)
		switch {
		case ooResult.err != nil && ksResult.err != nil:
			return nil, fmt.Errorf("both providers failed: openocean: %w; kyberswap: %v", ooResult.err, ksResult.err)
		case ooResult.err != nil:
			return nil, ooResult.err
		case ksResult.err != nil:
			return nil, ksResult.err
		default:
			return nil, fmt.Errorf("no quote available for chain %d (OpenOcean supported=%v, KyberSwap supported=%v)", params.ChainID, ooSupported, ksSupported)
		}
	}

	best.RouteType = "best"
	best.FeeRate = "0"
	best.FeeAmount = "0"
	return best, nil
}

// buildBestRouteTransaction queries both providers, picks the best, and builds tx
func (a *Aggregator) buildBestRouteTransaction(ctx context.Context, params *QuoteParams) (*SwapTransaction, error) {
	type txResult struct {
		tx  *SwapTransaction
		err error
	}

	var (
		ooResult, ksResult txResult
		wg                 sync.WaitGroup
	)

	// Build from OpenOcean
	if openocean.IsChainSupported(params.ChainID) {
		wg.Add(1)
		go func() {
			defer wg.Done()
			t, err := a.buildOpenOceanTransaction(ctx, params)
			ooResult = txResult{tx: t, err: err}
		}()
	}

	// Build from KyberSwap
	if kyberswap.IsChainSupported(params.ChainID) {
		wg.Add(1)
		go func() {
			defer wg.Done()
			t, err := a.buildKyberSwapTransaction(ctx, params)
			ksResult = txResult{tx: t, err: err}
		}()
	}

	wg.Wait()

	// Pick best by toAmount
	var best *SwapTransaction
	if ooResult.err == nil && ooResult.tx != nil {
		best = ooResult.tx
	}
	if ksResult.err == nil && ksResult.tx != nil {
		if best == nil {
			best = ksResult.tx
		} else {
			bestAmt := new(big.Int)
			bestAmt.SetString(best.Quote.ToAmount, 10)
			ksAmt := new(big.Int)
			ksAmt.SetString(ksResult.tx.Quote.ToAmount, 10)
			if ksAmt.Cmp(bestAmt) > 0 {
				best = ksResult.tx
			}
		}
	}

	if best == nil {
		if ooResult.err != nil {
			return nil, ooResult.err
		}
		return nil, ksResult.err
	}

	best.Quote.RouteType = "best"
	best.Quote.FeeRate = "0"
	best.Quote.FeeAmount = "0"
	return best, nil
}

// calculateFeeAmount computes the fee amount from input token amount and fee rate
func (a *Aggregator) calculateFeeAmount(fromAmount string, feeRate float64) string {
	amt := new(big.Int)
	if _, ok := amt.SetString(fromAmount, 10); !ok {
		return "0"
	}
	// feeAmount = fromAmount * feeRate / 100
	feeNumerator := new(big.Int).Mul(amt, big.NewInt(int64(feeRate*1000)))
	feeAmount := new(big.Int).Div(feeNumerator, big.NewInt(100000))
	return feeAmount.String()
}

// GetApprovalTransaction gets the approval transaction for a token
func (a *Aggregator) GetApprovalTransaction(ctx context.Context, provider Provider, chainID int, tokenAddress string, amount *big.Int) (*ApproveResponse, error) {
	p := a.getProvider(provider)

	switch p {
	case ProviderOpenOcean:
		if !openocean.IsChainSupported(chainID) {
			return nil, fmt.Errorf("chain %d is not supported by OpenOcean", chainID)
		}
		resp, err := a.openoceanClient.GetApproveTransaction(ctx, chainID, tokenAddress, amount)
		if err != nil {
			return nil, err
		}
		return &ApproveResponse{To: resp.To, Value: resp.Value, Data: resp.Data}, nil

	case ProviderKyberSwap:
		if !kyberswap.IsChainSupported(chainID) {
			return nil, fmt.Errorf("chain %d is not supported by KyberSwap", chainID)
		}
		// KyberSwap uses standard ERC20 approve
		routerAddress := kyberswap.GetRouterAddress(chainID)
		amountHex := fmt.Sprintf("%064x", amount)
		data := "0x095ea7b3" + fmt.Sprintf("%064s", routerAddress[2:]) + amountHex
		return &ApproveResponse{To: tokenAddress, Value: "0", Data: data}, nil

	default:
		return nil, fmt.Errorf("unsupported provider: %s", p)
	}
}

// CheckAllowance checks if sufficient allowance exists
func (a *Aggregator) CheckAllowance(ctx context.Context, provider Provider, chainID int, tokenAddress, walletAddress string) (*big.Int, error) {
	p := a.getProvider(provider)

	switch p {
	case ProviderOpenOcean:
		if !openocean.IsChainSupported(chainID) {
			return nil, fmt.Errorf("chain %d is not supported by OpenOcean", chainID)
		}
		return a.openoceanClient.GetAllowance(ctx, chainID, tokenAddress, walletAddress)

	case ProviderKyberSwap:
		if !kyberswap.IsChainSupported(chainID) {
			return nil, fmt.Errorf("chain %d is not supported by KyberSwap", chainID)
		}
		return a.kyberswapClient.CheckAllowance(ctx, chainID, tokenAddress, walletAddress)

	default:
		return nil, fmt.Errorf("unsupported provider: %s", p)
	}
}

// GetTokens fetches all available tokens for swap on a chain
func (a *Aggregator) GetTokens(ctx context.Context, provider Provider, chainID int) ([]TokenInfo, error) {
	p := a.getProvider(provider)

	switch p {
	case ProviderOpenOcean:
		if !openocean.IsChainSupported(chainID) {
			return nil, fmt.Errorf("chain %d is not supported by OpenOcean", chainID)
		}
		tokens, err := a.openoceanClient.GetTokenList(ctx, chainID)
		if err != nil {
			return nil, err
		}
		result := make([]TokenInfo, len(tokens))
		for i, t := range tokens {
			result[i] = TokenInfo{
				Symbol:   t.Symbol,
				Name:     t.Name,
				Address:  t.Address,
				Decimals: t.Decimals,
				LogoURI:  t.LogoURI,
			}
		}
		return result, nil

	case ProviderKyberSwap:
		if !kyberswap.IsChainSupported(chainID) {
			return nil, fmt.Errorf("chain %d is not supported by KyberSwap", chainID)
		}
		tokens, err := a.kyberswapClient.GetTokenList(ctx, chainID)
		if err != nil {
			// Fallback to OpenOcean token list if KyberSwap Settings API fails
			if openocean.IsChainSupported(chainID) {
				ooTokens, ooErr := a.openoceanClient.GetTokenList(ctx, chainID)
				if ooErr != nil {
					return nil, fmt.Errorf("KyberSwap token list failed: %w (OpenOcean fallback also failed: %v)", err, ooErr)
				}
				result := make([]TokenInfo, len(ooTokens))
				for i, t := range ooTokens {
					result[i] = TokenInfo{
						Symbol:   t.Symbol,
						Name:     t.Name,
						Address:  t.Address,
						Decimals: t.Decimals,
						LogoURI:  t.LogoURI,
					}
				}
				return result, nil
			}
			return nil, err
		}
		result := make([]TokenInfo, len(tokens))
		for i, t := range tokens {
			result[i] = TokenInfo{
				Symbol:   t.Symbol,
				Name:     t.Name,
				Address:  t.Address,
				Decimals: t.Decimals,
				LogoURI:  t.LogoURI,
			}
		}
		return result, nil

	default:
		return nil, fmt.Errorf("unsupported provider: %s", p)
	}
}

// IsProviderChainSupported checks if a provider supports a specific chain
func IsProviderChainSupported(provider Provider, chainID int) bool {
	switch provider {
	case ProviderOpenOcean:
		return openocean.IsChainSupported(chainID)
	case ProviderKyberSwap:
		return kyberswap.IsChainSupported(chainID)
	default:
		return false
	}
}

// GetSupportedChains returns chains supported by a provider
func GetSupportedChains(provider Provider) []int {
	switch provider {
	case ProviderOpenOcean:
		chains := make([]int, 0, len(openocean.SupportedChains))
		for chainID := range openocean.SupportedChains {
			chains = append(chains, chainID)
		}
		return chains
	case ProviderKyberSwap:
		chains := make([]int, 0, len(kyberswap.SupportedChains))
		for chainID := range kyberswap.SupportedChains {
			chains = append(chains, chainID)
		}
		return chains
	default:
		return nil
	}
}

// IsNativeToken checks if the address is a native token
func IsNativeToken(address string) bool {
	return address == openocean.NativeTokenAddress ||
		address == kyberswap.NativeTokenAddress ||
		address == "" ||
		address == "0x0000000000000000000000000000000000000000"
}

// GetNativeTokenAddress returns the standard native token address
func GetNativeTokenAddress() string {
	return openocean.NativeTokenAddress // Same for all providers
}

// SupportedChains returns the list of all supported chain IDs across all providers
func SupportedChains() []int {
	chainSet := make(map[int]bool)

	for chainID := range openocean.SupportedChains {
		chainSet[chainID] = true
	}
	for chainID := range kyberswap.SupportedChains {
		chainSet[chainID] = true
	}

	chains := make([]int, 0, len(chainSet))
	for chainID := range chainSet {
		chains = append(chains, chainID)
	}
	return chains
}

// IsChainSupported checks if a chain is supported by any provider
func IsChainSupported(chainID int) bool {
	return openocean.IsChainSupported(chainID) || kyberswap.IsChainSupported(chainID)
}

// ========== OpenOcean Implementation ==========

func (a *Aggregator) getOpenOceanQuote(ctx context.Context, params *QuoteParams) (*SwapQuote, error) {
	if !openocean.IsChainSupported(params.ChainID) {
		return nil, fmt.Errorf("chain %d is not supported by OpenOcean", params.ChainID)
	}

	req := &openocean.SwapRequest{
		FromTokenAddress: params.FromTokenAddress,
		ToTokenAddress:   params.ToTokenAddress,
		Amount:           params.Amount,
		FromAddress:      params.FromAddress,
		Slippage:         params.Slippage,
		ChainID:          params.ChainID,
		GasPrice:         params.GasPrice,
	}

	// Pass referrer fee config for Free users
	if params.Fee != nil {
		req.ReferrerAddress = params.Fee.ReferrerAddress
		req.ReferrerFee = params.Fee.FeeRate
	}

	quote, err := a.openoceanClient.BuildSwapQuote(ctx, req)
	if err != nil {
		return nil, err
	}

	return convertOpenOceanQuote(quote), nil
}

func (a *Aggregator) buildOpenOceanTransaction(ctx context.Context, params *QuoteParams) (*SwapTransaction, error) {
	if !openocean.IsChainSupported(params.ChainID) {
		return nil, fmt.Errorf("chain %d is not supported by OpenOcean", params.ChainID)
	}

	req := &openocean.SwapRequest{
		FromTokenAddress: params.FromTokenAddress,
		ToTokenAddress:   params.ToTokenAddress,
		Amount:           params.Amount,
		FromAddress:      params.FromAddress,
		Slippage:         params.Slippage,
		ChainID:          params.ChainID,
		GasPrice:         params.GasPrice,
		DisableEstimate:  true,
	}

	// Pass referrer fee config for Free users
	if params.Fee != nil {
		req.ReferrerAddress = params.Fee.ReferrerAddress
		req.ReferrerFee = params.Fee.FeeRate
	}

	tx, err := a.openoceanClient.BuildSwapTransaction(ctx, req)
	if err != nil {
		return nil, err
	}

	return convertOpenOceanSwapTransaction(tx), nil
}

func convertOpenOceanQuote(q *openocean.SwapQuote) *SwapQuote {
	return &SwapQuote{
		Provider: ProviderOpenOcean,
		Dex:      q.Dex,
		FromToken: TokenInfo{
			Symbol:   q.FromToken.Symbol,
			Name:     q.FromToken.Name,
			Address:  q.FromToken.Address,
			Decimals: q.FromToken.Decimals,
			LogoURI:  q.FromToken.LogoURI,
		},
		ToToken: TokenInfo{
			Symbol:   q.ToToken.Symbol,
			Name:     q.ToToken.Name,
			Address:  q.ToToken.Address,
			Decimals: q.ToToken.Decimals,
			LogoURI:  q.ToToken.LogoURI,
		},
		FromAmount:      q.FromAmount,
		ToAmount:        q.ToAmount,
		ToAmountMin:     q.ToAmountMin,
		ExchangeRate:    q.ExchangeRate,
		PriceImpact:     q.PriceImpact,
		EstimatedGas:    q.EstimatedGas,
		GasCostETH:      q.GasCostETH,
		Route:           q.Route,
		Protocols:       q.Protocols,
		ValidUntil:      q.ValidUntil,
		NeedsApproval:   q.NeedsApproval,
		ApprovalAddress: q.ApprovalAddress,
	}
}

func convertOpenOceanSwapTransaction(tx *openocean.SwapTransaction) *SwapTransaction {
	return &SwapTransaction{
		Quote: *convertOpenOceanQuote(&tx.Quote),
		TxData: TxData{
			From:     tx.TxData.From,
			To:       tx.TxData.To,
			Data:     tx.TxData.Data,
			Value:    tx.TxData.Value,
			Gas:      tx.TxData.Gas,
			GasPrice: tx.TxData.GasPrice,
		},
		ChainID: tx.ChainID,
	}
}

// ========== KyberSwap Implementation ==========

func (a *Aggregator) getKyberSwapQuote(ctx context.Context, params *QuoteParams) (*SwapQuote, error) {
	if !kyberswap.IsChainSupported(params.ChainID) {
		return nil, fmt.Errorf("chain %d is not supported by KyberSwap", params.ChainID)
	}

	quote, err := a.kyberswapClient.BuildSwapQuote(ctx, params.ChainID, params.FromTokenAddress, params.ToTokenAddress, params.Amount, params.FromAddress, params.Slippage)
	if err != nil {
		return nil, err
	}

	return convertKyberSwapQuote(quote), nil
}

func (a *Aggregator) buildKyberSwapTransaction(ctx context.Context, params *QuoteParams) (*SwapTransaction, error) {
	if !kyberswap.IsChainSupported(params.ChainID) {
		return nil, fmt.Errorf("chain %d is not supported by KyberSwap", params.ChainID)
	}

	tx, err := a.kyberswapClient.BuildSwapTransaction(ctx, params.ChainID, params.FromTokenAddress, params.ToTokenAddress, params.Amount, params.FromAddress, params.Slippage)
	if err != nil {
		return nil, err
	}

	return convertKyberSwapTransaction(tx), nil
}

func convertKyberSwapQuote(q *kyberswap.SwapQuote) *SwapQuote {
	return &SwapQuote{
		Provider: ProviderKyberSwap,
		Dex:      q.Dex,
		FromToken: TokenInfo{
			Symbol:  q.FromToken.Symbol,
			Address: q.FromToken.Address,
		},
		ToToken: TokenInfo{
			Symbol:  q.ToToken.Symbol,
			Address: q.ToToken.Address,
		},
		FromAmount:      q.FromAmount,
		ToAmount:        q.ToAmount,
		ToAmountMin:     q.ToAmountMin,
		ExchangeRate:    q.ExchangeRate,
		PriceImpact:     q.PriceImpact,
		EstimatedGas:    q.EstimatedGas,
		GasCostETH:      q.GasCostETH,
		Route:           q.Route,
		Protocols:       q.Protocols,
		ValidUntil:      q.ValidUntil,
		NeedsApproval:   q.NeedsApproval,
		ApprovalAddress: q.ApprovalAddress,
	}
}

func convertKyberSwapTransaction(tx *kyberswap.SwapTransaction) *SwapTransaction {
	return &SwapTransaction{
		Quote: *convertKyberSwapQuote(&tx.Quote),
		TxData: TxData{
			From:     tx.TxData.From,
			To:       tx.TxData.To,
			Data:     tx.TxData.Data,
			Value:    tx.TxData.Value,
			Gas:      tx.TxData.Gas,
			GasPrice: tx.TxData.GasPrice,
		},
		ChainID: tx.ChainID,
	}
}
