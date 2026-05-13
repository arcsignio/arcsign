# ArcSign

> A USB-only multi-chain cold wallet you can audit instead of trust.

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![Reproducible Builds](https://img.shields.io/badge/builds-reproducible-green.svg)](docs/reproducible-builds.md)
[![Security Policy](https://img.shields.io/badge/security-policy-red.svg)](SECURITY.md)
[![DCO](https://img.shields.io/badge/Commits-DCO-blue.svg)](CONTRIBUTING.md)

ArcSign is an open-source desktop cold wallet for Bitcoin and 6 EVM chains.
Private keys are generated and stored only on a USB device. The `.arcsign`
encrypted backup file replaces paper seed phrases — it's AES-256 encrypted
at export, so a stolen backup file isn't a stolen wallet.

## Why open source

Cold wallets ask you to trust them with your savings. **We don't think you
should have to.**

- Every line of code that touches your keys is public.
- Every release is built reproducibly — clone the source at the matching
  tag, run `make build-reproducible`, and the SHA-256 should match
  the published `SHA256SUMS`. If it doesn't, something was tampered with.
  See [`docs/reproducible-builds.md`](docs/reproducible-builds.md).
- Every official on-chain address (Pro NFT, Referral, swap referrer) is
  a compile-time constant — printed at startup, documented at
  [`OFFICIAL_ADDRESSES.md`](OFFICIAL_ADDRESSES.md), and verifiable
  against BscScan.

Apache 2.0 licensed. Fork-friendly with a small trademark policy — see
[`TRADEMARK.md`](TRADEMARK.md).

## Features

- **Multi-chain HD wallet** — Bitcoin + 6 EVM chains
  (Ethereum, BSC, Polygon, Arbitrum, Optimism, Base).
- **USB cold storage** — private keys live on the USB, never on the host.
- **`.arcsign` encrypted backup** — AES-256 at export. No paper seed phrases.
- **DEX swap aggregator** — OpenOcean + KyberSwap parallel quotes,
  picks the best route automatically.
- **Token approvals manager** — view and revoke ERC-20 approvals across
  6 chains. Pro users get batch revoke.
- **NFT gallery** — cross-chain ERC-721 / ERC-1155 display.
- **DeFi positions** — liquid staking (stETH, ankrETH, ankrBNB) with
  real-time APY.
- **WalletConnect** — sign transactions from cold storage.
- **Pro membership** — optional 30 USDT/year NFT for advanced features.

## Architecture

```
┌──────────────────────┐
│ Dashboard (Tauri v2) │  React + TypeScript
└──────────┬───────────┘
           │ Tauri commands (Rust)
           ▼
┌──────────────────────┐
│ ffi/bindings.rs      │  libloading
└──────────┬───────────┘
           │ C FFI
           ▼
┌──────────────────────┐
│ libarcsign.dylib /.so│  Go shared library
│                      │  BIP39/44, signing,
│                      │  swap routing
└──────────────────────┘
```

For deeper detail see [`docs/architecture.md`](docs/architecture.md) and
[`CLAUDE.md`](CLAUDE.md).

## Downloading

Pre-built binaries are at **https://dl.arcsign.io**.

Verify your download:

```bash
# 1. Download SHA256SUMS for your version
curl -L https://dl.arcsign.io/v1.3.0/SHA256SUMS -o SHA256SUMS

# 2. Verify the binary you downloaded matches
shasum -a 256 -c SHA256SUMS

# 3. Optionally: rebuild yourself and confirm the hash matches
#    See docs/reproducible-builds.md
```

## Building from source

```bash
# Prerequisites: Go 1.21+, Node 20+, Rust 1.70+
git clone https://github.com/arcsignio/arcsign.git
cd arcsign

# Build the Go shared library
make build-lib-macos    # or build-lib-linux / build-lib-windows

# Build the Dashboard
cd dashboard
npm install
npm run tauri:dev       # development
npm run tauri:build     # production app bundle
```

For reproducible builds (matching the official `SHA256SUMS`):

```bash
make build-reproducible
shasum -a 256 dashboard/src-tauri/libarcsign.dylib
```

## Security

Found a vulnerability? **Do not open a public GitHub issue.**

Email `security@arcsign.io` (PGP key in [`SECURITY.md`](SECURITY.md)).

We aim for an initial response within 7 days. Full disclosure policy,
threat model, and bug bounty status (currently retrospective-only;
monetary bounty launches at Pro NFT holders > 500) in
[`SECURITY.md`](SECURITY.md).

## Contributing

ArcSign is a one-maintainer project. **Please read
[`CONTRIBUTING.md`](CONTRIBUTING.md) before opening a PR** — particularly
the "What we do NOT accept" section.

TL;DR:
- Open an issue first for any non-trivial change (>50 lines).
- All commits must be signed off with DCO: `git commit -s -m "..."`.
- Tests required for non-trivial changes.
- Changes to `internal/wallet/constants.go` (official addresses) are
  auto-blocked and require explicit maintainer review.

Good first issues are tagged [`good-first-issue`](https://github.com/arcsignio/arcsign/issues?q=is%3Aissue+is%3Aopen+label%3Agood-first-issue).
Translation contributions are especially welcome.

## License & trademarks

Source code is licensed under the Apache License 2.0 — see
[`LICENSE`](LICENSE) and [`NOTICE`](NOTICE).

"ArcSign" and the ArcSign logo are unregistered trademarks of the ArcSign
project. You may freely refer to the project by name; you may **not** ship
a fork under a name containing "ArcSign". See [`TRADEMARK.md`](TRADEMARK.md).

## Project links

| What | Where |
|---|---|
| Website | https://arcsign.io |
| Downloads | https://dl.arcsign.io |
| GitHub | https://github.com/arcsignio/arcsign |
| Issues | https://github.com/arcsignio/arcsign/issues |
| Discussions | https://github.com/arcsignio/arcsign/discussions |
| Twitter / X | [@arcsign](https://twitter.com/arcsign) |
| Discord | https://discord.gg/WTyQakx4pb |
| Security | security@arcsign.io ([PGP](docs/pgp-pubkey.asc)) |
