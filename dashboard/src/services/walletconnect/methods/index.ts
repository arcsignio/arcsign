/**
 * WalletConnect Method Handlers Index
 * Feature: Unified export for all WC method handlers
 * Created: 2026-01-15
 *
 * Purpose: Auto-register all handlers by importing this file
 *
 * To add a new method:
 * 1. Create handler file in this directory
 * 2. Add import below
 * That's it! The handler will be auto-registered.
 */

// Signing methods (require user password)
import './personal-sign';
import './eth-sign-typed-data';
import './eth-send-transaction';

// Chain methods (no password required)
import './wallet-switch-chain';
import './wallet-add-chain';

// Re-export for direct access if needed
export { personalSignHandler } from './personal-sign';
export { signTypedDataHandler } from './eth-sign-typed-data';
export { sendTransactionHandler } from './eth-send-transaction';
export { switchChainHandler } from './wallet-switch-chain';
export { addChainHandler } from './wallet-add-chain';
