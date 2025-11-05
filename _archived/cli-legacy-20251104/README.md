# ArcSign CLI Legacy (Archived 2025-11-04)

## 歸檔原因

ArcSign 項目已轉向 **Dashboard (Tauri) → FFI → Go Shared Library** 架構。
傳統的 CLI 工具已不再維護，所有功能將通過 Dashboard UI 提供。

## 歸檔內容

### internal-cli/
原 `internal/cli` 目錄的所有代碼：
- `errors.go` - CLI 錯誤處理
- `mode.go` - CLI 模式檢測
- `output.go` - CLI 輸出格式化
- `types.go` - CLI 類型定義

### tests-cli/
原 `tests/cli` 目錄的所有測試（9 個文件）：
- 地址生成測試
- 錢包創建測試
- JSON 輸出測試
- 模式檢測測試
- 錯誤日誌測試
- 文件權限測試

### build-scripts/
- `build.sh` - Linux/macOS 構建腳本
- `build.bat` - Windows 構建腳本

### binary/
- `arcsign` - 最後編譯的 CLI 二進制文件 (13MB)

### docs/
- `README-CLI.md` - 從主 README 提取的 CLI 使用文檔

## 新架構

```
Dashboard (Tauri/Rust UI)
    ↓
FFI (libarcsign.h)
    ↓
Go Shared Library
    ├── Wallet Management (CreateWallet, ImportWallet, etc.)
    └── ChainAdapter (Build, Sign, Broadcast transactions)
```

## 如需恢復

如果需要恢復 CLI 功能：

1. 將 `internal-cli/` 複製回 `internal/cli/`
2. 將 `tests-cli/` 複製回 `tests/cli/`
3. 恢復 README.md 中的 CLI 使用文檔（見 `docs/README-CLI.md`）
4. 使用 `build-scripts/build.sh` 重新構建

## 歸檔日期

2025-11-04

## 相關 Commit

[將在提交時填寫]
