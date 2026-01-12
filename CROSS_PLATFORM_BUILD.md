# 🌐 ArcSign 跨平台打包指南

**日期**: 2026-01-12
**Tauri 版本**: 1.x
**目標平台**: macOS, Windows, Linux

---

## 📋 概述

### 當前狀況

- ✅ **macOS (Apple Silicon)**: 已成功打包 (57MB DMG)
- ❌ **macOS (Intel)**: 需要在 Intel Mac 或使用 Universal Binary
- ❌ **Windows**: 需要在 Windows 環境打包或使用 GitHub Actions
- ❌ **Linux**: 需要在 Linux 環境打包或使用 GitHub Actions

### Tauri 跨平台打包限制

**重要**：Tauri **無法**在單一平台上打包所有目標平台。原因：

1. **原生編譯**：Tauri 使用原生編譯，需要目標平台的工具鏈
2. **平台特定依賴**：每個平台有不同的系統庫和 API
3. **程式碼簽章**：macOS 和 Windows 需要平台特定的簽章工具

---

## 🎯 解決方案

### 方案 1: GitHub Actions CI/CD（推薦）

**優點**：
- ✅ 自動化打包所有平台
- ✅ 免費（開源專案）
- ✅ 可重現的建置環境
- ✅ 自動發布到 GitHub Releases

**設定步驟**：

1. 建立 `.github/workflows/build.yml`
2. 配置多平台打包任務
3. 每次 git push 或 release 時自動觸發

**範例工作流程**：見下方「GitHub Actions 配置」

---

### 方案 2: 多台實體機器打包

**方法**：
- macOS：在 Mac 上打包（當前）
- Windows：在 Windows PC 上打包
- Linux：在 Linux 機器或 VM 上打包

**優點**：完全控制建置環境
**缺點**：需要多台機器，手動操作繁瑣

---

### 方案 3: Docker + QEMU（有限支援）

**警告**：Tauri 不完全支援容器化打包，因為：
- macOS DMG 需要 macOS 原生環境
- Windows 簽章需要 Windows
- GUI 應用程式的容器化挑戰

**僅適用於**：Linux AppImage/DEB 打包

---

## 🛠️ GitHub Actions 配置

### 完整 Workflow 範例

創建 `.github/workflows/release.yml`:

\`\`\`yaml
name: Release Build

on:
  push:
    tags:
      - 'v*'
  workflow_dispatch:

jobs:
  release:
    strategy:
      fail-fast: false
      matrix:
        platform:
          - os: macos-latest
            target: aarch64-apple-darwin
            name: macOS-ARM64
          - os: macos-latest
            target: x86_64-apple-darwin
            name: macOS-Intel
          - os: windows-latest
            target: x86_64-pc-windows-msvc
            name: Windows-x64
          - os: ubuntu-20.04
            target: x86_64-unknown-linux-gnu
            name: Linux-x64

    runs-on: \${{ matrix.platform.os }}

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'

      - name: Setup Rust
        uses: dtolnay/rust-toolchain@stable
        with:
          targets: \${{ matrix.platform.target }}

      - name: Install system dependencies (Ubuntu)
        if: matrix.platform.os == 'ubuntu-20.04'
        run: |
          sudo apt-get update
          sudo apt-get install -y \\
            libwebkit2gtk-4.0-dev \\
            build-essential \\
            curl \\
            wget \\
            libssl-dev \\
            libgtk-3-dev \\
            libayatana-appindicator3-dev \\
            librsvg2-dev

      - name: Install Go
        uses: actions/setup-go@v4
        with:
          go-version: '1.21'

      - name: Build Go library
        run: |
          cd internal/lib
          go build -o ../../dashboard/src-tauri/libarcsign.dylib -buildmode=c-shared exports.go

      - name: Install frontend dependencies
        run: |
          cd dashboard
          npm install

      - name: Build Tauri app
        uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
          TAURI_PRIVATE_KEY: \${{ secrets.TAURI_PRIVATE_KEY }}
          TAURI_KEY_PASSWORD: \${{ secrets.TAURI_KEY_PASSWORD }}
        with:
          projectPath: dashboard
          tagName: v__VERSION__
          releaseName: 'ArcSign v__VERSION__'
          releaseBody: 'See CHANGELOG.md for details'
          releaseDraft: true
          prerelease: false

      - name: Upload artifacts
        uses: actions/upload-artifact@v3
        with:
          name: \${{ matrix.platform.name }}
          path: |
            dashboard/src-tauri/target/release/bundle/**/*.dmg
            dashboard/src-tauri/target/release/bundle/**/*.msi
            dashboard/src-tauri/target/release/bundle/**/*.exe
            dashboard/src-tauri/target/release/bundle/**/*.deb
            dashboard/src-tauri/target/release/bundle/**/*.AppImage
\`\`\`

---

## 📦 手動打包指南

### macOS

#### Apple Silicon (當前環境)
\`\`\`bash
cd dashboard
npm run tauri build
# 輸出: src-tauri/target/release/bundle/macos/*.dmg
\`\`\`

#### Universal Binary（同時支援 ARM64 + Intel）
\`\`\`bash
# 需要 Xcode 和兩種架構的 Rust toolchain
rustup target add aarch64-apple-darwin
rustup target add x86_64-apple-darwin

# 修改 tauri.conf.json:
# "targets": ["aarch64-apple-darwin", "x86_64-apple-darwin"]

cd dashboard
npm run tauri build
\`\`\`

**注意**：Universal Binary 需要兩倍的建置時間和儲存空間

---

### Windows

**前置條件**：
- Windows 10/11
- Visual Studio 2019+ (Build Tools)
- Rust (MSVC toolchain)
- Node.js 18+

\`\`\`powershell
# 安裝 Rust (MSVC)
rustup toolchain install stable-msvc
rustup default stable-msvc

# 建置
cd dashboard
npm install
npm run tauri build

# 輸出:
# src-tauri/target/release/bundle/msi/*.msi
# src-tauri/target/release/bundle/nsis/*.exe
\`\`\`

---

### Linux (Ubuntu/Debian)

**前置條件**：
\`\`\`bash
sudo apt-get update
sudo apt-get install -y \\
  libwebkit2gtk-4.0-dev \\
  build-essential \\
  curl \\
  wget \\
  libssl-dev \\
  libgtk-3-dev \\
  libayatana-appindicator3-dev \\
  librsvg2-dev
\`\`\`

**建置**：
\`\`\`bash
cd dashboard
npm install
npm run tauri build

# 輸出:
# src-tauri/target/release/bundle/deb/*.deb
# src-tauri/target/release/bundle/appimage/*.AppImage
\`\`\`

---

## 🔐 程式碼簽章

### macOS

**需要**：
- Apple Developer 帳號 ($99/年)
- Developer ID Application 憑證

**配置**：
\`\`\`json
// tauri.conf.json
{
  "tauri": {
    "bundle": {
      "macOS": {
        "signingIdentity": "Developer ID Application: Your Name (TEAM_ID)"
      }
    }
  }
}
\`\`\`

**公證 (Notarization)**：
\`\`\`bash
xcrun notarytool submit \\
  ArcSign.dmg \\
  --apple-id "your@email.com" \\
  --password "app-specific-password" \\
  --team-id "TEAM_ID" \\
  --wait
\`\`\`

---

### Windows

**需要**：
- Code Signing 憑證 ($200-500/年)
- SignTool (Windows SDK)

**配置**：
\`\`\`json
// tauri.conf.json
{
  "tauri": {
    "bundle": {
      "windows": {
        "certificateThumbprint": "YOUR_CERT_THUMBPRINT",
        "digestAlgorithm": "sha256",
        "timestampUrl": "http://timestamp.digicert.com"
      }
    }
  }
}
\`\`\`

---

## 📊 建置輸出大小估算

| 平台 | 格式 | 大小 (估算) |
|------|------|------------|
| macOS ARM64 | DMG | 57 MB (實際) |
| macOS Intel | DMG | ~60 MB |
| macOS Universal | DMG | ~110 MB |
| Windows | MSI | ~50 MB |
| Windows | NSIS | ~45 MB |
| Linux | DEB | ~40 MB |
| Linux | AppImage | ~50 MB |

---

## 🚀 推薦流程

### 階段 1：測試階段（當前）

**目標**：快速迭代開發

**方法**：
- ✅ 只打包 macOS (ARM64)
- ✅ 手動建置
- ✅ 本地測試

---

### 階段 2：Alpha/Beta 發布

**目標**：擴大測試範圍

**方法**：
1. 設定 GitHub Actions
2. 打包 macOS (ARM64 + Intel) + Windows + Linux
3. 上傳到 GitHub Releases (Draft)
4. 內部測試所有平台

---

### 階段 3：正式發布

**目標**：公開發布

**方法**：
1. 購買程式碼簽章憑證
   - macOS: Apple Developer ($99/年)
   - Windows: Code Signing ($200-500/年)
2. 配置自動簽章
3. 自動發布到:
   - GitHub Releases
   - 官網下載頁面
   - (選) Homebrew (macOS)
   - (選) Chocolatey (Windows)
   - (選) Snap Store (Linux)

---

## 💡 當前建議

### 短期（本週）

1. ✅ **設定下載連結**（已完成）
   - 將 macOS DMG 移動到 landing-page/downloads/
   - 更新 landing page 下載按鈕

2. 📝 **文檔更新**
   - 告知使用者目前只支援 macOS (Apple Silicon)
   - 說明其他平台即將推出

3. 🧪 **本地測試**
   - 確認 DMG 可正常下載
   - 測試安裝流程

---

### 中期（本月）

4. 🤖 **設定 GitHub Actions**
   - 創建 `.github/workflows/release.yml`
   - 測試自動打包流程
   - 確保所有平台都能成功建置

5. 📦 **打包其他平台**
   - Windows: MSI + NSIS installer
   - Linux: DEB + AppImage
   - macOS Intel: Universal Binary

---

### 長期（下個月）

6. 🔐 **程式碼簽章**
   - 申請 Apple Developer 帳號
   - 購買 Windows Code Signing 憑證
   - 配置自動簽章流程

7. 📢 **發布渠道**
   - GitHub Releases 自動發布
   - Homebrew Cask (macOS)
   - Microsoft Store (Windows, 選用)
   - Snap Store (Linux, 選用)

---

## 📚 相關資源

**官方文檔**：
- [Tauri Building Guide](https://tauri.app/v1/guides/building/)
- [GitHub Actions for Tauri](https://tauri.app/v1/guides/building/cross-platform)
- [Tauri Action (GitHub)](https://github.com/tauri-apps/tauri-action)

**社群資源**：
- [Tauri Discord](https://discord.com/invite/tauri)
- [GitHub Discussions](https://github.com/tauri-apps/tauri/discussions)

---

## ✅ 下一步行動

1. **立即**：
   - [x] 移動 macOS DMG 到 downloads/
   - [x] 更新 landing page 下載連結
   - [x] 建立此文檔

2. **本週**：
   - [ ] 測試下載流程
   - [ ] 準備 GitHub Actions workflow
   - [ ] 更新 README 說明平台支援狀況

3. **本月**：
   - [ ] 實作 GitHub Actions 自動打包
   - [ ] 打包 Windows 和 Linux 版本
   - [ ] 設定自動發布流程

---

**結論**：Tauri 無法在單一平台上打包所有目標，但透過 GitHub Actions，我們可以實現自動化的跨平台打包流程。當前階段建議先專注於 macOS 發布，然後逐步加入其他平台。

🌐 **Cross-Platform Build Strategy - Build Once, Deploy Everywhere (with CI/CD)** 🌐
