/**
 * Membership Badge Component
 * Displays membership status in Dashboard header
 * Shows Pro/Free status with wallet count
 */

import { useMembershipStatus, useWalletLimitInfo } from '@/stores/dashboardStore';

interface MembershipBadgeProps {
  onClick?: () => void;
}

const ShieldIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style={{display:'inline',verticalAlign:'middle',marginRight:3}}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
);

export function MembershipBadge({ onClick }: MembershipBadgeProps) {
  const membership = useMembershipStatus();
  const walletLimit = useWalletLimitInfo();

  return (
    <button
      onClick={onClick}
      className="membership-badge"
      title="Click to view membership details"
    >
      <div className="badge-content">
        <span className={`badge-label ${membership.isPro ? 'pro' : 'free'}`}>
          {membership.isPro ? <><ShieldIcon /> Pro</> : 'Free'}
        </span>
        <span className="badge-info">
          {walletLimit.current}/{walletLimit.limit} wallets
        </span>
      </div>

      <style>{`
        .membership-badge {
          display: flex;
          align-items: center;
          padding: 8px 16px;
          background: ${membership.isPro ? 'linear-gradient(135deg, #f0fdfa 0%, #ccfbf1 100%)' : '#f9fafb'};
          border: 1.5px solid ${membership.isPro ? '#2dd4bf' : '#e5e7eb'};
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s;
          font-family: inherit;
        }

        .membership-badge:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
          border-color: ${membership.isPro ? '#14b8a6' : '#d1d5db'};
        }

        .badge-content {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .badge-label {
          font-weight: 600;
          font-size: 14px;
          padding: 4px 10px;
          border-radius: 8px;
          white-space: nowrap;
        }

        .badge-label.pro {
          background: linear-gradient(135deg, #0d9488 0%, #2dd4bf 100%);
          color: white;
        }

        .badge-label.free {
          background: #e5e7eb;
          color: #374151;
        }

        .badge-info {
          font-size: 13px;
          color: #6b7280;
          font-weight: 500;
          white-space: nowrap;
        }

        @media (max-width: 640px) {
          .membership-badge {
            padding: 6px 12px;
          }

          .badge-content {
            gap: 8px;
          }

          .badge-label {
            font-size: 12px;
            padding: 3px 8px;
          }

          .badge-info {
            font-size: 12px;
          }
        }
      `}</style>
    </button>
  );
}
