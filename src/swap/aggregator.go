// Package swap provides DEX aggregation for token swaps
// Supports multiple DEX aggregators that users can choose from
package swap

import (
	"context"
	"fmt"
	"math/big"

	"github.com/yourusername/arcsign/src/swap/kyberswap"
	"github.com/yourusername/arcsign/src/swap/openocean"
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

// QuoteParams for requesting a swap quote
type QuoteParams struct {
	Provider         Provider // Which DEX provider to use (optional, uses default if empty)
	ChainID          int      // Chain ID
	FromTokenAddress string   // Source token address
	ToTokenAddress   string   // Destination token address
	Amount           *big.Int // Amount in smallest unit
	FromAddress      string   // User's wallet address
	Slippage         float64  // Slippage tolerance (e.g., 0.5 for 0.5%)
	GasPrice         *big.Int // Gas price in wei
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
func (a *Aggregator) GetQuote(ctx context.Context, params *QuoteParams) (*SwapQuote, error) {
	provider := a.getProvider(params.Provider)

	switch provider {
	case ProviderOpenOcean:
		return a.getOpenOceanQuote(ctx, params)
	case ProviderKyberSwap:
		return a.getKyberSwapQuote(ctx, params)
	default:
		return nil, fmt.Errorf("unsupported provider: %s", provider)
	}
}

// BuildSwapTransaction builds a complete swap transaction from the specified provider
func (a *Aggregator) BuildSwapTransaction(ctx context.Context, params *QuoteParams) (*SwapTransaction, error) {
	provider := a.getProvider(params.Provider)

	switch provider {
	case ProviderOpenOcean:
		return a.buildOpenOceanTransaction(ctx, params)
	case ProviderKyberSwap:
		return a.buildKyberSwapTransaction(ctx, params)
	default:
		return nil, fmt.Errorf("unsupported provider: %s", provider)
	}
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
		// KyberSwap doesn't have allowance API, return max uint256
		maxUint256 := new(big.Int)
		maxUint256.SetString("115792089237316195423570985008687907853269984665640564039457584007913129639935", 10)
		return maxUint256, nil

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
		// KyberSwap doesn't have token list API
		return []TokenInfo{}, nil

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
