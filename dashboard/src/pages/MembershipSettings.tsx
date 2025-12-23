/**
 * Membership Settings Page
 * Feature: ArcSign Pro NFT Membership System
 *
 * Allows users to:
 * 1. Select a primary BSC address for membership verification
 * 2. View current membership status (Free/Pro)
 * 3. Check membership validity and expiration
 */

import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { open } from '@tauri-apps/api/shell';
import { useDashboardStore, useMembershipStatus, usePrimaryMembershipAddress } from '@/stores/dashboardStore';

interface MembershipSettingsProps {
  onBack: () => void;
}

interface BscAddress {
  walletId: string;
  walletName: string;
  address: string;
}

interface MembershipCheckResult {
  isPro: boolean;
  nftCount: number;
  tokenIds: number[];
  expirations: number[];
  daysRemaining: number;
  walletLimit: number | null;
}

export const MembershipSettings: React.FC<MembershipSettingsProps> = ({ onBack }) => {
  const [bscAddresses, setBscAddresses] = useState<BscAddress[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const membership = useMembershipStatus();
  const primaryAddress = usePrimaryMembershipAddress();
  const { wallets, setMembership } = useDashboardStore();

  // Load all BSC addresses from all wallets on mount
  // Addresses are now included in wallet data (public, no password needed)
  useEffect(() => {
    loadBscAddresses();
  }, [wallets]);

  // Auto-check membership when primary address is set
  useEffect(() => {
    if (primaryAddress) {
      checkMembership(primaryAddress);
    }
  }, [primaryAddress]);

  const loadBscAddresses = () => {
    setIsLoading(true);
    setError(null);
    const addresses: BscAddress[] = [];

    try {
      // Addresses are now included in wallet list (public data from AddressBook)
      for (const wallet of wallets) {
        if (wallet.addresses) {
          // Find BSC address (BNB symbol with EVM key type)
          const bscAddr = wallet.addresses.find(
            (addr) => addr.symbol === 'BNB' || addr.symbol === 'BSC'
          );

          if (bscAddr) {
            addresses.push({
              walletId: wallet.id,
              walletName: wallet.name,
              address: bscAddr.address,
            });
          }
        }
      }

      setBscAddresses(addresses);
    } catch (err) {
      console.error('Failed to load BSC addresses:', err);
      setError('Failed to load wallet addresses');
    } finally {
      setIsLoading(false);
    }
  };

  const checkMembership = async (address: string) => {
    setIsChecking(true);
    setError(null);

    try {
      const result = await invoke<MembershipCheckResult>('check_membership', {
        input: { address },
      });

      setMembership({
        isPro: result.isPro,
        membershipAddress: address,
        daysRemaining: result.daysRemaining,
        walletLimit: result.walletLimit,
      });

      if (result.isPro) {
        setSuccessMessage('Pro membership verified!');
        setTimeout(() => setSuccessMessage(null), 3000);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to check membership';
      setError(errorMessage);
    } finally {
      setIsChecking(false);
    }
  };

  const handleSelectAddress = async (address: string) => {
    setMembership({ primaryMembershipAddress: address });
    await checkMembership(address);
  };

  const handleRefresh = () => {
    if (primaryAddress) {
      checkMembership(primaryAddress);
    }
  };

  const handleUpgrade = async () => {
    try {
      // Open mint page in default browser using Tauri shell API
      await open('http://localhost:8591');
    } catch (err) {
      console.error('Failed to open mint page:', err);
      // Fallback to window.open if shell API fails
      window.open('http://localhost:8591', '_blank');
    }
  };

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 8)}...${addr.slice(-6)}`;
  };

  return (
    <div className="membership-settings">
      <button onClick={onBack} className="back-button">
        ← Back to Settings
      </button>

      <header className="page-header">
        <h1>Membership</h1>
        <p className="page-description">
          Select your primary BSC address for Pro membership verification
        </p>
      </header>

      {/* Error/Success Messages */}
      {error && <div className="error-message">{error}</div>}
      {successMessage && <div className="success-message">{successMessage}</div>}

      {/* Current Status */}
      <section className="status-section">
        <div className="status-header">
          <h2>Current Status</h2>
          <button
            onClick={handleRefresh}
            disabled={isChecking || !primaryAddress}
            className="refresh-btn"
          >
            {isChecking ? '...' : '↻ Refresh'}
          </button>
        </div>

        <div className={`status-card ${membership.isPro ? 'pro' : 'free'}`}>
          <div className="status-badge">
            {membership.isPro ? '⭐ Pro Member' : 'Free Tier'}
          </div>

          {primaryAddress ? (
            <div className="status-details">
              <div className="detail-row">
                <span className="label">Verification Address</span>
                <span className="value">{formatAddress(primaryAddress)}</span>
              </div>
              {membership.isPro ? (
                <>
                  <div className="detail-row">
                    <span className="label">Status</span>
                    <span className="value status-active">Active</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">Expires in</span>
                    <span className="value">
                      {membership.daysRemaining > 0
                        ? `${membership.daysRemaining} days`
                        : 'Expired'}
                    </span>
                  </div>
                  <div className="detail-row">
                    <span className="label">Wallet Limit</span>
                    <span className="value">Unlimited</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="detail-row">
                    <span className="label">Wallet Limit</span>
                    <span className="value">{membership.walletLimit ?? 5} wallets</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">Current Usage</span>
                    <span className="value">{wallets.length} / {membership.walletLimit ?? 5}</span>
                  </div>
                </>
              )}
            </div>
          ) : (
            <p className="no-address-hint">
              Select a BSC address below to check your membership status
            </p>
          )}

          {!membership.isPro && (
            <button onClick={handleUpgrade} className="upgrade-btn">
              Upgrade to Pro - 30 USDT/year
            </button>
          )}
        </div>
      </section>

      {/* Address Selection */}
      <section className="address-section">
        <h2>Select Primary Address</h2>
        <p className="section-description">
          Choose which BSC address to use for membership verification.
          This should be the address where you minted your Pro NFT.
        </p>

        {isLoading ? (
          <div className="loading">Loading addresses...</div>
        ) : bscAddresses.length === 0 ? (
          <div className="no-addresses">
            <p>No BSC addresses found.</p>
            <p className="hint">Create a wallet first to get your BSC address.</p>
          </div>
        ) : (
          <div className="address-list">
            {bscAddresses.map((item) => (
              <button
                key={item.address}
                className={`address-item ${primaryAddress === item.address ? 'selected' : ''}`}
                onClick={() => handleSelectAddress(item.address)}
              >
                <div className="address-info">
                  <span className="wallet-name">{item.walletName}</span>
                  <span className="address">{formatAddress(item.address)}</span>
                </div>
                {primaryAddress === item.address && (
                  <span className="selected-indicator">✓ Selected</span>
                )}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Pro Benefits */}
      <section className="benefits-section">
        <h2>Pro Benefits</h2>
        <ul className="benefits-list">
          <li>
            <span className="check">✓</span>
            Unlimited wallet creation
          </li>
          <li>
            <span className="check">✓</span>
            Priority support
          </li>
          <li>
            <span className="check">✓</span>
            Early access to new features
          </li>
          <li>
            <span className="check">✓</span>
            Earn points for future airdrops
          </li>
        </ul>
      </section>

      <style>{`
        .membership-settings {
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
        }

        .back-button {
          background: none;
          border: none;
          color: #3b82f6;
          cursor: pointer;
          font-size: 14px;
          padding: 8px 0;
          margin-bottom: 16px;
        }

        .back-button:hover {
          text-decoration: underline;
        }

        .page-header {
          margin-bottom: 24px;
        }

        .page-header h1 {
          margin: 0 0 8px;
          font-size: 28px;
          font-weight: 600;
          color: #111827;
        }

        .page-description {
          margin: 0;
          color: #6b7280;
          font-size: 16px;
        }

        .error-message {
          padding: 12px 16px;
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 8px;
          color: #dc2626;
          margin-bottom: 16px;
        }

        .success-message {
          padding: 12px 16px;
          background: #f0fdf4;
          border: 1px solid #86efac;
          border-radius: 8px;
          color: #166534;
          margin-bottom: 16px;
        }

        section {
          margin-bottom: 32px;
        }

        section h2 {
          margin: 0 0 12px;
          font-size: 18px;
          font-weight: 600;
          color: #111827;
        }

        .section-description {
          margin: 0 0 16px;
          color: #6b7280;
          font-size: 14px;
        }

        /* Status Section */
        .status-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .refresh-btn {
          background: none;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          padding: 6px 12px;
          cursor: pointer;
          font-size: 14px;
          color: #374151;
        }

        .refresh-btn:hover:not(:disabled) {
          border-color: #3b82f6;
          color: #3b82f6;
        }

        .refresh-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .status-card {
          padding: 24px;
          background: #f9fafb;
          border-radius: 12px;
          border: 2px solid #e5e7eb;
        }

        .status-card.pro {
          background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
          border-color: #f0b90b;
        }

        .status-badge {
          display: inline-block;
          padding: 8px 16px;
          border-radius: 20px;
          font-size: 16px;
          font-weight: 600;
          margin-bottom: 16px;
        }

        .status-card.free .status-badge {
          background: #e5e7eb;
          color: #374151;
        }

        .status-card.pro .status-badge {
          background: #f0b90b;
          color: #000;
        }

        .status-details {
          margin-bottom: 16px;
        }

        .detail-row {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
          border-bottom: 1px solid rgba(0,0,0,0.1);
        }

        .detail-row:last-child {
          border-bottom: none;
        }

        .detail-row .label {
          color: #6b7280;
        }

        .detail-row .value {
          font-weight: 500;
          color: #111827;
        }

        .status-active {
          color: #10b981 !important;
        }

        .no-address-hint {
          color: #6b7280;
          font-style: italic;
          margin: 16px 0;
        }

        .upgrade-btn {
          width: 100%;
          padding: 12px 16px;
          background: linear-gradient(135deg, #f0b90b 0%, #f8d12f 100%);
          color: #000;
          border: none;
          border-radius: 8px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          margin-top: 16px;
        }

        .upgrade-btn:hover {
          opacity: 0.9;
        }

        /* Address List */
        .address-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .address-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px;
          background: white;
          border: 2px solid #e5e7eb;
          border-radius: 10px;
          cursor: pointer;
          text-align: left;
          width: 100%;
          transition: all 0.2s;
        }

        .address-item:hover {
          border-color: #3b82f6;
        }

        .address-item.selected {
          border-color: #f0b90b;
          background: #fffbeb;
        }

        .address-info {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .wallet-name {
          font-weight: 600;
          color: #111827;
        }

        .address {
          font-family: monospace;
          font-size: 14px;
          color: #6b7280;
        }

        .selected-indicator {
          color: #f0b90b;
          font-weight: 600;
        }

        .loading, .no-addresses {
          padding: 24px;
          text-align: center;
          background: #f9fafb;
          border-radius: 10px;
          color: #6b7280;
        }

        .no-addresses .hint {
          font-size: 14px;
          margin-top: 8px;
        }

        /* Benefits */
        .benefits-section {
          padding: 20px;
          background: #f0fdf4;
          border-radius: 12px;
          border: 1px solid #86efac;
        }

        .benefits-section h2 {
          color: #166534;
        }

        .benefits-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .benefits-list li {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 0;
          color: #166534;
        }

        .benefits-list .check {
          color: #22c55e;
          font-weight: bold;
        }
      `}</style>
    </div>
  );
};

export default MembershipSettings;
