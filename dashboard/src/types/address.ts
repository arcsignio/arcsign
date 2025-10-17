/**
 * TypeScript type definitions for Address entities
 * Feature: User Dashboard for Wallet Management
 * Generated: 2025-10-17
 */

/**
 * Blockchain category classification
 */
export enum Category {
  /** Original Bitcoin and Layer-1 blockchains */
  BASE = 'base',

  /** Ethereum Layer-2 scaling solutions */
  LAYER2 = 'layer2',

  /** Region-specific or local blockchains */
  REGIONAL = 'regional',

  /** Cosmos ecosystem chains */
  COSMOS = 'cosmos',

  /** Alternative EVM-compatible chains */
  ALT_EVM = 'alt_evm',

  /** Specialized or niche blockchains */
  SPECIALIZED = 'specialized',
}

/**
 * Cryptographic key type for address derivation
 */
export enum KeyType {
  /** ECDSA secp256k1 (Bitcoin, Ethereum) */
  SECP256K1 = 'secp256k1',

  /** EdDSA Ed25519 (Solana, Cardano, Polkadot) */
  ED25519 = 'ed25519',

  /** Schnorr sr25519 (Substrate-based chains) */
  SR25519 = 'sr25519',

  /** Schnorr signature scheme (Bitcoin Taproot) */
  SCHNORR = 'schnorr',
}

/**
 * Represents a derived cryptocurrency address for a specific blockchain
 * Each wallet contains exactly 54 addresses (one per supported blockchain)
 */
export interface Address {
  /** Parent wallet identifier (links to Wallet.id) */
  wallet_id: string;

  /** Display order (1-54, matches SLIP-44 registration order) */
  rank: number;

  /** Blockchain symbol (e.g., "BTC", "ETH", "SOL") */
  symbol: string;

  /** Human-readable blockchain name (e.g., "Bitcoin", "Ethereum") */
  name: string;

  /** SLIP-44 coin type (e.g., 0 for BTC, 60 for ETH) */
  coin_type: number;

  /** BIP44 derivation path (e.g., "m/44'/0'/0'/0/0") */
  derivation_path: string;

  /** Derived public address (blockchain-specific format) */
  address: string;

  /** Blockchain category for filtering */
  category: Category;

  /** Cryptographic key type used for derivation */
  key_type: KeyType;

  /** Optional testnet indicator (true for testnet addresses) */
  is_testnet?: boolean;
}

/**
 * Response from load_addresses Tauri command
 * Contains all 54 derived addresses for a wallet
 */
export interface AddressListResponse {
  /** Wallet identifier */
  wallet_id: string;

  /** Array of all 54 blockchain addresses */
  addresses: Address[];

  /** Total address count (always 54 for v0.3.0) */
  total_count: number;
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
 * Filter criteria for address list display
 */
export interface AddressFilter {
  /** Filter by blockchain category (optional) */
  category?: Category;

  /** Filter by key type (optional) */
  key_type?: KeyType;

  /** Search query for symbol or name (optional) */
  search?: string;

  /** Show only testnet addresses (optional) */
  testnet_only?: boolean;
}

/**
 * Export format options
 */
export enum ExportFormat {
  /** JSON format with full metadata */
  JSON = 'json',

  /** CSV format (symbol, address, derivation_path) */
  CSV = 'csv',
}

/**
 * Parameters for exporting addresses
 */
export interface ExportAddressesParams {
  /** Wallet identifier */
  wallet_id: string;

  /** Export file format */
  format: ExportFormat;

  /** Optional filter to export subset of addresses */
  filter?: AddressFilter;
}

/**
 * Response from export_addresses Tauri command
 */
export interface ExportResponse {
  /** Export file path */
  file_path: string;

  /** Number of addresses exported */
  exported_count: number;

  /** Export format used */
  format: ExportFormat;

  /** Export timestamp (ISO 8601) */
  exported_at: string;
}
