/**
 * Domain models module
 * Feature: User Dashboard for Wallet Management
 */

pub mod address;
pub mod wallet;

pub use address::{Address, AddressListResponse, Category, KeyType};
pub use wallet::{Wallet, WalletCreateResponse, WalletImportResponse};
