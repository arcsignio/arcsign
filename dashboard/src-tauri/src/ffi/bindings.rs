//! Low-level FFI bindings and safe wrappers for Go shared library.
//!
//! This module provides:
//! - Unsafe extern "C" declarations matching Go exports
//! - Safe Rust wrappers that handle memory management
//! - WalletLibrary struct for managing library lifetime
//!
//! Feature: 005-go-cli-shared
//! Created: 2025-10-25

use libloading::{Library, Symbol};
use std::ffi::{CStr, CString};
use std::os::raw::c_char;
use std::sync::Arc;
use serde::de::DeserializeOwned;

use super::types::{FFIResponse, FFIError};

// ============================================================================
// Extern "C" Function Type Definitions (T013)
// ============================================================================

/// Function signature for GoFree: void GoFree(char* ptr)
type GoFreeFn = unsafe extern "C" fn(*mut c_char);

/// Function signature for GetVersion: char* GetVersion()
type GetVersionFn = unsafe extern "C" fn() -> *mut c_char;

// T027: Wallet operation function types (Phase 3 - User Story 1)
/// Function signature for CreateWallet: char* CreateWallet(char* params)
type CreateWalletFn = unsafe extern "C" fn(*const c_char) -> *mut c_char;

/// Function signature for ImportWallet: char* ImportWallet(char* params)
type ImportWalletFn = unsafe extern "C" fn(*const c_char) -> *mut c_char;

/// Function signature for UnlockWallet: char* UnlockWallet(char* params)
type UnlockWalletFn = unsafe extern "C" fn(*const c_char) -> *mut c_char;

/// Function signature for GenerateAddresses: char* GenerateAddresses(char* params)
type GenerateAddressesFn = unsafe extern "C" fn(*const c_char) -> *mut c_char;

/// Function signature for ExportWallet: char* ExportWallet(char* params)
type ExportWalletFn = unsafe extern "C" fn(*const c_char) -> *mut c_char;

/// Function signature for RenameWallet: char* RenameWallet(char* params)
type RenameWalletFn = unsafe extern "C" fn(*const c_char) -> *mut c_char;

/// Function signature for ListWallets: char* ListWallets(char* params)
type ListWalletsFn = unsafe extern "C" fn(*const c_char) -> *mut c_char;

// ============================================================================
// WalletLibrary - Dynamic Library Wrapper (T016, T017)
// ============================================================================

/// WalletLibrary manages the lifecycle of the Go shared library.
///
/// Memory Management:
/// - Library loaded once at startup
/// - Function symbols cached to avoid repeated unsafe operations
/// - All strings returned from Go must be freed via GoFree
///
/// Thread Safety:
/// - Library is Send + Sync (wrapped in Arc for sharing)
/// - Actual wallet operations serialized through WalletQueue
pub struct WalletLibrary {
    lib: Arc<Library>,
    go_free: Symbol<'static, GoFreeFn>,
    get_version: Symbol<'static, GetVersionFn>,
    // T027: Wallet operation function symbols
    create_wallet: Symbol<'static, CreateWalletFn>,
    import_wallet: Symbol<'static, ImportWalletFn>,
    unlock_wallet: Symbol<'static, UnlockWalletFn>,
    generate_addresses: Symbol<'static, GenerateAddressesFn>,
    export_wallet: Symbol<'static, ExportWalletFn>,
    rename_wallet: Symbol<'static, RenameWalletFn>,
    list_wallets: Symbol<'static, ListWalletsFn>,
}

impl WalletLibrary {
    /// Load the shared library from the platform-specific path.
    ///
    /// Platform-specific library names:
    /// - Windows: libarcsign.dll
    /// - macOS: libarcsign.dylib
    /// - Linux: libarcsign.so
    ///
    /// Returns:
    /// - Ok(WalletLibrary) if library loaded and symbols cached successfully
    /// - Err(String) if library not found or symbols missing
    pub fn load() -> Result<Self, String> {
        unsafe {
            // Determine library path based on platform
            #[cfg(target_os = "windows")]
            let lib_name = "libarcsign.dll";

            #[cfg(target_os = "macos")]
            let lib_name = "libarcsign.dylib";

            #[cfg(target_os = "linux")]
            let lib_name = "libarcsign.so";

            // Load library
            let lib = Library::new(lib_name)
                .map_err(|e| format!("Failed to load {}: {}", lib_name, e))?;

            // Cache function symbols (T016 - avoid repeated unsafe operations)
            let go_free: Symbol<GoFreeFn> = lib
                .get(b"GoFree")
                .map_err(|e| format!("GoFree symbol not found: {}", e))?;

            let get_version: Symbol<GetVersionFn> = lib
                .get(b"GetVersion")
                .map_err(|e| format!("GetVersion symbol not found: {}", e))?;

            // T027: Load wallet operation symbols
            let create_wallet: Symbol<CreateWalletFn> = lib
                .get(b"CreateWallet")
                .map_err(|e| format!("CreateWallet symbol not found: {}", e))?;

            let import_wallet: Symbol<ImportWalletFn> = lib
                .get(b"ImportWallet")
                .map_err(|e| format!("ImportWallet symbol not found: {}", e))?;

            let unlock_wallet: Symbol<UnlockWalletFn> = lib
                .get(b"UnlockWallet")
                .map_err(|e| format!("UnlockWallet symbol not found: {}", e))?;

            let generate_addresses: Symbol<GenerateAddressesFn> = lib
                .get(b"GenerateAddresses")
                .map_err(|e| format!("GenerateAddresses symbol not found: {}", e))?;

            let export_wallet: Symbol<ExportWalletFn> = lib
                .get(b"ExportWallet")
                .map_err(|e| format!("ExportWallet symbol not found: {}", e))?;

            let rename_wallet: Symbol<RenameWalletFn> = lib
                .get(b"RenameWallet")
                .map_err(|e| format!("RenameWallet symbol not found: {}", e))?;

            let list_wallets: Symbol<ListWalletsFn> = lib
                .get(b"ListWallets")
                .map_err(|e| format!("ListWallets symbol not found: {}", e))?;

            // Extend symbol lifetime to 'static (safe because Library lives for program duration)
            let go_free: Symbol<'static, GoFreeFn> = std::mem::transmute(go_free);
            let get_version: Symbol<'static, GetVersionFn> = std::mem::transmute(get_version);
            let create_wallet: Symbol<'static, CreateWalletFn> = std::mem::transmute(create_wallet);
            let import_wallet: Symbol<'static, ImportWalletFn> = std::mem::transmute(import_wallet);
            let unlock_wallet: Symbol<'static, UnlockWalletFn> = std::mem::transmute(unlock_wallet);
            let generate_addresses: Symbol<'static, GenerateAddressesFn> = std::mem::transmute(generate_addresses);
            let export_wallet: Symbol<'static, ExportWalletFn> = std::mem::transmute(export_wallet);
            let rename_wallet: Symbol<'static, RenameWalletFn> = std::mem::transmute(rename_wallet);
            let list_wallets: Symbol<'static, ListWalletsFn> = std::mem::transmute(list_wallets);

            Ok(WalletLibrary {
                lib: Arc::new(lib),
                go_free,
                get_version,
                create_wallet,
                import_wallet,
                unlock_wallet,
                generate_addresses,
                export_wallet,
                rename_wallet,
                list_wallets,
            })
        }
    }

    /// Call GetVersion FFI function and return parsed response.
    ///
    /// Memory Safety:
    /// 1. Call GetVersion() -> receives *mut c_char
    /// 2. Copy string data to Rust String
    /// 3. Call GoFree() on pointer
    ///
    /// Example:
    /// ```ignore
    /// let lib = WalletLibrary::load()?;
    /// let version_data = lib.get_version()?;
    /// println!("Library version: {}", version_data["version"]);
    /// ```
    pub fn get_version(&self) -> Result<serde_json::Value, String> {
        unsafe {
            // Call Go function
            let result_ptr = (self.get_version)();

            if result_ptr.is_null() {
                return Err("GetVersion returned null pointer".to_string());
            }

            // Copy C string to Rust (before freeing)
            let result_cstr = CStr::from_ptr(result_ptr);
            let result_json = result_cstr
                .to_str()
                .map_err(|e| format!("Invalid UTF-8 from GetVersion: {}", e))?
                .to_string();

            // CRITICAL: Free Go-allocated memory
            (self.go_free)(result_ptr);

            // Parse JSON response
            let response: FFIResponse<serde_json::Value> = serde_json::from_str(&result_json)
                .map_err(|e| format!("JSON parse error: {}", e))?;

            if response.success {
                response.data.ok_or_else(|| "Success response missing data".to_string())
            } else {
                let err = response.error.unwrap_or(FFIError {
                    code: "UNKNOWN".to_string(),
                    message: "Unknown error".to_string(),
                });
                Err(format!("{}: {}", err.code, err.message))
            }
        }
    }

    /// Generic helper for calling FFI functions that return JSON.
    ///
    /// This pattern will be reused for all wallet operations in Phase 3.
    ///
    /// Type Parameters:
    /// - `T`: The expected data type (must implement Deserialize)
    ///
    /// Safety:
    /// - Caller must ensure function pointer is valid
    /// - Result pointer will be freed via GoFree
    fn call_ffi_json<T: DeserializeOwned>(
        &self,
        ffi_fn: unsafe extern "C" fn() -> *mut c_char,
    ) -> Result<T, String> {
        unsafe {
            let result_ptr = ffi_fn();

            if result_ptr.is_null() {
                return Err("FFI function returned null pointer".to_string());
            }

            let result_cstr = CStr::from_ptr(result_ptr);
            let result_json = result_cstr
                .to_str()
                .map_err(|e| format!("Invalid UTF-8: {}", e))?
                .to_string();

            (self.go_free)(result_ptr);

            // Parse as generic Value first, then extract data
            let response: FFIResponse<serde_json::Value> = serde_json::from_str(&result_json)
                .map_err(|e| format!("JSON parse error: {}", e))?;

            if response.success {
                let data_value = response.data.ok_or_else(|| "Success response missing data".to_string())?;
                serde_json::from_value(data_value)
                    .map_err(|e| format!("Failed to deserialize data: {}", e))
            } else {
                let err = response.error.unwrap_or(FFIError {
                    code: "UNKNOWN".to_string(),
                    message: "Unknown error".to_string(),
                });
                Err(format!("{}: {}", err.code, err.message))
            }
        }
    }

    /// Generic helper for calling FFI functions that accept JSON parameters.
    ///
    /// T028: Helper for parameterized wallet operations
    ///
    /// Type Parameters:
    /// - `T`: The expected response data type (must implement Deserialize)
    ///
    /// Safety:
    /// - Caller must ensure function pointer is valid
    /// - Result pointer will be freed via GoFree
    fn call_ffi_with_params<T: DeserializeOwned>(
        &self,
        ffi_fn: unsafe extern "C" fn(*const c_char) -> *mut c_char,
        params_json: &str,
    ) -> Result<T, String> {
        unsafe {
            let params_cstr = CString::new(params_json)
                .map_err(|e| format!("Invalid params JSON: {}", e))?;

            let result_ptr = ffi_fn(params_cstr.as_ptr());

            if result_ptr.is_null() {
                return Err("FFI function returned null pointer".to_string());
            }

            let result_cstr = CStr::from_ptr(result_ptr);
            let result_json = result_cstr
                .to_str()
                .map_err(|e| format!("Invalid UTF-8: {}", e))?
                .to_string();

            (self.go_free)(result_ptr);

            // Parse as generic Value first, then extract data
            let response: FFIResponse<serde_json::Value> = serde_json::from_str(&result_json)
                .map_err(|e| format!("JSON parse error: {}", e))?;

            if response.success {
                let data_value = response.data.ok_or_else(|| "Success response missing data".to_string())?;
                serde_json::from_value(data_value)
                    .map_err(|e| format!("Failed to deserialize data: {}", e))
            } else {
                let err = response.error.unwrap_or(FFIError {
                    code: "UNKNOWN".to_string(),
                    message: "Unknown error".to_string(),
                });
                Err(format!("{}: {}", err.code, err.message))
            }
        }
    }

    // ========================================================================
    // T029: Public Safe Wrappers for Wallet Operations
    // ========================================================================

    /// Create a new HD wallet from provided mnemonic.
    pub fn create_wallet(&self, params_json: &str) -> Result<serde_json::Value, String> {
        self.call_ffi_with_params(*self.create_wallet, params_json)
    }

    /// Import an existing wallet from mnemonic.
    pub fn import_wallet(&self, params_json: &str) -> Result<serde_json::Value, String> {
        self.call_ffi_with_params(*self.import_wallet, params_json)
    }

    /// Authenticate and load wallet into memory.
    pub fn unlock_wallet(&self, params_json: &str) -> Result<serde_json::Value, String> {
        self.call_ffi_with_params(*self.unlock_wallet, params_json)
    }

    /// Derive addresses for specified blockchains.
    pub fn generate_addresses(&self, params_json: &str) -> Result<serde_json::Value, String> {
        self.call_ffi_with_params(*self.generate_addresses, params_json)
    }

    /// Export wallet metadata without private keys.
    pub fn export_wallet(&self, params_json: &str) -> Result<serde_json::Value, String> {
        self.call_ffi_with_params(*self.export_wallet, params_json)
    }

    /// Change wallet display name.
    pub fn rename_wallet(&self, params_json: &str) -> Result<serde_json::Value, String> {
        self.call_ffi_with_params(*self.rename_wallet, params_json)
    }

    /// Enumerate all wallets on USB.
    pub fn list_wallets(&self, params_json: &str) -> Result<serde_json::Value, String> {
        self.call_ffi_with_params(*self.list_wallets, params_json)
    }
}

// Implement Send + Sync to allow sharing across threads
// Safe because:
// 1. Library is read-only after loading
// 2. Function symbols are read-only
// 3. Actual operations serialized through WalletQueue
unsafe impl Send for WalletLibrary {}
unsafe impl Sync for WalletLibrary {}
