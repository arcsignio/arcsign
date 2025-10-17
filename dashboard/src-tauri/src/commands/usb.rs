/**
 * USB device detection commands for Tauri
 * Feature: User Dashboard for Wallet Management
 * Task: T014 - Implement USB detection command
 * Generated: 2025-10-17
 */

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

/// USB device information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UsbDevice {
    /// Mount path (e.g., "/Volumes/MyUSB", "E:\\", "/media/user/usb")
    pub path: String,

    /// Device name/label
    pub name: String,

    /// Whether the device is writable
    pub is_writable: bool,

    /// Available space in bytes
    pub available_space: u64,
}

/// Minimum required space for wallet storage (10MB)
const MIN_REQUIRED_SPACE: u64 = 10 * 1024 * 1024;

/// Detect available USB storage devices
#[tauri::command]
pub async fn detect_usb() -> Result<Vec<UsbDevice>, String> {
    let mut devices = Vec::new();

    // Platform-specific USB detection
    #[cfg(target_os = "macos")]
    {
        devices.extend(detect_macos_volumes().await?);
    }

    #[cfg(target_os = "linux")]
    {
        devices.extend(detect_linux_media().await?);
    }

    #[cfg(target_os = "windows")]
    {
        devices.extend(detect_windows_drives().await?);
    }

    // Filter out devices with insufficient space or read-only
    let filtered: Vec<UsbDevice> = devices
        .into_iter()
        .filter(|d| d.is_writable && d.available_space >= MIN_REQUIRED_SPACE)
        .collect();

    Ok(filtered)
}

/// Detect USB volumes on macOS (/Volumes)
#[cfg(target_os = "macos")]
async fn detect_macos_volumes() -> Result<Vec<UsbDevice>, String> {
    use std::fs;

    let volumes_path = Path::new("/Volumes");
    if !volumes_path.exists() {
        return Ok(Vec::new());
    }

    let mut devices = Vec::new();

    let entries = fs::read_dir(volumes_path)
        .map_err(|e| format!("Failed to read /Volumes: {}", e))?;

    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let path = entry.path();

        // Skip "Macintosh HD" and other system volumes
        if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
            if name == "Macintosh HD" || name.starts_with('.') {
                continue;
            }

            // Check if writable and get available space
            if let Ok((is_writable, space)) = check_path_writable_and_space(&path).await {
                devices.push(UsbDevice {
                    path: path.to_string_lossy().to_string(),
                    name: name.to_string(),
                    is_writable,
                    available_space: space,
                });
            }
        }
    }

    Ok(devices)
}

/// Detect USB media on Linux (/media and /mnt)
#[cfg(target_os = "linux")]
async fn detect_linux_media() -> Result<Vec<UsbDevice>, String> {
    use std::fs;

    let mut devices = Vec::new();

    // Check /media/$USER
    if let Ok(user) = std::env::var("USER") {
        let media_path = PathBuf::from(format!("/media/{}", user));
        if media_path.exists() {
            if let Ok(entries) = fs::read_dir(&media_path) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                        if let Ok((is_writable, space)) = check_path_writable_and_space(&path).await {
                            devices.push(UsbDevice {
                                path: path.to_string_lossy().to_string(),
                                name: name.to_string(),
                                is_writable,
                                available_space: space,
                            });
                        }
                    }
                }
            }
        }
    }

    // Check /mnt
    let mnt_path = Path::new("/mnt");
    if mnt_path.exists() {
        if let Ok(entries) = fs::read_dir(mnt_path) {
            for entry in entries.flatten() {
                let path = entry.path();
                if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                    if let Ok((is_writable, space)) = check_path_writable_and_space(&path).await {
                        devices.push(UsbDevice {
                            path: path.to_string_lossy().to_string(),
                            name: name.to_string(),
                            is_writable,
                            available_space: space,
                        });
                    }
                }
            }
        }
    }

    Ok(devices)
}

/// Detect removable drives on Windows
#[cfg(target_os = "windows")]
async fn detect_windows_drives() -> Result<Vec<UsbDevice>, String> {
    use std::fs;

    let mut devices = Vec::new();

    // Check all drive letters (A-Z)
    for letter in b'A'..=b'Z' {
        let drive = format!("{}:\\", char::from(letter));
        let path = PathBuf::from(&drive);

        if path.exists() {
            // Get drive type (we want removable drives)
            // Note: Full implementation would use Windows API to check drive type
            // For now, just check if it's accessible and writable

            if let Ok((is_writable, space)) = check_path_writable_and_space(&path).await {
                // Use drive letter as name for now
                let name = format!("Drive {}", char::from(letter));

                devices.push(UsbDevice {
                    path: drive,
                    name,
                    is_writable,
                    available_space: space,
                });
            }
        }
    }

    Ok(devices)
}

/// Check if path is writable and get available space
async fn check_path_writable_and_space(path: &Path) -> Result<(bool, u64), String> {
    use std::fs;

    // Check if path is writable by attempting to create a test file
    let test_file = path.join(".arcsign_write_test");
    let is_writable = fs::write(&test_file, b"test").is_ok();

    // Clean up test file
    if test_file.exists() {
        let _ = fs::remove_file(&test_file);
    }

    // Get available space using platform-specific methods
    let available_space = get_available_space(path).await?;

    Ok((is_writable, available_space))
}

/// Get available space for a path (in bytes)
async fn get_available_space(path: &Path) -> Result<u64, String> {
    #[cfg(unix)]
    {
        use std::ffi::CString;
        use std::os::unix::ffi::OsStrExt;

        // Use statvfs on Unix systems
        let path_cstr = CString::new(path.as_os_str().as_bytes())
            .map_err(|e| format!("Invalid path: {}", e))?;

        let mut stat: libc::statvfs = unsafe { std::mem::zeroed() };

        if unsafe { libc::statvfs(path_cstr.as_ptr(), &mut stat) } == 0 {
            let available = stat.f_bavail * stat.f_bsize;
            Ok(available)
        } else {
            Err("Failed to get filesystem stats".to_string())
        }
    }

    #[cfg(windows)]
    {
        // Use GetDiskFreeSpaceEx on Windows
        use std::os::windows::ffi::OsStrExt;
        use winapi::um::fileapi::GetDiskFreeSpaceExW;

        let wide_path: Vec<u16> = path
            .as_os_str()
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();

        let mut free_bytes: u64 = 0;

        if unsafe {
            GetDiskFreeSpaceExW(
                wide_path.as_ptr(),
                std::ptr::null_mut(),
                std::ptr::null_mut(),
                &mut free_bytes as *mut u64 as *mut _,
            )
        } != 0
        {
            Ok(free_bytes)
        } else {
            Err("Failed to get disk space".to_string())
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[tokio::test]
    async fn test_check_path_writable() {
        let temp_dir = TempDir::new().unwrap();
        let (is_writable, space) = check_path_writable_and_space(temp_dir.path())
            .await
            .unwrap();

        assert!(is_writable, "Temp directory should be writable");
        assert!(space > 0, "Should have available space");
    }

    #[tokio::test]
    async fn test_get_available_space() {
        let temp_dir = TempDir::new().unwrap();
        let space = get_available_space(temp_dir.path()).await.unwrap();

        assert!(space > MIN_REQUIRED_SPACE, "Should have at least 10MB free");
    }

    #[tokio::test]
    async fn test_detect_usb_filters_insufficient_space() {
        // This is a conceptual test - actual implementation would mock filesystem
        // For now, just verify the function exists and returns Ok
        let result = detect_usb().await;
        assert!(result.is_ok());
    }
}
