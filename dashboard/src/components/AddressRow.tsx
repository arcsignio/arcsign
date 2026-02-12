/**
 * AddressRow Component
 * Feature: User Dashboard for Wallet Management
 * Task: T054 - Create AddressRow subcomponent with blockchain logos
 * Updated: 2025-01-08
 */

import React, { useState } from 'react';
import type { Address } from '@/types/address';
import { getChainIconUrl, getChainFallbackIcon, isChainSupported } from '@/utils/chainIcons';

interface AddressRowProps {
  address: Address;
  style?: React.CSSProperties;
  onCopy?: (address: string, symbol: string) => void;
  onReceive?: (address: Address) => void;
}

/**
 * Category badge colors
 */
const categoryColors: Record<string, string> = {
  base: 'bg-teal-100 text-teal-800',
  layer2: 'bg-purple-100 text-purple-800',
  regional: 'bg-green-100 text-green-800',
  cosmos: 'bg-pink-100 text-pink-800',
  alt_evm: 'bg-orange-100 text-orange-800',
  specialized: 'bg-gray-100 text-gray-800',
};

/**
 * Format category for display
 */
function formatCategory(category: string): string {
  if (category === 'alt_evm') return 'Alt EVM';
  return category.charAt(0).toUpperCase() + category.slice(1);
}

/**
 * Truncate address for display
 */
function truncateAddress(address: string): string {
  if (address.length <= 20) return address;
  return `${address.slice(0, 10)}...${address.slice(-8)}`;
}

/**
 * ChainIcon component with fallback
 */
const ChainIcon: React.FC<{ symbol: string; size?: number }> = ({ symbol, size = 32 }) => {
  const [hasError, setHasError] = useState(false);
  const fallbackColor = getChainFallbackIcon(symbol);

  if (hasError) {
    // Fallback to colored circle with symbol
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
 * AddressRow component for virtualized list
 * Displays a single blockchain address with metadata and logo
 */
export const AddressRow: React.FC<AddressRowProps> = ({ address, style, onCopy, onReceive }) => {
  const categoryColor = categoryColors[address.category] || categoryColors.specialized;
  const isSupported = isChainSupported(address.symbol);

  return (
    <div
      style={style}
      className="flex items-center gap-4 px-4 py-3 border-b border-gray-200 hover:bg-gray-50 transition-colors"
      data-testid="address-row"
    >
      {/* Chain Logo */}
      <div className="flex-shrink-0">
        <ChainIcon symbol={address.symbol} size={36} />
      </div>

      {/* Symbol and Name */}
      <div className="min-w-[120px]">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-gray-900">{address.symbol}</span>
          {isSupported && (
            <span className="px-1.5 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded">
              Active
            </span>
          )}
        </div>
        <span className="text-sm text-gray-500">{address.name}</span>
      </div>

      {/* Address Value */}
      <div className="flex-1 min-w-0">
        <code
          className="text-sm text-gray-600 font-mono cursor-pointer hover:text-teal-600"
          title={address.address}
          onClick={() => onCopy?.(address.address, address.symbol)}
        >
          {truncateAddress(address.address)}
        </code>
      </div>

      {/* Category Badge */}
      <div className="hidden md:block min-w-[90px]">
        <span
          className={`inline-block px-2 py-1 text-xs font-medium rounded ${categoryColor}`}
          data-testid="category-badge"
        >
          {formatCategory(address.category)}
        </span>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2">
        {/* Copy Button */}
        {onCopy && (
          <button
            onClick={() => onCopy(address.address, address.symbol)}
            className="p-2 text-gray-500 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
            title="Copy address"
            data-testid="copy-button"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </button>
        )}

        {/* Receive Button (for supported chains) */}
        {isSupported && onReceive && (
          <button
            onClick={() => onReceive(address)}
            className="p-2 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
            title="Receive"
            data-testid="receive-button"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
};

export default AddressRow;
