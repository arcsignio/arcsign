# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ArcSign is a secure multi-chain HD wallet system with USB-only storage. The architecture follows: **Dashboard (Tauri) → FFI → Go Shared Library**.

## Build Commands

### Go Shared Library (FFI)

```bash
make build-lib          # Build for current platform
make build-lib-macos    # Build universal macOS dylib (arm64 + x86_64)
make build-lib-windows  # Build Windows DLL
make build-lib-linux    # Build Linux SO
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
npm test                # Run Vitest tests
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

- `internal/` - Go core logic (wallet, crypto, services, providers)
- `internal/lib/` - FFI exports for Tauri (exports.go)
- `src/chainadapter/` - Cross-chain transaction adapters (Bitcoin, Ethereum)
- `dashboard/` - Tauri + React + TypeScript desktop app
- `dashboard/src/` - React components, hooks, stores (Zustand)
- `contracts/` - Hardhat smart contracts (NFT membership on BSC)
- `landing-page/` - Static site (arcsign.io), includes blog (zh-TW + en)
- `marketing/` - SEO articles, strategy docs, social media content, dashboard

### Data Flow

1. Dashboard (React) → Tauri FFI bindings → Go shared library
2. Go library handles: wallet creation, key derivation (BIP39/44), signing
3. ChainAdapter provides unified interface for multi-chain transactions

### Key Technologies

- **Backend**: Go 1.21+, CGO for shared library builds
- **Frontend**: React 18, TypeScript, Vite, TailwindCSS, Zustand
- **Desktop**: Tauri v1 (Rust)
- **Testing**: Vitest (frontend), Go testing (backend), Hardhat (contracts)

## Release Process

When bumping the version number, update all 3 files:

- `dashboard/package.json`
- `dashboard/src-tauri/tauri.conf.json`
- `dashboard/src-tauri/Cargo.toml`

After committing the version bump, **always create and push the git tag** to trigger the Release workflow:

```bash
git tag v<VERSION>
git push origin v<VERSION>
```

The Release workflow (GitHub Actions) builds all 3 platforms (macOS, Windows, Linux) and uploads artifacts to **Cloudflare R2** (`dl.arcsign.io`). GitHub repo is **private** — all public downloads and OTA updates go through R2, not GitHub Releases.

- Download URLs: `https://dl.arcsign.io/v<VERSION>/<file>`
- Tauri updater endpoint: `https://dl.arcsign.io/latest.json` (auto-uploaded by workflow)
- Landing page download links are auto-updated by the workflow.

## Product Facts (for content creation)

- ArcSign is **free software** — not open-source yet (planned after 10K users)
- The `.arcsign` backup file is **already encrypted upon export** (AES-256). There is NO separate step to set a password. Export = encrypted file immediately.
- Provider/Indexer setup requires an Alchemy API Key to read on-chain data (free tier is sufficient)
- ArcSign is a USB cold wallet — private keys never leave the device
- ArcSign **supports WalletConnect** — frequent traders can also use ArcSign to sign transactions securely from cold storage
- A **mobile app** is planned for the future (not yet released)
- Key differentiator: `.arcsign` encrypted backup replaces paper seed phrases
- **Token Approvals management** — users can view and revoke ERC-20 approvals across 6 EVM chains. Pro users get batch revoke. This is a security feature to prevent forgotten approvals from becoming attack vectors.
- **BSC full support** — Token balances, NFTs, and Approvals all work on BSC via NodeReal enhanced APIs (`nr_getTokenHoldings`, `nr_getNFTHoldings`). Other chains use Alchemy.
- **NFT Gallery** — cross-chain NFT display with ERC721/ERC1155 support across 6 chains
- **DeFi positions** — shows liquid staking positions (stETH, ankrETH, ankrBNB) with real-time APY

## Development Guidelines

- Break complex work into 3-5 stages, document in `IMPLEMENTATION_PLAN.md`
- Follow TDD: write test first, implement minimal code, refactor
- Maximum 3 attempts per issue, then stop and reassess
- Every commit must compile and pass all existing tests
- Never use `--no-verify` to bypass commit hooks
- Use Traditional Chinese (zh-TW) for user-facing content and commit messages
