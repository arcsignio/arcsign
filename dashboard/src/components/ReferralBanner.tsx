import { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface ReferralBannerProps {
  onGoToMembership: () => void;
}

const DISMISSED_KEY = 'referral_banner_dismissed';

export function ReferralBanner({ onGoToMembership }: ReferralBannerProps) {
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(DISMISSED_KEY) === '1'
  );

  if (dismissed) return null;

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, '1');
    setDismissed(true);
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '12px 16px',
      background: 'linear-gradient(135deg, rgba(13,148,136,0.12) 0%, rgba(45,212,191,0.08) 100%)',
      border: '1px solid rgba(45,212,191,0.3)',
      borderRadius: 10,
      marginBottom: 16,
    }}>
      <span style={{ fontSize: 20, flexShrink: 0 }}>💸</span>
      <span style={{ flex: 1, fontSize: 13, color: '#374151', lineHeight: 1.5 }}>
        {t('referralBanner.text')}
      </span>
      <button
        onClick={onGoToMembership}
        style={{
          flexShrink: 0,
          padding: '6px 12px',
          background: 'linear-gradient(135deg, #0d9488 0%, #2dd4bf 100%)',
          color: 'white',
          border: 'none',
          borderRadius: 6,
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        {t('referralBanner.cta')}
      </button>
      <button
        onClick={handleDismiss}
        aria-label={t('referralBanner.dismiss')}
        style={{
          flexShrink: 0,
          width: 24,
          height: 24,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: '#9ca3af',
          fontSize: 16,
          borderRadius: 4,
        }}
      >
        ×
      </button>
    </div>
  );
}
