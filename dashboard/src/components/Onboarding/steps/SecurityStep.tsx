/**
 * Onboarding Step 2: USB-Only Cold Storage
 */

import { useTranslation } from 'react-i18next';
import styles from "./SecurityStep.module.css";
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
  <div className={styles.securityCard} style={{ animationDelay: `${index * 0.1}s` }}>
    <div className={styles.securityCardNumber}>{index + 1}</div>
    <div className={styles.securityCardContent}>
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
      <p className={styles.securityIntro}>{t('onboarding.securityBody')}</p>
      <div className={styles.securityCards}>
        {points.map((point, i) => (
          <SecurityCard key={i} title={point.title} body={point.body} index={i} />
        ))}
      </div>
    </OnboardingStep>
  );
};
