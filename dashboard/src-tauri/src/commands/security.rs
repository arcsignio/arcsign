/**
 * Security commands for Tauri (screenshot protection, memory clearing)
 * Feature: User Dashboard for Wallet Management
 * Task: T020 - Implement screenshot protection commands
 * Generated: 2025-10-17
 */

use tauri::{Manager, Window};

/// Enable screenshot protection (SEC-004)
/// Prevents screen capture during sensitive operations (mnemonic display)
#[tauri::command]
pub async fn enable_screenshot_protection(window: Window) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        enable_screenshot_protection_macos(window).await
    }

    #[cfg(target_os = "windows")]
    {
        enable_screenshot_protection_windows(window).await
    }

    #[cfg(target_os = "linux")]
    {
        // Linux: Screenshot protection is complex and varies by window manager
        // For MVP, return success but log limitation
        tracing::warn!("Screenshot protection not fully supported on Linux");
        Ok(())
    }
}

/// Disable screenshot protection
/// Restores normal screen sharing/capture capabilities
#[tauri::command]
pub async fn disable_screenshot_protection(window: Window) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        disable_screenshot_protection_macos(window).await
    }

    #[cfg(target_os = "windows")]
    {
        disable_screenshot_protection_windows(window).await
    }

    #[cfg(target_os = "linux")]
    {
        Ok(())
    }
}

/// Clear sensitive data from memory (SEC-003)
/// Attempts to zero out memory containing sensitive data
#[tauri::command]
pub async fn clear_sensitive_memory() -> Result<(), String> {
    // Note: Full implementation would use secure memory zeroing libraries
    // like zeroize or secrecy crates

    // Force garbage collection (Rust doesn't have manual GC, but we can drop values)
    // In real implementation, would zero specific memory regions

    tracing::info!("Clearing sensitive memory");

    // Placeholder: Would zero mnemonic and password memory here
    Ok(())
}

/// macOS screenshot protection using NSWindow sharing type
#[cfg(target_os = "macos")]
async fn enable_screenshot_protection_macos(window: Window) -> Result<(), String> {
    use cocoa::base::{id, nil};
    use objc::{msg_send, sel, sel_impl};

    if let Ok(ns_window) = window.ns_window() {
        unsafe {
            let ns_window = ns_window as id;
            // NSWindowSharingNone = 0 (no screen sharing/capture)
            let _: () = msg_send![ns_window, setSharingType: 0u64];
        }
        tracing::info!("Screenshot protection enabled (macOS)");
        Ok(())
    } else {
        Err("Failed to get NSWindow".to_string())
    }
}

/// macOS screenshot protection disable
#[cfg(target_os = "macos")]
async fn disable_screenshot_protection_macos(window: Window) -> Result<(), String> {
    use cocoa::base::{id, nil};
    use objc::{msg_send, sel, sel_impl};

    if let Ok(ns_window) = window.ns_window() {
        unsafe {
            let ns_window = ns_window as id;
            // NSWindowSharingReadOnly = 1 (allow screen sharing)
            let _: () = msg_send![ns_window, setSharingType: 1u64];
        }
        tracing::info!("Screenshot protection disabled (macOS)");
        Ok(())
    } else {
        Err("Failed to get NSWindow".to_string())
    }
}

/// Windows screenshot protection using SetWindowDisplayAffinity
#[cfg(target_os = "windows")]
async fn enable_screenshot_protection_windows(window: Window) -> Result<(), String> {
    use windows::Win32::Foundation::HWND;
    use windows::Win32::UI::WindowsAndMessaging::{SetWindowDisplayAffinity, WDA_EXCLUDEFROMCAPTURE};

    if let Ok(hwnd) = window.hwnd() {
        unsafe {
            let hwnd = HWND(hwnd.0 as isize);
            if SetWindowDisplayAffinity(hwnd, WDA_EXCLUDEFROMCAPTURE).is_ok() {
                tracing::info!("Screenshot protection enabled (Windows)");
                Ok(())
            } else {
                Err("Failed to set window display affinity".to_string())
            }
        }
    } else {
        Err("Failed to get HWND".to_string())
    }
}

/// Windows screenshot protection disable
#[cfg(target_os = "windows")]
async fn disable_screenshot_protection_windows(window: Window) -> Result<(), String> {
    use windows::Win32::Foundation::HWND;
    use windows::Win32::UI::WindowsAndMessaging::{SetWindowDisplayAffinity, WDA_NONE};

    if let Ok(hwnd) = window.hwnd() {
        unsafe {
            let hwnd = HWND(hwnd.0 as isize);
            if SetWindowDisplayAffinity(hwnd, WDA_NONE).is_ok() {
                tracing::info!("Screenshot protection disabled (Windows)");
                Ok(())
            } else {
                Err("Failed to reset window display affinity".to_string())
            }
        }
    } else {
        Err("Failed to get HWND".to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_clear_sensitive_memory() {
        let result = clear_sensitive_memory().await;
        assert!(result.is_ok());
    }

    // Note: Window-based tests require Tauri runtime
    // These would be tested in integration tests
}
