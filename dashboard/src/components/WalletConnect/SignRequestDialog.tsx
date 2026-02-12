/**
 * WalletConnect Sign Request Dialog
 * Feature: WalletConnect v2 integration - Unified signing UI
 * Updated: 2026-01-15
 *
 * Handles all signing requests from dApps:
 * - personal_sign: Simple message signing
 * - eth_signTypedData_v4: EIP-712 structured data
 * - eth_sendTransaction: Transaction signing
 *
 * Security: Requires wallet password for each signature
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { SignatureRequestParams } from '@/services/walletconnect/request-handler';

interface SignRequestDialogProps {
  isOpen: boolean;
  request: SignatureRequestParams | null;
  onApprove: (password: string) => void;
  onReject: () => void;
}

export const SignRequestDialog: React.FC<SignRequestDialogProps> = ({
  isOpen,
  request,
  onApprove,
  onReject,
}) => {
  const { t } = useTranslation();
  const [password, setPassword] = useState('');
  const [showRaw, setShowRaw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !request) return null;

  const handleApprove = async () => {
    if (!password.trim()) {
      setError(t('walletConnect.enterPassword'));
      return;
    }

    setLoading(true);
    setError(null);
    try {
      onApprove(password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signing failed');
    } finally {
      setLoading(false);
      setPassword('');
    }
  };

  const handleReject = () => {
    setPassword('');
    setError(null);
    onReject();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && password.trim() && !loading) {
      handleApprove();
    }
  };

  const getChainName = (chainId: number): string => {
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

  const getTypeLabel = (type: SignatureRequestParams['type']): string => {
    switch (type) {
      case 'personal_sign':
        return 'Message';
      case 'eth_signTypedData_v4':
        return 'Typed Data';
      case 'eth_sendTransaction':
        return 'Transaction';
      default:
        return type;
    }
  };

  const getTypeBadgeColor = (type: SignatureRequestParams['type']): string => {
    switch (type) {
      case 'personal_sign':
        return 'bg-teal-100 text-teal-700';
      case 'eth_signTypedData_v4':
        return 'bg-purple-100 text-purple-700';
      case 'eth_sendTransaction':
        return 'bg-orange-100 text-orange-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getWarningMessage = (type: SignatureRequestParams['type']): { title: string; detail: string } => {
    switch (type) {
      case 'eth_sendTransaction':
        return {
          title: t('walletConnect.txWarning'),
          detail: t('walletConnect.txWarningDetail'),
        };
      case 'eth_signTypedData_v4':
        return {
          title: t('walletConnect.typedDataWarning'),
          detail: t('walletConnect.typedDataWarningDetail'),
        };
      default:
        return {
          title: t('walletConnect.signWarning'),
          detail: t('walletConnect.signWarningDetail'),
        };
    }
  };

  const isMessageLong = (request.message?.length || 0) > 200;
  const hasRawMessage = request.rawMessage && request.rawMessage !== request.message;
  const warning = getWarningMessage(request.type);

  // For transactions, show special warning color
  const isTransaction = request.type === 'eth_sendTransaction';
  const warningBgColor = isTransaction ? 'bg-orange-50 border-orange-200' : 'bg-yellow-50 border-yellow-200';
  const warningIconColor = isTransaction ? 'text-orange-600' : 'text-yellow-600';
  const warningTextColor = isTransaction ? 'text-orange-900' : 'text-yellow-900';
  const warningDetailColor = isTransaction ? 'text-orange-800' : 'text-yellow-800';

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={loading ? undefined : handleReject}
    >
      <div
        className="bg-white rounded-lg p-6 max-w-lg w-full mx-4 shadow-xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="sign-request-title"
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-start gap-3 flex-1">
            {/* dApp Icon */}
            {request.dappIcon ? (
              <img
                src={request.dappIcon}
                alt={request.dappName}
                className="w-12 h-12 rounded-lg"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold text-xl">
                {request.dappName.charAt(0).toUpperCase()}
              </div>
            )}

            <div className="flex-1 min-w-0">
              <h2 id="sign-request-title" className="text-xl font-semibold text-gray-900 truncate">
                {isTransaction ? t('walletConnect.transactionRequest') : t('walletConnect.signRequest')}
              </h2>
              <p className="text-sm text-gray-600">{request.dappName}</p>
              <a
                href={request.dappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-teal-600 hover:text-teal-800 truncate block"
              >
                {request.dappUrl}
              </a>
            </div>
          </div>

          {!loading && (
            <button
              onClick={handleReject}
              className="text-gray-400 hover:text-gray-600 transition-colors ml-2"
              aria-label="Close"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Network & Type Badges */}
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-full">
            {getChainName(request.chainId)}
          </span>
          <span className={`text-xs px-2 py-1 rounded-full ${getTypeBadgeColor(request.type)}`}>
            {getTypeLabel(request.type)}
          </span>
        </div>

        {/* Message/Data Content */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-700">
              {isTransaction ? t('walletConnect.transactionDetails') : t('walletConnect.messageToSign')}
            </label>
            {hasRawMessage && (
              <button
                onClick={() => setShowRaw(!showRaw)}
                className="text-xs text-teal-600 hover:text-teal-800"
              >
                {showRaw ? t('walletConnect.showDecoded') : t('walletConnect.showRaw')}
              </button>
            )}
          </div>
          <div
            className={`p-3 bg-gray-50 border border-gray-200 rounded-lg font-mono text-sm break-all whitespace-pre-wrap ${
              isMessageLong ? 'max-h-48 overflow-y-auto' : ''
            }`}
          >
            {showRaw ? request.rawMessage : request.message}
          </div>
        </div>

        {/* Security Warning */}
        <div className={`mb-4 p-3 border rounded-lg flex items-start gap-2 ${warningBgColor}`}>
          <svg
            className={`w-5 h-5 flex-shrink-0 mt-0.5 ${warningIconColor}`}
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
          <div className={`text-sm ${warningTextColor}`}>
            <p className="font-medium">{warning.title}</p>
            <p className={`mt-1 ${warningDetailColor}`}>
              {warning.detail}
            </p>
          </div>
        </div>

        {/* Password Input */}
        <div className="mb-4">
          <label htmlFor="wallet-password" className="block text-sm font-medium text-gray-700 mb-1">
            {t('walletConnect.walletPassword')}
          </label>
          <input
            id="wallet-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
            autoFocus
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:opacity-50 disabled:bg-gray-100"
            placeholder={t('walletConnect.enterWalletPassword')}
          />
          {error && (
            <p className="mt-1 text-sm text-red-600">{error}</p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 justify-end">
          <button
            onClick={handleReject}
            disabled={loading}
            className="px-6 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('walletConnect.reject')}
          </button>
          <button
            onClick={handleApprove}
            disabled={loading || !password.trim()}
            className={`px-6 py-2 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 ${
              isTransaction
                ? 'bg-orange-600 hover:bg-orange-700'
                : 'bg-teal-600 hover:bg-teal-700'
            }`}
          >
            {loading ? (
              <>
                <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
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
                {isTransaction ? t('walletConnect.sending') : t('walletConnect.signing')}
              </>
            ) : (
              isTransaction ? t('walletConnect.send') : t('walletConnect.sign')
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
