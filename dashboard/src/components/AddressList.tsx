/**
 * AddressList Component
 * Feature: User Dashboard for Wallet Management
 * Tasks: T055-T057, T060 - AddressList with blockchain logos, categorization, and receive modal
 * Updated: 2025-01-08
 */

import React, { useState, useMemo, useCallback } from 'react';
import AddressRow from './AddressRow';
import ReceiveAddressModal from './ReceiveAddressModal';
import { copyWithAutoClear } from '@/services/clipboard';
import { isChainSupported, CHAIN_CATEGORIES } from '@/utils/chainIcons';
import type { Address } from '@/types/address';

interface AddressListProps {
  addresses: Address[];
  isLoading?: boolean;
  error?: string | null;
  walletName?: string;
}

/**
 * Available categories for filtering
 */
const CATEGORIES = [
  { value: 'all', label: 'All Chains' },
  { value: 'supported', label: 'Supported Chains' },
  { value: 'base', label: 'Base Chains' },
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
 * AddressList component with blockchain logos and categorization
 * Displays addresses with supported chains highlighted
 */
export const AddressList: React.FC<AddressListProps> = ({
  addresses,
  isLoading = false,
  error = null,
  walletName = 'Wallet',
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copyStatus, setCopyStatus] = useState<string>('');
  const [receiveAddress, setReceiveAddress] = useState<Address | null>(null);

  // Debounce search query (300ms)
  const debouncedSearch = useDebounce(searchQuery, 300);

  /**
   * Separate addresses into supported and unsupported
   */
  const { supportedAddresses, unsupportedAddresses, filteredAddresses } = useMemo(() => {
    let filtered = addresses;

    // Filter by category
    if (selectedCategory === 'supported') {
      filtered = filtered.filter(addr => isChainSupported(addr.symbol));
    } else if (selectedCategory !== 'all') {
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

    // Separate into supported and unsupported
    const supported = filtered.filter(addr => isChainSupported(addr.symbol));
    const unsupported = filtered.filter(addr => !isChainSupported(addr.symbol));

    return {
      supportedAddresses: supported,
      unsupportedAddresses: unsupported,
      filteredAddresses: filtered,
    };
  }, [addresses, selectedCategory, debouncedSearch]);

  /**
   * Handle copy to clipboard with auto-clear
   */
  const handleCopy = useCallback(async (address: string, symbol: string) => {
    const result = await copyWithAutoClear(address, symbol);

    if (result.success) {
      setCopyStatus(`${symbol} address copied!`);
      setTimeout(() => setCopyStatus(''), 3000);
    } else {
      setCopyStatus(`Failed to copy: ${result.error}`);
      setTimeout(() => setCopyStatus(''), 3000);
    }
  }, []);

  /**
   * Handle receive button click
   */
  const handleReceive = useCallback((address: Address) => {
    setReceiveAddress(address);
  }, []);

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
    <div className="flex flex-col h-full bg-white rounded-lg shadow" data-testid="address-list">
      {/* Header with Title */}
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900">Wallet Addresses</h2>
        <p className="text-sm text-gray-500 mt-1">
          {walletName} - {addresses.length} blockchain addresses
        </p>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center gap-4 px-6 py-4 border-b border-gray-200 bg-gray-50">
        {/* Category Filter */}
        <div className="flex items-center gap-2">
          <label htmlFor="category-filter" className="text-sm font-medium text-gray-700">
            Filter:
          </label>
          <select
            id="category-filter"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
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
        <div className="flex-1 min-w-[200px] max-w-md">
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search by symbol, name, or address..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              data-testid="search-input"
            />
          </div>
        </div>

        {/* Results Count */}
        <div className="text-sm text-gray-600">
          <span className="font-medium">{filteredAddresses.length}</span> of {addresses.length} addresses
        </div>
      </div>

      {/* Copy Status Toast */}
      {copyStatus && (
        <div className="px-6 py-3 bg-green-50 border-b border-green-200">
          <p className="text-sm text-green-800 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            {copyStatus}
          </p>
        </div>
      )}

      {/* Address Lists */}
      <div className="flex-1 overflow-auto">
        {filteredAddresses.length > 0 ? (
          <>
            {/* Supported Chains Section */}
            {supportedAddresses.length > 0 && (
              <div>
                <div className="sticky top-0 px-6 py-3 bg-green-50 border-b border-green-200">
                  <h3 className="text-sm font-semibold text-green-800 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {CHAIN_CATEGORIES.SUPPORTED} ({supportedAddresses.length})
                    <span className="text-xs font-normal text-green-600 ml-2">
                      Full transaction support
                    </span>
                  </h3>
                </div>
                {supportedAddresses.map((address) => (
                  <AddressRow
                    key={`${address.wallet_id}-${address.symbol}`}
                    address={address}
                    onCopy={handleCopy}
                    onReceive={handleReceive}
                  />
                ))}
              </div>
            )}

            {/* Unsupported Chains Section */}
            {unsupportedAddresses.length > 0 && (
              <div>
                <div className="sticky top-0 px-6 py-3 bg-gray-50 border-b border-gray-200">
                  <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    {CHAIN_CATEGORIES.UNSUPPORTED} ({unsupportedAddresses.length})
                    <span className="text-xs font-normal text-gray-500 ml-2">
                      Address only - Use external wallets for transactions
                    </span>
                  </h3>
                </div>
                {unsupportedAddresses.map((address) => (
                  <AddressRow
                    key={`${address.wallet_id}-${address.symbol}`}
                    address={address}
                    onCopy={handleCopy}
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center justify-center h-64">
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

      {/* Receive Address Modal */}
      {receiveAddress && (
        <ReceiveAddressModal
          address={receiveAddress}
          onClose={() => setReceiveAddress(null)}
          onCopy={handleCopy}
        />
      )}
    </div>
  );
};

export default AddressList;
