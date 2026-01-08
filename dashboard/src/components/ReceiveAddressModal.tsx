/**
 * ReceiveAddressModal Component
 * Feature: User Dashboard for Wallet Management
 * Displays address with QR code for receiving cryptocurrency
 * Created: 2025-01-08
 */

import React, { useState, useEffect } from 'react';
import type { Address } from '@/types/address';
import { getChainIconUrl, getChainFallbackIcon } from '@/utils/chainIcons';

interface ReceiveAddressModalProps {
  address: Address;
  onClose: () => void;
  onCopy: (address: string, symbol: string) => void;
}

/**
 * ChainIcon component with fallback
 */
const ChainIcon: React.FC<{ symbol: string; size?: number }> = ({ symbol, size = 48 }) => {
  const [hasError, setHasError] = useState(false);
  const fallbackColor = getChainFallbackIcon(symbol);

  if (hasError) {
    return (
      <div
        className="flex items-center justify-center rounded-full font-bold text-white"
        style={{
          width: size,
          height: size,
          backgroundColor: fallbackColor,
          fontSize: size * 0.35,
        }}
      >
        {symbol.slice(0, 2)}
      </div>
    );
  }

  return (
    <img
      src={getChainIconUrl(symbol)}
      alt={`${symbol} logo`}
      width={size}
      height={size}
      className="rounded-full"
      onError={() => setHasError(true)}
    />
  );
};

/**
 * ReceiveAddressModal - Modal for displaying receive address with QR code
 */
/**
 * EVM-compatible chains that can receive any token on that network
 */
const EVM_CHAINS = new Set(['ETH', 'ARB', 'OP', 'BASE', 'MATIC', 'BNB', 'AVAX', 'ZKS', 'LINEA']);

/**
 * Get the network display name for a chain symbol
 */
const getNetworkDisplayName = (symbol: string): string => {
  const networkNames: Record<string, string> = {
    'ETH': 'Ethereum',
    'ARB': 'Arbitrum',
    'OP': 'Optimism',
    'BASE': 'Base',
    'MATIC': 'Polygon',
    'BNB': 'BNB Chain',
    'AVAX': 'Avalanche',
    'ZKS': 'zkSync',
    'LINEA': 'Linea',
  };
  return networkNames[symbol.toUpperCase()] || symbol;
};

export const ReceiveAddressModal: React.FC<ReceiveAddressModalProps> = ({
  address,
  onClose,
  onCopy,
}) => {
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  // Check if this is an EVM-compatible chain
  const isEVMChain = EVM_CHAINS.has(address.symbol.toUpperCase());

  // Generate QR code using a simple API
  useEffect(() => {
    // Using QRServer API for QR code generation (no external dependencies)
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(address.address)}&format=svg`;
    setQrDataUrl(qrUrl);
  }, [address.address]);

  const handleCopy = () => {
    onCopy(address.address, address.symbol);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Handle escape key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.6)',
      }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl max-w-md w-full mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ChainIcon symbol={address.symbol} size={40} />
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Receive {address.symbol}
              </h2>
              <p className="text-sm text-gray-500">{address.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* QR Code */}
        <div className="px-6 py-8 flex flex-col items-center">
          <div className="bg-white p-4 rounded-xl border-2 border-gray-100 shadow-inner">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt={`QR code for ${address.symbol} address`}
                className="w-48 h-48"
              />
            ) : (
              <div className="w-48 h-48 flex items-center justify-center bg-gray-100 rounded">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            )}
          </div>

          {/* Address Display */}
          <div className="mt-6 w-full">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Your {address.symbol} Address
            </label>
            <div className="relative">
              <code className="block w-full p-4 bg-gray-50 border border-gray-200 rounded-lg text-sm font-mono text-gray-800 break-all">
                {address.address}
              </code>
            </div>
          </div>

          {/* Derivation Path */}
          <div className="mt-4 w-full">
            <p className="text-xs text-gray-500">
              Derivation path: <code className="font-mono">{address.derivation_path}</code>
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex gap-3">
          <button
            onClick={handleCopy}
            className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
              copied
                ? 'bg-green-600 text-white'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {copied ? (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Copied!
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Copy Address
              </>
            )}
          </button>
          <button
            onClick={onClose}
            className="px-6 py-3 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-100 transition-colors"
          >
            Close
          </button>
        </div>

        {/* Warning - Different message for EVM vs non-EVM chains */}
        <div className={`px-6 py-3 border-t ${isEVMChain ? 'bg-blue-50 border-blue-100' : 'bg-yellow-50 border-yellow-100'}`}>
          <p className={`text-xs flex items-start gap-2 ${isEVMChain ? 'text-blue-800' : 'text-yellow-800'}`}>
            <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {isEVMChain ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              )}
            </svg>
            <span>
              {isEVMChain ? (
                <>
                  This address can receive <strong>{address.symbol}</strong> and all tokens on the <strong>{getNetworkDisplayName(address.symbol)}</strong> network (ERC-20, NFTs, etc.).
                </>
              ) : (
                <>
                  Only send <strong>{address.symbol}</strong> to this address. Sending other cryptocurrencies may result in permanent loss.
                </>
              )}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ReceiveAddressModal;
