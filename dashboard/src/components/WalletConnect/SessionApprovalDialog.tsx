/**
 * WalletConnect Session Approval Dialog
 * Feature: WalletConnect v2 integration - Session authorization UI
 * Updated: 2026-01-14
 *
 * Displays session proposal from dApp and allows user to approve/reject
 * Shows: dApp metadata, requested chains, methods, events
 * Security: Clear visibility of permissions being granted
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { SessionApprovalRequest } from '@/services/walletconnect/types';
import { CHAIN_ID_MAP } from '@/services/walletconnect/types';

interface SessionApprovalDialogProps {
  isOpen: boolean;
  proposal: SessionApprovalRequest | null;
  onApprove: () => Promise<void>;
  onReject: () => Promise<void>;
}

export const SessionApprovalDialog: React.FC<SessionApprovalDialogProps> = ({
  isOpen,
  proposal,
  onApprove,
  onReject,
}) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>('chains');

  if (!isOpen || !proposal) return null;

  const dApp = proposal.params.proposer.metadata;

  // Extract requested chains
  const requiredChains = proposal.params.requiredNamespaces.eip155?.chains || [];
  const optionalChains = proposal.params.optionalNamespaces?.eip155?.chains || [];
  const allChains = [...new Set([...requiredChains, ...optionalChains])];

  // Extract requested methods
  const requiredMethods = proposal.params.requiredNamespaces.eip155?.methods || [];
  const optionalMethods = proposal.params.optionalNamespaces?.eip155?.methods || [];
  const allMethods = [...new Set([...requiredMethods, ...optionalMethods])];

  // Extract requested events
  const requiredEvents = proposal.params.requiredNamespaces.eip155?.events || [];
  const optionalEvents = proposal.params.optionalNamespaces?.eip155?.events || [];
  const allEvents = [...new Set([...requiredEvents, ...optionalEvents])];

  // Check if any sensitive permissions requested
  const hasSensitivePermissions = allMethods.some(method =>
    ['eth_sendTransaction', 'personal_sign', 'eth_signTypedData_v4'].includes(method)
  );

  const handleApprove = async () => {
    setLoading(true);
    try {
      await onApprove();
    } catch (error) {
      console.error('Approval failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    setLoading(true);
    try {
      await onReject();
    } catch (error) {
      console.error('Rejection failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const getChainName = (caipChainId: string): string => {
    const chainIdMatch = caipChainId.match(/eip155:(\d+)/);
    if (!chainIdMatch) return caipChainId;

    const chainId = parseInt(chainIdMatch[1], 10);
    const chainNames: Record<number, string> = {
      1: 'Ethereum',
      56: 'BNB Smart Chain',
      137: 'Polygon',
      42161: 'Arbitrum',
      10: 'Optimism',
      8453: 'Base',
    };

    return chainNames[chainId] || `Chain ${chainId}`;
  };

  const getMethodDescription = (method: string): string => {
    const descriptions: Record<string, string> = {
      eth_sendTransaction: 'Send transactions (requires password)',
      personal_sign: 'Sign messages (requires password)',
      eth_signTypedData_v4: 'Sign structured data (requires password)',
      wallet_switchEthereumChain: 'Switch between networks',
      wallet_addEthereumChain: 'Add new networks',
      eth_chainId: 'Read current network',
      eth_accounts: 'Read wallet addresses',
      eth_estimateGas: 'Estimate transaction costs',
      eth_gasPrice: 'Read gas prices',
      eth_feeHistory: 'Read fee history',
      eth_getTransactionCount: 'Read transaction count',
      eth_call: 'Read smart contract data',
      eth_blockNumber: 'Read block number',
      eth_getBalance: 'Read account balance',
    };

    return descriptions[method] || method;
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={loading ? undefined : handleReject}
    >
      <div
        className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 shadow-xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="session-approval-title"
        aria-describedby="session-approval-description"
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-start gap-3 flex-1">
            {/* dApp Icon */}
            {dApp.icons && dApp.icons[0] ? (
              <img
                src={dApp.icons[0]}
                alt={dApp.name}
                className="w-12 h-12 rounded-lg"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold text-xl">
                {dApp.name.charAt(0).toUpperCase()}
              </div>
            )}

            <div className="flex-1 min-w-0">
              <h2
                id="session-approval-title"
                className="text-xl font-semibold text-gray-900 truncate"
              >
                {dApp.name}
              </h2>
              <a
                href={dApp.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:text-blue-800 truncate block"
              >
                {dApp.url}
              </a>
              {dApp.description && (
                <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                  {dApp.description}
                </p>
              )}
            </div>
          </div>

          {!loading && (
            <button
              onClick={handleReject}
              className="text-gray-400 hover:text-gray-600 transition-colors ml-2"
              aria-label="Reject"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}
        </div>

        {/* Security Warning */}
        {hasSensitivePermissions && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-2">
            <svg
              className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5"
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
            <div className="text-sm text-yellow-900">
              <p className="font-medium">This dApp requests sensitive permissions</p>
              <p className="text-yellow-800 mt-1">
                It can send transactions and sign messages on your behalf. You'll need to enter your
                wallet password for each transaction.
              </p>
            </div>
          </div>
        )}

        {/* Permissions Sections */}
        <div className="space-y-3 mb-6">
          {/* Chains */}
          <div className="border border-gray-200 rounded-lg">
            <button
              onClick={() => toggleSection('chains')}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                  />
                </svg>
                <span className="font-medium text-gray-900">
                  Networks ({allChains.length})
                </span>
              </div>
              <svg
                className={`w-5 h-5 text-gray-400 transition-transform ${
                  expandedSection === 'chains' ? 'rotate-180' : ''
                }`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {expandedSection === 'chains' && (
              <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
                <ul className="space-y-2">
                  {allChains.map((chain) => (
                    <li key={chain} className="flex items-center gap-2 text-sm">
                      <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                      <span className="text-gray-700">{getChainName(chain)}</span>
                      {requiredChains.includes(chain) && (
                        <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
                          Required
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Methods */}
          <div className="border border-gray-200 rounded-lg">
            <button
              onClick={() => toggleSection('methods')}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <span className="font-medium text-gray-900">
                  Permissions ({allMethods.length})
                </span>
              </div>
              <svg
                className={`w-5 h-5 text-gray-400 transition-transform ${
                  expandedSection === 'methods' ? 'rotate-180' : ''
                }`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {expandedSection === 'methods' && (
              <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
                <ul className="space-y-2">
                  {allMethods.map((method) => (
                    <li key={method} className="text-sm">
                      <div className="flex items-start gap-2">
                        <span className="w-2 h-2 bg-blue-500 rounded-full mt-1.5"></span>
                        <div className="flex-1">
                          <code className="text-xs bg-gray-200 px-1.5 py-0.5 rounded text-gray-800">
                            {method}
                          </code>
                          <p className="text-gray-600 mt-0.5">{getMethodDescription(method)}</p>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Events */}
          {allEvents.length > 0 && (
            <div className="border border-gray-200 rounded-lg">
              <button
                onClick={() => toggleSection('events')}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                    />
                  </svg>
                  <span className="font-medium text-gray-900">
                    Events ({allEvents.length})
                  </span>
                </div>
                <svg
                  className={`w-5 h-5 text-gray-400 transition-transform ${
                    expandedSection === 'events' ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {expandedSection === 'events' && (
                <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
                  <ul className="space-y-2">
                    {allEvents.map((event) => (
                      <li key={event} className="flex items-center gap-2 text-sm">
                        <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                        <code className="text-xs bg-gray-200 px-1.5 py-0.5 rounded text-gray-800">
                          {event}
                        </code>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 justify-end">
          <button
            onClick={handleReject}
            disabled={loading}
            className="px-6 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Reject
          </button>
          <button
            onClick={handleApprove}
            disabled={loading}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? (
              <>
                <svg
                  className="animate-spin h-5 w-5 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Approving...
              </>
            ) : (
              'Approve'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
