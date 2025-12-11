# 開發與調試指南

## 日誌系統

### 啟動帶日誌的開發模式

```bash
./start-dev-with-logs.sh
```

這會：
- 啟動 Tauri 開發服務器
- 將所有輸出記錄到 `~/Library/Logs/ArcSign/`
- 生成三個日誌文件：
  - `frontend-TIMESTAMP.log` - 前端日誌
  - `backend-TIMESTAMP.log` - 後端日誌
  - `combined-TIMESTAMP.log` - 合併日誌
- 實時顯示合併日誌

### 查看日誌

```bash
./view-logs.sh
```

選項：
1. 查看完整日誌
2. 查看最後 50 行
3. 查看最後 100 行
4. 搜尋錯誤
5. 搜尋 'is_first_time_setup'
6. 搜尋 'unlock'
7. 實時跟蹤（tail -f）
8. 在編輯器中打開

### 手動查看日誌

```bash
# 列出所有日誌文件
ls -lht ~/Library/Logs/ArcSign/

# 查看最新的合併日誌
tail -f ~/Library/Logs/ArcSign/combined-*.log

# 搜尋特定錯誤
grep -i "error" ~/Library/Logs/ArcSign/combined-*.log

# 搜尋特定函數調用
grep "is_first_time_setup" ~/Library/Logs/ArcSign/combined-*.log
```

## 當前問題調試

### 問題：認證畫面顯示但出現錯誤

**症狀：**
- 紫色漸層背景顯示正常
- 出現 "Failed to check setup status: An unexpected error occurred"

**調試步驟：**

1. **啟動帶日誌的開發模式：**
   ```bash
   ./start-dev-with-logs.sh
   ```

2. **重現問題後，查看日誌：**
   ```bash
   ./view-logs.sh
   # 選擇選項 4（搜尋錯誤）或 5（搜尋 is_first_time_setup）
   ```

3. **尋找關鍵訊息：**
   - FFI 調用失敗
   - Rust 命令錯誤
   - Go 函數返回值格式
   - 序列化/反序列化錯誤

4. **常見錯誤模式：**
   ```
   // FFI 調用失敗
   "Failed to check first-time setup: ..."

   // 序列化錯誤
   "Failed to serialize input: ..."

   // 解析錯誤
   "Invalid response from FFI"

   // Go 層錯誤
   "failed to load wallet library"
   ```

## 前端調試

### 瀏覽器開發者工具

在 Tauri 應用中打開開發者工具：
- macOS: `Cmd + Option + I`
- Windows/Linux: `Ctrl + Shift + I`

或在 `main.rs` 中啟用：
```rust
.setup(|app| {
    #[cfg(debug_assertions)]
    {
        let window = app.get_window("main").unwrap();
        window.open_devtools();
    }
    Ok(())
})
```

### Console 日誌

前端日誌會自動記錄到文件中，包含：
- `console.log()`
- `console.error()`
- `console.warn()`
- `console.info()`

## 後端調試

### Rust 日誌

使用 `tracing` 宏：
```rust
tracing::info!("Function called with param: {}", param);
tracing::error!("Error occurred: {}", err);
tracing::debug!("Debug info: {:?}", data);
```

### Go FFI 日誌

Go 端的 `fmt.Println` 和 `log.Println` 會輸出到 stdout，
會被捕獲到日誌文件中。

## 清理日誌

```bash
# 刪除所有日誌（保留最新 5 個）
cd ~/Library/Logs/ArcSign
ls -t *.log | tail -n +6 | xargs rm -f

# 刪除超過 7 天的日誌
find ~/Library/Logs/ArcSign -name "*.log" -mtime +7 -delete
```

## 提交 Bug 報告

當提交 bug 報告時，請附上：
1. 問題描述和重現步驟
2. 相關的日誌片段（使用 `view-logs.sh` 選項 4 搜尋錯誤）
3. 系統資訊（macOS 版本、USB 裝置等）
4. 截圖（如適用）

日誌文件位置：`~/Library/Logs/ArcSign/`
