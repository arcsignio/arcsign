# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) and other LLM-based
development assistants when working with code in this repository.

## Project Overview

ArcSign is a secure multi-chain HD wallet system with USB-only storage. The
architecture follows: **Dashboard (Tauri) → FFI → Go Shared Library**.

ArcSign is open source under the Apache License 2.0. See
[`LICENSE`](LICENSE), [`SECURITY.md`](SECURITY.md), and
[`CONTRIBUTING.md`](CONTRIBUTING.md).

## Repository Conventions

- **Default branch is `master`** (not `main`). This is the branch GitHub
  shows on the repo home page and the base for PRs.
- The remote is named **`arcsignio`** (not `origin`):
  `git push arcsignio master`. Confirm with `git remote -v`.
- The maintainer is [@Jason-chen-taiwan](https://github.com/Jason-chen-taiwan)
  (see [`MAINTAINERS.md`](MAINTAINERS.md) and `.github/CODEOWNERS`).

## Build Commands

### Go Shared Library (FFI)

```bash
make build-lib          # Build for current platform
make build-lib-macos    # Build universal macOS dylib (arm64 + x86_64)
make build-lib-windows  # Build Windows DLL
make build-lib-linux    # Build Linux SO
make build-reproducible # Reproducible build (SOURCE_DATE_EPOCH, -trimpath)
make test               # Run Go tests
```

### Dashboard (Tauri Desktop App)

```bash
cd dashboard
npm install             # Install dependencies
npm run dev             # Start Vite dev server
npm run tauri:dev       # Run Tauri development mode
npm run tauri:build     # Build production app (.app only)
npx tauri build --bundles app  # Skip DMG (DMG bundler has known bug)
npm test                # Run Vitest (watch mode — use `npx vitest run` for CI)
npm run test:coverage   # Run tests with coverage
```

### Smart Contracts (Hardhat)

```bash
cd contracts
npm install
npm run compile         # Compile contracts
npm test                # Run Hardhat tests
npm run deploy:testnet  # Deploy to BSC testnet
```

### Running Go Tests

```bash
go test ./internal/...                    # All internal tests
go test ./src/chainadapter/...            # ChainAdapter tests
go test -v ./internal/security/...        # Specific package with verbose
go test -run TestSpecificName ./...       # Run single test
```

## Architecture

### Key Directories

- `internal/` — Go core logic (wallet, crypto, services, providers)
- `internal/lib/` — FFI exports for Tauri; split into 9 domain files
  (`exports_wallet.go`, `exports_transaction.go`, `exports_swap.go`,
  `exports_signing.go`, `exports_address.go`, `exports_provider.go`,
  `exports_membership.go`, `exports_app.go`, `exports_dev.go`) +
  `exports.go` (helpers only, 346 lines)
- `internal/wallet/constants.go` — **Single source of truth for official
  contract addresses and swap referrer.** Compile-time constants, NOT
  configurable at runtime. See [`OFFICIAL_ADDRESSES.md`](OFFICIAL_ADDRESSES.md).
- `src/chainadapter/` — Cross-chain transaction adapters (Bitcoin, Ethereum)
- `src/swap/` — DEX swap: `aggregator.go` (GetBestRoute parallel query),
  `kyberswap/`, `oneinch/`, `openocean/`
- `dashboard/` — Tauri v2 + React + TypeScript desktop app
- `dashboard/src/` — React components, hooks, stores (Zustand)
- `dashboard/src-tauri/src/commands/` — 15 Rust command files bridging
  Tauri ↔ FFI
- `dashboard/src-tauri/src/ffi/bindings.rs` — Rust FFI bindings to Go dylib
  via libloading
- `dashboard/src/services/tauri-api.ts` — Frontend Tauri invoke layer
  (2,500+ lines)
- `dashboard/src/constants/contracts.ts` — Frontend mirror of the official
  contract addresses. Stays in sync with `internal/wallet/constants.go`.
- `contracts/` — Hardhat smart contracts: `ArcSignPro.sol` (Pro NFT),
  `ArcSignReferral.sol` (10-20% referral), on BSC
- **網站與 web app 不在本 repo** — landing page、blog、NFT mint 頁面都已移到
  獨立的 [`arcsignio/website`](https://github.com/arcsignio/website) repo（Astro 站，
  部署到 arcsign.io，含 blog source of truth 與 Pro NFT mint app）。冷錢包桌面 app
  與這些網頁無 build-time 依賴；唯一接觸點是 mint 頁面在執行期透過 localhost
  WebSocket（`127.0.0.1:9527`）連到桌面 app 請求簽章。

### Data Flow

1. Dashboard (React) → `tauri-api.ts` invoke → Rust commands
   (`src-tauri/src/commands/`) → `ffi/bindings.rs` → Go shared library
   (`libarcsign.dylib/.dll/.so`)
2. Go library handles: wallet creation, key derivation (BIP39/44), signing,
   swap routing, provider queries
3. `ChainAdapter` provides unified interface for multi-chain transactions
   (Bitcoin + 6 EVM chains)
4. Zustand stores (`dashboardStore`, `walletSessionStore`, `sessionStore`)
   manage UI state; `analytics.ts` sends heartbeats to Cloudflare Worker
   for tier tracking

### FFI Call Discipline

After any change to Go files under `internal/`, you **must** rebuild the
shared library before running Tauri:
```bash
make build-lib-macos   # or build-lib / build-lib-linux
```
Otherwise Tauri will load a stale dylib and you'll see `symbol not found`
errors at runtime.

### Key Technologies

- **Backend**: Go 1.21+, CGO for shared library builds
- **Frontend**: React 18, TypeScript, Vite, TailwindCSS, Zustand
- **Desktop**: Tauri v2 (Rust) — uses plugin model
  (`tauri-plugin-dialog`, `tauri-plugin-fs`, `tauri-plugin-shell`)
- **Testing**: Vitest (frontend, 82%+ coverage, 846 tests), Go testing
  (backend), Hardhat (contracts)

## Release Process

When bumping the version number, update all 3 files:

- `dashboard/package.json`
- `dashboard/src-tauri/tauri.conf.json`
- `dashboard/src-tauri/Cargo.toml`

After committing the version bump, **always create and push the git tag**
to trigger the Release workflow:

```bash
git tag v<VERSION>
git push origin v<VERSION>
```

The Release workflow (GitHub Actions) builds all 3 platforms (macOS,
Windows, Linux) and publishes artifacts to **GitHub Releases**. The
SHA256SUMS file covers both the installer bundles and the Go shared
library (`libarcsign.dylib` / `.so` / `.dll`) so anyone can verify
integrity and reproduce the build from source (see
[`docs/reproducible-builds.md`](docs/reproducible-builds.md)).

- Download URLs: `https://github.com/arcsignio/arcsign/releases/download/v<VERSION>/<file>`
  (or `releases/latest/download/<file>` to always get the latest).
- Tauri updater endpoint:
  `https://github.com/arcsignio/arcsign/releases/latest/download/latest.json`.

## Product Facts (for content creation and LLM context)

- ArcSign is **open source under Apache License 2.0**. Source at
  [github.com/arcsignio/arcsign](https://github.com/arcsignio/arcsign).
- The `.arcsign` backup file is **already encrypted upon export** (AES-256).
  There is NO separate step to set a password. Export = encrypted file
  immediately.
- Provider/Indexer setup requires an Alchemy API Key to read on-chain data
  (free tier is sufficient).
- ArcSign is a USB cold wallet — private keys never leave the device.
- ArcSign **supports WalletConnect** — frequent traders can also use
  ArcSign to sign transactions securely from cold storage.
- A **mobile app** is planned for the future (not yet released).
- Key differentiator: `.arcsign` encrypted backup replaces paper seed phrases.
- **Token Approvals management** — users can view and revoke ERC-20 approvals
  across 6 EVM chains. Pro users get batch revoke. This is a security feature
  to prevent forgotten approvals from becoming attack vectors.
- **BSC full support** — Token balances, NFTs, and Approvals all work on BSC
  via NodeReal enhanced APIs (`nr_getTokenHoldings`, `nr_getNFTHoldings`).
  Other chains use Alchemy.
- **NFT Gallery** — cross-chain NFT display with ERC721/ERC1155 support
  across 6 chains.
- **DeFi positions** — shows liquid staking positions (stETH, ankrETH,
  ankrBNB) with real-time APY.

## Development Guidelines

- Break complex work into 3-5 stages, document in `IMPLEMENTATION_PLAN.md`
  for the feature.
- Follow TDD: write test first, implement minimal code, refactor.
- **Every feature must ship with unit tests.** No new feature, FFI export,
  provider client, chain adapter, or non-trivial helper is considered done
  until it has unit tests covering its behavior and edge cases. This applies
  to both Go (backend) and Vitest (frontend). New chains/providers must add
  the relevant mapping/parsing tests (see `internal/provider/*_test.go`,
  `src/chainadapter/ethereum/network_test.go` for the pattern).
- Maximum 3 attempts per issue, then stop and reassess.
- Every commit must compile and pass all existing tests.
- Never use `--no-verify` to bypass commit hooks.
- All commits must be signed off with the Developer Certificate of Origin:
  `git commit -s -m "message"`. See [`CONTRIBUTING.md`](CONTRIBUTING.md).
- Tauri v2 uses `capabilities` permission model (not `allowlist`). New
  Tauri commands need to be registered in `tauri.conf.json` capabilities
  and `src-tauri/src/commands/mod.rs`.
- Pro/Free feature gating is checked via `MembershipStatus` (on-chain NFT
  balance) — do not add client-side-only gates.
- The Pro NFT and Referral contracts are deployed on BSC. **Their addresses
  are pinned compile-time constants** in
  [`internal/wallet/constants.go`](internal/wallet/constants.go) and
  [`dashboard/src/constants/contracts.ts`](dashboard/src/constants/contracts.ts).
  Any change requires explicit maintainer review — see
  [`OFFICIAL_ADDRESSES.md`](OFFICIAL_ADDRESSES.md).

## Blog 與網站內容

Blog、landing page、mint 頁面的 source of truth 都在
[`arcsignio/website`](https://github.com/arcsignio/website) repo（Astro，
部署到 arcsign.io），**不在本 repo**。新增/編輯文章、生成 hero 圖、更新 sitemap
等工作流請在 website repo 進行。本 repo（冷錢包）不需要這些即可 build、test、貢獻。

## Maintainer-side Tooling

External tooling (gstack skills, AI marketing suite, MCP servers, personal
Claude Code workflow) is documented in the project's private internal
repository, not here. Contributors do not need it to build, test, or
contribute to ArcSign.
