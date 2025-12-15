/**
 * Alchemy API types for token balance queries
 * API: POST https://api.g.alchemy.com/data/v1/:apiKey/assets/tokens/by-address
 */

package provider

import "time"

// AlchemyTokenBalanceRequest represents the request to Alchemy's token balance API
type AlchemyTokenBalanceRequest struct {
	Addresses []AlchemyAddressWithNetworks `json:"addresses"`
}

// AlchemyAddressWithNetworks represents an address with multiple networks to query
type AlchemyAddressWithNetworks struct {
	Address  string   `json:"address"`
	Networks []string `json:"networks"`
}

// AlchemyTokenBalanceResponse represents the response from Alchemy's token balance API
type AlchemyTokenBalanceResponse struct {
	Data AlchemyTokenData `json:"data"`
}

// AlchemyTokenData contains the token data
type AlchemyTokenData struct {
	Tokens  []AlchemyToken `json:"tokens"`
	PageKey string         `json:"pageKey,omitempty"`
}

// AlchemyToken represents a single token balance entry
type AlchemyToken struct {
	Address       string                `json:"address"`       // Wallet address
	Network       string                `json:"network"`       // Network identifier (e.g., "eth-mainnet")
	TokenAddress  string                `json:"tokenAddress"`  // Token contract address (empty for native tokens)
	TokenBalance  string                `json:"tokenBalance"`  // Raw balance (with decimals)
	TokenMetadata AlchemyTokenMetadata  `json:"tokenMetadata"`
	TokenPrices   []AlchemyTokenPrice   `json:"tokenPrices"`
	Error         string                `json:"error,omitempty"`
}

// AlchemyTokenMetadata contains token information
type AlchemyTokenMetadata struct {
	Decimals int    `json:"decimals"`
	Logo     string `json:"logo"`
	Name     string `json:"name"`
	Symbol   string `json:"symbol"`
}

// AlchemyTokenPrice contains price information
type AlchemyTokenPrice struct {
	Currency      string    `json:"currency"`      // e.g., "usd"
	Value         string    `json:"value"`         // e.g., "4608.2208671202"
	LastUpdatedAt time.Time `json:"lastUpdatedAt"`
}

// SimplifiedTokenBalance is our simplified format for frontend
type SimplifiedTokenBalance struct {
	Address       string  `json:"address"`
	Network       string  `json:"network"`
	NetworkLabel  string  `json:"networkLabel"` // Human-readable: "Ethereum", "Polygon"
	TokenAddress  string  `json:"tokenAddress"`
	TokenSymbol   string  `json:"tokenSymbol"`
	TokenName     string  `json:"tokenName"`
	TokenLogo     string  `json:"tokenLogo"`
	Balance       string  `json:"balance"`     // Human-readable balance (e.g., "1000.50")
	RawBalance    string  `json:"rawBalance"`  // Raw balance string
	Decimals      int     `json:"decimals"`
	USDValue      float64 `json:"usdValue"`    // USD value (price * balance)
	PriceUSD      float64 `json:"priceUsd"`    // Current USD price
	Error         string  `json:"error,omitempty"`
}

// GetTokenBalancesInput represents the input for GetTokenBalances FFI function
type GetTokenBalancesInput struct {
	WalletID   string `json:"walletId"`
	Password   string `json:"password"`
	USBPath    string `json:"usbPath"`
	AppPassword string `json:"appPassword"` // For reading provider config
}

// GetTokenBalancesOutput represents the output
type GetTokenBalancesOutput struct {
	Tokens     []SimplifiedTokenBalance `json:"tokens"`
	TotalUSD   float64                  `json:"totalUsd"`
	AddressCount int                    `json:"addressCount"`
	NetworkCount int                    `json:"networkCount"`
}
