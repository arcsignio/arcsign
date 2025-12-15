/**
 * Wallet Detail View - Asset-first display with multi-chain token balances
 * Feature: Asset management with Alchemy API integration
 */

import { useState } from 'react';
import { useAppPassword } from '@/contexts/AppPasswordContext';
import tauriApi, { type AppError } from '@/services/tauri-api';
import type { TokenBalance, TokenBalancesResponse } from '@/types/tokens';
import type { Wallet } from '@/types/wallet';
import { LoadingSpinner } from '@/components/LoadingSpinner';

interface WalletDetailProps {
  wallet: Wallet;
  usbPath: string;
  onBack: () => void;
  onViewAddresses?: () => void;
}

export function WalletDetail({ wallet, usbPath, onBack, onViewAddresses }: WalletDetailProps) {
  const { appPassword } = useAppPassword();
  const [tokens, setTokens] = useState<TokenBalance[]>([]);
  const [totalUsd, setTotalUsd] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(true);

  const handleLoadBalances = async () => {
    if (!password || !appPassword) {
      setError('Please enter wallet password');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response: TokenBalancesResponse = await tauriApi.getTokenBalances({
        walletId: wallet.id,
        password,
        usbPath,
        appPassword,
      });

      setTokens(response.tokens);
      setTotalUsd(response.totalUsd);
      setShowPasswordPrompt(false);
    } catch (err) {
      const error = err as AppError;
      setError(error.message || 'Failed to load token balances');
    } finally {
      setIsLoading(false);
    }
  };

  const formatUSD = (value: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatBalance = (balance: string): string => {
    const num = parseFloat(balance);
    if (num === 0) return '0';
    if (num < 0.01) return num.toFixed(8);
    if (num < 1) return num.toFixed(6);
    if (num < 1000) return num.toFixed(4);
    return num.toFixed(2);
  };

  // Group tokens by network
  const tokensByNetwork = tokens.reduce((acc, token) => {
    if (!acc[token.networkLabel]) {
      acc[token.networkLabel] = [];
    }
    acc[token.networkLabel].push(token);
    return {};
  }, {} as Record<string, TokenBalance[]>);

  if (showPasswordPrompt) {
    return (
      <div className="wallet-detail">
        <div className="detail-header">
          <button onClick={onBack} className="back-button">
            ← Back to Wallets
          </button>
          <h2>{wallet.name}</h2>
        </div>

        <div className="password-prompt">
          <h3>Enter Wallet Password</h3>
          <p>Please enter your wallet password to view token balances</p>

          {error && <div className="error-message">{error}</div>}

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleLoadBalances()}
              placeholder="Enter wallet password"
              autoFocus
            />
          </div>

          <button
            onClick={handleLoadBalances}
            disabled={isLoading || !password}
            className="primary-button"
          >
            {isLoading ? 'Loading...' : 'View Assets'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="wallet-detail">
      <div className="detail-header">
        <button onClick={onBack} className="back-button">
          ← Back to Wallets
        </button>
        <div className="header-content">
          <h2>{wallet.name}</h2>
          <div className="total-value">
            <span className="label">Total Value</span>
            <span className="value">{formatUSD(totalUsd)}</span>
          </div>
        </div>
        {onViewAddresses && (
          <button onClick={onViewAddresses} className="view-addresses-link">
            📋 View Addresses
          </button>
        )}
      </div>

      {isLoading && (
        <div className="loading-container">
          <LoadingSpinner />
          <p>Loading token balances...</p>
        </div>
      )}

      {error && <div className="error-message">{error}</div>}

      {!isLoading && tokens.length === 0 && (
        <div className="empty-state">
          <p>No tokens found in this wallet</p>
        </div>
      )}

      {!isLoading && tokens.length > 0 && (
        <div className="tokens-container">
          {Object.entries(tokensByNetwork).map(([network, networkTokens]) => (
            <div key={network} className="network-section">
              <h3 className="network-header">{network}</h3>
              <div className="tokens-list">
                {networkTokens.map((token, idx) => (
                  <div key={`${token.address}-${token.tokenAddress}-${idx}`} className="token-card">
                    <div className="token-info">
                      {token.tokenLogo && (
                        <img src={token.tokenLogo} alt={token.tokenSymbol} className="token-logo" />
                      )}
                      <div className="token-details">
                        <div className="token-name">{token.tokenSymbol}</div>
                        <div className="token-network">{token.tokenName}</div>
                      </div>
                    </div>
                    <div className="token-balance">
                      <div className="balance-amount">{formatBalance(token.balance)}</div>
                      <div className="balance-usd">{formatUSD(token.usdValue)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
