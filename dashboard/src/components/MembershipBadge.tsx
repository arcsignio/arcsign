/**
 * Membership Badge Component
 * Displays membership status in Dashboard header
 * Shows Pro/Free status with wallet count
 */

import { useMembershipStatus, useWalletLimitInfo } from '@/stores/dashboardStore';

interface MembershipBadgeProps {
  onClick?: () => void;
}

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
          {membership.isPro ? '⭐ Pro' : 'Free'}
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
          background: ${membership.isPro ? 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)' : '#f9fafb'};
          border: 2px solid ${membership.isPro ? '#f0b90b' : '#e5e7eb'};
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s;
          font-family: inherit;
        }

        .membership-badge:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
          border-color: ${membership.isPro ? '#d4a00a' : '#d1d5db'};
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
          background: #f0b90b;
          color: #000;
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
