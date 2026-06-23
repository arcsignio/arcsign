# IMPLEMENTATION_PLAN — 全鏈餘額改走公共 RPC + Multicall3(降低 Alchemy 依賴)

> Branch: `feature/balance-multicall` · Worktree: `.worktrees/balance-multicall`
> 目標:把「餘額查詢」從第三方 indexer(Alchemy/NodeReal)手中拿回來,全 7 鏈統一走
> 「公共 RPC pool + Multicall3 + 主流 token 清單 + DefiLlama 免 key 價格」。NFT / 交易歷史 /
> 大範圍 discovery 務實保留給 Alchemy(本質需全鏈索引,公共 RPC 不可替代)。

---

## 0. 背景與最重要的前提(讀程式後的發現)

**這次不是「從零建 indexer」。** 探查現有程式發現:你設計的整套架構
(公共 RPC pool + Multicall3 + 主流 token 清單 + 免 key 價格)**已經完整存在並通過測試**,
目前定位為「沒有 API key 時的 degraded fallback」。本計畫的本質是:

> **把這條已存在的 degraded 路徑,從「無 key 降級路線」提升為「餘額維度的主路線」,
> 並把路由從「鏈維度(一鏈一 provider)」改成「功能維度(餘額走自建、NFT/歷史走 Alchemy)」。**

### 已存在、可直接複用(無需重建)

| 元件 | 位置 | 說明 |
|---|---|---|
| 通用 RPC pool(全鏈 primary+backups) | `internal/rpc/registry.go` | `DefaultRegistry`、`GetAllRPCEndpoints(chainID)` |
| Multicall3 批次 balanceOf | `internal/provider/multicall.go` | `aggregate3` + `AllowFailure` + 逐 endpoint fallback;全鏈同址 `0xcA11...CA11` |
| degraded 串接(native + token via pool + multicall) | `internal/provider/degraded.go` | `degradedTokenBalances`、`degradedBalancesForNetwork`、`internalToRegistryChain` |
| 主流 token 清單(後端真理來源) | `internal/provider/common_tokens.go` | `commonTokensByNetwork`、`CommonTokensFor(network)`、「加 token = 加一行」 |
| 免 key 價格 | `EnrichPricesWithDefiLlama`(串在 `exports_app.go` 末段) | DefiLlama,無需 key |
| USB 加密 store 範式 | `internal/provider/config.go` + `internal/services/crypto/encryption.go` | AES-256-GCM、原子寫、`Version` 欄位 |
| 共用型別 | `internal/provider/alchemy_types.go` | `SimplifiedTokenBalance`、`AddressWithNetworks` |

### 功能邊界(本計畫處理 vs 保留第三方)— 已與使用者確認

| 資料 | 公共 RPC 自建? | 本計畫 | 原因 |
|---|---|---|---|
| **餘額(已知 token)** | ✅ 完全可行 | **自建,全鏈(主體)** | 狀態現在式,`balanceOf` 一次 `eth_call` 即得,Multicall3 批量 |
| NFT「某 collection 擁有幾個」 | ✅ 可(需先知 collection) | 不在本計畫(可選後續) | 同 balanceOf,但需 discovery |
| NFT「擁有哪些 tokenId + 圖片」 | ❌ 需掃歷史 + metadata pipeline | **保留 Alchemy** | 多數合約無 Enumerable;1155 需先知 tokenId;metadata 需 IPFS pipeline |
| 大範圍 discovery(碰過哪些 token) | ⚠️ 公共 RPC `eth_getLogs` 限制多 | **小範圍自掃 + 手動加;大範圍靠 Alchemy** | 公共 RPC 常禁/限制 log 範圍 |
| 交易歷史 | ❌ 本質需全鏈索引 | **保留 Alchemy(不可替代)** | 鏈上無「按地址查交易」索引,必須有人事先掃全鏈 |

**核心分水嶺:`eth_call`(讀現在狀態,公共 RPC 強)vs `eth_getLogs`(翻歷史,公共 RPC 弱)。**
餘額是前者 → 自建;NFT 列舉/歷史是後者 → 保留 Alchemy。

---

## 1. 分層架構(對齊使用者推導的設計)

```
聚合層 (exports_app.go GetTokenBalances export / 前端 aggregateTokens.ts)
   │  決定「要抓什麼」:地址 × 鏈
   ▼
Token List 層
   │  表A 主流(common_tokens.go,打包) + 表B 使用者碰過(USB,新增)
   │  → 回傳每鏈要查的 token 清單
   ▼
Multicall 編碼層 (multicall.go)
   │  把 (地址 × token) 打包成每鏈幾個 aggregate3,分批
   ▼
RPC 管理層 (rpc/registry.go)
   │  endpoint pool 輪替 + 逐端點 fallback(+ 後續可加 backoff/並發節流)
   ▼
公共 RPC → Multicall3 → 回 bytes → decode → DefiLlama 補價 → 聚合
```

**擴增規則(高內聚低耦合,符合 CLAUDE.md「register in one place」):**
- 加一條鏈 → 改 RPC 層(`rpc/registry.go` 加 endpoints)+ `internalToRegistryChain` 補一行 + `common_tokens.go` 加該鏈 token。
- 加一個 token → 改 Token List 層(`common_tokens.go` 加一行 / 使用者手動加進表 B)。
- 其他層不動。

---

## 2. 實作階段(TDD,每階段先寫測試)

### Stage 1 — 路由:鏈維度 → 功能維度(本計畫核心)
**目標:餘額查詢全鏈強制走自建公共 RPC+Multicall 路徑,不再依 `GetProviderForNetwork` 的鏈維度路由;NFT/歷史維持原路由。**

- [ ] `internal/provider/chains.go`:新增 `GetBalanceProviderForNetwork(network)` 或 balance 專用 resolver
      — 全鏈一律回「self-hosted RPC」路徑,與既有 `GetProviderForNetwork`(NFT/歷史用)並存。
- [ ] `internal/lib/exports_app.go`:
  - `GetTokenBalances` export 改用 balance 專用 bucketing(不再與 `GetNFTs` 共用
    `bucketAddressesByProvider`),全鏈導向統一的 `degradedTokenBalances`/multicall 路徑。
  - `unavailableProviders` 語意調整:餘額路徑下,reason 改為描述「公共 RPC pool 全掛」而非
    `missing_key`(因為餘額不再需要 key)。
  - 保留 `EnrichPricesWithDefiLlama(allTokens)` 末段不動。
  - `GetNFTs` / `GetAssetTransfers` **不動**,仍走 `GetProviderForNetwork`(Alchemy/Glacier)。
- [ ] `internal/lib/exports_address.go`(單網路版餘額)同步改走 balance resolver。
- **測試**:`chains_test.go` 加 `GetBalanceProviderForNetwork` 全 7 鏈 mapping 斷言;
  `exports_*` 對應的 dispatch 測試(餘額全走自建、NFT 仍走舊路由)。
- **驗證**:`go test ./internal/provider/... ./internal/lib/...`

### Stage 2 — Avalanche 補齊 degraded(目前缺口)
**目標:Avalanche 也能走公共 RPC+Multicall 抓餘額(目前 `common_tokens.go` 無 AVAX、Glacier 未走 degraded)。**

- [ ] `internal/provider/common_tokens.go`:新增 `avalanche-mainnet` 的 `CommonToken` 條目
      (USDC/USDT/WAVAX 等,lowercase 地址 + decimals)。
- [ ] `internal/provider/degraded.go`:`internalToRegistryChain` 補 `avalanche-mainnet → avalanche`(確認 key 名與 `rpc/registry.go` 一致)。
- [ ] 確認 `rpc/registry.go` 有 Avalanche C-Chain 公共 RPC endpoints(無則補)。
- **測試**:`TestCommonTokensTable` 擴充 Avalanche 斷言(地址格式、lowercase);
      degraded 路徑對 avalanche 的 mapping 測試。
- **驗證**:`go test ./internal/provider/...`

### Stage 3 — Multicall 多地址批量(壓 RPC round-trip,可選但建議)
**目標:目前 `GetTokenBalancesMulticall` 是「1 address × N tokens」,多地址仍外層 loop。
冷錢包地址少影響有限,但全鏈 × 多地址時值得一次 aggregate3 打包。**

- [ ] `internal/provider/multicall.go`:擴充支援「M addresses × N tokens」一次 `aggregate3`
      (call list = address × token 笛卡兒積,分批上限 ~100~500 call/批)。
- [ ] decode 時依 call 順序對回 (address, token)。
- **測試**:仿 `multicall_test.go` `httptest` mock,驗多地址一次 eth_call、`atomic.Int32` 確認次數。
- **驗證**:`go test ./internal/provider/...`
- **註**:若時間有限,此階段可延後;Stage 1+2 已達成「全鏈餘額脫離 Alchemy」主目標。

### Stage 4 — USB「使用者碰過的 token」表 B(per-user discovery 持久化)
**目標:仿 `ProviderConfigStore` 開新加密 store,存「地址 → 碰過哪些 token」+ `lastScannedBlock`。**

- [ ] 新檔 `internal/provider/touched_tokens.go`:`TouchedTokenStore`,檔名 `touched_tokens.enc`,
      復用 `crypto.Encrypt/Decrypt` + 原子寫(temp+rename, 0600)+ `Version` 欄位 + `Close()` 清零 password。
      schema:`{ Version, LastScannedBlock: map[network]uint64, DiscoveredTokens: map[address][]tokenAddr }`。
- [ ] FFI export(`exports_app.go` 或新 `exports_tokens.go`):
  - `AddTouchedToken(usbPath, password, address, network, tokenAddr)` — swap output / 手動加用。
  - `GetTouchedTokens(usbPath, password, address)` — 餘額查詢時併入 token 清單。
- [ ] 餘額查詢(Stage 1 的 export)併入表 B:`CommonTokensFor(network)` ∪ 表 B 的 token。
- **測試**:新 `touched_tokens_test.go` — 加密往返、原子寫、schema 版本、與 `common_tokens` 合併去重。
- **驗證**:`go test ./internal/provider/...`

### Stage 5 — 前端:手動加 token + swap 後寫表 + 更新時機
**目標:UI 串接表 B 的寫入時機(對齊設計:啟動掃 / swap output 直接加 / 手動加 / 手動刷新,不輪詢)。**

- [ ] `dashboard/src/services/tauri-api.ts`:新增 `addTouchedToken` invoke(對應 Stage 4 export)。
- [ ] Rust command(`src-tauri/src/commands/wallet.rs` 或新檔)+ 註冊
      (`tauri.conf.json` capabilities + `commands/mod.rs` + `main.rs`)。
- [ ] swap 成功後:把 output token 直接寫表 B(已知,不掃)+ 刷該 token 餘額。
- [ ] 手動加 token UI:貼合約地址 → `eth_call` 讀 `symbol/decimals/balanceOf` 驗證 → 寫表 B
      (MetaMask「Import token」式)。
- [ ] 確認餘額刷新時機:啟動 / 進資產頁 / swap 後 / 手動下拉;**不做定時輪詢**。
- **測試**:Vitest 覆蓋 `addTouchedToken` service、手動加 token 元件(驗證流程、錯誤地址處理)。
- **驗證**:`npx vitest run`

### Stage 6 — 整合驗證 + 重建 dylib
- [ ] `make build-lib-macos`(**CLAUDE.md 明令:改 Go 後必重建,否則 Tauri symbol not found**)。
- [ ] 全套 Go 測試:`go test ./internal/... ./src/...`
- [ ] 前端:`npx vitest run`
- [ ] 手動 dogfood:`npm run tauri:dev`,實機驗證全 7 鏈餘額(含 Avalanche)在「無任何 provider key」
      情況下都能顯示;swap 後餘額正確刷新;手動加 token 正常。
- [ ] 觀察公共 RPC 穩定度(尤其 Ethereum 公共 RPC 體質最差),必要時在 `rpc/registry.go` 補 endpoint。

### Stage 7 — 文件更新(**實作 + 驗收通過後才做**)
**目標:讓 README / CLAUDE.md 反映實際架構。先 code 後文件,避免「文件說有、code 還沒做」誤導貢獻者。**

- [ ] `CLAUDE.md`「Provider data path」章節:更新「Provider/key matrix」
  - 餘額:**全鏈走公共 RPC pool + Multicall3(免 key)**;Alchemy/NodeReal 不再是餘額主路徑。
  - NFT / 交易歷史:仍走 Alchemy(Glacier for AVAX),維持 key 需求說明。
  - 補上分層說明(RPC 層 / Token List 層 / Multicall 編碼層)與「擴增 = 改對應層」規則。
- [ ] `README`:若有提及「provider keys 必要性」的段落,更新為「餘額免 key、NFT/歷史需 key」。
- [ ] `OFFICIAL_ADDRESSES.md` 不受影響(僅合約地址,不動)。
- [ ] 確認文件描述與最終 code 一致(用 verification-before-completion:逐條對照 code 才寫「已實現」)。

---

## 3. 風險與緩解

| 風險 | 緩解 |
|---|---|
| Ethereum 公共 RPC 限流/不穩(體質最差) | RPC pool 多 endpoint 輪替 + 逐端點 fallback(已有);後續可加指數退避/並發節流 |
| 公共 RPC 餘額路徑全鏈全掛 | `unavailableProviders` 如實回報;若該鏈有 Alchemy key,可選保留 fallback(本計畫主路線為全面自建,fallback 視穩定度再議) |
| Avalanche key 名不一致(internal vs rpc registry) | Stage 2 明確核對 `internalToRegistryChain` 與 `rpc/registry.go` chain key |
| 改動 FFI 輸出格式破壞前端 | 餘額路徑輸出維持 `GetTokenBalancesOutput`,FFI 簽名與前端 invoke 不動(純後端內部改) |
| degraded 語意混淆(原為「無 key 降級」) | 餘額路徑下重新定義:degraded 不再代表「缺 key」,而是「公共 RPC 不可用」 |

---

## 4. 不在本計畫範圍(明確排除)

- ❌ 自建 archive node / 全鏈 indexer(家用機做不到,違背冷錢包隱私)。
- ❌ 交易歷史自建(本質需全鏈索引 → 保留 Alchemy)。
- ❌ NFT tokenId 列舉 + metadata pipeline(保留 Alchemy)。
- ❌ 中央 per-user indexer(違背「private keys/資產 never leave device」+ 真實用戶=1)。
- ❌ 大範圍 discovery 掃全鏈(公共 RPC `eth_getLogs` 限制;改用小範圍自掃 + 手動加)。

---

## 5. 驗收標準(Definition of Done)

1. 全 7 鏈(含 Avalanche)在**無任何 provider API key** 下,餘額(native + 主流 token + 使用者碰過的 token)正確顯示。
2. NFT / 交易歷史維持原 Alchemy 路徑、功能不退化。
3. 每個新增/修改的 provider 邏輯、路由、token 表、USB store **都有對應 unit test**(CLAUDE.md 硬性要求)。
4. swap 後餘額正確刷新;手動加 token 可用;無定時輪詢。
5. `make build-lib-macos` 成功;`go test ./...` 與 `npx vitest run` 全綠。
6. dogfood 實機通過。
