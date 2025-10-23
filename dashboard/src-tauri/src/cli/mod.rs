/**
 * CLI subprocess integration module
 * Feature: User Dashboard for Wallet Management
 */

pub mod types;
pub mod wrapper;

pub use types::{
    Address, AddressCategory, CliError, CliErrorCode, CliResponse, DeriveAddressData,
    ErrorObject, WalletMetadata,
};

pub use wrapper::{
    AddressListResponse, AddressRecord, CliCommand, CliWrapper, WalletCreateResponse,
    WalletImportResponse, WalletInfo, WalletListResponse,
};
