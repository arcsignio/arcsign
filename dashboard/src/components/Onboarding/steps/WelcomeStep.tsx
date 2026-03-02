/**
 * Onboarding Step 1: Welcome to ArcSign
 */

import { useTranslation } from 'react-i18next';
import { OnboardingStep } from '../OnboardingStep';

const ShieldIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
);

export const WelcomeStep = () => {
  const { t } = useTranslation();

  return (
    <OnboardingStep icon={<ShieldIcon />} title={t('onboarding.welcomeTitle')}>
      <div className="welcome-content">
        <img src="/logo.png" alt="ArcSign" className="welcome-logo" />
        <p className="welcome-body">{t('onboarding.welcomeBody')}</p>
        <div className="welcome-highlight">
          <strong>{t('onboarding.welcomeHighlight')}</strong>
        </div>
      </div>

      <style>{`
        .welcome-content {
          text-align: center;
        }

        .welcome-logo {
          width: 80px;
          height: 80px;
          object-fit: contain;
          margin: 0 auto 24px;
          display: block;
          animation: floatLogo 3s ease-in-out infinite;
        }

        @keyframes floatLogo {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }

        .welcome-body {
          margin: 0 0 24px;
          font-size: 15px;
          line-height: 1.7;
          color: #4b5563;
        }

        .welcome-highlight {
          display: inline-block;
          padding: 12px 24px;
          background: linear-gradient(135deg, rgba(13, 148, 136, 0.08) 0%, rgba(45, 212, 191, 0.08) 100%);
          border: 1px solid rgba(45, 212, 191, 0.2);
          border-radius: 8px;
          color: #0d9488;
          font-size: 16px;
        }
      `}</style>
    </OnboardingStep>
  );
};
