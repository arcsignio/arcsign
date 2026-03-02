/**
 * Onboarding Step 6: You're All Set!
 */

import { useTranslation } from 'react-i18next';
import { OnboardingStep } from '../OnboardingStep';

const RocketIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 00-2.91-.09z"/>
    <path d="M12 15l-3-3a22 22 0 012-3.95A12.88 12.88 0 0122 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 01-4 2z"/>
    <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/>
    <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>
  </svg>
);

interface GetStartedStepProps {
  onCreateWallet: () => void;
}

export const GetStartedStep = ({ onCreateWallet }: GetStartedStepProps) => {
  const { t } = useTranslation();

  return (
    <OnboardingStep icon={<RocketIcon />} title={t('onboarding.readyTitle')}>
      <div className="ready-content">
        <div className="ready-logo-wrapper">
          <img src="/logo.png" alt="ArcSign" className="ready-logo" />
          <div className="ready-glow" />
        </div>

        <p className="ready-body">{t('onboarding.readyBody')}</p>

        <button
          className="ready-cta"
          onClick={onCreateWallet}
          type="button"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 8 }}>
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          {t('onboarding.createFirstWallet')}
        </button>

        <p className="ready-hint">{t('onboarding.revisitHint')}</p>
      </div>

      <style>{`
        .ready-content {
          text-align: center;
        }

        .ready-logo-wrapper {
          position: relative;
          display: inline-block;
          margin-bottom: 24px;
        }

        .ready-logo {
          width: 72px;
          height: 72px;
          object-fit: contain;
          position: relative;
          z-index: 1;
        }

        .ready-glow {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 100px;
          height: 100px;
          background: radial-gradient(circle, rgba(45, 212, 191, 0.2) 0%, transparent 70%);
          border-radius: 50%;
          animation: pulseGlow 2s ease-in-out infinite;
        }

        @keyframes pulseGlow {
          0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.6; }
          50% { transform: translate(-50%, -50%) scale(1.3); opacity: 1; }
        }

        .ready-body {
          margin: 0 0 28px;
          font-size: 15px;
          line-height: 1.7;
          color: #4b5563;
        }

        .ready-cta {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 14px 32px;
          background: linear-gradient(135deg, #0d9488 0%, #2dd4bf 100%);
          color: white;
          border: none;
          border-radius: 10px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          margin-bottom: 20px;
        }

        .ready-cta:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 16px rgba(45, 212, 191, 0.4);
        }

        .ready-cta:active {
          transform: translateY(0);
        }

        .ready-hint {
          margin: 0;
          font-size: 13px;
          color: #9ca3af;
        }
      `}</style>
    </OnboardingStep>
  );
};
