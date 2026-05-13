// Package wallet contains official ArcSign addresses and constants.
//
// These values are compile-time constants and intentionally NOT configurable
// at runtime. Anyone running an unmodified official build of ArcSign uses
// these addresses. Forks that change these values produce binaries with
// different reproducible-build hashes, which users can verify.
//
// See OFFICIAL_ADDRESSES.md in repo root for the canonical user-facing
// reference. The values here MUST stay in sync with that document and with
// contracts/deployments/bsc.json + bsc-referral.json.
package wallet

const (
	// ArcSignProNFTAddress is the official ArcSign Pro NFT contract on BSC.
	// Used by Dashboard membership checks. ERC-721 with 1-year expiry.
	// Deployed 2026-01-06. See contracts/deployments/bsc.json.
	ArcSignProNFTAddress = "0x02EA7B4870Aa0553EF357Af6475727f1E01c7b2F"

	// ArcSignReferralAddress is the official referral contract on BSC.
	// Provides 10-20% revenue share for referrer Pro NFT holders.
	// Deployed 2026-03-31. See contracts/deployments/bsc-referral.json.
	ArcSignReferralAddress = "0x69A7aa10e11958e79988553f1722a703F7411457"

	// ArcSignSwapReferrer is the EOA address that receives the 0.1% swap
	// referrer fee from OpenOcean / KyberSwap / 1inch routers when users
	// execute swaps through ArcSign.
	//
	// This is the project Treasury (the same address that receives Pro NFT
	// mint payments — see ArcSignPro.sol `treasury` field). It is a regular
	// account, NOT a contract, so it can hold ERC20 tokens from any chain
	// the swap aggregator routes through.
	//
	// IMPORTANT: This value used to point at ArcSignProNFTAddress, which
	// could not accept ERC20 (the Pro NFT contract only exposes native BNB
	// withdrawal). Fixed in the open-source preparation pass.
	ArcSignSwapReferrer = "0x2e26cbD533Ac3E98d3B650c7f89406EbB6f2f634"

	// ArcSignSwapReferrerFeeRate is the percentage fee applied to user
	// swaps. Stored as a percent value (0.1 = 0.1%, NOT 0.001).
	// The OpenOcean / KyberSwap API expects this format.
	ArcSignSwapReferrerFeeRate = 0.1

	// BSCMainnetChainID is the BSC mainnet chain id for verification.
	BSCMainnetChainID = 56

	// USDTAddressBSC is the canonical BEP-20 USDT contract on BSC,
	// used by ArcSign Pro NFT as the payment token.
	USDTAddressBSC = "0x55d398326f99059fF775485246999027B3197955"
)
