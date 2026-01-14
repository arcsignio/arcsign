/**
 * WalletConnect Pairing Modal
 * Feature: WalletConnect v2 integration - URI input interface
 * Updated: 2026-01-14
 *
 * Desktop wallet pairing flow:
 * 1. User pastes WC URI from dApp (wc:...@2?...)
 * 2. OR clicks "Paste from Clipboard"
 * 3. Parse URI and display dApp metadata
 * 4. Initiate pairing (triggers session_proposal event)
 *
 * Note: No QR scanning (desktop has no camera)
 */

import React, { useState } from 'react';

interface PairingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPair: (uri: string) => Promise<void>;
}

export const PairingModal: React.FC<PairingModalProps> = ({
  isOpen,
  onClose,
  onPair,
}) => {
  const [uri, setUri] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text.startsWith('wc:')) {
        setUri(text);
        setError(null);
      } else {
        setError('Invalid WalletConnect URI. Must start with "wc:"');
      }
    } catch (err) {
      setError('Failed to read clipboard. Please paste manually.');
      console.error('Clipboard read failed:', err);
    }
  };

  const handleConnect = async () => {
    if (!uri.trim()) {
      setError('Please enter a WalletConnect URI');
      return;
    }

    if (!uri.startsWith('wc:')) {
      setError('Invalid URI format. WalletConnect URIs must start with "wc:"');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await onPair(uri);
      // Success - modal will be closed by parent after session_proposal
      setUri('');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to connect';
      setError(errorMessage);
      console.error('Pairing failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setUri('');
      setError(null);
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !loading) {
      handleConnect();
    } else if (e.key === 'Escape' && !loading) {
      handleClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={handleClose}
    >
      <div
        className="bg-white rounded-lg p-6 max-w-lg w-full mx-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="pairing-modal-title"
        aria-describedby="pairing-modal-description"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {/* WalletConnect Icon */}
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <svg
                className="w-6 h-6 text-blue-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                />
              </svg>
            </div>
            <h2
              id="pairing-modal-title"
              className="text-xl font-semibold text-gray-900"
            >
              Connect to dApp
            </h2>
          </div>
          {!loading && (
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Close"
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

        {/* Description */}
        <p
          id="pairing-modal-description"
          className="text-sm text-gray-600 mb-4"
        >
          Paste the WalletConnect URI from the dApp you want to connect to.
        </p>

        {/* Info Box */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
          <div className="flex gap-2">
            <svg
              className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div className="text-sm text-blue-900">
              <p className="font-medium mb-1">How to get the URI:</p>
              <ol className="list-decimal list-inside space-y-1 text-blue-800">
                <li>Open the dApp in your browser</li>
                <li>Click "Connect Wallet" and choose "WalletConnect"</li>
                <li>Copy the connection link or URI</li>
                <li>Paste it here</li>
              </ol>
            </div>
          </div>
        </div>

        {/* URI Input */}
        <div className="mb-4">
          <label
            htmlFor="wc-uri-input"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            WalletConnect URI
          </label>
          <div className="flex gap-2">
            <input
              id="wc-uri-input"
              type="text"
              value={uri}
              onChange={(e) => {
                setUri(e.target.value);
                setError(null);
              }}
              onKeyDown={handleKeyDown}
              placeholder="wc:..."
              disabled={loading}
              className={`flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed ${
                error ? 'border-red-500' : 'border-gray-300'
              }`}
              autoFocus
            />
            <button
              onClick={handlePaste}
              disabled={loading}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              title="Paste from clipboard"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
              Paste
            </button>
          </div>
          {uri && (
            <p className="mt-1 text-xs text-gray-500">
              URI length: {uri.length} characters
            </p>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
            <svg
              className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 justify-end">
          <button
            onClick={handleClose}
            disabled={loading}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={handleConnect}
            disabled={loading || !uri.trim()}
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
                Connecting...
              </>
            ) : (
              'Connect'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
