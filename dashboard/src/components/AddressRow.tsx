/**
 * AddressRow Component
 * Feature: User Dashboard for Wallet Management
 * Task: T054 - Create AddressRow subcomponent
 * Generated: 2025-10-17
 */

import React from 'react';
import type { Address } from '@/types/address';

interface AddressRowProps {
  address: Address;
  style?: React.CSSProperties;
  onCopy?: (address: string, symbol: string) => void;
}

/**
 * Category badge colors
 */
const categoryColors: Record<string, string> = {
  base: 'bg-blue-100 text-blue-800',
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
 * AddressRow component for virtualized list
 * Displays a single blockchain address with metadata
 */
export const AddressRow: React.FC<AddressRowProps> = ({ address, style, onCopy }) => {
  const categoryColor = categoryColors[address.category] || categoryColors.specialized;

  return (
    <div
      style={style}
      className="flex items-center gap-4 p-4 border-b border-gray-200 hover:bg-gray-50 transition-colors"
      data-testid="address-row"
    >
      {/* Rank and Symbol */}
      <div className="flex items-center gap-2 min-w-[80px]">
        <span className="text-sm text-gray-500 font-mono">#{address.rank}</span>
        <span className="font-semibold text-gray-900">{address.symbol}</span>
      </div>

      {/* Blockchain Name */}
      <div className="min-w-[150px]">
        <span className="text-sm text-gray-700">{address.name}</span>
      </div>

      {/* Address Value */}
      <div className="flex-1 min-w-0">
        <code className="text-xs text-gray-600 font-mono truncate block" title={address.address}>
          {address.address}
        </code>
      </div>

      {/* Derivation Path */}
      <div className="min-w-[200px]">
        <code className="text-xs text-gray-500 font-mono">{address.derivation_path}</code>
      </div>

      {/* Category Badge */}
      <div className="min-w-[100px]">
        <span
          className={`inline-block px-2 py-1 text-xs font-medium rounded ${categoryColor}`}
          data-testid="category-badge"
        >
          {formatCategory(address.category)}
        </span>
      </div>

      {/* Copy Button Placeholder (T059) */}
      {onCopy && (
        <button
          onClick={() => onCopy(address.address, address.symbol)}
          className="px-3 py-1 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
          title="Copy address to clipboard"
          data-testid="copy-button"
        >
          Copy
        </button>
      )}
    </div>
  );
};

export default AddressRow;
