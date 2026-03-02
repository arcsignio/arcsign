/**
 * Onboarding Step 2: USB-Only Cold Storage
 */

import { useTranslation } from 'react-i18next';
import { OnboardingStep } from '../OnboardingStep';

const UsbIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="10" cy="7" r="1"/><circle cx="14" cy="7" r="1"/>
    <rect x="6" y="1" width="12" height="14" rx="2"/>
    <path d="M9 15v2a2 2 0 002 2h2a2 2 0 002-2v-2"/>
    <path d="M12 19v4"/>
  </svg>
);

interface SecurityCardProps {
  title: string;
  body: string;
  index: number;
}

const SecurityCard = ({ title, body, index }: SecurityCardProps) => (
  <div className="security-card" style={{ animationDelay: `${index * 0.1}s` }}>
    <div className="security-card-number">{index + 1}</div>
    <div className="security-card-content">
      <h4>{title}</h4>
      <p>{body}</p>
    </div>
  </div>
);

export const SecurityStep = () => {
  const { t } = useTranslation();

  const points = [
    { title: t('onboarding.securityPoint1Title'), body: t('onboarding.securityPoint1Body') },
    { title: t('onboarding.securityPoint2Title'), body: t('onboarding.securityPoint2Body') },
    { title: t('onboarding.securityPoint3Title'), body: t('onboarding.securityPoint3Body') },
  ];

  return (
    <OnboardingStep icon={<UsbIcon />} title={t('onboarding.securityTitle')}>
      <p className="security-intro">{t('onboarding.securityBody')}</p>
      <div className="security-cards">
        {points.map((point, i) => (
          <SecurityCard key={i} title={point.title} body={point.body} index={i} />
        ))}
      </div>

      <style>{`
        .security-intro {
          text-align: center;
          margin: 0 0 24px;
          color: #6b7280;
        }

        .security-cards {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .security-card {
          display: flex;
          gap: 16px;
          padding: 16px;
          background: #f0fdfa;
          border-left: 4px solid #2dd4bf;
          border-radius: 0 8px 8px 0;
          animation: fadeInUp 0.4s ease forwards;
          opacity: 0;
        }

        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .security-card-number {
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #0d9488;
          color: white;
          border-radius: 50%;
          font-size: 13px;
          font-weight: 700;
          flex-shrink: 0;
        }

        .security-card-content h4 {
          margin: 0 0 4px;
          font-size: 15px;
          font-weight: 600;
          color: #0f766e;
        }

        .security-card-content p {
          margin: 0;
          font-size: 13px;
          color: #4b5563;
          line-height: 1.5;
        }
      `}</style>
    </OnboardingStep>
  );
};
