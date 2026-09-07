/**
 * Onboarding Step 4: Security Best Practices
 */

import { useTranslation } from 'react-i18next';
import styles from "./BestPracticesStep.module.css";
import { OnboardingStep } from '../OnboardingStep';

const ChecklistIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 11l3 3L22 4"/>
    <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
  </svg>
);

interface PracticeItemProps {
  title: string;
  body: string;
}

const PracticeItem = ({ title, body }: PracticeItemProps) => (
  <div className={styles.practiceItem}>
    <div className={styles.practiceCheck}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
    </div>
    <div>
      <h4>{title}</h4>
      <p>{body}</p>
    </div>
  </div>
);

export const BestPracticesStep = () => {
  const { t } = useTranslation();

  const practices: PracticeItemProps[] = [
    { title: t('onboarding.practice1Title'), body: t('onboarding.practice1Body') },
    { title: t('onboarding.practice2Title'), body: t('onboarding.practice2Body') },
    { title: t('onboarding.practice3Title'), body: t('onboarding.practice3Body') },
    { title: t('onboarding.practice4Title'), body: t('onboarding.practice4Body') },
    { title: t('onboarding.practice5Title'), body: t('onboarding.practice5Body') },
  ];

  return (
    <OnboardingStep icon={<ChecklistIcon />} title={t('onboarding.practicesTitle')}>
      <p className={styles.practicesIntro}>{t('onboarding.practicesBody')}</p>
      <div className={styles.practicesList}>
        {practices.map((practice, i) => (
          <PracticeItem key={i} {...practice} />
        ))}
      </div>
    </OnboardingStep>
  );
};
