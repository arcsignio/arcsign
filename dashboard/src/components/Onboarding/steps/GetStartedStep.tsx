/**
 * Onboarding Step 6: You're All Set!
 */

import { useTranslation } from 'react-i18next';
import styles from "./GetStartedStep.module.css";
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
      <div className={styles.readyContent}>
        <div className={styles.readyLogoWrapper}>
          <img src="/logo.png" alt="ArcSign" className={styles.readyLogo} />
          <div className={styles.readyGlow} />
        </div>

        <p className={styles.readyBody}>{t('onboarding.readyBody')}</p>

        <button
          className={styles.readyCta}
          onClick={onCreateWallet}
          type="button"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 8 }}>
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          {t('onboarding.createFirstWallet')}
        </button>

        <p className={styles.readyHint}>{t('onboarding.revisitHint')}</p>
      </div>
    </OnboardingStep>
  );
};
