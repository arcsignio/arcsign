/**
 * Alchemy API types for token balance and NFT queries
 * Token API: POST https://api.g.alchemy.com/data/v1/:apiKey/assets/tokens/by-address
 * NFT API:   POST https://api.g.alchemy.com/data/v1/:apiKey/assets/nfts/by-address
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

// ================================================================================
// NFT Types
// ================================================================================

// AlchemyNFTRequest represents the request to Alchemy's NFT balance API
type AlchemyNFTRequest struct {
	Addresses []AlchemyAddressWithNetworks `json:"addresses"`
}

// AlchemyNFTResponse represents the response from Alchemy's NFT balance API
type AlchemyNFTResponse struct {
	Data AlchemyNFTData `json:"data"`
}

// AlchemyNFTData contains the NFT data
type AlchemyNFTData struct {
	NFTs    []AlchemyNFT `json:"nfts"`
	PageKey string       `json:"pageKey,omitempty"`
}

// AlchemyNFT represents a single NFT entry from Alchemy
type AlchemyNFT struct {
	Address         string           `json:"address"`         // Wallet address
	Network         string           `json:"network"`         // Network identifier
	ContractAddress string           `json:"contractAddress"` // NFT contract address
	TokenID         string           `json:"tokenId"`         // Token ID within collection
	TokenType       string           `json:"tokenType"`       // "ERC721" or "ERC1155"
	Name            string           `json:"name"`            // NFT name
	Description     string           `json:"description"`     // NFT description
	Image           AlchemyNFTImage  `json:"image"`           // Image URLs
	Collection      AlchemyNFTCollection `json:"collection"`  // Collection metadata
	Balance         string           `json:"balance"`         // Balance (usually "1" for ERC721)
}

// AlchemyNFTImage contains NFT image URLs
type AlchemyNFTImage struct {
	CachedURL    string `json:"cachedUrl"`    // Alchemy-cached image URL (preferred)
	ThumbnailURL string `json:"thumbnailUrl"` // Thumbnail version
	PNGOriginal  string `json:"pngUrl"`       // PNG version
	OriginalURL  string `json:"originalUrl"`  // Original image URL
}

// AlchemyNFTCollection contains NFT collection metadata
type AlchemyNFTCollection struct {
	Name          string `json:"name"`
	Slug          string `json:"slug"`
	ExternalURL   string `json:"externalUrl"`
	BannerImageURL string `json:"bannerImageUrl"`
}

// SimplifiedNFT is our simplified format for frontend
type SimplifiedNFT struct {
	Address         string `json:"address"`         // Owner wallet address
	Network         string `json:"network"`         // Internal Network ID
	NetworkLabel    string `json:"networkLabel"`     // Human-readable: "Ethereum"
	ContractAddress string `json:"contractAddress"`  // NFT contract
	TokenID         string `json:"tokenId"`          // Token ID
	TokenType       string `json:"tokenType"`        // "ERC721" or "ERC1155"
	Name            string `json:"name"`             // NFT name
	Description     string `json:"description"`      // NFT description
	ImageURL        string `json:"imageUrl"`         // Best available image URL
	ThumbnailURL    string `json:"thumbnailUrl"`     // Thumbnail URL
	CollectionName  string `json:"collectionName"`   // Collection name
	CollectionSlug  string `json:"collectionSlug"`   // Collection slug
	Balance         string `json:"balance"`          // Balance count
}

// GetNFTsInput represents the input for GetNFTs FFI function
type GetNFTsInput struct {
	WalletID     string `json:"walletId"`
	Password     string `json:"password"`
	USBPath      string `json:"usbPath"`
	SessionToken string `json:"sessionToken"`
	AppPassword  string `json:"appPassword"`
}

// GetNFTsOutput represents the output for GetNFTs FFI function
type GetNFTsOutput struct {
	NFTs         []SimplifiedNFT `json:"nfts"`
	TotalCount   int             `json:"totalCount"`
	AddressCount int             `json:"addressCount"`
	NetworkCount int             `json:"networkCount"`
}

// ================================================================================
// Token Approval Types
// ================================================================================

// ApprovalEntry represents a single active ERC-20 token approval
type ApprovalEntry struct {
	TokenAddress string `json:"tokenAddress"` // ERC-20 token contract address
	TokenName    string `json:"tokenName"`    // Token name (from name() call)
	TokenSymbol  string `json:"tokenSymbol"`  // Token symbol (from symbol() call)
	Spender      string `json:"spender"`      // Approved spender address
	Allowance    string `json:"allowance"`    // Current allowance amount (decimal string)
	IsUnlimited  bool   `json:"isUnlimited"`  // True if allowance >= 2^128
	Network      string `json:"network"`      // Internal Network ID
	NetworkLabel string `json:"networkLabel"` // Human-readable network name
	OwnerAddress string `json:"ownerAddress"` // The wallet address that granted approval
}

// GetTokenApprovalsInput represents the input for GetTokenApprovals FFI function
type GetTokenApprovalsInput struct {
	WalletID     string `json:"walletId"`
	Password     string `json:"password"`
	USBPath      string `json:"usbPath"`
	SessionToken string `json:"sessionToken"`
	AppPassword  string `json:"appPassword"`
}

// GetTokenApprovalsOutput represents the output for GetTokenApprovals FFI function
type GetTokenApprovalsOutput struct {
	Approvals  []ApprovalEntry `json:"approvals"`
	TotalCount int             `json:"totalCount"`
}

// ================================================================================
// FFI Input/Output Types
// ================================================================================

// GetTokenBalancesInput represents the input for GetTokenBalances FFI function
type GetTokenBalancesInput struct {
	WalletID        string   `json:"walletId"`
	Password        string   `json:"password"`
	USBPath         string   `json:"usbPath"`
	SessionToken    string   `json:"sessionToken"`    // PREFERRED: Session token for app-level auth
	AppPassword     string   `json:"appPassword"`     // DEPRECATED: For reading provider config (use SessionToken instead)
	IncludeTestnets bool     `json:"includeTestnets"` // Include testnet networks (dev mode)
}

// GetTokenBalancesOutput represents the output
type GetTokenBalancesOutput struct {
	Tokens       []SimplifiedTokenBalance `json:"tokens"`
	TotalUSD     float64                  `json:"totalUsd"`
	AddressCount int                      `json:"addressCount"`
	NetworkCount int                      `json:"networkCount"`
	// Providers that could not be queried, so the UI can distinguish "no
	// balance" from "not fetched" (e.g. missing API key, query failure).
	UnavailableProviders []ProviderUnavailable `json:"unavailableProviders,omitempty"`
}

// ProviderUnavailable explains why a provider's chains have no data.
type ProviderUnavailable struct {
	Provider string `json:"provider"` // "alchemy" / "nodereal"
	Reason   string `json:"reason"`   // "missing_key" / "query_failed"
}
