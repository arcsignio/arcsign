/**
 * TypeScript type definitions for Wallet entities
 * Feature: User Dashboard for Wallet Management
 * Generated: 2025-10-17
 */

/**
 * Public address from AddressBook (no sensitive data)
 */
export interface WalletAddress {
  /** Ticker symbol (e.g., "BTC", "ETH", "BNB") */
  symbol: string;
  /** Full coin name (e.g., "Bitcoin", "Ethereum") */
  coinName: string;
  /** SLIP-44 coin type */
  coinType: number;
  /** Blockchain address (public, no password needed) */
  address: string;
  /** BIP44 derivation path */
  derivationPath: string;
  /** Blockchain category */
  category: string;
}

/**
 * Represents a hierarchical deterministic wallet
 * Contains mnemonic seed (encrypted on USB), metadata, and derived addresses
 */
export interface Wallet {
  /** Unique wallet identifier (SHA-256 hash of mnemonic) */
  id: string;

  /** User-assigned wallet name (1-50 chars) */
  name: string;

  /** Wallet creation timestamp (ISO 8601) */
  created_at: string;

  /** Last modification timestamp (ISO 8601) */
  updated_at: string;

  /** True if BIP39 passphrase (25th word) was used */
  has_passphrase: boolean;

  /** Number of derived addresses (always 54 for v0.3.0) */
  address_count: number;

  /** Public addresses from AddressBook (optional, loaded with wallet list) */
  addresses?: WalletAddress[];
}

/**
 * Response from create_wallet Tauri command
 * Contains wallet metadata + mnemonic (SECURITY: display once, then clear)
 */
export interface WalletCreateResponse {
  wallet: Wallet;

  /** BIP39 mnemonic phrase (12 or 24 words, space-separated)
   *  SECURITY: Never store in state, only display in secure component
   */
  mnemonic: string;
}

/**
 * Response from import_wallet Tauri command
 */
export interface WalletImportResponse {
  wallet: Wallet;

  /** True if wallet with same ID already exists (FR-031) */
  is_duplicate: boolean;
}

/**
 * Parameters for wallet creation
 */
export interface WalletCreateParams {
  /** Encryption password (12+ chars, complexity required) */
  password: string;

  /** USB mount point from detect_usb */
  usb_path: string;

  /** Optional wallet name (default: "Wallet {timestamp}") */
  name?: string;

  /** Optional BIP39 passphrase (25th word) */
  passphrase?: string;

  /** Mnemonic word count (12 or 24, default: 24) */
  mnemonic_length?: 12 | 24;
}

/**
 * Parameters for wallet import
 */
export interface WalletImportParams {
  /** BIP39 mnemonic phrase (12 or 24 words, space-separated) */
  mnemonic: string;

  /** Encryption password for this wallet */
  password: string;

  /** USB mount point */
  usb_path: string;

  /** Optional BIP39 passphrase (25th word) */
  passphrase?: string;

  /** Optional wallet name */
  name?: string;
}

/**
 * Parameters for loading wallet addresses
 */
export interface LoadAddressesParams {
  /** Wallet identifier */
  wallet_id: string;

  /** Wallet encryption password */
  password: string;

  /** USB mount point */
  usb_path: string;
}

/**
 * Parameters for renaming a wallet
 */
export interface RenameWalletParams {
  /** Wallet identifier */
  wallet_id: string;

  /** New wallet name (1-50 chars) */
  new_name: string;

  /** USB mount point */
  usb_path: string;
}
