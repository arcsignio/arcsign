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

/// Function signature for ImportBackupWallet: char* ImportBackupWallet(char* params)
type ImportBackupWalletFn = unsafe extern "C" fn(*const c_char) -> *mut c_char;

/// Function signature for ExportAllWallets: char* ExportAllWallets(char* params)
type ExportAllWalletsFn = unsafe extern "C" fn(*const c_char) -> *mut c_char;

/// Function signature for ImportAllWallets: char* ImportAllWallets(char* params)
type ImportAllWalletsFn = unsafe extern "C" fn(*const c_char) -> *mut c_char;

/// Function signature for RenameWallet: char* RenameWallet(char* params)
type RenameWalletFn = unsafe extern "C" fn(*const c_char) -> *mut c_char;

/// Function signature for DeleteWallet: char* DeleteWallet(char* params)
type DeleteWalletFn = unsafe extern "C" fn(*const c_char) -> *mut c_char;

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

// Provider configuration function types
/// Function signature for SetProviderConfig: char* SetProviderConfig(char* params)
type SetProviderConfigFn = unsafe extern "C" fn(*const c_char) -> *mut c_char;

/// Function signature for GetProviderConfig: char* GetProviderConfig(char* params)
type GetProviderConfigFn = unsafe extern "C" fn(*const c_char) -> *mut c_char;

/// Function signature for ListProviderConfigs: char* ListProviderConfigs(char* params)
type ListProviderConfigsFn = unsafe extern "C" fn(*const c_char) -> *mut c_char;

/// Function signature for DeleteProviderConfig: char* DeleteProviderConfig(char* params)
type DeleteProviderConfigFn = unsafe extern "C" fn(*const c_char) -> *mut c_char;

// App-level authentication function types
/// Function signature for IsFirstTimeSetup: char* IsFirstTimeSetup(char* params)
type IsFirstTimeSetupFn = unsafe extern "C" fn(*const c_char) -> *mut c_char;

/// Function signature for InitializeApp: char* InitializeApp(char* params)
type InitializeAppFn = unsafe extern "C" fn(*const c_char) -> *mut c_char;

/// Function signature for UnlockApp: char* UnlockApp(char* params)
type UnlockAppFn = unsafe extern "C" fn(*const c_char) -> *mut c_char;

/// Function signature for GetTokenBalances: char* GetTokenBalances(char* params)
type GetTokenBalancesFn = unsafe extern "C" fn(*const c_char) -> *mut c_char;

/// Function signature for GetAssetTransfers: char* GetAssetTransfers(char* params)
type GetAssetTransfersFn = unsafe extern "C" fn(*const c_char) -> *mut c_char;

/// Function signature for ValidatePassphrase: char* ValidatePassphrase(char* params)
type ValidatePassphraseFn = unsafe extern "C" fn(*const c_char) -> *mut c_char;

// Swap/DEX aggregator function types
/// Function signature for GetSwapQuote: char* GetSwapQuote(char* params)
type GetSwapQuoteFn = unsafe extern "C" fn(*const c_char) -> *mut c_char;

/// Function signature for BuildSwapTransaction: char* BuildSwapTransaction(char* params)
type BuildSwapTransactionFn = unsafe extern "C" fn(*const c_char) -> *mut c_char;

/// Function signature for GetSwapApproval: char* GetSwapApproval(char* params)
type GetSwapApprovalFn = unsafe extern "C" fn(*const c_char) -> *mut c_char;

/// Function signature for CheckSwapAllowance: char* CheckSwapAllowance(char* params)
type CheckSwapAllowanceFn = unsafe extern "C" fn(*const c_char) -> *mut c_char;

/// Function signature for GetNativeTokenAddress: char* GetNativeTokenAddress()
type GetNativeTokenAddressFn = unsafe extern "C" fn() -> *mut c_char;

/// Function signature for GetSwapTokens: char* GetSwapTokens(char* params)
type GetSwapTokensFn = unsafe extern "C" fn(*const c_char) -> *mut c_char;

// Membership management function types
/// Function signature for GetMembershipStatus: char* GetMembershipStatus(char* params)
type GetMembershipStatusFn = unsafe extern "C" fn(*const c_char) -> *mut c_char;

/// Function signature for GetDeviceMembershipStatusWithToken: char* GetDeviceMembershipStatusWithToken(char* params)
/// Uses session token instead of password for authentication
type GetDeviceMembershipStatusWithTokenFn = unsafe extern "C" fn(*const c_char) -> *mut c_char;

/// Function signature for AddMembershipBinding: char* AddMembershipBinding(char* params)
type AddMembershipBindingFn = unsafe extern "C" fn(*const c_char) -> *mut c_char;

/// Function signature for RemoveMembershipBinding: char* RemoveMembershipBinding(char* params)
type RemoveMembershipBindingFn = unsafe extern "C" fn(*const c_char) -> *mut c_char;

/// Function signature for SyncMembershipBindingWithToken: char* SyncMembershipBindingWithToken(char* params)
/// Uses session token instead of password for authentication
type SyncMembershipBindingWithTokenFn = unsafe extern "C" fn(*const c_char) -> *mut c_char;

/// Function signature for RemoveMembershipBindingWithToken: char* RemoveMembershipBindingWithToken(char* params)
/// Uses session token instead of password for authentication
type RemoveMembershipBindingWithTokenFn = unsafe extern "C" fn(*const c_char) -> *mut c_char;

// Session management function types
/// Function signature for CreateSessionToken: char* CreateSessionToken(char* params)
type CreateSessionTokenFn = unsafe extern "C" fn(*const c_char) -> *mut c_char;

/// Function signature for ValidateSessionToken: char* ValidateSessionToken(char* params)
type ValidateSessionTokenFn = unsafe extern "C" fn(*const c_char) -> *mut c_char;

/// Function signature for RevokeSessionToken: char* RevokeSessionToken(char* params)
type RevokeSessionTokenFn = unsafe extern "C" fn(*const c_char) -> *mut c_char;

// Wallet session management function types
/// Function signature for CreateWalletSessionToken: char* CreateWalletSessionToken(char* params)
type CreateWalletSessionTokenFn = unsafe extern "C" fn(*const c_char) -> *mut c_char;

/// Function signature for ValidateWalletSessionToken: char* ValidateWalletSessionToken(char* params)
type ValidateWalletSessionTokenFn = unsafe extern "C" fn(*const c_char) -> *mut c_char;

/// Function signature for RevokeWalletSessionToken: char* RevokeWalletSessionToken(char* params)
type RevokeWalletSessionTokenFn = unsafe extern "C" fn(*const c_char) -> *mut c_char;

// WalletConnect signing function types
/// Function signature for SignMessage: char* SignMessage(char* params)
/// EIP-191 personal_sign implementation
type SignMessageFn = unsafe extern "C" fn(*const c_char) -> *mut c_char;

/// Function signature for SignTypedData: char* SignTypedData(char* params)
/// EIP-712 eth_signTypedData_v4 implementation
type SignTypedDataFn = unsafe extern "C" fn(*const c_char) -> *mut c_char;

// Developer Mode session management function types
/// Function signature for CreateDevSession: char* CreateDevSession(char* params)
/// Creates a developer session for auto-signing testnets
type CreateDevSessionFn = unsafe extern "C" fn(*const c_char) -> *mut c_char;

/// Function signature for DevSessionSign: char* DevSessionSign(char* params)
/// Signs a transaction using an active dev session (no password required)
type DevSessionSignFn = unsafe extern "C" fn(*const c_char) -> *mut c_char;

/// Function signature for GetDevSession: char* GetDevSession(char* params)
/// Gets information about an active dev session
type GetDevSessionFn = unsafe extern "C" fn(*const c_char) -> *mut c_char;

/// Function signature for EndDevSession: char* EndDevSession(char* params)
/// Ends a developer session and clears stored keys
type EndDevSessionFn = unsafe extern "C" fn(*const c_char) -> *mut c_char;

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
    import_backup_wallet: Symbol<'static, ImportBackupWalletFn>,
    // Bundle (batch) export/import function symbols
    export_all_wallets: Symbol<'static, ExportAllWalletsFn>,
    import_all_wallets: Symbol<'static, ImportAllWalletsFn>,
    rename_wallet: Symbol<'static, RenameWalletFn>,
    delete_wallet: Symbol<'static, DeleteWalletFn>,
    list_wallets: Symbol<'static, ListWalletsFn>,
    // ChainAdapter transaction function symbols
    build_transaction: Symbol<'static, BuildTransactionFn>,
    sign_transaction: Symbol<'static, SignTransactionFn>,
    broadcast_transaction: Symbol<'static, BroadcastTransactionFn>,
    query_transaction_status: Symbol<'static, QueryTransactionStatusFn>,
    estimate_fee: Symbol<'static, EstimateFeeFn>,
    // Provider configuration function symbols
    set_provider_config: Symbol<'static, SetProviderConfigFn>,
    get_provider_config: Symbol<'static, GetProviderConfigFn>,
    list_provider_configs: Symbol<'static, ListProviderConfigsFn>,
    delete_provider_config: Symbol<'static, DeleteProviderConfigFn>,
    // App-level authentication function symbols
    is_first_time_setup: Symbol<'static, IsFirstTimeSetupFn>,
    initialize_app: Symbol<'static, InitializeAppFn>,
    unlock_app: Symbol<'static, UnlockAppFn>,
    // Token balance query function symbols
    get_token_balances: Symbol<'static, GetTokenBalancesFn>,
    // Asset transfers query function symbols
    get_asset_transfers: Symbol<'static, GetAssetTransfersFn>,
    // Passphrase validation function symbol
    validate_passphrase: Symbol<'static, ValidatePassphraseFn>,
    // Swap/DEX aggregator function symbols
    get_swap_quote: Symbol<'static, GetSwapQuoteFn>,
    build_swap_transaction: Symbol<'static, BuildSwapTransactionFn>,
    get_swap_approval: Symbol<'static, GetSwapApprovalFn>,
    check_swap_allowance: Symbol<'static, CheckSwapAllowanceFn>,
    get_native_token_address: Symbol<'static, GetNativeTokenAddressFn>,
    get_swap_tokens: Symbol<'static, GetSwapTokensFn>,
    // Membership management function symbols
    get_membership_status: Symbol<'static, GetMembershipStatusFn>,
    get_device_membership_status_with_token: Symbol<'static, GetDeviceMembershipStatusWithTokenFn>,
    add_membership_binding: Symbol<'static, AddMembershipBindingFn>,
    remove_membership_binding: Symbol<'static, RemoveMembershipBindingFn>,
    sync_membership_binding_with_token: Symbol<'static, SyncMembershipBindingWithTokenFn>,
    remove_membership_binding_with_token: Symbol<'static, RemoveMembershipBindingWithTokenFn>,
    // Session management function symbols
    create_session_token: Symbol<'static, CreateSessionTokenFn>,
    validate_session_token: Symbol<'static, ValidateSessionTokenFn>,
    revoke_session_token: Symbol<'static, RevokeSessionTokenFn>,
    // Wallet session management function symbols
    create_wallet_session_token: Symbol<'static, CreateWalletSessionTokenFn>,
    validate_wallet_session_token: Symbol<'static, ValidateWalletSessionTokenFn>,
    revoke_wallet_session_token: Symbol<'static, RevokeWalletSessionTokenFn>,
    // WalletConnect signing function symbols
    sign_message: Symbol<'static, SignMessageFn>,
    sign_typed_data: Symbol<'static, SignTypedDataFn>,
    // Developer Mode session function symbols
    create_dev_session: Symbol<'static, CreateDevSessionFn>,
    dev_session_sign: Symbol<'static, DevSessionSignFn>,
    get_dev_session: Symbol<'static, GetDevSessionFn>,
    end_dev_session: Symbol<'static, EndDevSessionFn>,
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
                            // Verify library integrity by computing SHA256 hash
                            match Self::compute_library_hash(path) {
                                Ok(hash) => {
                                    tracing::info!("Loaded wallet library from: {}", path);
                                    tracing::info!("Library SHA256: {}", hash);
                                }
                                Err(e) => {
                                    tracing::warn!("Could not verify library hash: {}", e);
                                }
                            }
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

            let import_backup_wallet: Symbol<ImportBackupWalletFn> = lib
                .get(b"ImportBackupWallet")
                .map_err(|e| format!("ImportBackupWallet symbol not found: {}", e))?;

            let export_all_wallets: Symbol<ExportAllWalletsFn> = lib
                .get(b"ExportAllWallets")
                .map_err(|e| format!("ExportAllWallets symbol not found: {}", e))?;

            let import_all_wallets: Symbol<ImportAllWalletsFn> = lib
                .get(b"ImportAllWallets")
                .map_err(|e| format!("ImportAllWallets symbol not found: {}", e))?;

            let rename_wallet: Symbol<RenameWalletFn> = lib
                .get(b"RenameWallet")
                .map_err(|e| format!("RenameWallet symbol not found: {}", e))?;

            let delete_wallet: Symbol<DeleteWalletFn> = lib
                .get(b"DeleteWallet")
                .map_err(|e| format!("DeleteWallet symbol not found: {}", e))?;

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

            // Load Provider configuration symbols
            let set_provider_config: Symbol<SetProviderConfigFn> = lib
                .get(b"SetProviderConfig")
                .map_err(|e| format!("SetProviderConfig symbol not found: {}", e))?;

            let get_provider_config: Symbol<GetProviderConfigFn> = lib
                .get(b"GetProviderConfig")
                .map_err(|e| format!("GetProviderConfig symbol not found: {}", e))?;

            let list_provider_configs: Symbol<ListProviderConfigsFn> = lib
                .get(b"ListProviderConfigs")
                .map_err(|e| format!("ListProviderConfigs symbol not found: {}", e))?;

            let delete_provider_config: Symbol<DeleteProviderConfigFn> = lib
                .get(b"DeleteProviderConfig")
                .map_err(|e| format!("DeleteProviderConfig symbol not found: {}", e))?;

            // App-level authentication symbols
            let is_first_time_setup: Symbol<IsFirstTimeSetupFn> = lib
                .get(b"IsFirstTimeSetup")
                .map_err(|e| format!("IsFirstTimeSetup symbol not found: {}", e))?;

            let initialize_app: Symbol<InitializeAppFn> = lib
                .get(b"InitializeApp")
                .map_err(|e| format!("InitializeApp symbol not found: {}", e))?;

            let unlock_app: Symbol<UnlockAppFn> = lib
                .get(b"UnlockApp")
                .map_err(|e| format!("UnlockApp symbol not found: {}", e))?;

            let get_token_balances: Symbol<GetTokenBalancesFn> = lib
                .get(b"GetTokenBalances")
                .map_err(|e| format!("GetTokenBalances symbol not found: {}", e))?;

            let get_asset_transfers: Symbol<GetAssetTransfersFn> = lib
                .get(b"GetAssetTransfers")
                .map_err(|e| format!("GetAssetTransfers symbol not found: {}", e))?;

            let validate_passphrase: Symbol<ValidatePassphraseFn> = lib
                .get(b"ValidatePassphrase")
                .map_err(|e| format!("ValidatePassphrase symbol not found: {}", e))?;

            // Load Swap/DEX aggregator symbols
            let get_swap_quote: Symbol<GetSwapQuoteFn> = lib
                .get(b"GetSwapQuote")
                .map_err(|e| format!("GetSwapQuote symbol not found: {}", e))?;

            let build_swap_transaction: Symbol<BuildSwapTransactionFn> = lib
                .get(b"BuildSwapTransaction")
                .map_err(|e| format!("BuildSwapTransaction symbol not found: {}", e))?;

            let get_swap_approval: Symbol<GetSwapApprovalFn> = lib
                .get(b"GetSwapApproval")
                .map_err(|e| format!("GetSwapApproval symbol not found: {}", e))?;

            let check_swap_allowance: Symbol<CheckSwapAllowanceFn> = lib
                .get(b"CheckSwapAllowance")
                .map_err(|e| format!("CheckSwapAllowance symbol not found: {}", e))?;

            let get_native_token_address: Symbol<GetNativeTokenAddressFn> = lib
                .get(b"GetNativeTokenAddress")
                .map_err(|e| format!("GetNativeTokenAddress symbol not found: {}", e))?;

            let get_swap_tokens: Symbol<GetSwapTokensFn> = lib
                .get(b"GetSwapTokens")
                .map_err(|e| format!("GetSwapTokens symbol not found: {}", e))?;

            // Load Membership management symbols
            let get_membership_status: Symbol<GetMembershipStatusFn> = lib
                .get(b"GetMembershipStatus")
                .map_err(|e| format!("GetMembershipStatus symbol not found: {}", e))?;

            let get_device_membership_status_with_token: Symbol<GetDeviceMembershipStatusWithTokenFn> = lib
                .get(b"GetDeviceMembershipStatusWithToken")
                .map_err(|e| format!("GetDeviceMembershipStatusWithToken symbol not found: {}", e))?;

            let add_membership_binding: Symbol<AddMembershipBindingFn> = lib
                .get(b"AddMembershipBinding")
                .map_err(|e| format!("AddMembershipBinding symbol not found: {}", e))?;

            let remove_membership_binding: Symbol<RemoveMembershipBindingFn> = lib
                .get(b"RemoveMembershipBinding")
                .map_err(|e| format!("RemoveMembershipBinding symbol not found: {}", e))?;

            let sync_membership_binding_with_token: Symbol<SyncMembershipBindingWithTokenFn> = lib
                .get(b"SyncMembershipBindingWithToken")
                .map_err(|e| format!("SyncMembershipBindingWithToken symbol not found: {}", e))?;

            let remove_membership_binding_with_token: Symbol<RemoveMembershipBindingWithTokenFn> = lib
                .get(b"RemoveMembershipBindingWithToken")
                .map_err(|e| format!("RemoveMembershipBindingWithToken symbol not found: {}", e))?;

            // Load Session management symbols
            let create_session_token: Symbol<CreateSessionTokenFn> = lib
                .get(b"CreateSessionToken")
                .map_err(|e| format!("CreateSessionToken symbol not found: {}", e))?;

            let validate_session_token: Symbol<ValidateSessionTokenFn> = lib
                .get(b"ValidateSessionToken")
                .map_err(|e| format!("ValidateSessionToken symbol not found: {}", e))?;

            let revoke_session_token: Symbol<RevokeSessionTokenFn> = lib
                .get(b"RevokeSessionToken")
                .map_err(|e| format!("RevokeSessionToken symbol not found: {}", e))?;

            // Load Wallet Session management symbols
            let create_wallet_session_token: Symbol<CreateWalletSessionTokenFn> = lib
                .get(b"CreateWalletSessionToken")
                .map_err(|e| format!("CreateWalletSessionToken symbol not found: {}", e))?;

            let validate_wallet_session_token: Symbol<ValidateWalletSessionTokenFn> = lib
                .get(b"ValidateWalletSessionToken")
                .map_err(|e| format!("ValidateWalletSessionToken symbol not found: {}", e))?;

            let revoke_wallet_session_token: Symbol<RevokeWalletSessionTokenFn> = lib
                .get(b"RevokeWalletSessionToken")
                .map_err(|e| format!("RevokeWalletSessionToken symbol not found: {}", e))?;

            // Load WalletConnect signing symbols
            let sign_message: Symbol<SignMessageFn> = lib
                .get(b"SignMessage")
                .map_err(|e| format!("SignMessage symbol not found: {}", e))?;

            let sign_typed_data: Symbol<SignTypedDataFn> = lib
                .get(b"SignTypedData")
                .map_err(|e| format!("SignTypedData symbol not found: {}", e))?;

            // Load Developer Mode session symbols
            let create_dev_session: Symbol<CreateDevSessionFn> = lib
                .get(b"CreateDevSession")
                .map_err(|e| format!("CreateDevSession symbol not found: {}", e))?;

            let dev_session_sign: Symbol<DevSessionSignFn> = lib
                .get(b"DevSessionSign")
                .map_err(|e| format!("DevSessionSign symbol not found: {}", e))?;

            let get_dev_session: Symbol<GetDevSessionFn> = lib
                .get(b"GetDevSession")
                .map_err(|e| format!("GetDevSession symbol not found: {}", e))?;

            let end_dev_session: Symbol<EndDevSessionFn> = lib
                .get(b"EndDevSession")
                .map_err(|e| format!("EndDevSession symbol not found: {}", e))?;

            // Extend symbol lifetime to 'static (safe because Library lives for program duration)
            let go_free: Symbol<'static, GoFreeFn> = std::mem::transmute(go_free);
            let get_version: Symbol<'static, GetVersionFn> = std::mem::transmute(get_version);
            let create_wallet: Symbol<'static, CreateWalletFn> = std::mem::transmute(create_wallet);
            let import_wallet: Symbol<'static, ImportWalletFn> = std::mem::transmute(import_wallet);
            let unlock_wallet: Symbol<'static, UnlockWalletFn> = std::mem::transmute(unlock_wallet);
            let generate_addresses: Symbol<'static, GenerateAddressesFn> = std::mem::transmute(generate_addresses);
            let export_wallet: Symbol<'static, ExportWalletFn> = std::mem::transmute(export_wallet);
            let import_backup_wallet: Symbol<'static, ImportBackupWalletFn> = std::mem::transmute(import_backup_wallet);
            let export_all_wallets: Symbol<'static, ExportAllWalletsFn> = std::mem::transmute(export_all_wallets);
            let import_all_wallets: Symbol<'static, ImportAllWalletsFn> = std::mem::transmute(import_all_wallets);
            let rename_wallet: Symbol<'static, RenameWalletFn> = std::mem::transmute(rename_wallet);
            let delete_wallet: Symbol<'static, DeleteWalletFn> = std::mem::transmute(delete_wallet);
            let list_wallets: Symbol<'static, ListWalletsFn> = std::mem::transmute(list_wallets);
            let build_transaction: Symbol<'static, BuildTransactionFn> = std::mem::transmute(build_transaction);
            let sign_transaction: Symbol<'static, SignTransactionFn> = std::mem::transmute(sign_transaction);
            let broadcast_transaction: Symbol<'static, BroadcastTransactionFn> = std::mem::transmute(broadcast_transaction);
            let query_transaction_status: Symbol<'static, QueryTransactionStatusFn> = std::mem::transmute(query_transaction_status);
            let estimate_fee: Symbol<'static, EstimateFeeFn> = std::mem::transmute(estimate_fee);
            let set_provider_config: Symbol<'static, SetProviderConfigFn> = std::mem::transmute(set_provider_config);
            let get_provider_config: Symbol<'static, GetProviderConfigFn> = std::mem::transmute(get_provider_config);
            let list_provider_configs: Symbol<'static, ListProviderConfigsFn> = std::mem::transmute(list_provider_configs);
            let delete_provider_config: Symbol<'static, DeleteProviderConfigFn> = std::mem::transmute(delete_provider_config);
            let is_first_time_setup: Symbol<'static, IsFirstTimeSetupFn> = std::mem::transmute(is_first_time_setup);
            let initialize_app: Symbol<'static, InitializeAppFn> = std::mem::transmute(initialize_app);
            let unlock_app: Symbol<'static, UnlockAppFn> = std::mem::transmute(unlock_app);
            let get_token_balances: Symbol<'static, GetTokenBalancesFn> = std::mem::transmute(get_token_balances);
            let get_asset_transfers: Symbol<'static, GetAssetTransfersFn> = std::mem::transmute(get_asset_transfers);
            let validate_passphrase: Symbol<'static, ValidatePassphraseFn> = std::mem::transmute(validate_passphrase);
            let get_swap_quote: Symbol<'static, GetSwapQuoteFn> = std::mem::transmute(get_swap_quote);
            let build_swap_transaction: Symbol<'static, BuildSwapTransactionFn> = std::mem::transmute(build_swap_transaction);
            let get_swap_approval: Symbol<'static, GetSwapApprovalFn> = std::mem::transmute(get_swap_approval);
            let check_swap_allowance: Symbol<'static, CheckSwapAllowanceFn> = std::mem::transmute(check_swap_allowance);
            let get_native_token_address: Symbol<'static, GetNativeTokenAddressFn> = std::mem::transmute(get_native_token_address);
            let get_swap_tokens: Symbol<'static, GetSwapTokensFn> = std::mem::transmute(get_swap_tokens);
            let get_membership_status: Symbol<'static, GetMembershipStatusFn> = std::mem::transmute(get_membership_status);
            let get_device_membership_status_with_token: Symbol<'static, GetDeviceMembershipStatusWithTokenFn> = std::mem::transmute(get_device_membership_status_with_token);
            let add_membership_binding: Symbol<'static, AddMembershipBindingFn> = std::mem::transmute(add_membership_binding);
            let remove_membership_binding: Symbol<'static, RemoveMembershipBindingFn> = std::mem::transmute(remove_membership_binding);
            let sync_membership_binding_with_token: Symbol<'static, SyncMembershipBindingWithTokenFn> = std::mem::transmute(sync_membership_binding_with_token);
            let remove_membership_binding_with_token: Symbol<'static, RemoveMembershipBindingWithTokenFn> = std::mem::transmute(remove_membership_binding_with_token);
            let create_session_token: Symbol<'static, CreateSessionTokenFn> = std::mem::transmute(create_session_token);
            let validate_session_token: Symbol<'static, ValidateSessionTokenFn> = std::mem::transmute(validate_session_token);
            let revoke_session_token: Symbol<'static, RevokeSessionTokenFn> = std::mem::transmute(revoke_session_token);
            let create_wallet_session_token: Symbol<'static, CreateWalletSessionTokenFn> = std::mem::transmute(create_wallet_session_token);
            let validate_wallet_session_token: Symbol<'static, ValidateWalletSessionTokenFn> = std::mem::transmute(validate_wallet_session_token);
            let revoke_wallet_session_token: Symbol<'static, RevokeWalletSessionTokenFn> = std::mem::transmute(revoke_wallet_session_token);
            let sign_message: Symbol<'static, SignMessageFn> = std::mem::transmute(sign_message);
            let sign_typed_data: Symbol<'static, SignTypedDataFn> = std::mem::transmute(sign_typed_data);
            let create_dev_session: Symbol<'static, CreateDevSessionFn> = std::mem::transmute(create_dev_session);
            let dev_session_sign: Symbol<'static, DevSessionSignFn> = std::mem::transmute(dev_session_sign);
            let get_dev_session: Symbol<'static, GetDevSessionFn> = std::mem::transmute(get_dev_session);
            let end_dev_session: Symbol<'static, EndDevSessionFn> = std::mem::transmute(end_dev_session);

            Ok(WalletLibrary {
                lib: Arc::new(lib),
                go_free,
                get_version,
                create_wallet,
                import_wallet,
                unlock_wallet,
                generate_addresses,
                export_wallet,
                import_backup_wallet,
                export_all_wallets,
                import_all_wallets,
                rename_wallet,
                delete_wallet,
                list_wallets,
                build_transaction,
                sign_transaction,
                broadcast_transaction,
                query_transaction_status,
                estimate_fee,
                set_provider_config,
                get_provider_config,
                list_provider_configs,
                delete_provider_config,
                is_first_time_setup,
                initialize_app,
                unlock_app,
                get_token_balances,
                get_asset_transfers,
                validate_passphrase,
                get_swap_quote,
                build_swap_transaction,
                get_swap_approval,
                check_swap_allowance,
                get_native_token_address,
                get_swap_tokens,
                get_membership_status,
                get_device_membership_status_with_token,
                add_membership_binding,
                remove_membership_binding,
                sync_membership_binding_with_token,
                remove_membership_binding_with_token,
                create_session_token,
                validate_session_token,
                revoke_session_token,
                create_wallet_session_token,
                validate_wallet_session_token,
                revoke_wallet_session_token,
                sign_message,
                sign_typed_data,
                create_dev_session,
                dev_session_sign,
                get_dev_session,
                end_dev_session,
            })
        }
    }

    /// Get platform-specific search paths for the wallet library (T047, T048).
    ///
    /// Search order (highest priority first):
    /// 1. Executable directory (portable USB apps)
    /// 2. App bundle Resources directory (macOS .app bundles)
    /// Compute SHA256 hash of the library file for integrity verification.
    /// The hash is logged so administrators can compare against known-good values.
    fn compute_library_hash(path: &str) -> Result<String, String> {
        use sha2::{Sha256, Digest};
        use std::io::Read as _;

        let mut file = std::fs::File::open(path)
            .map_err(|e| format!("Failed to open library for verification: {}", e))?;
        let mut hasher = Sha256::new();
        let mut buffer = [0u8; 8192];
        loop {
            let n = std::io::Read::read(&mut file, &mut buffer)
                .map_err(|e| format!("Read error during hash: {}", e))?;
            if n == 0 { break; }
            hasher.update(&buffer[..n]);
        }
        Ok(format!("{:x}", hasher.finalize()))
    }

    /// 3. Current directory (development builds)
    /// 4. User-specific application directory
    /// 5. System-wide application directory
    ///
    /// Returns: Vec<String> of absolute paths to try
    fn get_search_paths(lib_name: &str) -> Vec<String> {
        let mut paths = Vec::new();

        // Priority 0: Executable directory (for portable USB apps)
        // This allows the library to be placed next to the executable
        if let Ok(exe_path) = std::env::current_exe() {
            if let Some(exe_dir) = exe_path.parent() {
                // Direct sibling of executable (Windows/Linux portable)
                paths.push(exe_dir.join(lib_name).to_string_lossy().to_string());

                // macOS app bundle: Contents/MacOS/../Resources = Contents/Resources
                #[cfg(target_os = "macos")]
                {
                    let resources_dir = exe_dir.join("../Resources");
                    paths.push(resources_dir.join(lib_name).to_string_lossy().to_string());
                }

                // Linux: lib subdirectory
                #[cfg(target_os = "linux")]
                {
                    let lib_dir = exe_dir.join("lib");
                    paths.push(lib_dir.join(lib_name).to_string_lossy().to_string());
                }

                // Development environment: target/debug/../../libarcsign.dylib = src-tauri/libarcsign.dylib
                // Only in debug builds to avoid cluttering production search paths
                #[cfg(debug_assertions)]
                {
                    let dev_lib_path = exe_dir.join("../..").join(lib_name);
                    paths.push(dev_lib_path.to_string_lossy().to_string());
                }
            }
        }

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

    /// Export wallet as encrypted .arcsign backup file.
    pub fn export_wallet(&self, params_json: &str) -> Result<serde_json::Value, String> {
        self.call_ffi_with_params(*self.export_wallet, params_json)
    }

    /// Import wallet from encrypted .arcsign backup file.
    pub fn import_backup_wallet(&self, params_json: &str) -> Result<serde_json::Value, String> {
        self.call_ffi_with_params(*self.import_backup_wallet, params_json)
    }

    /// Export all wallets as encrypted .arcsign-bundle file.
    pub fn export_all_wallets(&self, params_json: &str) -> Result<serde_json::Value, String> {
        self.call_ffi_with_params(*self.export_all_wallets, params_json)
    }

    /// Import all wallets from encrypted .arcsign-bundle file.
    pub fn import_all_wallets(&self, params_json: &str) -> Result<serde_json::Value, String> {
        self.call_ffi_with_params(*self.import_all_wallets, params_json)
    }

    /// Change wallet display name.
    pub fn rename_wallet(&self, params_json: &str) -> Result<serde_json::Value, String> {
        self.call_ffi_with_params(*self.rename_wallet, params_json)
    }

    /// Delete a wallet from storage (requires password verification).
    pub fn delete_wallet(&self, params_json: &str) -> Result<serde_json::Value, String> {
        self.call_ffi_with_params(*self.delete_wallet, params_json)
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

    // ========================================================================
    // Provider Configuration Operations
    // ========================================================================

    /// Set a blockchain provider configuration (Alchemy, Infura, etc.)
    ///
    /// Input JSON format:
    /// ```json
    /// {
    ///   "providerType": "alchemy",
    ///   "apiKey": "your-api-key",
    ///   "chainId": "ethereum",
    ///   "networkId": "mainnet",
    ///   "priority": 100,
    ///   "enabled": true,
    ///   "password": "wallet-password",
    ///   "usbPath": "/path/to/usb"
    /// }
    /// ```
    pub fn set_provider_config(&self, params_json: &str) -> Result<serde_json::Value, String> {
        self.call_ffi_with_params(*self.set_provider_config, params_json)
    }

    /// Get a blockchain provider configuration.
    ///
    /// Input JSON format:
    /// ```json
    /// {
    ///   "chainId": "ethereum",
    ///   "providerType": "alchemy",
    ///   "password": "wallet-password",
    ///   "usbPath": "/path/to/usb"
    /// }
    /// ```
    pub fn get_provider_config(&self, params_json: &str) -> Result<serde_json::Value, String> {
        self.call_ffi_with_params(*self.get_provider_config, params_json)
    }

    /// List all provider configurations.
    ///
    /// Input JSON format:
    /// ```json
    /// {
    ///   "chainId": "ethereum",
    ///   "password": "wallet-password",
    ///   "usbPath": "/path/to/usb"
    /// }
    /// ```
    pub fn list_provider_configs(&self, params_json: &str) -> Result<serde_json::Value, String> {
        self.call_ffi_with_params(*self.list_provider_configs, params_json)
    }

    /// Delete a provider configuration.
    ///
    /// Input JSON format:
    /// ```json
    /// {
    ///   "chainId": "ethereum",
    ///   "providerType": "alchemy",
    ///   "password": "wallet-password",
    ///   "usbPath": "/path/to/usb"
    /// }
    /// ```
    pub fn delete_provider_config(&self, params_json: &str) -> Result<serde_json::Value, String> {
        self.call_ffi_with_params(*self.delete_provider_config, params_json)
    }

    /// Check if this is first-time setup (app_config.enc doesn't exist).
    ///
    /// # Example Input JSON
    /// ```json
    /// {
    ///   "usbPath": "/path/to/usb"
    /// }
    /// ```
    pub fn is_first_time_setup(&self, params_json: &str) -> Result<serde_json::Value, String> {
        self.call_ffi_with_params(*self.is_first_time_setup, params_json)
    }

    /// Initialize app configuration for first-time setup.
    ///
    /// # Example Input JSON
    /// ```json
    /// {
    ///   "password": "master-password",
    ///   "usbPath": "/path/to/usb"
    /// }
    /// ```
    pub fn initialize_app(&self, params_json: &str) -> Result<serde_json::Value, String> {
        self.call_ffi_with_params(*self.initialize_app, params_json)
    }

    /// Unlock app and load configuration.
    ///
    /// # Example Input JSON
    /// ```json
    /// {
    ///   "password": "master-password",
    ///   "usbPath": "/path/to/usb"
    /// }
    /// ```
    pub fn unlock_app(&self, params_json: &str) -> Result<serde_json::Value, String> {
        self.call_ffi_with_params(*self.unlock_app, params_json)
    }

    /// Get token balances across multiple chains using Alchemy API.
    ///
    /// # Example Input JSON
    /// ```json
    /// {
    ///   "walletId": "wallet-uuid",
    ///   "password": "wallet-password",
    ///   "usbPath": "/path/to/usb",
    ///   "appPassword": "app-password"
    /// }
    /// ```
    pub fn get_token_balances(&self, params_json: &str) -> Result<serde_json::Value, String> {
        self.call_ffi_with_params(*self.get_token_balances, params_json)
    }

    /// Get asset transfers (transaction history) for an address using Alchemy API.
    ///
    /// # Example Input JSON
    /// ```json
    /// {
    ///   "address": "0x...",
    ///   "network": "eth-mainnet",
    ///   "maxCount": 50,
    ///   "pageKey": "",
    ///   "appPassword": "app-password",
    ///   "usbPath": "/path/to/usb"
    /// }
    /// ```
    pub fn get_asset_transfers(&self, params_json: &str) -> Result<serde_json::Value, String> {
        self.call_ffi_with_params(*self.get_asset_transfers, params_json)
    }

    /// Validate a BIP39 passphrase by comparing derived address with stored address.
    ///
    /// This is used during wallet unlock to validate the passphrase before proceeding.
    ///
    /// Input JSON format:
    /// ```json
    /// {
    ///   "walletId": "...",
    ///   "password": "...",
    ///   "passphrase": "...",
    ///   "usbPath": "/path/to/usb"
    /// }
    /// ```
    pub fn validate_passphrase(&self, params_json: &str) -> Result<serde_json::Value, String> {
        self.call_ffi_with_params(*self.validate_passphrase, params_json)
    }

    // ========================================================================
    // Swap/DEX Aggregator Operations
    // ========================================================================

    /// Get a swap quote from 1inch DEX aggregator.
    ///
    /// Input JSON format:
    /// ```json
    /// {
    ///   "chainId": "ethereum",
    ///   "fromTokenAddress": "0x...",
    ///   "toTokenAddress": "0x...",
    ///   "amount": "1000000000000000000",
    ///   "fromAddress": "0x...",
    ///   "slippage": 0.5,
    ///   "usbPath": "/path/to/usb",
    ///   "appPassword": "password"
    /// }
    /// ```
    pub fn get_swap_quote(&self, params_json: &str) -> Result<serde_json::Value, String> {
        self.call_ffi_with_params(*self.get_swap_quote, params_json)
    }

    /// Build a complete swap transaction ready for signing.
    ///
    /// Input JSON format: same as get_swap_quote
    pub fn build_swap_transaction(&self, params_json: &str) -> Result<serde_json::Value, String> {
        self.call_ffi_with_params(*self.build_swap_transaction, params_json)
    }

    /// Get the approval transaction for ERC-20 token swap.
    ///
    /// Input JSON format:
    /// ```json
    /// {
    ///   "chainId": "ethereum",
    ///   "tokenAddress": "0x...",
    ///   "amount": "1000000000000000000",
    ///   "usbPath": "/path/to/usb",
    ///   "appPassword": "password"
    /// }
    /// ```
    pub fn get_swap_approval(&self, params_json: &str) -> Result<serde_json::Value, String> {
        self.call_ffi_with_params(*self.get_swap_approval, params_json)
    }

    /// Check the current token allowance for 1inch router.
    ///
    /// Input JSON format:
    /// ```json
    /// {
    ///   "chainId": "ethereum",
    ///   "tokenAddress": "0x...",
    ///   "walletAddress": "0x...",
    ///   "usbPath": "/path/to/usb",
    ///   "appPassword": "password"
    /// }
    /// ```
    pub fn check_swap_allowance(&self, params_json: &str) -> Result<serde_json::Value, String> {
        self.call_ffi_with_params(*self.check_swap_allowance, params_json)
    }

    /// Get the native token address used by 1inch API.
    pub fn get_native_token_address(&self) -> Result<serde_json::Value, String> {
        self.call_ffi_json(*self.get_native_token_address)
    }

    /// Get all available swap tokens for a chain from 1inch API.
    ///
    /// Input JSON format:
    /// ```json
    /// {
    ///   "chainId": "56",
    ///   "usbPath": "/path/to/usb",
    ///   "appPassword": "password"
    /// }
    /// ```
    pub fn get_swap_tokens(&self, params_json: &str) -> Result<serde_json::Value, String> {
        self.call_ffi_with_params(*self.get_swap_tokens, params_json)
    }

    // ========================================================================
    // Membership Management Operations
    // ========================================================================

    /// Get membership status including device identity and NFT bindings.
    ///
    /// Input JSON format:
    /// ```json
    /// {
    ///   "usbPath": "/path/to/usb",
    ///   "appPassword": "password"
    /// }
    /// ```
    ///
    /// Returns device ID, device ID hash (for contract binding), wallet limits,
    /// and list of NFT membership bindings.
    pub fn get_membership_status(&self, params_json: &str) -> Result<serde_json::Value, String> {
        self.call_ffi_with_params(*self.get_membership_status, params_json)
    }

    /// Get device membership status using session token (no password required).
    ///
    /// This is the preferred method for checking membership after login,
    /// as it uses the session token stored during authentication.
    ///
    /// Input JSON format:
    /// ```json
    /// {
    ///   "token": "session-token-from-login"
    /// }
    /// ```
    ///
    /// Returns device ID, device ID hash (for contract binding), wallet limits,
    /// and list of NFT membership bindings.
    pub fn get_device_membership_status_with_token(&self, params_json: &str) -> Result<serde_json::Value, String> {
        self.call_ffi_with_params(*self.get_device_membership_status_with_token, params_json)
    }

    /// Add a new NFT membership binding to this USB device.
    ///
    /// Call this after the user has bound their deviceId on the NFT contract.
    ///
    /// Input JSON format:
    /// ```json
    /// {
    ///   "usbPath": "/path/to/usb",
    ///   "appPassword": "password",
    ///   "nftTokenId": "1",
    ///   "nftContract": "0x...",
    ///   "chainId": "bnb",
    ///   "boundAddress": "0x...",
    ///   "signature": "0x..."
    /// }
    /// ```
    pub fn add_membership_binding(&self, params_json: &str) -> Result<serde_json::Value, String> {
        self.call_ffi_with_params(*self.add_membership_binding, params_json)
    }

    /// Remove an NFT membership binding from this USB device.
    ///
    /// Input JSON format:
    /// ```json
    /// {
    ///   "usbPath": "/path/to/usb",
    ///   "appPassword": "password",
    ///   "nftTokenId": "1",
    ///   "nftContract": "0x..."
    /// }
    /// ```
    pub fn remove_membership_binding(&self, params_json: &str) -> Result<serde_json::Value, String> {
        self.call_ffi_with_params(*self.remove_membership_binding, params_json)
    }

    /// Sync a membership binding using session token (no password needed).
    ///
    /// Call this to sync on-chain bindings to USB storage.
    ///
    /// Input JSON format:
    /// ```json
    /// {
    ///   "token": "session-token",
    ///   "nftTokenId": "1",
    ///   "nftContract": "0x...",
    ///   "chainId": "bnb",
    ///   "boundAddress": "0x..."
    /// }
    /// ```
    pub fn sync_membership_binding_with_token(&self, params_json: &str) -> Result<serde_json::Value, String> {
        self.call_ffi_with_params(*self.sync_membership_binding_with_token, params_json)
    }

    /// Remove a membership binding using session token (no password needed).
    ///
    /// Input JSON format:
    /// ```json
    /// {
    ///   "token": "session-token",
    ///   "nftTokenId": "1",
    ///   "nftContract": "0x..."
    /// }
    /// ```
    pub fn remove_membership_binding_with_token(&self, params_json: &str) -> Result<serde_json::Value, String> {
        self.call_ffi_with_params(*self.remove_membership_binding_with_token, params_json)
    }

    /// Create a new session token after validating credentials.
    ///
    /// Input JSON format:
    /// ```json
    /// {
    ///   "usbPath": "/path/to/usb",
    ///   "appPassword": "password"
    /// }
    /// ```
    ///
    /// Returns:
    /// ```json
    /// {
    ///   "token": "hex-encoded-token",
    ///   "expiresAt": 1234567890,
    ///   "usbPath": "/path/to/usb"
    /// }
    /// ```
    pub fn create_session_token(&self, params_json: &str) -> Result<serde_json::Value, String> {
        self.call_ffi_with_params(*self.create_session_token, params_json)
    }

    /// Validate a session token and get session info.
    ///
    /// Input JSON format:
    /// ```json
    /// {
    ///   "token": "hex-encoded-token"
    /// }
    /// ```
    ///
    /// Returns:
    /// ```json
    /// {
    ///   "valid": true,
    ///   "usbPath": "/path/to/usb",
    ///   "expiresAt": 1234567890
    /// }
    /// ```
    pub fn validate_session_token(&self, params_json: &str) -> Result<serde_json::Value, String> {
        self.call_ffi_with_params(*self.validate_session_token, params_json)
    }

    /// Revoke (invalidate) a session token.
    ///
    /// Input JSON format:
    /// ```json
    /// {
    ///   "token": "hex-encoded-token"
    /// }
    /// ```
    ///
    /// Returns:
    /// ```json
    /// {
    ///   "revoked": true
    /// }
    /// ```
    pub fn revoke_session_token(&self, params_json: &str) -> Result<serde_json::Value, String> {
        self.call_ffi_with_params(*self.revoke_session_token, params_json)
    }

    /// Create a wallet session token by validating wallet password.
    ///
    /// Input JSON format:
    /// ```json
    /// {
    ///   "walletId": "wallet-uuid",
    ///   "password": "wallet-password",
    ///   "usbPath": "/path/to/usb"
    /// }
    /// ```
    ///
    /// Returns:
    /// ```json
    /// {
    ///   "token": "hex-encoded-token",
    ///   "walletId": "wallet-uuid",
    ///   "expiresAt": 1234567890,
    ///   "usbPath": "/path/to/usb"
    /// }
    /// ```
    pub fn create_wallet_session_token(&self, params_json: &str) -> Result<serde_json::Value, String> {
        self.call_ffi_with_params(*self.create_wallet_session_token, params_json)
    }

    /// Validate a wallet session token and get session info.
    ///
    /// Input JSON format:
    /// ```json
    /// {
    ///   "token": "hex-encoded-token"
    /// }
    /// ```
    ///
    /// Returns:
    /// ```json
    /// {
    ///   "valid": true,
    ///   "walletId": "wallet-uuid",
    ///   "expiresAt": 1234567890,
    ///   "usbPath": "/path/to/usb"
    /// }
    /// ```
    pub fn validate_wallet_session_token(&self, params_json: &str) -> Result<serde_json::Value, String> {
        self.call_ffi_with_params(*self.validate_wallet_session_token, params_json)
    }

    /// Revoke (invalidate) a wallet session token.
    ///
    /// Input JSON format:
    /// ```json
    /// {
    ///   "token": "hex-encoded-token"
    /// }
    /// ```
    ///
    /// Returns:
    /// ```json
    /// {
    ///   "revoked": true
    /// }
    /// ```
    pub fn revoke_wallet_session_token(&self, params_json: &str) -> Result<serde_json::Value, String> {
        self.call_ffi_with_params(*self.revoke_wallet_session_token, params_json)
    }

    // ========================================================================
    // WalletConnect Signing Operations
    // ========================================================================

    /// Sign a message using EIP-191 (personal_sign).
    ///
    /// Input JSON format:
    /// ```json
    /// {
    ///   "walletId": "wallet-uuid",
    ///   "password": "wallet-password",
    ///   "passphrase": "optional-bip39-passphrase",
    ///   "usbPath": "/path/to/usb",
    ///   "address": "0x...",
    ///   "message": "0x... or plain text"
    /// }
    /// ```
    ///
    /// Returns:
    /// ```json
    /// {
    ///   "signature": "0x...",
    ///   "messageHash": "0x...",
    ///   "signedBy": "0x..."
    /// }
    /// ```
    pub fn sign_message(&self, params_json: &str) -> Result<serde_json::Value, String> {
        self.call_ffi_with_params(*self.sign_message, params_json)
    }

    /// Sign EIP-712 typed data (eth_signTypedData_v4).
    ///
    /// Input JSON format:
    /// ```json
    /// {
    ///   "walletId": "wallet-uuid",
    ///   "password": "wallet-password",
    ///   "passphrase": "optional-bip39-passphrase",
    ///   "usbPath": "/path/to/usb",
    ///   "address": "0x...",
    ///   "typedData": "{...}" // EIP-712 JSON string
    /// }
    /// ```
    ///
    /// Returns:
    /// ```json
    /// {
    ///   "signature": "0x...",
    ///   "signedBy": "0x..."
    /// }
    /// ```
    pub fn sign_typed_data(&self, params_json: &str) -> Result<serde_json::Value, String> {
        self.call_ffi_with_params(*self.sign_typed_data, params_json)
    }

    // =========================================================================
    // Developer Mode Session Methods
    // =========================================================================

    /// Create a developer session for auto-signing testnets.
    ///
    /// Input JSON format:
    /// ```json
    /// {
    ///   "walletId": "wallet-uuid",
    ///   "password": "wallet-password",
    ///   "passphrase": "optional-bip39-passphrase",
    ///   "usbPath": "/path/to/usb",
    ///   "durationMinutes": 30,
    ///   "trustedNetworks": ["sepolia", "goerli", "bsc-testnet"]
    /// }
    /// ```
    ///
    /// Returns:
    /// ```json
    /// {
    ///   "sessionToken": "dev_xxx...",
    ///   "expiresAt": 1234567890000,
    ///   "trustedNetworks": ["sepolia", "goerli"],
    ///   "addresses": ["0x..."]
    /// }
    /// ```
    pub fn create_dev_session(&self, params_json: &str) -> Result<serde_json::Value, String> {
        self.call_ffi_with_params(*self.create_dev_session, params_json)
    }

    /// Sign a transaction using an active dev session (no password required).
    /// Only works for testnet transactions in trusted networks.
    ///
    /// Input JSON format:
    /// ```json
    /// {
    ///   "sessionToken": "dev_xxx...",
    ///   "chainId": 11155111,
    ///   "from": "0x...",
    ///   "to": "0x...",
    ///   "data": "0x...",
    ///   "value": "0",
    ///   "gas": "21000",
    ///   "gasPrice": "1000000000",
    ///   "nonce": 0
    /// }
    /// ```
    ///
    /// Returns:
    /// ```json
    /// {
    ///   "signedTx": "0x...",
    ///   "txHash": "0x...",
    ///   "signedBy": "0x..."
    /// }
    /// ```
    pub fn dev_session_sign(&self, params_json: &str) -> Result<serde_json::Value, String> {
        self.call_ffi_with_params(*self.dev_session_sign, params_json)
    }

    /// Get information about an active dev session.
    ///
    /// Input JSON format:
    /// ```json
    /// {
    ///   "sessionToken": "dev_xxx..."
    /// }
    /// ```
    ///
    /// Returns:
    /// ```json
    /// {
    ///   "active": true,
    ///   "walletId": "...",
    ///   "expiresAt": 1234567890000,
    ///   "remainingMs": 60000,
    ///   "signCount": 5,
    ///   "trustedNetworks": ["sepolia"],
    ///   "addresses": ["0x..."]
    /// }
    /// ```
    pub fn get_dev_session(&self, params_json: &str) -> Result<serde_json::Value, String> {
        self.call_ffi_with_params(*self.get_dev_session, params_json)
    }

    /// End a developer session and clear all stored keys.
    ///
    /// Input JSON format:
    /// ```json
    /// {
    ///   "sessionToken": "dev_xxx..."
    /// }
    /// ```
    ///
    /// Returns:
    /// ```json
    /// {
    ///   "status": "ended"
    /// }
    /// ```
    pub fn end_dev_session(&self, params_json: &str) -> Result<serde_json::Value, String> {
        self.call_ffi_with_params(*self.end_dev_session, params_json)
    }
}

// Implement Send + Sync to allow sharing across threads
// Safe because:
// 1. Library is read-only after loading
// 2. Function symbols are read-only
// 3. Actual operations serialized through WalletQueue
unsafe impl Send for WalletLibrary {}
unsafe impl Sync for WalletLibrary {}
