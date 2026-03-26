/**
 * ProUpgradeDialog Component
 * Shows compelling upgrade prompt when user hits wallet limit.
 * Displays Pro features, pricing, and wallet comparison.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';

interface ProUpgradeDialogProps {
  isOpen: boolean;
  currentWallets: number;
  walletLimit: number;
  isPro: boolean;
  onUpgrade: () => void;
  onClose: () => void;
}

export const ProUpgradeDialog: React.FC<ProUpgradeDialogProps> = ({
  isOpen,
  currentWallets,
  walletLimit,
  isPro,
  onUpgrade,
  onClose,
}) => {
  const { t } = useTranslation();

  if (!isOpen) return null;

  const proFeatures = [
    { icon: '💼', label: t('proUpgrade.feature.wallets', '4+ wallets (each NFT +3)') },
    { icon: '🔄', label: t('proUpgrade.feature.bestRoute', 'Best-route DEX swap auto-comparison') },
    { icon: '🛡️', label: t('proUpgrade.feature.batchRevoke', 'Batch revoke token approvals') },
    { icon: '💎', label: t('proUpgrade.feature.points', '2x points + 3x airdrop weight') },
    { icon: '⚡', label: t('proUpgrade.feature.earlyAccess', 'Early access to new features') },
    { icon: '🎧', label: t('proUpgrade.feature.support', 'Priority support') },
  ];

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.dialog} onClick={(e) => e.stopPropagation()} role="dialog">
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.badge}>
            {isPro ? t('proUpgrade.needMore', 'Need More Wallets?') : 'Pro'}
          </div>
          <h2 style={styles.title}>
            {isPro
              ? t('proUpgrade.titleMore', 'Purchase additional NFTs')
              : t('proUpgrade.title', 'Unlock the full power of ArcSign')}
          </h2>
          <p style={styles.subtitle}>
            {isPro
              ? t('proUpgrade.subtitleMore', 'Each additional Pro NFT adds 3 more wallet slots.')
              : t('proUpgrade.subtitle', 'You\'ve reached the Free plan limit. Upgrade to Pro for more wallets and advanced DeFi tools.')}
          </p>
        </div>

        {/* Wallet Limit Indicator */}
        <div style={styles.limitBar}>
          <div style={styles.limitLabel}>
            <span>{t('proUpgrade.wallets', 'Wallets')}</span>
            <span style={styles.limitCount}>{currentWallets} / {walletLimit}</span>
          </div>
          <div style={styles.progressBg}>
            <div style={{ ...styles.progressFill, width: '100%' }} />
          </div>
          <span style={styles.limitFull}>{t('proUpgrade.limitReached', 'Limit reached')}</span>
        </div>

        {/* Pro Features */}
        {!isPro && (
          <div style={styles.features}>
            {proFeatures.map((f, i) => (
              <div key={i} style={styles.featureRow}>
                <span style={styles.featureIcon}>{f.icon}</span>
                <span style={styles.featureLabel}>{f.label}</span>
              </div>
            ))}
          </div>
        )}

        {/* Price */}
        <div style={styles.priceSection}>
          <span style={styles.priceValue}>$30</span>
          <span style={styles.pricePeriod}>USDT / {t('proUpgrade.year', 'year')}</span>
        </div>

        {/* Buttons */}
        <div style={styles.buttons}>
          <button style={styles.upgradeBtn} onClick={onUpgrade}>
            {isPro
              ? t('proUpgrade.buyMore', 'Purchase NFT')
              : t('proUpgrade.upgrade', 'Upgrade to Pro')}
          </button>
          <button style={styles.closeBtn} onClick={onClose}>
            {t('actions.close', 'Close')}
          </button>
        </div>

        {/* Note */}
        <p style={styles.note}>
          {t('proUpgrade.note', 'Pro membership is an on-chain NFT. You own it — transferable and sellable.')}
        </p>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
    backdropFilter: 'blur(4px)',
  },
  dialog: {
    background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
    borderRadius: 16,
    padding: '32px 28px',
    maxWidth: 420,
    width: '90%',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(45, 212, 191, 0.2)',
  },
  header: {
    textAlign: 'center' as const,
    marginBottom: 24,
  },
  badge: {
    display: 'inline-block',
    background: 'linear-gradient(135deg, #0d9488 0%, #2dd4bf 100%)',
    color: '#0f172a',
    fontWeight: 800,
    fontSize: 13,
    padding: '4px 16px',
    borderRadius: 20,
    marginBottom: 16,
    letterSpacing: 1,
  },
  title: {
    color: '#f8fafc',
    fontSize: 20,
    fontWeight: 700,
    margin: '0 0 8px',
    lineHeight: 1.3,
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: 14,
    margin: 0,
    lineHeight: 1.6,
  },
  limitBar: {
    background: 'rgba(239, 68, 68, 0.08)',
    border: '1px solid rgba(239, 68, 68, 0.2)',
    borderRadius: 12,
    padding: '12px 16px',
    marginBottom: 20,
  },
  limitLabel: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 13,
    color: '#94a3b8',
    marginBottom: 8,
  },
  limitCount: {
    fontWeight: 700,
    color: '#ef4444',
  },
  progressBg: {
    height: 6,
    background: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressFill: {
    height: '100%',
    background: 'linear-gradient(90deg, #ef4444, #f97316)',
    borderRadius: 3,
    transition: 'width 0.3s ease',
  },
  limitFull: {
    fontSize: 11,
    color: '#ef4444',
    fontWeight: 600,
  },
  features: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 10,
    marginBottom: 20,
  },
  featureRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  featureIcon: {
    fontSize: 16,
    width: 24,
    textAlign: 'center' as const,
    flexShrink: 0,
  },
  featureLabel: {
    color: '#e2e8f0',
    fontSize: 13,
    lineHeight: 1.4,
  },
  priceSection: {
    textAlign: 'center' as const,
    marginBottom: 20,
    padding: '12px 0',
    borderTop: '1px solid rgba(255, 255, 255, 0.06)',
    borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
  },
  priceValue: {
    fontSize: 28,
    fontWeight: 800,
    color: '#2dd4bf',
    marginRight: 6,
  },
  pricePeriod: {
    fontSize: 14,
    color: '#94a3b8',
  },
  buttons: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 10,
  },
  upgradeBtn: {
    width: '100%',
    padding: '14px 0',
    background: 'linear-gradient(135deg, #0d9488 0%, #2dd4bf 100%)',
    color: '#0f172a',
    border: 'none',
    borderRadius: 10,
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'transform 0.15s, box-shadow 0.15s',
  },
  closeBtn: {
    width: '100%',
    padding: '12px 0',
    background: 'transparent',
    color: '#94a3b8',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
    fontSize: 14,
    cursor: 'pointer',
  },
  note: {
    textAlign: 'center' as const,
    fontSize: 11,
    color: '#64748b',
    marginTop: 16,
    marginBottom: 0,
    lineHeight: 1.5,
  },
};
