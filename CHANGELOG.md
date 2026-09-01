# Changelog

All notable changes to ArcSign. Format follows [Keep a Changelog](https://keepachangelog.com/),
Semantic Versioning.

## [Unreleased]

## [v1.6.2] — 2026-08-31 — 修復匯入錢包完全無法使用

### Fixed

- **匯入錢包完全不能用** — 所有助記詞都被判定為「無效的檢查碼」，包含
  完全正確的。桌面版的助記詞驗證需要 Node.js 的 `Buffer`，而 Tauri 的
  WebView 沒有它：驗證函式在計算 SHA-256 時直接拋錯，錯誤被吞掉，一律
  回報「無效」。

  更糟的是錯誤訊息說「請驗證您的恢復詞組」——把 app 自己的缺陷講成使用者
  抄錯字，讓人去懷疑自己的備份是不是壞了。

  改用 `@scure/bip39`（純 JavaScript、經過審計、不依賴 Node）。

  **你的助記詞從來沒有問題**，也沒有任何資料因此受損——匯入根本沒開始，
  什麼都沒被寫入。受影響的只有「把既有錢包匯入 ArcSign」這個動作。

- 助記詞欄位在修正錯字之後，錯誤訊息不會消失（表單顯示的是前一次輸入的
  驗證結果）。
- 從其他錢包複製助記詞時夾帶的隱形字元（零寬空格、文字方向標記）、清單
  編號（`1. legal 2. winner`）與結尾標點，現在會被自動清除。這些在畫面上
  看不見，卻會讓檢查碼失敗。

### Added

- `make test-e2e` — 端到端測試：建置共享函式庫、掛載真實磁碟區、透過與
  桌面版相同的 C ABI 匯入錢包並確認錢包確實寫入磁碟。
- WebView 環境守門測試 — 在移除 `Buffer`／`process`／`global` 之後才載入
  密碼學相關模組，確保不會再有「測試全過、實機失效」的相依套件。

## [v1.6.1] — 2026-08-31 — 強制刪除忘記密碼的錢包

### Added

- **強制刪除錢包** — 錢包密碼遺失時，原本會永遠卡在 USB 上無法移除。
  現在可改用**解鎖 ArcSign 的 app 密碼**授權刪除，入口在既有刪除對話框
  底部的「忘記錢包密碼？」連結——正常路徑仍是預設，不會讓人平常就伸手
  去拿 app 密碼。

  兩道閘都在 Go 後端（前端 disabled 只是 UX，不是保證）：

  1. app 密碼經 `VerifyAppPassword` 常數時間驗證，且**與解鎖共用同一個
     限流器**——不共用的話，這個匯出會變成猜 app 密碼的免限流旁路，
     而且在這裡花掉的嘗試不會計入解鎖次數。
  2. 手打的錢包名稱在 service 層對照**已存資料**比對，直接呼叫 FFI
     的人一樣不能靠傳錯名字刪掉別的錢包。

  **這不削弱錢包機密性**：助記詞全程維持以錢包密碼加密，刪除密文永遠
  不會解密它。使用者刪掉的正是他本來就能在檔案管理員刪掉的東西，只是
  這條路徑一致且會寫入稽核紀錄（`WALLET_FORCE_DELETE`）。

  刪除前明確警告：錢包內資產仍在鏈上，但將永久無法取用——解開它們的
  密碼已經遺失，而加密備份檔需要的正是同一把密碼。

  確認名稱時忽略大小寫與前後空格。錢包名稱沒有唯一性檢查（兩個錢包
  可以同名），識別錢包的是 `walletID`，名稱只確認使用者知道這是哪個
  錢包——所以 macOS 自動把首字母大寫不會害你被擋在門外。打成**不同的**
  名字仍然拒絕，這才是擋住「刪到隔壁那個錢包」的部分。

### Known limitations

- 強制刪除的限流行為（連續輸錯 app 密碼後暫時鎖定）目前只有程式碼
  層面的保證——與 `UnlockApp` 共用同一個 `appRateLimiter`。

## [v1.6.0] — 2026-08-28 — Clear Signing 與完全開源

### Added

- **ERC-7730 clear signing** — 簽章確認畫面改用合約作者發布到以太坊基金會
  官方註冊表的 descriptor 描述交易，而非僅由 ABI 逆推欄位名。ABI 給型別，
  descriptor 給語意（哪個參數是滑點下限、哪個是收款人）。內建 229 筆快照
  （`go:embed`，涵蓋 7 條鏈的 504 個 deployment），預設完全離線；設定頁可
  手動更新，是唯一的連網點，下載後以 AES-256-GCM 加密存於 USB。
- **ERC-8213 交易指紋** — 簽章畫面永遠顯示 `keccak256(uint256(len) ‖ calldata)`
  的完整 64 字元指紋（分 16 組）。ArcSign 沒有硬體錢包那樣的第二塊實體螢幕，
  指紋讓使用者能在**另一台裝置獨立計算比對**，確認即將被簽的 bytes 未遭竄改。
  指紋旁可展開原始 calldata 供比對輸入。涵蓋率 100%——所有解讀層失效時仍可用。
- **clear signing 鋪設至全部 7 個簽章確認畫面**（先前僅 2 個）。新增
  `useSignReview` 與 `SignReview`：可讀性與安全結論同行，畫面不可能接了閘
  卻漏了可讀性。
- Token Approvals 與 Swap 授權補上前端知情同意閘（後端閘一直都在）。
- 密碼欄位加入顯示／隱藏切換（26 個欄位）。

### Fixed

- **`ChainSpecific["data"]` 型別斷言錯誤**：builder 存 `[]byte`、取值處斷言
  `string`，導致 `txData` 恆為空。後果不只顯示——`guard.Check` 收到的
  `simulation.TxParams.Data` 也一直是空的，**App 內建轉帳路徑的交易模擬
  從未看過真實 calldata**（黑名單比對只看 `to` 位址故仍有效）。
- `BuildTransaction` 未回傳 calldata，前端只能寫死 `data: ""`。
- 原始 calldata 的展開切換原本只在「無法解讀」時出現，而那正是最不需要
  驗證的情況；改為與指紋並列，任何交易都可展開。
- 空錢包時後端回傳 `tokens: null` 導致前端崩潰（後端保證回 `[]`，前端加防禦）。

### Security

- 新增守門測試確保 descriptor 與 digest **只影響顯示、不影響安全判定**：
  `txguard` 不得 import `clearsign`、`SecurityReport` 不得攜帶 descriptor
  欄位、`Guard.Check` 不得接受 descriptor 參數，以及一個對抗性測試
  （惡意 descriptor 宣稱交易安全時，`unlimited-approval` 徽章仍存活）。
- 黑名單檢查、`RequiresAcknowledge` 判定、session token 機制不受影響。

### Removed

- 移除全部盈利機制：錢包數量限制、swap 0.1% 抽成、Pro 最佳路徑閘、
  交易模擬分級閘、Pro NFT／Referral 合約、tier 回報 heartbeat、升級 UI。
  所有功能對所有使用者開放。
- 刪除 `contracts/` 與 `OFFICIAL_ADDRESSES.md`。

### Changed

- 交易模擬改為「有 Alchemy key 就執行」，不再依使用者分級。
- Swap 一律走平行最佳路徑報價，不帶 referrer 參數。

### Security

- 黑名單檢查、`RequiresAcknowledge` 簽章閘、session token 機制不受影響。

## [v1.5.4] — 2026-07-06 — WalletDetail Decomposition

### Changed

- **WalletDetail refactored from a 2979-line component into focused units.**
  The largest frontend file after v1.5.3 is now a ~2142-line coordinator.
  Extracted: pure token-metadata enrichment (`enrichTokens.ts`, deduping three
  identical copies), pure formatters (`walletDetailFormat.ts`), the seven
  full-screen sub-view dispatch blocks (`walletDetail/WalletDetailViews.tsx`),
  and the unlock → passphrase → load-balances state machine (`useWalletData.ts`).
  Behavior is unchanged; the signing-sensitive `validatedPassphrase` and
  `passwordRef` plumbing is byte-identical to before, verified end-to-end.
  The asset-list render body stays in the main component (its extraction is
  planned for a later release).

## [v1.5.3] — 2026-07-03 — Swap Component Decomposition + Service Layer

### Changed

- **SwapTransaction refactored from a 3238-line component into focused units.**
  Pure formatters moved to `swapFormat.ts`, the flow state machine to a
  `useSwapFlow` hook, and each step rendered by a small presentational component
  under `components/swap/`. The main component is now a ~355-line coordinator.
  Behavior is unchanged; the mandatory backend sign-gate and its
  `acknowledgedRisk` plumbing are byte-identical to before.
- **Swap orchestration extracted into a pure `swapService.ts`.** The multi-step
  build → sign → broadcast → record sequence (for both approval and swap) now
  lives in a React-free service that the hook calls; the service reports progress
  via a callback and throws stable error codes the hook maps to i18n. Every
  `signTransaction` call is byte-identical to the pre-refactor code, verified
  field-by-field. No Go / backend changes.

### Fixed

- **Return to the asset list and refresh balances after a successful swap.**
  Previously the swap success handler only logged; the view stayed open and
  balances weren't refreshed. It now closes the swap view and re-fetches
  balances. The same pre-existing bug in the Send flow is fixed the same way.

## [v1.5.2] — 2026-07-01 — WebSocket Pairing Gate + Swap Resilience

### Security

- **Mint-page connection pairing gate.** The localhost WebSocket (`127.0.0.1:9527`)
  used by the Pro NFT mint page now requires a one-time 8-digit pairing code
  (shown in the desktop app, entered in the mint page) before any account or
  signing method is allowed — 60s TTL, 3-attempt lockout, constant-time
  comparison. Replaces the prior boolean-authenticated model.
- **Origin allowlist hardening.** Production builds reject empty Origin
  (non-browser local processes) and localhost dev ports; only the apex mint-page
  origin and Tauri's own webview origins are allowed. Origin comparison is now
  case-insensitive per RFC 6454.
- **Pairing-code comparison length gate.** A length mismatch now folds into the
  same wrong-attempt path as a content mismatch, removing a distinguishable
  early return so the constant-time compare is honest end-to-end.

### Changed

- **Dev / production build split.** Developer-only WebSocket auto-sign helpers
  are compiled behind a `dev-mode` feature; production builds return a friendly
  error instead. CI publishes both a production release (3 platforms) and a
  `-dev` build (macOS/Linux).
- Signing paths (transaction / message / typed-data) consolidated through a
  single `deriveSecureSigner` (decrypt + derive), byte-identical to the prior
  per-path code.

### Fixed

- **Swap quote resilience.** OpenOcean and KyberSwap clients send a browser-like
  User-Agent to avoid Cloudflare 403s. Free users whose OpenOcean quote/build
  fails now fall back to KyberSwap automatically (no referrer fee on the
  fallback), for both quote and transaction build.
- **Swap confirm shows the route you'll actually sign.** When a free-user swap
  falls back to a different provider between quote and build, the confirmation
  step shows a "route updated" notice with the actual provider and fee.

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


