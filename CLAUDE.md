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
npm run tauri:build     # Build production app
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

### Data Flow

1. Dashboard (React) → Tauri FFI bindings → Go shared library
2. Go library handles: wallet creation, key derivation (BIP39/44), signing
3. ChainAdapter provides unified interface for multi-chain transactions

### Key Technologies

- **Backend**: Go 1.21+, CGO for shared library builds
- **Frontend**: React 18, TypeScript, Vite, TailwindCSS, Zustand
- **Desktop**: Tauri v1 (Rust)
- **Testing**: Vitest (frontend), Go testing (backend), Hardhat (contracts)

## Development Guidelines

- Break complex work into 3-5 stages, document in `IMPLEMENTATION_PLAN.md`
- Follow TDD: write test first, implement minimal code, refactor
- Maximum 3 attempts per issue, then stop and reassess
- Every commit must compile and pass all existing tests
- Never use `--no-verify` to bypass commit hooks
