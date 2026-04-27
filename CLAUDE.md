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
- `internal/lib/` - FFI exports for Tauri; split into 9 domain files (`exports_wallet.go`, `exports_transaction.go`, `exports_swap.go`, `exports_signing.go`, `exports_address.go`, `exports_provider.go`, `exports_membership.go`, `exports_app.go`, `exports_dev.go`) + `exports.go` (helpers only, 346 lines)
- `src/chainadapter/` - Cross-chain transaction adapters (Bitcoin, Ethereum)
- `src/swap/` - DEX swap: `aggregator.go` (GetBestRoute parallel query), `kyberswap/`, `oneinch/`
- `dashboard/` - Tauri v2 + React + TypeScript desktop app
- `dashboard/src/` - React components, hooks, stores (Zustand)
- `dashboard/src-tauri/src/commands/` - 15 Rust command files bridging Tauri ↔ FFI
- `dashboard/src-tauri/src/ffi/bindings.rs` - Rust FFI bindings to Go dylib via libloading
- `dashboard/src/services/tauri-api.ts` - Frontend Tauri invoke layer (2,500+ lines)
- `contracts/` - Hardhat smart contracts: `ArcSignPro.sol` (Pro NFT), `ArcSignReferral.sol` (10-20% referral), on BSC
- `landing-page/` - Static site (arcsign.io) — 主頁、FAQ、whitepaper 等非 blog 頁面。**Blog 已移除**，改用 Astro。
- `landing-page-astro/` - **Astro-based landing page（現役，部署到 arcsign.io）**。Cloudflare Pages 自動 build：`cd landing-page-astro && npm install && npm run build`，output 為 `landing-page-astro/dist`。
- `mint-page/` - React app for Pro NFT minting on BSC
- `marketing/` - SEO articles, strategy docs, social media content

### Data Flow

1. Dashboard (React) → `tauri-api.ts` invoke → Rust commands (`src-tauri/src/commands/`) → `ffi/bindings.rs` → Go shared library (`libarcsign.dylib/.dll/.so`)
2. Go library handles: wallet creation, key derivation (BIP39/44), signing, swap routing, provider queries
3. `ChainAdapter` provides unified interface for multi-chain transactions (Bitcoin + 6 EVM chains)
4. Zustand stores (`dashboardStore`, `walletSessionStore`, `sessionStore`) manage UI state; `analytics.ts` sends heartbeats to Cloudflare Worker for tier tracking

### FFI Call Discipline

After any change to Go files under `internal/`, you **must** rebuild the shared library before running Tauri:
```bash
make build-lib-macos   # or build-lib / build-lib-linux
```
Otherwise Tauri will load a stale dylib and you'll see `symbol not found` errors at runtime.

### Key Technologies

- **Backend**: Go 1.21+, CGO for shared library builds
- **Frontend**: React 18, TypeScript, Vite, TailwindCSS, Zustand
- **Desktop**: Tauri v2 (Rust) — uses plugin model (`tauri-plugin-dialog`, `tauri-plugin-fs`, `tauri-plugin-shell`)
- **Testing**: Vitest (frontend, 82%+ coverage, 846 tests), Go testing (backend), Hardhat (contracts)

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
- **完成開發後必須更新路線圖**：每完成一個 Q2/Q3/Q4 工項，立即更新 `CTO_技術發展路線圖_2026.md` 中對應項目的狀態欄（✅ 完成 + commit hash），避免重複開發已完成的功能
- Tauri v2 uses `capabilities` permission model (not `allowlist`). New Tauri commands need to be registered in `tauri.conf.json` capabilities and `src-tauri/src/commands/mod.rs`
- Pro/Free feature gating is checked via `MembershipStatus` (on-chain NFT balance) — do not add client-side-only gates
- The referral contract is deployed at `0x69A7...1457` on BSC — do not redeploy unless intentional

## gstack Skills（工程流程）

全域安裝於 `~/.claude/skills/gstack`，提供 29 個工程開發 skills。

### 常用 Skills

**規劃：**
- `/office-hours` — 產品思維重構，提出關鍵問題
- `/plan-ceo-review` — CEO 視角審查功能範圍
- `/plan-eng-review` — 工程架構鎖定、資料流圖、邊界案例
- `/plan-design-review` — 設計維度 0-10 分評分

**開發與審查：**
- `/review` — Staff Engineer 等級程式碼審查
- `/investigate` — 系統性 root cause 分析
- `/cso` — OWASP Top 10 + STRIDE 安全審計

**測試：**
- `/qa` — 真實瀏覽器自動測試（需 Bun）
- `/browse` — headless Chromium，用於 web 測試和 dogfooding
- `/benchmark` — Core Web Vitals 效能基準

**發布：**
- `/ship` — 跑測試、推 branch、開 PR
- `/land-and-deploy` — 合併 PR、等 CI、驗證 production
- `/document-release` — 自動更新文件

**安全護欄：**
- `/careful` — 危險指令警告（rm -rf、force-push 等）
- `/freeze` — 限制編輯範圍到指定目錄

### 注意事項
- `/browse` 和 `/qa` 需要 Bun v1.0+（已安裝）
- `/qa` 只能測 web（Vite dev server / landing-page），無法測 Tauri app
- ArcSign 用 `master` branch，`/ship` 開 PR 時需確認目標 branch

## 行銷 Skills

### AI Marketing Suite（`/market`）

全方位行銷工具，15 個 skills + 5 個平行 subagents。

- `/market audit <url>` — 完整行銷審計（5 個平行 agents）
- `/market copy <url>` — 文案分析與生成
- `/market seo <url>` — SEO 內容審計
- `/market social <topic>` — 社群媒體內容日曆
- `/market competitors <url>` — 競爭情報分析
- `/market landing <url>` — Landing page CRO
- `/market launch <product>` — 產品上市 playbook
- `/market emails <topic>` — Email 序列生成
- `/market ads <url>` — 廣告創意與文案
- `/market brand <url>` — 品牌語調分析
- `/market report <url>` — 行銷報告（Markdown）
- `/market report-pdf <url>` — 行銷報告（PDF）

### Claude SEO（`/seo`）

13 個 SEO sub-skills，搭配已連接的 Ahrefs MCP。

- `/seo audit <url>` — 完整 SEO 審計
- `/seo technical <url>` — 技術 SEO（crawlability、Core Web Vitals）
- `/seo content <url>` — 內容品質與 E-E-A-T 分析
- `/seo schema <url>` — Schema markup 偵測與生成
- `/seo geo` — AI 搜尋引擎優化（GEO/AEO）
- `/seo local` — 本地 SEO 分析
- `/seo plan` — SEO 策略規劃

### Marketing Skills（CRO + 文案 + 成長）

34 個專項 skills，涵蓋：
- `/copywriting` `/copy-editing` — 文案撰寫與編輯
- `/page-cro` `/form-cro` `/signup-flow-cro` — 轉換率優化
- `/content-strategy` — 內容策略規劃
- `/social-content` — 社群內容創作
- `/pricing-strategy` — 定價策略
- `/referral-program` — 推薦計畫設計
- `/launch-strategy` — 產品上市策略
- `/cold-email` — B2B 冷郵件撰寫
- `/programmatic-seo` — 程式化 SEO 頁面生成
- `/schema-markup` — 結構化資料優化

## 行銷 MCP Servers

### Twitter MCP
設定檔：`.mcp.json`（需填入 Twitter API keys，到 developer.x.com 申請）

### Ahrefs MCP（已連接）
70+ 個端點：關鍵字研究、競品分析、排名追蹤、反向連結、流量分析

## Blog 文章工作流（Astro）

Blog source of truth 是 Astro Markdown，**不再使用靜態 HTML**。

### 新增文章步驟

```bash
# 1. 寫中文文章
landing-page-astro/src/content/blog/zh-TW/<slug>.md

# 2. 寫英文文章
landing-page-astro/src/content/blog/en/<slug>.md

# 3. 生成 hero 圖（1200×630 OG image）
cd /path/to/repo
python3 marketing/scripts/gen_blog_hero.py "<slug>" "<英文標題>" "<英文副標題>" --tags "tag1,tag2"
# 輸出到 landing-page-astro/public/blog/images/<slug>-hero.png

# 4. 更新 sitemap
landing-page/sitemap.xml  # 補入 ZH + EN 的 <url> 區塊

# 5. 更新 marketing/strategy/05_SEO_文章地圖.md（文章狀態改為 ✅）

# 6. Commit + push → Cloudflare Pages 自動 build
```

### Frontmatter 格式（必填欄位）

```yaml
---
title: "文章標題"
description: "120-155 字元的 meta description，含主要關鍵字"
pubDate: 2026-04-27
locale: zh-TW   # 或 en
tags: ["標籤1", "標籤2"]
author: "ArcSign Security Team"
heroImage: "/blog/images/<slug>-hero.png"
---
```

### 重要注意事項

- **圖片放在** `landing-page-astro/public/blog/images/`（不是 landing-page/blog/images/，那個已刪除）
- `landing-page/blog/` **已完全刪除**，不要在那裡新建 HTML
- `landing-page-astro/scripts/convert-blog.mjs` **已刪除**，不再使用
- SEO 工具腳本在 `marketing/scripts/optimize_blog_seo.py`（描述快取在 `marketing/scripts/seo_descriptions.json`）
- 內部連結用 Markdown 格式：`[文字](/blog/slug)` 或 `[text](/blog/slug)`

## 開發與行銷工作流

```
【工程開發】
  規劃：/office-hours → /plan-eng-review
  實作：Claude Code 直接寫程式碼
  審查：/review → /cso
  測試：/qa（web）
  發布：/ship → git tag 觸發 CI

【行銷活動】
  策略：/market audit → /market competitors
  SEO：Ahrefs MCP 關鍵字研究 → /seo audit → /seo content
  內容：/content-strategy → /copywriting → 直接寫 Astro MD → push
  社群：/market social → /social-content → Twitter MCP 發推
  追蹤：/market report → 每日報告
```
