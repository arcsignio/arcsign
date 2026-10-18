/**
 * Onboarding Step 1: Welcome to ArcSign
 */

import { useTranslation } from 'react-i18next';
import styles from "./WelcomeStep.module.css";
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
      <div className={styles.welcomeContent}>
        <img src="/logo.png" alt="ArcSign" className={styles.welcomeLogo} />
        <p className={styles.welcomeBody}>{t('onboarding.welcomeBody')}</p>
        <div className={styles.welcomeHighlight}>
          <strong>{t('onboarding.welcomeHighlight')}</strong>
        </div>
      </div>
    </OnboardingStep>
  );
};
