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

// ChainAdapter transaction function types
/// Function signature for BuildTransaction: char* BuildTransaction(char* params)
type BuildTransactionFn = unsafe extern "C" fn(*const c_char) -> *mut c_char;

/// Function signature for SignTransaction: char* SignTransaction(char* params)
type SignTransactionFn = unsafe extern "C" fn(*const c_char) -> *mut c_char;

/// Function signature for BroadcastTransaction: char* BroadcastTransaction(char* params)
type BroadcastTransactionFn = unsafe extern "C" fn(*const c_char) -> *mut c_char;

/// Function signature for QueryTransactionStatus: char* QueryTransactionStatus(char* params)
type QueryTransactionStatusFn = unsafe extern "C" fn(*const c_char) -> *mut c_char;

/// Function signature for EstimateFee: char* EstimateFee(char* params)
type EstimateFeeFn = unsafe extern "C" fn(*const c_char) -> *mut c_char;

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
    // ChainAdapter transaction function symbols
    build_transaction: Symbol<'static, BuildTransactionFn>,
    sign_transaction: Symbol<'static, SignTransactionFn>,
    broadcast_transaction: Symbol<'static, BroadcastTransactionFn>,
    query_transaction_status: Symbol<'static, QueryTransactionStatusFn>,
    estimate_fee: Symbol<'static, EstimateFeeFn>,
}

impl WalletLibrary {
    /// Load the shared library from the platform-specific path.
    ///
    /// Platform-specific library names:
    /// - Windows: libarcsign.dll
    /// - macOS: libarcsign.dylib
    /// - Linux: libarcsign.so
    ///
    /// Search Paths (T047, T048):
    /// - Windows: Current directory, %APPDATA%\arcSign, Program Files\arcSign
    /// - macOS: Current directory, ~/Library/Application Support/arcSign, /Applications/arcSign.app/Contents/Resources
    /// - Linux: Current directory, ~/.local/lib/arcsign, /usr/local/lib/arcsign
    ///
    /// Returns:
    /// - Ok(WalletLibrary) if library loaded and symbols cached successfully
    /// - Err(String) if library not found or symbols missing
    pub fn load() -> Result<Self, String> {
        unsafe {
            // Determine library name based on platform
            #[cfg(target_os = "windows")]
            let lib_name = "libarcsign.dll";

            #[cfg(target_os = "macos")]
            let lib_name = "libarcsign.dylib";

            #[cfg(target_os = "linux")]
            let lib_name = "libarcsign.so";

            // T047, T048: Platform-specific search paths
            let search_paths = Self::get_search_paths(lib_name);

            // Try loading from each search path in order
            let mut last_error = String::new();
            let lib = 'search: {
                for path in &search_paths {
                    match Library::new(path) {
                        Ok(lib) => {
                            tracing::info!("Loaded wallet library from: {}", path);
                            break 'search lib;
                        }
                        Err(e) => {
                            tracing::debug!("Failed to load from {}: {}", path, e);
                            last_error = format!("{}: {}", path, e);
                        }
                    }
                }

                // If we get here, all paths failed
                return Err(format!(
                    "Failed to load {} from any search path. Last error: {}",
                    lib_name, last_error
                ));
            };

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

            // Load ChainAdapter transaction symbols
            let build_transaction: Symbol<BuildTransactionFn> = lib
                .get(b"BuildTransaction")
                .map_err(|e| format!("BuildTransaction symbol not found: {}", e))?;

            let sign_transaction: Symbol<SignTransactionFn> = lib
                .get(b"SignTransaction")
                .map_err(|e| format!("SignTransaction symbol not found: {}", e))?;

            let broadcast_transaction: Symbol<BroadcastTransactionFn> = lib
                .get(b"BroadcastTransaction")
                .map_err(|e| format!("BroadcastTransaction symbol not found: {}", e))?;

            let query_transaction_status: Symbol<QueryTransactionStatusFn> = lib
                .get(b"QueryTransactionStatus")
                .map_err(|e| format!("QueryTransactionStatus symbol not found: {}", e))?;

            let estimate_fee: Symbol<EstimateFeeFn> = lib
                .get(b"EstimateFee")
                .map_err(|e| format!("EstimateFee symbol not found: {}", e))?;

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
            let build_transaction: Symbol<'static, BuildTransactionFn> = std::mem::transmute(build_transaction);
            let sign_transaction: Symbol<'static, SignTransactionFn> = std::mem::transmute(sign_transaction);
            let broadcast_transaction: Symbol<'static, BroadcastTransactionFn> = std::mem::transmute(broadcast_transaction);
            let query_transaction_status: Symbol<'static, QueryTransactionStatusFn> = std::mem::transmute(query_transaction_status);
            let estimate_fee: Symbol<'static, EstimateFeeFn> = std::mem::transmute(estimate_fee);

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
                build_transaction,
                sign_transaction,
                broadcast_transaction,
                query_transaction_status,
                estimate_fee,
            })
        }
    }

    /// Get platform-specific search paths for the wallet library (T047, T048).
    ///
    /// Search order (highest priority first):
    /// 1. Current directory (development builds)
    /// 2. User-specific application directory
    /// 3. System-wide application directory
    ///
    /// Returns: Vec<String> of absolute paths to try
    fn get_search_paths(lib_name: &str) -> Vec<String> {
        let mut paths = Vec::new();

        // Priority 1: Current directory (for development and bundled apps)
        paths.push(lib_name.to_string());

        // Priority 1.5: src-tauri directory (for development builds)
        paths.push(format!("dashboard/src-tauri/{}", lib_name));
        paths.push(format!("src-tauri/{}", lib_name));

        // Priority 2 & 3: Platform-specific directories
        #[cfg(target_os = "windows")]
        {
            // T047: Windows search paths
            // User AppData: C:\Users\<username>\AppData\Roaming\arcSign
            if let Ok(appdata) = std::env::var("APPDATA") {
                paths.push(format!("{}\\arcSign\\{}", appdata, lib_name));
            }

            // Program Files: C:\Program Files\arcSign
            if let Ok(program_files) = std::env::var("ProgramFiles") {
                paths.push(format!("{}\\arcSign\\{}", program_files, lib_name));
            }

            // Also check ProgramFiles(x86) for 32-bit apps on 64-bit Windows
            if let Ok(program_files_x86) = std::env::var("ProgramFiles(x86)") {
                paths.push(format!("{}\\arcSign\\{}", program_files_x86, lib_name));
            }
        }

        #[cfg(target_os = "macos")]
        {
            // T048: macOS search paths
            // User Library: ~/Library/Application Support/arcSign
            if let Ok(home) = std::env::var("HOME") {
                paths.push(format!("{}/Library/Application Support/arcSign/{}", home, lib_name));
            }

            // Bundled app: /Applications/arcSign.app/Contents/Resources
            paths.push(format!("/Applications/arcSign.app/Contents/Resources/{}", lib_name));

            // System-wide: /usr/local/lib/arcsign
            paths.push(format!("/usr/local/lib/arcsign/{}", lib_name));
        }

        #[cfg(target_os = "linux")]
        {
            // T048: Linux search paths
            // User-specific: ~/.local/lib/arcsign
            if let Ok(home) = std::env::var("HOME") {
                paths.push(format!("{}/.local/lib/arcsign/{}", home, lib_name));
            }

            // System-wide: /usr/local/lib/arcsign
            paths.push(format!("/usr/local/lib/arcsign/{}", lib_name));

            // Alternative system location: /opt/arcsign/lib
            paths.push(format!("/opt/arcsign/lib/{}", lib_name));
        }

        tracing::info!("Library search paths: {:?}", paths);
        paths
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

    // ========================================================================
    // ChainAdapter Transaction Operations
    // ========================================================================

    /// Build an unsigned transaction for the specified chain.
    ///
    /// Input JSON format:
    /// ```json
    /// {
    ///   "chainId": "bitcoin"|"ethereum",
    ///   "from": "...",
    ///   "to": "...",
    ///   "amount": "...",
    ///   "feeSpeed": "fast"|"normal"|"slow"
    /// }
    /// ```
    pub fn build_transaction(&self, params_json: &str) -> Result<serde_json::Value, String> {
        self.call_ffi_with_params(*self.build_transaction, params_json)
    }

    /// Sign an unsigned transaction with the provided private key.
    ///
    /// Input JSON format:
    /// ```json
    /// {
    ///   "chainId": "bitcoin"|"ethereum",
    ///   "unsignedTx": {...},
    ///   "privateKey": "..."
    /// }
    /// ```
    ///
    /// Security Note: Private key is zeroed after use on the Go side.
    pub fn sign_transaction(&self, params_json: &str) -> Result<serde_json::Value, String> {
        self.call_ffi_with_params(*self.sign_transaction, params_json)
    }

    /// Broadcast a signed transaction to the blockchain network.
    ///
    /// Input JSON format:
    /// ```json
    /// {
    ///   "chainId": "bitcoin"|"ethereum",
    ///   "signedTx": {...}
    /// }
    /// ```
    ///
    /// Note: Broadcast is idempotent - duplicate submissions are handled gracefully.
    pub fn broadcast_transaction(&self, params_json: &str) -> Result<serde_json::Value, String> {
        self.call_ffi_with_params(*self.broadcast_transaction, params_json)
    }

    /// Query the status of a transaction by hash.
    ///
    /// Input JSON format:
    /// ```json
    /// {
    ///   "chainId": "bitcoin"|"ethereum",
    ///   "txHash": "..."
    /// }
    /// ```
    pub fn query_transaction_status(&self, params_json: &str) -> Result<serde_json::Value, String> {
        self.call_ffi_with_params(*self.query_transaction_status, params_json)
    }

    /// Estimate transaction fees for the specified chain.
    ///
    /// Input JSON format:
    /// ```json
    /// {
    ///   "chainId": "bitcoin"|"ethereum",
    ///   "from": "...",
    ///   "to": "...",
    ///   "amount": "..."
    /// }
    /// ```
    pub fn estimate_fee(&self, params_json: &str) -> Result<serde_json::Value, String> {
        self.call_ffi_with_params(*self.estimate_fee, params_json)
    }
}

// Implement Send + Sync to allow sharing across threads
// Safe because:
// 1. Library is read-only after loading
// 2. Function symbols are read-only
// 3. Actual operations serialized through WalletQueue
unsafe impl Send for WalletLibrary {}
unsafe impl Sync for WalletLibrary {}
