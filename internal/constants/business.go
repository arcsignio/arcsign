// Package constants defines shared business constants for ArcSign.
// This is the single source of truth for business rules used across the Go codebase.
package constants

const (
	// WalletLimitFree is the number of wallets available without NFT membership.
	WalletLimitFree = 1

	// WalletLimitPerNFT is the additional wallets granted per valid NFT.
	WalletLimitPerNFT = 3
)

// WalletLimit calculates the maximum number of wallets based on NFT count.
// Formula: 1 + (nftCount * 3)
//   - Free (0 NFT): 1 wallet
//   - Pro (1 NFT): 4 wallets
//   - Pro (n NFTs): 1 + (n * 3) wallets
func WalletLimit(nftCount int) int {
	return WalletLimitFree + (nftCount * WalletLimitPerNFT)
}
