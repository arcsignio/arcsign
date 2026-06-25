# Changelog

All notable changes to ArcSign. Format follows [Keep a Changelog](https://keepachangelog.com/),
Semantic Versioning.

## [v1.5.1] — 2026-06-25 — Unified Signing Security Gate

### Security

- **Every signing path now passes through one mandatory backend gate before a
  private key is touched.** Previously, `eth_signTypedData` (EIP-712) and
  `personal_sign` reached signing without any security check — the main attack
  surface for phishing signatures (malicious `Permit` / `Permit2` /
  `setApprovalForAll`). Transactions, EIP-712 typed data, and messages now all
  route through the same architecturally-unbypassable gate.
- **EIP-712 `verifyingContract` normalization defense.** A non-canonical
  `verifyingContract` (e.g. a decimal number instead of a `0x` address — the
  ScamSniffer/SlowMist bypass that affected 40+ wallets) is flagged as danger
  instead of rendering blank.
- **Blocklist screening of signature contents.** The `spender` / `operator` /
  `verifyingContract` embedded in an EIP-712 request, and any `0x` address in a
  `personal_sign` message, are screened against the embedded blocklist
  (OFAC-sanctioned + known scam spenders). Free, offline, no API key.
- Danger detected and not acknowledged → the backend refuses to sign; the
  private key is never decrypted or touched.

### Changed

- Private-key derivation is consolidated into a single entry point
  (`deriveAndSign`) whose first step is the security gate — no signing path can
  reach key material without passing it.
- `mapSignError` delegates to `MapWalletError`, restoring specific error codes
  (e.g. wrong-password) for message/typed-data signing, consistent with
  `SignTransaction`.

### Fixed

- Rust `SignMessageInput` / `SignTypedDataInput` were missing the
  `acknowledged_risk` field, so the user's risk acknowledgement was silently
  dropped before reaching the backend gate. Plumbed end-to-end.

## [v1.4.0] — 2026-05-14 — Open Source Launch

### Changed

- License changed from MIT to **Apache License 2.0**.
- Repository module path: `github.com/Jason-chen-taiwan/arcSignv2` → `github.com/arcsignio/arcsign`.
- Swap referrer fee receiver: ArcSignPro NFT contract → Treasury EOA
  (`0x2e26cbD533Ac3E98d3B650c7f89406EbB6f2f634`). The previous receiver
  was a contract that could not withdraw ERC-20 fees; the new receiver
  is an EOA that can.

### Added

- `internal/wallet/constants.go` — official addresses as compile-time constants.
- `OFFICIAL_ADDRESSES.md` — user-facing verification doc.
- `SECURITY.md` — disclosure policy, PGP key, threat model, bounty status.
- `CONTRIBUTING.md` — DCO sign-off, PR / issue process, what we do NOT accept.
- `CODE_OF_CONDUCT.md` — Contributor Covenant 2.1.
- `TRADEMARK.md` — common-law ™ policy + fork naming rules.
- `ROADMAP.md` — public roadmap (shipped + planned + explicitly not planned).
- `NOTICE` — Apache 2.0 §4(d) attribution + trademark notice.
- Reproducible builds CI (planned: `docs/reproducible-builds.md`).
- Dashboard logs official contract addresses on startup.

### Removed

- 17.1 MB Mach-O binary `lib` accidentally committed in 2026-01
  (purged from entire git history via `git filter-repo`).

## [v1.2.3] — 2026-03-11

- chore: bump version to 1.2.3
- fix(updater): 改用 R2 端點修復 OTA 更新偵測失敗
- ci: update landing page downloads to v1.2.2 [skip ci]

## [v1.2.2] — 2026-03-11

- fix(ci): 鎖定 Rust 1.93.1 修復 Linux wry/webkit2gtk 編譯失敗
- docs: 優化 CLAUDE.md — 補齊目錄說明、DMG 提示、zh-TW 慣例
- docs: CLAUDE.md 新增 Release Process 說明
- fix(blog): 補上 XOR 加密文章 hero 圖片
- chore: bump version to 1.2.2
- fix(dashboard): CSP img-src 放寬 + token icon fallback + XOR 加密文章
- feat: QR code 本地化修復 + 新手入門文章 + 行銷素材更新
- feat(blog): 雙語架構（中文 + 英文）+ hreflang SEO + 語言切換按鈕
- feat(marketing): SEO 文章地圖 90 篇 + 每日 1 篇 + 開源時程修正為用戶破萬後
- fix(marketing): 開源時程統一改為「用戶破萬後開源」+ 新增 SEO 文章地圖
- fix(marketing): 修正所有「已開源」虛假宣稱 → 改為「計畫 Q2 2026 開源」
- gitignore *.pyc
- fix(landing): 主頁導覽列與 footer 加入 Blog 連結
- feat(marketing): 動態 Dashboard v2 + SEO 部落格系統 + CJK 字型修復
- docs: 新增行銷策略與內容素材，更新競品分析與投資計劃
- fix(install): 修復 Windows 安裝腳本 USB 選擇無限迴圈

## [v1.2.1] — 2026-03-03

- release: v1.2.1 — R2 下載遷移 + 開發者模式修復 + USB 偵測修復
- fix: CI 和 Makefile 加 -tags dev，修復 CreateDevSession 缺失
- feat: 下載檔遷移至 Cloudflare R2，支援 Private Repo
- fix: 修復 USB 偵測重複問題，加 sort -u 去重
- fix: 修正 diskutil 參數順序，修復 USB 偵測失敗
- fix: macOS install.sh USB 偵測改用 diskutil，排除非 USB 磁碟
- feat: Landing page 全面對齊 v1.2.0 + 三平台一鍵安裝
- ci: update landing page downloads to v1.2.0 [skip ci]
- fix(ci): 修復三平台 build 失敗問題
- docs: 更新 landing page 反映 v1.2.0 現狀

## [v1.2.0] — 2026-03-02

- release: v1.2.0 — Onboarding, OTA UI, Analytics, 安全修復
- fix: KyberSwap 價格影響處理 amountOutUsd=0 + 更新 README
- style: 統一設定頁開發者模式卡片樣式
- feat: 新增下載追蹤 + 匿名活躍用戶 heartbeat
- feat: 新增 OTA 自動更新完整 UI，取代原生系統彈窗
- feat: 新增首次使用 Onboarding 導引 + KyberSwap 價格影響修復
- refactor: 移除非 EVM/BTC 鏈，僅保留 22 條鏈 (BTC + 21 EVM)
- security: 修復 11 個安全漏洞 (4 HIGH + 5 MEDIUM + 2 LOW)
- docs: 更新 README 反映 v1.1.5 與三平台 CI/CD
- security: 修復 6 個 High 等級安全漏洞
- security: 修復 5 個 Critical 漏洞 + 啟用 Tauri 自動更新
- feat(landing): 新增 Windows 和 Linux 下載連結

## [v1.1.5] — 2026-02-25

- fix(ci): 停用未設定的 Apple 簽名環境變數
- fix(ci): 修正 Windows PowerShell glob 展開問題
- fix(ci): 拆分平台特定 syscall 修復 Windows DLL 建置
- fix(ci): 修正 Windows Go 共享庫建置
- chore: release v1.1.5
- ci(release): 自動更新 Landing Page 下載連結
- fix(lint): 修正 golangci-lint 全部 16 個錯誤
- fix(ci): 修正 golangci-lint Go 版本不匹配與棄用設定
- fix(ci): 修正 CI 管線三個失敗問題
- chore: 將 Pitch Deck 移至 pitch_deck/ 資料夾
- chore: 將文件整理至 doc/ 資料夾
- ci: 建立 GitHub Actions CI/CD 自動化管線
- test: 新增 ~370 個測試，全面提升測試覆蓋率
- refactor: 建立 Single Source of Truth 統一商業邏輯常數
- fix: 統一錢包數量限制公式為 1 + (nftCount * 3)
- chore: 將編譯產物 lib 加入 gitignore 並提交開發工具腳本
- fix(gas): 修正手動簽名路徑 gas 解析錯誤及優化各鏈 gas 策略
- chore: 更新 CGO 自動生成的 C header 檔
- feat(membership): 新增使用 session token 同步/移除 membership binding
- fix(build): 修正 macOS dylib 載入失敗問題


## [v1.1.1] — 2026-02-06

- chore: bump version to 1.1.1
- feat(dashboard): 新增交易歷史白名單過濾功能
- fix(chainadapter): 啟用 RPC multi-endpoint fallback 機制

## [v1.1.0] — 2026-02-06

- feat: release v1.1.0 with Developer Mode
- update all and remove docu
- fix(hardhat-plugin): 修正空字串 API key 無法覆蓋的問題
- feat(hardhat-plugin): 新增 Block Explorer API Key 自動注入功能
- feat(developer): 新增開發者模式設定功能 - Block Explorer API Keys
- feat(developer): 新增簽名歷史 Block Explorer 連結功能
- fix(hardhat-plugin): 修復 script_name 偵測邏輯
- feat(developer): 新增 script_name 欄位顯示腳本來源
- feat(developer): 新增簽名歷史持久化儲存功能
- feat(developer): 完成 Developer Mode 簽名流程並修復相關問題
- feat(developer): 整合 Hardhat plugin 與 Developer Mode 簽名流程
- fix(dashboard): Add developer mode navigation handler in Settings
- feat(developer-mode): Update flow to select wallet first before entering dev mode
- feat(hardhat-plugin): Add @arcsign/hardhat-plugin for Hardhat integration
- feat(developer-mode): Add developer mode UI and WebSocket protocol extensions
- official claude upgrade
- feat(i18n): 將網站預設語言改為英文，面向全球市場
- feat(seo): 加入 SEO 優化 - sitemap、robots.txt、Open Graph
- feat(landing): 加入 Google Analytics 4 追蹤
- chore: 更新 README 至 v1.0.0 並移除 GitHub Actions


## [v1.0.0] — 2026-01-26

- chore: release v1.0.0 - 正式版本發布
- feat(landing): 新增企業解決方案頁面
- docs(tutorial): 更新隨插即用支援所有作業系統
- docs(faq): 移除加密技術細節，簡化安全說明
- docs(faq): 更新 USB 損壞 FAQ，加入加密備份方式
- feat(landing): 優化 Landing Page UI 和內容
- chore(provider): 暫時停用 1inch provider 選項
- docs(tutorial): 移除 1inch provider 說明
- docs(tutorial): 新增 RPC Provider 設定說明
- feat(landing): 重新定義產品願景與價值主張
- docs(whitepaper): 改為 Coming Soon 佔位頁面
- docs(faq): 修正 Swap 手續費說明
- feat(landing): 新增資源頁面與優化首頁
- feat(staking): 加入最低質押金額驗證
- fix(staking): 修復 estimate_fee 缺少 sessionToken 參數的問題
- feat(security): 實作錢包鎖定機制全面阻擋
- refactor(membership): 調整錢包額度公式 3+(n×5) → 1+(n×3)
- refactor(walletconnect): 移除未實作的 read-only RPC 方法
- feat(history): 遷移 Transaction History 到 session token 認證
- chore: 更新 FFI header 和 Landing Page


