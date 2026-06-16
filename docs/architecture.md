# ArcSign Architecture

This document is the deep-dive companion to the Architecture section of the
[README](../README.md). It describes how the desktop app is layered, how a
request flows from a React click to an on-chain action, and how the provider
abstraction (including the no-API-key "degraded" path) is wired.

> **One-line model:** Dashboard (Tauri / React) → C FFI → Go shared library.
> Private keys never leave the USB device, and nothing security-sensitive runs
> in JavaScript — all key derivation, signing, and swap routing happen in Go.

---

## 1. Layers

```
┌─────────────────────────────────────────────────────────────────────┐
│  Dashboard  —  React 18 + TypeScript + Vite + Tailwind + Zustand      │
│    dashboard/src/                                                     │
│      components/         UI                                           │
│      hooks/              data-fetching / view logic                  │
│      stores/            Zustand: dashboardStore · walletSessionStore │
│                          · sessionStore                              │
│      services/tauri-api.ts   the single invoke() layer (2,500+ lines)│
│      constants/contracts.ts  mirror of official on-chain addresses   │
└───────────────────────────────┬───────────────────────────────────────┘
                                │  Tauri v2 invoke (capabilities perms)
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Tauri shell (Rust)  —  dashboard/src-tauri/src/                       │
│    commands/   15 command files bridging Tauri ↔ FFI:                 │
│      wallet · transaction · swap · provider · membership · usb ·      │
│      auth · security · walletconnect · websocket_commands · app ·     │
│      dev_session · dev_history · dev_settings                         │
│    ffi/bindings.rs   Rust → Go via `libloading` (dynamic dylib load)  │
└───────────────────────────────┬───────────────────────────────────────┘
                                │  C FFI  —  CString JSON in, CString JSON out
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│  libarcsign.dylib / .so / .dll   —   Go shared library (CGO)          │
│    internal/lib/   FFI exports, split by domain (9 files):            │
│      exports_wallet · _transaction · _swap · _signing · _address ·    │
│      _provider · _membership · _app · _dev   (+ exports.go helpers)   │
│    internal/       core logic:                                        │
│      wallet/       BIP39/44 HD derivation; constants.go = single      │
│                    source of truth for official contract addresses    │
│      crypto/ security/ services/                                      │
│      provider/     on-chain reads (see §4)                            │
│    src/chainadapter/   unified tx interface: bitcoin/ · ethereum/     │
│    src/swap/           DEX aggregator: kyberswap/ · oneinch/ ·         │
│                        openocean/  (aggregator.go = parallel quotes)  │
└─────────────────────────────────────────────────────────────────────┘
```

### Why a Go shared library behind FFI

- **Trust boundary.** Key material and signing stay in a compiled Go core. The
  JS/TS frontend never touches a private key — it only renders what the Go
  library returns.
- **One implementation, three platforms.** The same Go code compiles to
  `.dylib` / `.so` / `.dll`; the Rust shell loads whichever matches the host.
- **Reproducible.** The shared library is part of the reproducible-build chain
  (see [`reproducible-builds.md`](reproducible-builds.md)); its hash is in
  `SHA256SUMS`.

> **FFI call discipline:** after any change to Go files under `internal/`, you
> must rebuild the shared library (`make build-lib-macos` / `build-lib` /
> `build-lib-linux`) before running Tauri, or it loads a stale dylib and you get
> `symbol not found` at runtime.

---

## 2. Request flow (end to end)

A representative read — "show my token balances":

```
React component
  └─ useTokenList() hook
       └─ services/tauri-api.ts   invoke("get_token_balances", {...})
            └─ src-tauri/src/commands/app.rs           (Rust command)
                 └─ ffi/bindings.rs                    (libloading symbol)
                      └─ internal/lib/exports_app.go   (Go FFI export)
                           └─ internal/provider/...     (provider abstraction)
                                └─ Alchemy / NodeReal / Glacier / public RPC
                           ← JSON (tokens, totals, unavailableProviders)
                      ← CString
                 ← Rust struct
            ← TS object
       ← typed result
  ← rendered rows
```

A write — "sign and broadcast a transaction" — follows the same path through
`commands/transaction.rs` → `exports_transaction.go` → `src/chainadapter/`,
with signing done in `internal/` against the USB-resident key.

Tauri v2 uses the **capabilities** permission model (not the v1 allowlist). A
new Tauri command must be registered both in `tauri.conf.json` capabilities and
in `src-tauri/src/commands/mod.rs`.

---

## 3. Chains and adapters

`ChainAdapter` (`src/chainadapter/adapter.go`) is the unified interface over:

- **Bitcoin** (`src/chainadapter/bitcoin/`)
- **7 EVM chains** (`src/chainadapter/ethereum/`): Ethereum, Polygon, Arbitrum,
  Optimism, Base, BSC, Avalanche.

Adding an EVM network = add its entry/mapping and the relevant parsing tests
(see `src/chainadapter/ethereum/network_test.go` for the pattern).

### Cross-chain asset aggregation

The assets list merges native coins (ETH/BNB/AVAX) and whitelisted ERC-20s
(USDC/USDT/…) **across chains** into one row; the token detail view shows the
per-chain breakdown and each chain's contract. Only CoinGecko-whitelisted
contracts merge by symbol, so fake same-named tokens stay separate. See
`dashboard/src/utils/aggregateTokens.ts`.

### Swaps

`src/swap/aggregator.go` `GetBestRoute` queries **KyberSwap, 1inch, and
OpenOcean in parallel** and returns the best route. Each integration is a
subpackage under `src/swap/`.

---

## 4. Provider data path (read-on-chain)

Reading on-chain data — balances, tokens, NFTs, transfers — goes through a
single **`WalletDataProvider` abstraction** (`internal/provider/`), **not**
per-endpoint `switch` blocks.

### Pieces

- **Interface** (`wallet_data_provider.go`):
  `GetTokenBalances` / `GetNFTs` (batch, multi-address) + `GetAssetTransfers`
  (single address). All return the shared `Simplified*` types — normalization is
  the provider's job, so callers stay provider-agnostic.
  - Optional `DegradedProvider` capability: a provider running without its key
    reports `IsDegraded() == true` so the FFI layer can emit a soft "degraded"
    hint instead of a hard "missing key" error.
- **Wrappers** (`wallet_data_wrappers.go`): one per backend, adapting the
  concrete clients (`alchemy_client.go` / `bsctrace_client.go` /
  `glacier_client.go`) to the interface. Alchemy batches all addresses in one
  HTTP request; NodeReal/Glacier loop internally.
- **Registry** (`wallet_data_registry.go`): provider string → instance,
  resolving each provider's API key from the per-USB encrypted provider config.
- **Routing** (`chains.go`): `GetProviderForNetwork(network)` maps a network to
  a provider. The FFI layer (`exports_app.go` / `exports_address.go`) buckets
  addresses by provider, then dispatches polymorphically.
- **Price enrichment** (`defillama_client.go`): `EnrichPricesWithDefiLlama`
  fills USD values (no key) for anything the providers returned at price 0.

```
        FFI layer (exports_app.go) buckets addresses by provider
                              │
                   ┌──────────┴──────────┐
                   │ WalletDataProvider  │   GetProviderForNetwork(network)
                   └──────────┬──────────┘
        ┌──────────────┬──────┴───────┬────────────────────┐
        ▼              ▼              ▼                    ▼
   alchemyWDP     nodeRealWDP     glacierWDP        EnrichPricesWithDefiLlama
   (5 EVM)        (BSC)           (Avalanche)       (USD for all, no key)
        │              │              │
   has key?        has key?      anon tier
   ├ yes → full   ├ yes → full    └ full token/NFT data
   └ no ──┬─ no ─┘  BEP-20 disc.
          ▼
   degradedTokenBalances (§4.1) — ONE shared no-key path
```

### Provider / key matrix

| Chain(s) | Provider | Key | Notes |
|---|---|---|---|
| Ethereum · Polygon · Arbitrum · Optimism · Base | Alchemy | required for full data | without a key → unified degraded path (§4.1) |
| BSC | NodeReal (`nr_getTokenHoldings` / `nr_getNFTHoldings`) | required for full BEP-20 discovery | without a key → **same** unified degraded path (native BNB + common BEP-20s) |
| Avalanche | Glacier (Avalanche Data API) | none (anonymous) | full token + NFT data, no key |
| *all of the above* | DefiLlama | none | fills USD prices |

There is **no hard-coded shared key** in the repo. Provider keys live only in
the per-USB encrypted provider config.

### 4.1 Progressive API keys — the unified no-key (degraded) path

Goal: a brand-new user with **no API key** on any EVM provider still sees basic
assets, instead of blank chains. Getting a key unlocks *more* (full token
discovery, NFTs, history) rather than being a prerequisite to seeing *anything*.

This is **one implementation, not one-per-provider**: `degradedTokenBalances`
(`internal/provider/degraded.go`) is the single no-key entry point. Any EVM
wrapper that lacks its key delegates to it — `alchemyWDP` (5 chains) and
`nodeRealWDP` (BSC) call the *same* helper, so no-key behaviour is identical
across all of them. (BSC resolves through `registryChainFor`'s
`bnb-mainnet → "bsc"` mapping so it reaches the public BSC RPCs.)

For each `(address, network)` the degraded path queries **public RPCs only**:

1. **Native coin balance** — `GetNativeBalance` (`bsctrace_client.go`, the
   chain-agnostic generalization of the old `GetNativeBNB`) via
   `eth_getBalance`.
2. **Curated common tokens** — `common_tokens.go` holds a per-chain whitelist:
   stablecoins (USDC/USDT/DAI), wrapped coins (WETH/WBTC), the chain's own token
   (ARB/OP), major DeFi tokens (UNI/LINK/AAVE), and **liquid-staking receipts**
   (stETH / ankrETH / eETH on Ethereum; ankrBNB on BSC). All balances are read
   with standard `balanceOf` and batched into **one `eth_call` per chain via
   Multicall3** (`multicall.go`, `aggregate3` at the same address
   `0xcA11bde0…` on every chain), with RPC fallback for flaky public endpoints.
3. **USD prices** — `EnrichPricesWithDefiLlama` fills values (no key).

Why a whitelist and not full discovery: there is **no free indexer** that can
enumerate "which tokens does this address hold" for Ethereum/Polygon/Arbitrum/
Optimism/Base. Glacier covers that for Avalanche only. So the common-token
whitelist is the practical upper bound for the no-key path. NFTs and transaction
history likewise need the provider's key (Alchemy for the 5 EVM chains, NodeReal
for BSC).

The frontend (`WalletDetail.tsx`) renders the difference: a soft blue banner —
"basic assets shown; add an Alchemy key to unlock full token / NFT / history" —
when providers report `degraded`, versus a yellow warning only on hard errors.

### Capability summary

| Capability | No key | + Alchemy key |
|---|---|---|
| Native balances | ✅ | ✅ |
| Common tokens (whitelist) | ✅ | ✅ (full discovery) |
| Liquid-staking receipts | ✅ | ✅ |
| USD prices (DefiLlama) | ✅ | ✅ |
| Long-tail token discovery | ❌ | ✅ |
| NFT gallery | Avalanche only | ✅ all EVM chains |
| Transaction history | ❌ | ✅ |

### Adding a provider

Adding a backend is a one-place change per concern:

1. Implement the `WalletDataProvider` interface (a concrete client + a wrapper
   in `wallet_data_wrappers.go`).
2. Register it in `wallet_data_registry.go`.
3. Map its networks in `chains.go` (`GetProviderForNetwork`).
4. Add mapping/parsing tests (`internal/provider/*_test.go`).

---

## 5. State, membership, and analytics

- **UI state:** Zustand stores (`dashboardStore`, `walletSessionStore`,
  `sessionStore`); some use `persist` middleware for localStorage.
- **Pro / Free gating:** checked via `MembershipStatus` (on-chain NFT balance) —
  no client-side-only gates. The Pro NFT and Referral contracts are deployed on
  BSC; their addresses are pinned compile-time constants in
  `internal/wallet/constants.go` and mirrored in
  `dashboard/src/constants/contracts.ts` (see `OFFICIAL_ADDRESSES.md`).
- **Analytics:** `analytics.ts` sends tier heartbeats to a Cloudflare Worker for
  tier tracking.

---

## 6. Where things live (quick map)

| Concern | Path |
|---|---|
| FFI exports | `internal/lib/exports_*.go` |
| Core wallet / crypto / security | `internal/{wallet,crypto,security,services}/` |
| On-chain reads (provider abstraction) | `internal/provider/` |
| No-key degraded path | `internal/provider/{degraded,common_tokens,multicall}.go` |
| Price enrichment | `internal/provider/defillama_client.go` |
| Cross-chain tx interface | `src/chainadapter/{bitcoin,ethereum}/` |
| Swap aggregator | `src/swap/{aggregator.go,kyberswap,oneinch,openocean}/` |
| Rust commands | `dashboard/src-tauri/src/commands/` |
| Rust ↔ Go FFI bindings | `dashboard/src-tauri/src/ffi/bindings.rs` |
| Frontend invoke layer | `dashboard/src/services/tauri-api.ts` |
| Cross-chain aggregation (UI) | `dashboard/src/utils/aggregateTokens.ts` |
| Official contract addresses | `internal/wallet/constants.go` + `dashboard/src/constants/contracts.ts` |

See also [`CLAUDE.md`](../CLAUDE.md) for build commands and conventions.
