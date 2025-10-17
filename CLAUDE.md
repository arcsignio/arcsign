# arcSignv2 Development Guidelines

Auto-generated from all feature plans. Last updated: 2025-10-15

## Active Technologies
- Go 1.21+ (backend-first per constitution) (001-bip39-bip-44)
- Go 1.21+ (backend-first per constitution, already established in v0.1.0) (002-slip-44-btc)
- File-based JSON (wallet metadata extends existing wallet.json structure) (002-slip-44-btc)
- USB-only JSON files (wallet metadata with AddressBook), no database (003-name-bitcoin-symbol)
- Rust 1.75+ (Tauri backend), TypeScript 5.0+ (frontend), Go 1.21+ (existing CLI service) (004-dashboard)
- USB-only storage (no hard drive), AES-256-GCM + Argon2id encryption (004-dashboard)

## Project Structure
```
src/
tests/
```

## Commands
# Add commands for Go 1.21+ (backend-first per constitution)

## Code Style
Go 1.21+ (backend-first per constitution): Follow standard conventions

## Recent Changes
- 004-dashboard: Added Rust 1.75+ (Tauri backend), TypeScript 5.0+ (frontend), Go 1.21+ (existing CLI service)
- 003-name-bitcoin-symbol: Added Go 1.21+
- 002-slip-44-btc: Added Go 1.21+ (backend-first per constitution, already established in v0.1.0)

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
