/**
 * MembershipStatus Component
 * Displays current membership tier (Free/Pro) and related information
 * Feature: ArcSign Pro NFT Membership System
 */

import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { useDashboardStore, useMembershipStatus } from '@/stores/dashboardStore';

interface MembershipStatusProps {
  /** BSC address to check membership for */
  bscAddress?: string;
  /** Compact mode for sidebar/header */
  compact?: boolean;
}

interface MembershipCheckResult {
  isPro: boolean;
  nftCount: number;
  tokenIds: number[];
  expirations: number[];
  daysRemaining: number;
  walletLimit: number | null;
}

export function MembershipStatus({ bscAddress, compact = false }: MembershipStatusProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const membership = useMembershipStatus();
  const { setMembership, wallets } = useDashboardStore();

  // Check membership on mount or when address changes
  useEffect(() => {
    if (bscAddress) {
      checkMembership(bscAddress);
    }
  }, [bscAddress]);

  const checkMembership = async (address: string) => {
    try {
      setIsLoading(true);
      setError(null);

      const result = await invoke<MembershipCheckResult>('check_membership', {
        input: { address },
      });

      setMembership({
        isPro: result.isPro,
        nftCount: result.nftCount,
        daysRemaining: result.daysRemaining,
        walletLimit: result.walletLimit ?? 3,
        addressNftCounts: [],
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to check membership';
      setError(errorMessage);
      console.error('Membership check failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpgrade = () => {
    window.open('https://arcsign.io/mint', '_blank');
  };

  const handleRefresh = () => {
    if (bscAddress) {
      checkMembership(bscAddress);
    }
  };

  // Compact view for header/sidebar
  if (compact) {
    return (
      <div className="membership-compact" style={styles.compact}>
        <span style={{
          ...styles.badge,
          backgroundColor: membership.isPro ? '#f0b90b' : '#6b7280',
          color: membership.isPro ? '#000' : '#fff',
        }}>
          {membership.isPro ? 'PRO' : 'FREE'}
        </span>
        {!membership.isPro && (
          <button onClick={handleUpgrade} style={styles.upgradeLink}>
            Upgrade
          </button>
        )}
      </div>
    );
  }

  // Full view for settings page
  return (
    <div className="membership-status" style={styles.container}>
      <div style={styles.header}>
        <h3 style={styles.title}>Membership Status</h3>
        <button onClick={handleRefresh} disabled={isLoading} style={styles.refreshBtn}>
          {isLoading ? '...' : '↻'}
        </button>
      </div>

      {error && (
        <div style={styles.error}>{error}</div>
      )}

      <div style={styles.tierCard}>
        <div style={styles.tierHeader}>
          <span style={{
            ...styles.tierBadge,
            backgroundColor: membership.isPro ? '#f0b90b' : '#e5e7eb',
            color: membership.isPro ? '#000' : '#374151',
          }}>
            {membership.isPro ? <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> Pro Member</> : 'Free Tier'}
          </span>
        </div>

        <div style={styles.tierDetails}>
          {membership.isPro ? (
            <>
              <div style={styles.detailRow}>
                <span style={styles.detailLabel}>Status</span>
                <span style={{ ...styles.detailValue, color: '#10b981' }}>Active</span>
              </div>
              <div style={styles.detailRow}>
                <span style={styles.detailLabel}>Expires in</span>
                <span style={styles.detailValue}>
                  {membership.daysRemaining > 0
                    ? `${membership.daysRemaining} days`
                    : 'Expired'
                  }
                </span>
              </div>
              <div style={styles.detailRow}>
                <span style={styles.detailLabel}>Wallet Limit</span>
                <span style={styles.detailValue}>{membership.walletLimit} wallets</span>
              </div>
              <div style={styles.detailRow}>
                <span style={styles.detailLabel}>Current Usage</span>
                <span style={styles.detailValue}>{wallets.length} / {membership.walletLimit}</span>
              </div>
            </>
          ) : (
            <>
              <div style={styles.detailRow}>
                <span style={styles.detailLabel}>Wallet Limit</span>
                <span style={styles.detailValue}>{membership.walletLimit} wallets</span>
              </div>
              <div style={styles.detailRow}>
                <span style={styles.detailLabel}>Current Usage</span>
                <span style={styles.detailValue}>{wallets.length} / {membership.walletLimit}</span>
              </div>
            </>
          )}
        </div>

        {!membership.isPro && (
          <div style={styles.upgradeSection}>
            <p style={styles.upgradeText}>
              Upgrade to Pro for +3 wallets per NFT and premium features!
            </p>
            <button onClick={handleUpgrade} style={styles.upgradeBtn}>
              Upgrade to Pro - 30 USDT/year
            </button>
          </div>
        )}

        {membership.isPro && membership.daysRemaining <= 30 && membership.daysRemaining > 0 && (
          <div style={styles.renewSection}>
            <p style={styles.renewText}>
              Your membership expires soon. Renew to continue enjoying Pro benefits!
            </p>
            <button onClick={handleUpgrade} style={styles.renewBtn}>
              Renew Membership
            </button>
          </div>
        )}
      </div>

      {/* Pro Benefits */}
      <div style={styles.benefitsCard}>
        <h4 style={styles.benefitsTitle}>Pro Benefits</h4>
        <ul style={styles.benefitsList}>
          <li style={styles.benefitItem}>
            <span style={styles.checkIcon}>✓</span>
            +3 wallets per NFT
          </li>
          <li style={styles.benefitItem}>
            <span style={styles.checkIcon}>✓</span>
            Priority support
          </li>
          <li style={styles.benefitItem}>
            <span style={styles.checkIcon}>✓</span>
            Early access to new features
          </li>
          <li style={styles.benefitItem}>
            <span style={styles.checkIcon}>✓</span>
            Earn points for future airdrops
          </li>
        </ul>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '1.5rem',
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1rem',
  },
  title: {
    margin: 0,
    fontSize: '1.25rem',
    fontWeight: 600,
    color: '#111827',
  },
  refreshBtn: {
    background: 'none',
    border: '1px solid #e5e7eb',
    borderRadius: '6px',
    padding: '0.25rem 0.5rem',
    cursor: 'pointer',
    fontSize: '1rem',
  },
  error: {
    padding: '0.75rem',
    backgroundColor: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '8px',
    color: '#dc2626',
    fontSize: '0.875rem',
    marginBottom: '1rem',
  },
  tierCard: {
    padding: '1.25rem',
    backgroundColor: '#f9fafb',
    borderRadius: '10px',
    marginBottom: '1rem',
  },
  tierHeader: {
    marginBottom: '1rem',
  },
  tierBadge: {
    display: 'inline-block',
    padding: '0.5rem 1rem',
    borderRadius: '20px',
    fontSize: '0.95rem',
    fontWeight: 600,
  },
  tierDetails: {
    marginTop: '1rem',
  },
  detailRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.5rem 0',
    borderBottom: '1px solid #e5e7eb',
  },
  detailLabel: {
    color: '#6b7280',
    fontSize: '0.9rem',
  },
  detailValue: {
    fontWeight: 500,
    color: '#111827',
  },
  upgradeSection: {
    marginTop: '1.25rem',
    paddingTop: '1rem',
    borderTop: '1px solid #e5e7eb',
  },
  upgradeText: {
    margin: '0 0 0.75rem 0',
    color: '#6b7280',
    fontSize: '0.9rem',
  },
  upgradeBtn: {
    width: '100%',
    padding: '0.75rem 1rem',
    backgroundColor: '#f0b90b',
    color: '#000',
    border: 'none',
    borderRadius: '8px',
    fontSize: '1rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  renewSection: {
    marginTop: '1.25rem',
    padding: '1rem',
    backgroundColor: '#fffbeb',
    borderRadius: '8px',
    border: '1px solid #fcd34d',
  },
  renewText: {
    margin: '0 0 0.75rem 0',
    color: '#92400e',
    fontSize: '0.9rem',
  },
  renewBtn: {
    width: '100%',
    padding: '0.75rem 1rem',
    backgroundColor: '#f59e0b',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '1rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  benefitsCard: {
    padding: '1.25rem',
    backgroundColor: '#f0fdf4',
    borderRadius: '10px',
    border: '1px solid #86efac',
  },
  benefitsTitle: {
    margin: '0 0 0.75rem 0',
    fontSize: '1rem',
    fontWeight: 600,
    color: '#166534',
  },
  benefitsList: {
    margin: 0,
    padding: 0,
    listStyle: 'none',
  },
  benefitItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.4rem 0',
    color: '#166534',
    fontSize: '0.9rem',
  },
  checkIcon: {
    color: '#22c55e',
    fontWeight: 'bold',
  },
  // Compact styles
  compact: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  badge: {
    padding: '0.2rem 0.5rem',
    borderRadius: '4px',
    fontSize: '0.75rem',
    fontWeight: 600,
  },
  upgradeLink: {
    background: 'none',
    border: 'none',
    color: '#f0b90b',
    fontSize: '0.75rem',
    cursor: 'pointer',
    textDecoration: 'underline',
  },
};

export default MembershipStatus;
