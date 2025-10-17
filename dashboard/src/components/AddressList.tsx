/**
 * AddressList Component
 * Feature: User Dashboard for Wallet Management
 * Tasks: T055-T057, T060 - AddressList with virtualization, filter, search, and states
 * Generated: 2025-10-17
 */

import React, { useState, useMemo, useCallback } from 'react';
import { FixedSizeList as List } from 'react-window';
import AddressRow from './AddressRow';
import { copyWithAutoClear } from '@/services/clipboard';
import type { Address } from '@/types/address';

interface AddressListProps {
  addresses: Address[];
  isLoading?: boolean;
  error?: string | null;
}

/**
 * Available categories for filtering
 */
const CATEGORIES = [
  { value: 'all', label: 'All Categories' },
  { value: 'base', label: 'Base' },
  { value: 'layer2', label: 'Layer 2' },
  { value: 'regional', label: 'Regional' },
  { value: 'cosmos', label: 'Cosmos' },
  { value: 'alt_evm', label: 'Alt EVM' },
  { value: 'specialized', label: 'Specialized' },
];

/**
 * Debounce hook for search input
 */
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * AddressList component with virtualization
 * Displays 54 blockchain addresses with filtering and search
 */
export const AddressList: React.FC<AddressListProps> = ({
  addresses,
  isLoading = false,
  error = null
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copyStatus, setCopyStatus] = useState<string>('');

  // Debounce search query (300ms)
  const debouncedSearch = useDebounce(searchQuery, 300);

  /**
   * Filter and search addresses
   */
  const filteredAddresses = useMemo(() => {
    let filtered = addresses;

    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(addr => addr.category === selectedCategory);
    }

    // Search by symbol, name, or address
    if (debouncedSearch.trim()) {
      const query = debouncedSearch.toLowerCase().trim();
      filtered = filtered.filter(addr =>
        addr.symbol.toLowerCase().includes(query) ||
        addr.name.toLowerCase().includes(query) ||
        addr.address.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [addresses, selectedCategory, debouncedSearch]);

  /**
   * Handle copy to clipboard with auto-clear
   */
  const handleCopy = useCallback(async (address: string, symbol: string) => {
    const result = await copyWithAutoClear(address, symbol);

    if (result.success) {
      setCopyStatus(`${symbol} address copied! (auto-clears in 30s)`);
      setTimeout(() => setCopyStatus(''), 3000);
    } else {
      setCopyStatus(`Failed to copy: ${result.error}`);
      setTimeout(() => setCopyStatus(''), 3000);
    }
  }, []);

  /**
   * Row renderer for react-window
   */
  const Row = useCallback(({ index, style }: { index: number; style: React.CSSProperties }) => {
    const address = filteredAddresses[index];
    return <AddressRow address={address} style={style} onCopy={handleCopy} />;
  }, [filteredAddresses, handleCopy]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading addresses...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center max-w-md">
          <svg
            className="mx-auto h-12 w-12 text-red-500 mb-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Failed to Load Addresses</h3>
          <p className="text-sm text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  // Empty state (no addresses)
  if (addresses.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <p className="text-gray-600">No addresses found for this wallet.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" data-testid="address-list">
      {/* Filter and Search Bar */}
      <div className="flex items-center gap-4 p-4 border-b border-gray-200 bg-white">
        {/* Category Filter */}
        <div className="flex items-center gap-2">
          <label htmlFor="category-filter" className="text-sm font-medium text-gray-700">
            Category:
          </label>
          <select
            id="category-filter"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            data-testid="category-filter"
          >
            {CATEGORIES.map((cat) => (
              <option key={cat.value} value={cat.value}>
                {cat.label}
              </option>
            ))}
          </select>
        </div>

        {/* Search Input */}
        <div className="flex-1 max-w-md">
          <input
            type="text"
            placeholder="Search by symbol, name, or address..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            data-testid="search-input"
          />
        </div>

        {/* Results Count */}
        <div className="text-sm text-gray-600">
          {filteredAddresses.length} of {addresses.length} addresses
        </div>
      </div>

      {/* Copy Status Toast */}
      {copyStatus && (
        <div className="px-4 py-2 bg-green-50 border-b border-green-200">
          <p className="text-sm text-green-800">{copyStatus}</p>
        </div>
      )}

      {/* Virtualized Address List */}
      {filteredAddresses.length > 0 ? (
        <List
          height={600}
          itemCount={filteredAddresses.length}
          itemSize={80}
          width="100%"
          className="border-t border-gray-200"
        >
          {Row}
        </List>
      ) : (
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <p className="text-gray-600">
              No addresses match your search or filter criteria.
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('all');
              }}
              className="mt-4 px-4 py-2 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
            >
              Clear filters
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AddressList;
