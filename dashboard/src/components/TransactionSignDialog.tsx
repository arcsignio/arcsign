/**
 * TransactionSignDialog Component
 *
 * Dialog for confirming and signing transactions from external sources (mint-page).
 * Requires USB insertion and password for each transaction.
 *
 * Feature: WebSocket wallet integration
 */

import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { PendingTransactionInfo } from '@/services/tauri-api';
import { decodeCalldata } from '@/services/clearsign/decodeCalldata';
import type { DecodedIntent } from '@/services/clearsign/types';
import { ClearSignSummary } from '@/components/ClearSignSummary';

// Map chain_id to Alchemy/internal network string for decodeCalldata
function chainIdToNetwork(chainId: number): string {
  switch (chainId) {
    case 1:   return 'eth-mainnet';
    case 137: return 'polygon-mainnet';
    case 42161: return 'arb-mainnet';
    case 10:  return 'opt-mainnet';
    case 8453: return 'base-mainnet';
    case 56:
    case 97:  return 'bnb-mainnet';
    default:  return 'eth-mainnet';
  }
}

// Re-export for backward compatibility
export type PendingTransaction = PendingTransactionInfo;

interface TransactionSignDialogProps {
  transaction: PendingTransactionInfo | null;
  walletName?: string;
  onConfirm: (requestId: number, password: string) => Promise<void>;
  onReject: (requestId: number) => Promise<void> | void;
}

export function TransactionSignDialog({
  transaction,
  walletName,
  onConfirm,
  onReject,
}: TransactionSignDialogProps) {
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usbConnected, setUsbConnected] = useState(false);
  const [intent, setIntent] = useState<DecodedIntent | null>(null);

  // Check USB connection on mount
  useEffect(() => {
    if (transaction) {
      checkUsbConnection();
      // Reset state
      setPassword('');
      setError(null);
    }
  }, [transaction]);

  // Decode calldata for clear-signing display
  useEffect(() => {
    if (!transaction) { setIntent(null); return; }
    const network = chainIdToNetwork(transaction.chain_id);
    decodeCalldata(network, transaction.to, transaction.data, transaction.value)
      .then(setIntent)
      .catch(() => setIntent(null));
  }, [transaction]);

  const checkUsbConnection = async () => {
    try {
      const devices = await invoke<Array<{ path: string }>>('detect_usb');
      setUsbConnected(devices.length > 0);
    } catch (e) {
      setUsbConnected(false);
    }
  };

  const handleConfirm = async () => {
    if (!password) {
      setError('Please enter your password');
      return;
    }

    if (!usbConnected) {
      setError('Please insert your USB device');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await onConfirm(transaction!.request_id, password);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to sign transaction');
      setIsLoading(false);
    }
    // Note: Don't reset isLoading here - the parent component will close the dialog
  };

  const handleReject = async () => {
    // Call onReject but don't wait - just clean up local state
    onReject(transaction!.request_id);
    setPassword('');
    setError(null);
    setIsLoading(false);
  };

  if (!transaction) return null;

  // Format address for display
  const shortAddress = (addr: string) => {
    if (addr.length >= 10) {
      return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
    }
    return addr;
  };

  // Get chain name
  const getChainName = (chainId: number) => {
    switch (chainId) {
      case 56: return 'BNB Chain';
      case 97: return 'BSC Testnet';
      case 1: return 'Ethereum';
      default: return `Chain ${chainId}`;
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50"
      onClick={handleReject}
    >
      <div
        className="bg-white rounded-xl p-6 max-w-lg w-full mx-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="sign-dialog-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 id="sign-dialog-title" className="text-xl font-bold text-gray-900">
            Confirm Transaction
          </h2>
          <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">
            {getChainName(transaction.chain_id)}
          </span>
        </div>

        {/* Transaction Details */}
        <div className="bg-gray-50 rounded-lg p-4 mb-4 space-y-3">
          {/* Description */}
          <div className="text-center py-2">
            <p className="text-lg font-semibold text-gray-800">
              {transaction.description}
            </p>
          </div>

          {/* Wallet */}
          {walletName && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Wallet</span>
              <span className="font-medium text-gray-800">{walletName}</span>
            </div>
          )}

          {/* From */}
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">From</span>
            <span className="font-mono text-gray-800">{shortAddress(transaction.from)}</span>
          </div>

          {/* To */}
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">To</span>
            <span className="font-mono text-gray-800">{shortAddress(transaction.to)}</span>
          </div>

          {/* Clear-signing summary */}
          {intent && (
            <div style={{ marginTop: '0.5rem' }}>
              <ClearSignSummary intent={intent} />
            </div>
          )}

          {/* Value (if not zero) */}
          {transaction.value && transaction.value !== '0x0' && transaction.value !== '0' && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Value</span>
              <span className="font-mono text-gray-800">{transaction.value} wei</span>
            </div>
          )}

          {/* Action type */}
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Action</span>
            <span className={`font-medium ${transaction.broadcast ? 'text-green-600' : 'text-teal-600'}`}>
              {transaction.broadcast ? 'Sign & Broadcast' : 'Sign Only'}
            </span>
          </div>
        </div>

        {/* USB Status */}
        <div className={`flex items-center gap-2 mb-4 p-3 rounded-lg ${
          usbConnected ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'
        }`}>
          <div className={`w-3 h-3 rounded-full ${usbConnected ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'}`} />
          <span className={`text-sm ${usbConnected ? 'text-green-700' : 'text-yellow-700'}`}>
            {usbConnected ? 'USB Device Connected' : 'Please insert your USB device'}
          </span>
          <button
            onClick={checkUsbConnection}
            className="ml-auto text-sm text-gray-500 hover:text-gray-700"
          >
            Refresh
          </button>
        </div>

        {/* Password Input */}
        <div className="mb-4">
          <label htmlFor="sign-password" className="block text-sm font-medium text-gray-700 mb-1">
            Wallet Password
          </label>
          <input
            id="sign-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your wallet password"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            disabled={isLoading}
            autoFocus
          />
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleReject}
            disabled={isLoading}
            className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Reject
          </button>
          <button
            onClick={handleConfirm}
            disabled={isLoading || !usbConnected || !password}
            className="flex-1 px-4 py-3 bg-teal-600 text-white font-medium rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Signing...' : 'Sign Transaction'}
          </button>
        </div>

        {/* Security Notice */}
        <p className="mt-4 text-xs text-gray-500 text-center">
          This transaction was requested by an external application.
          Always verify the details before signing.
        </p>
      </div>
    </div>
  );
}

export default TransactionSignDialog;
