/**
 * Signature Toast Component
 * Feature: Display signature request results (success/failure)
 * Created: 2026-01-15
 *
 * Shows:
 * - Success: Method type, dApp name, tx hash (if applicable) with explorer link
 * - Failure: Error message with retry suggestion
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

export type SignatureStatus = 'success' | 'error' | 'pending';

export interface SignatureNotification {
  id: string;
  status: SignatureStatus;
  method: string;
  dappName: string;
  chainId?: number;
  txHash?: string;
  message?: string;
  timestamp: number;
}

interface SignatureToastProps {
  notification: SignatureNotification;
  onDismiss: (id: string) => void;
}

// Chain explorer URLs
const EXPLORER_URLS: Record<number, string> = {
  1: 'https://etherscan.io',
  56: 'https://bscscan.com',
  137: 'https://polygonscan.com',
  42161: 'https://arbiscan.io',
  10: 'https://optimistic.etherscan.io',
  8453: 'https://basescan.org',
};

function getExplorerUrl(chainId: number, txHash: string): string | null {
  const baseUrl = EXPLORER_URLS[chainId];
  if (!baseUrl) return null;
  return `${baseUrl}/tx/${txHash}`;
}

function getMethodDisplayName(method: string): string {
  const names: Record<string, string> = {
    'personal_sign': 'Message Signing',
    'eth_sign': 'Message Signing',
    'eth_signTypedData': 'Typed Data Signing',
    'eth_signTypedData_v3': 'Typed Data Signing',
    'eth_signTypedData_v4': 'Typed Data Signing',
    'eth_sendTransaction': 'Transaction',
  };
  return names[method] || method;
}

export function SignatureToast({ notification, onDismiss }: SignatureToastProps) {
  const { t } = useTranslation();
  const [isVisible, setIsVisible] = useState(true);
  const [isExiting, setIsExiting] = useState(false);

  // Auto-dismiss after 8 seconds for success, longer for errors
  useEffect(() => {
    const timeout = notification.status === 'success' ? 8000 : 12000;
    const timer = setTimeout(() => {
      handleDismiss();
    }, timeout);

    return () => clearTimeout(timer);
  }, [notification.id]);

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(() => {
      setIsVisible(false);
      onDismiss(notification.id);
    }, 300); // Match animation duration
  };

  if (!isVisible) return null;

  const explorerUrl = notification.txHash && notification.chainId
    ? getExplorerUrl(notification.chainId, notification.txHash)
    : null;

  const isSuccess = notification.status === 'success';
  const isPending = notification.status === 'pending';

  return (
    <div
      className={`
        w-80 rounded-lg shadow-lg border overflow-hidden
        transition-all duration-300 ease-out
        ${isExiting ? 'opacity-0 translate-x-full' : 'opacity-100 translate-x-0'}
        ${isSuccess ? 'bg-green-50 border-green-200' : isPending ? 'bg-teal-50 border-teal-200' : 'bg-red-50 border-red-200'}
      `}
    >
      {/* Header */}
      <div className={`px-4 py-2 flex items-center justify-between ${isSuccess ? 'bg-green-100' : isPending ? 'bg-teal-100' : 'bg-red-100'}`}>
        <div className="flex items-center gap-2">
          {isSuccess ? (
            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ) : isPending ? (
            <svg className="w-5 h-5 text-teal-600 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : (
            <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
          <span className={`font-medium text-sm ${isSuccess ? 'text-green-800' : isPending ? 'text-teal-800' : 'text-red-800'}`}>
            {isSuccess ? t('walletconnect.signatureSuccess', 'Signature Successful') :
             isPending ? t('walletconnect.signaturePending', 'Signing...') :
             t('walletconnect.signatureFailed', 'Signature Failed')}
          </span>
        </div>
        <button
          onClick={handleDismiss}
          className={`p-1 rounded hover:bg-opacity-50 ${isSuccess ? 'hover:bg-green-200 text-green-600' : isPending ? 'hover:bg-teal-200 text-teal-600' : 'hover:bg-red-200 text-red-600'}`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Body */}
      <div className="px-4 py-3 space-y-2">
        {/* Method & dApp */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">{getMethodDisplayName(notification.method)}</span>
          <span className="font-medium text-gray-800 truncate max-w-[140px]" title={notification.dappName}>
            {notification.dappName}
          </span>
        </div>

        {/* Transaction Hash */}
        {notification.txHash && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">TX Hash:</span>
            <div className="flex items-center gap-1">
              <code className="text-xs bg-gray-100 px-1 py-0.5 rounded text-gray-700">
                {notification.txHash.slice(0, 10)}...{notification.txHash.slice(-8)}
              </code>
              {explorerUrl && (
                <a
                  href={explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-teal-600 hover:text-teal-800"
                  title={t('walletconnect.viewOnExplorer', 'View on Explorer')}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              )}
            </div>
          </div>
        )}

        {/* Error Message */}
        {notification.status === 'error' && notification.message && (
          <p className="text-xs text-red-700 bg-red-100 px-2 py-1 rounded">
            {notification.message}
          </p>
        )}
      </div>
    </div>
  );
}

// Container component for multiple toasts
interface SignatureToastContainerProps {
  notifications: SignatureNotification[];
  onDismiss: (id: string) => void;
}

export function SignatureToastContainer({ notifications, onDismiss }: SignatureToastContainerProps) {
  if (notifications.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2">
      {notifications.map((notification) => (
        <SignatureToast
          key={notification.id}
          notification={notification}
          onDismiss={onDismiss}
        />
      ))}
    </div>
  );
}
