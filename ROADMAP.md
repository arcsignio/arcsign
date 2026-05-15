# ArcSign Public Roadmap

This is the **public** roadmap. It lists shipped milestones and planned
near-term direction. Specific dates are intentionally omitted — we ship
when the quality bar is met, not by calendar.

Last reviewed: 2026-05

---

## Recently Shipped

- ✅ **Rate limiter on all 7 sensitive FFI endpoints** — defends against
  brute force on session unlock and other high-value entry points.
- ✅ **Swap aggregator** — parallel quote from OpenOcean + KyberSwap, picks
  best route automatically.
- ✅ **FFI exports refactor** — split into 9 domain files for maintainability
  (`exports_wallet.go`, `exports_transaction.go`, `exports_swap.go`,
  `exports_signing.go`, `exports_address.go`, `exports_provider.go`,
  `exports_membership.go`, `exports_app.go`, `exports_dev.go`).
- ✅ **Pro NFT membership** — BSC ERC-721 with 1-year expiry, 30 USDT mint.
- ✅ **Referral contract** — 10–20% revenue share, on-chain enforcement.
- ✅ **Token approvals management** — view and revoke ERC-20 approvals
  across 6 EVM chains. Pro users get batch revoke.
- ✅ **NFT Gallery** — cross-chain display (ERC-721 / ERC-1155).
- ✅ **DeFi positions** — liquid staking positions (stETH, ankrETH, ankrBNB)
  with real-time APY.
- ✅ **BSC full support** — token balances, NFTs, approvals via NodeReal
  enhanced APIs (`nr_getTokenHoldings`, `nr_getNFTHoldings`).
- ✅ **WalletConnect** — sign transactions from cold storage.

## In Progress

- 🔨 **Open source preparation** — Apache 2.0 license, reproducible builds,
  community docs (you're reading part of it).

## Planned

Order is approximate. We may reprioritize as feedback comes in.

- 📋 **Mobile companion app** — phone as a second screen for cold-wallet
  confirmations. Not a standalone wallet.
- 📋 **Additional chain adapters** — beyond Bitcoin + 6 EVM chains.
  Community contributions following the existing `src/chainadapter/`
  pattern are very welcome — see [`CONTRIBUTING.md`](CONTRIBUTING.md).
- 📋 **Bug bounty program** — will launch when the project is sustainable
  enough to fund it. See [`SECURITY.md`](SECURITY.md) for what I can
  offer in the meantime (Hall of Fame, references, CVE assignment help).
- 📋 **Third-party security audit** — will be commissioned when there's
  budget for it. No fixed timeline.
- 📋 **Reproducible builds across all platforms** — we have CI for
  macOS / Linux / Windows; ongoing work to make every release bit-for-bit
  deterministic.

## Not Planned

These are intentionally out of scope. We will close PRs that try to
add them.

- ❌ **Hot wallet / web wallet features** — ArcSign is USB-only by design.
- ❌ **Custody / centralized features** — we don't hold user funds.
- ❌ **Token issuance / launchpad** — out of scope.
- ❌ **Switching to a source-available license** (BUSL, SSPL, etc.) —
  ArcSign is and will remain Apache 2.0.

## How decisions get made

- **Roadmap changes**: maintainer decision, posted as a PR to this file.
  Issues with substantial community interest get heard.
- **Architecture changes**: PR with discussion in `area/wallet-core`,
  `area/dashboard`, or `area/contracts` labels.
- **Security policy changes**: see [`SECURITY.md`](SECURITY.md).

## Verifying our commitment

Reproducible builds let you verify the binary you downloaded matches the
source code at a specific tag. See
[`docs/reproducible-builds.md`](docs/reproducible-builds.md).

Compile-time constants (contract addresses, swap referrer) are pinned in
[`internal/wallet/constants.go`](internal/wallet/constants.go) and
documented in [`OFFICIAL_ADDRESSES.md`](OFFICIAL_ADDRESSES.md).
