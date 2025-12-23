// Package swap provides DEX aggregation for token swaps
package swap

import (
	"context"
	"fmt"
	"math/big"

	"github.com/yourusername/arcsign/src/swap/oneinch"
)

// Aggregator provides a unified interface for multiple DEX aggregators
type Aggregator struct {
	oneinchClient *oneinch.Client
	// Future: add more DEX clients here
	// zeroxClient   *zerox.Client
	// uniswapClient *uniswap.Client
}

// Config for initializing the aggregator
type Config struct {
	OneInchAPIKey string
	// Future: more API keys
}

// NewAggregator creates a new swap aggregator
func NewAggregator(cfg *Config) *Aggregator {
	return &Aggregator{
		oneinchClient: oneinch.NewClient(cfg.OneInchAPIKey),
	}
}

// QuoteParams for requesting a swap quote
type QuoteParams struct {
	ChainID          int      // Chain ID
	FromTokenAddress string   // Source token address
	ToTokenAddress   string   // Destination token address
	Amount           *big.Int // Amount in smallest unit
	FromAddress      string   // User's wallet address
	Slippage         float64  // Slippage tolerance (e.g., 0.5 for 0.5%)
}

// GetQuote fetches a swap quote from 1inch
func (a *Aggregator) GetQuote(ctx context.Context, params *QuoteParams, gasPrice *big.Int) (*oneinch.SwapQuote, error) {
	if !oneinch.IsChainSupported(params.ChainID) {
		return nil, fmt.Errorf("chain %d is not supported for swap", params.ChainID)
	}

	req := &oneinch.SwapRequest{
		FromTokenAddress: params.FromTokenAddress,
		ToTokenAddress:   params.ToTokenAddress,
		Amount:           params.Amount,
		FromAddress:      params.FromAddress,
		Slippage:         params.Slippage,
		ChainID:          params.ChainID,
	}

	return a.oneinchClient.BuildSwapQuote(ctx, req, gasPrice)
}

// BuildSwapTransaction builds a complete swap transaction
func (a *Aggregator) BuildSwapTransaction(ctx context.Context, params *QuoteParams, gasPrice *big.Int) (*oneinch.SwapTransaction, error) {
	if !oneinch.IsChainSupported(params.ChainID) {
		return nil, fmt.Errorf("chain %d is not supported for swap", params.ChainID)
	}

	req := &oneinch.SwapRequest{
		FromTokenAddress: params.FromTokenAddress,
		ToTokenAddress:   params.ToTokenAddress,
		Amount:           params.Amount,
		FromAddress:      params.FromAddress,
		Slippage:         params.Slippage,
		ChainID:          params.ChainID,
		DisableEstimate:  true, // We handle validation ourselves
	}

	return a.oneinchClient.BuildSwapTransaction(ctx, req, gasPrice)
}

// GetApprovalTransaction gets the approval transaction for a token
func (a *Aggregator) GetApprovalTransaction(ctx context.Context, chainID int, tokenAddress string, amount *big.Int) (*oneinch.ApproveResponse, error) {
	if !oneinch.IsChainSupported(chainID) {
		return nil, fmt.Errorf("chain %d is not supported for swap", chainID)
	}

	return a.oneinchClient.GetApproveTransaction(ctx, &oneinch.ApproveRequest{
		TokenAddress: tokenAddress,
		Amount:       amount,
		ChainID:      chainID,
	})
}

// CheckAllowance checks if sufficient allowance exists
func (a *Aggregator) CheckAllowance(ctx context.Context, chainID int, tokenAddress, walletAddress string) (*big.Int, error) {
	if !oneinch.IsChainSupported(chainID) {
		return nil, fmt.Errorf("chain %d is not supported for swap", chainID)
	}

	return a.oneinchClient.GetAllowance(ctx, &oneinch.AllowanceRequest{
		TokenAddress:  tokenAddress,
		WalletAddress: walletAddress,
		ChainID:       chainID,
	})
}

// IsNativeToken checks if the address is a native token
func IsNativeToken(address string) bool {
	return address == oneinch.NativeTokenAddress ||
		address == "" ||
		address == "0x0000000000000000000000000000000000000000"
}

// GetNativeTokenAddress returns the standard native token address for 1inch
func GetNativeTokenAddress() string {
	return oneinch.NativeTokenAddress
}

// GetRouterAddress returns the 1inch router address for a chain
func GetRouterAddress(chainID int) string {
	return oneinch.GetRouterAddress(chainID)
}

// SupportedChains returns the list of supported chain IDs
func SupportedChains() []int {
	chains := make([]int, 0, len(oneinch.SupportedChains))
	for chainID := range oneinch.SupportedChains {
		chains = append(chains, chainID)
	}
	return chains
}

// GetTokens fetches all available tokens for swap on a chain from 1inch API
func (a *Aggregator) GetTokens(ctx context.Context, chainID int) ([]oneinch.TokenInfo, error) {
	if !oneinch.IsChainSupported(chainID) {
		return nil, fmt.Errorf("chain %d is not supported for swap", chainID)
	}

	return a.oneinchClient.GetTokens(ctx, chainID)
}
