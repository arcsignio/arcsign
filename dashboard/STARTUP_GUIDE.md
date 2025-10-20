# ArcSign Dashboard 啟動指南

## 前置條件

確保您的系統已安裝：

1. **Node.js** 18+ 和 npm
   ```bash
   node --version  # 應顯示 v18.0.0 或更高
   npm --version   # 應顯示 9.0.0 或更高
   ```

2. **Rust** 和 Cargo
   ```bash
   rustc --version  # 應顯示 rustc 1.70.0 或更高
   cargo --version  # 應顯示 cargo 1.70.0 或更高
   ```

   如果未安裝，請訪問：https://www.rust-lang.org/tools/install

3. **Tauri CLI 系統依賴**
   - **macOS**: Xcode Command Line Tools
     ```bash
     xcode-select --install
     ```
   - **Linux**: libwebkit2gtk-4.0-dev, build-essential, curl, wget, file, libssl-dev, libgtk-3-dev, libayatana-appindicator3-dev, librsvg2-dev
     ```bash
     # Ubuntu/Debian
     sudo apt update
     sudo apt install libwebkit2gtk-4.0-dev build-essential curl wget file libssl-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev
     ```
   - **Windows**: Microsoft C++ Build Tools, WebView2

## 初始化項目

### 步驟 1: 安裝前端依賴

```bash
cd /Users/jnr350/Desktop/Yansiang/arcSignv2/dashboard
npm install
```

這將安裝所有前端依賴：
- React 18+
- Tauri API
- React Hook Form + Zod (表單驗證)
- Zustand (狀態管理)
- react-window (虛擬滾動)
- TailwindCSS (樣式)
- Vite (構建工具)
- Vitest (測試框架)

### 步驟 2: 構建 Rust 依賴

Rust 依賴會在第一次運行時自動下載和編譯。

## 啟動應用

### 開發模式

```bash
npm run tauri:dev
```

這將：
1. 啟動 Vite 開發服務器（http://localhost:5173）
2. 構建 Rust 後端
3. 打開 Tauri 窗口

**首次運行**：Rust 依賴編譯可能需要 5-10 分鐘。後續啟動會快得多（<30秒）。

### 僅前端開發

如果您只想開發前端 UI（不需要 Tauri 功能）：

```bash
npm run dev
```

然後在瀏覽器中打開 http://localhost:5173

## 測試

### 運行前端測試

```bash
npm run test
```

### 運行前端測試（帶 UI）

```bash
npm run test:ui
```

### 運行 Rust 測試

```bash
cd src-tauri
cargo test
```

## 構建生產版本

```bash
npm run tauri:build
```

構建產物位置：
- **macOS**: `src-tauri/target/release/bundle/dmg/`
- **Windows**: `src-tauri/target/release/bundle/msi/`
- **Linux**: `src-tauri/target/release/bundle/appimage/` 或 `deb/`

## 常見問題

### 問題 1: `npm install` 失敗

**解決方案**：
```bash
# 清除 npm 緩存
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

### 問題 2: Rust 編譯失敗

**解決方案**：
```bash
# 更新 Rust
rustup update

# 清除 Cargo 構建緩存
cd src-tauri
cargo clean
cd ..
```

### 問題 3: Tauri 窗口無法打開

**檢查**：
- 確保端口 5173 未被占用
- 查看終端錯誤信息
- 確認 `src-tauri/tauri.conf.json` 中 `devPath` 設置正確

### 問題 4: "Cannot find module '@/components/...'"

**解決方案**：
檢查 `tsconfig.json` 中的路徑別名配置：
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

### 問題 5: CLI 二進制文件未找到

**解決方案**：
確保 Go CLI 已構建並複製到正確位置：
```bash
# 在項目根目錄
cd /Users/jnr350/Desktop/Yansiang/arcSignv2
go build -o arcsign ./cmd/arcsign

# 複製到 Tauri 目錄
cp arcsign dashboard/src-tauri/
```

## 項目結構

```
dashboard/
├── src/                      # React 前端源碼
│   ├── components/           # UI 組件
│   ├── pages/                # 頁面組件
│   ├── stores/               # Zustand 狀態管理
│   ├── services/             # API 服務
│   ├── hooks/                # React Hooks
│   ├── types/                # TypeScript 類型定義
│   ├── validation/           # 表單驗證 schemas
│   ├── main.tsx              # React 入口
│   └── index.css             # 全局樣式
├── src-tauri/                # Rust 後端
│   ├── src/
│   │   ├── main.rs           # Tauri 主入口
│   │   ├── commands/         # Tauri 命令處理器
│   │   └── models/           # 數據模型
│   ├── Cargo.toml            # Rust 依賴
│   ├── tauri.conf.json       # Tauri 配置
│   └── build.rs              # 構建腳本
├── tests/                    # 測試文件
│   ├── frontend/             # React 組件測試
│   └── rust/                 # Rust 集成測試
├── package.json              # Node.js 依賴
├── vite.config.ts            # Vite 配置
├── tsconfig.json             # TypeScript 配置
├── tailwind.config.js        # TailwindCSS 配置
└── vitest.config.ts          # Vitest 測試配置
```

## 開發工作流

1. **前端開發**：
   ```bash
   npm run dev  # 僅前端熱重載
   ```

2. **全棧開發**：
   ```bash
   npm run tauri:dev  # 前端 + Rust 後端
   ```

3. **運行測試**：
   ```bash
   npm run test         # 前端測試
   cargo test           # Rust 測試（在 src-tauri/ 目錄）
   ```

4. **提交代碼**：
   ```bash
   git add .
   git commit -m "feat: 您的功能描述"
   git push
   ```

## 功能特性

已實現的所有用戶故事：

- ✅ **US1**: 創建新錢包（BIP39 助記詞生成）
- ✅ **US2**: 導入現有錢包（助記詞驗證）
- ✅ **US3**: 查看所有地址（54+ 條區塊鏈）
- ✅ **US4**: 管理多個錢包（最多 10 個）
- ✅ **US5**: 導出地址列表（JSON/CSV）
- ✅ **安全功能**：
  - 15 分鐘自動登出
  - 助記詞截圖保護
  - 剪貼板自動清除（30秒）
  - AES-256-GCM 加密
  - Argon2id 密鑰派生

## 性能指標

- 錢包創建：<5秒
- 地址加載：<5秒（54+ 地址）
- 地址導出：<5秒
- UI 響應：<100ms
- 地址搜索：<50ms

## 獲取幫助

- **文檔**: `SYSTEM_SPECIFICATION.md`
- **任務列表**: `../specs/004-dashboard/tasks.md`
- **規格說明**: `../specs/004-dashboard/spec.md`
- **實施計劃**: `../specs/004-dashboard/plan.md`

---

**版本**: 1.0.0
**最後更新**: 2025-10-20
**狀態**: 生產就緒 ✅
