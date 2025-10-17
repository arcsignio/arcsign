/**
 * CLI subprocess integration module
 * Feature: User Dashboard for Wallet Management
 */

pub mod wrapper;

pub use wrapper::{
    AddressListResponse, AddressRecord, CliCommand, CliWrapper, WalletCreateResponse,
    WalletImportResponse, WalletInfo, WalletListResponse,
};
