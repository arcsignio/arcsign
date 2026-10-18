/**
 * Onboarding Step 3: Powerful Features
 */

import { useTranslation } from 'react-i18next';
import styles from "./FeaturesStep.module.css";
import { OnboardingStep } from '../OnboardingStep';

const StarIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
  </svg>
);

interface FeatureItemProps {
  title: string;
  body: string;
  icon: string;
}

const FeatureItem = ({ title, body, icon }: FeatureItemProps) => (
  <div className={styles.featureItem}>
    <span className={styles.featureIcon}>{icon}</span>
    <div>
      <h4>{title}</h4>
      <p>{body}</p>
    </div>
  </div>
);

export const FeaturesStep = () => {
  const { t } = useTranslation();

  const features: FeatureItemProps[] = [
    { icon: '\u26d3', title: t('onboarding.feature1Title'), body: t('onboarding.feature1Body') },
    { icon: '\ud83d\udd11', title: t('onboarding.feature2Title'), body: t('onboarding.feature2Body') },
    { icon: '\ud83d\udd17', title: t('onboarding.feature3Title'), body: t('onboarding.feature3Body') },
    { icon: '\ud83d\udd04', title: t('onboarding.feature4Title'), body: t('onboarding.feature4Body') },
    { icon: '\ud83d\udee0\ufe0f', title: t('onboarding.feature5Title'), body: t('onboarding.feature5Body') },
  ];

  return (
    <OnboardingStep icon={<StarIcon />} title={t('onboarding.featuresTitle')}>
      <p className={styles.featuresIntro}>{t('onboarding.featuresBody')}</p>
      <div className={styles.featuresGrid}>
        {features.map((feature, i) => (
          <FeatureItem key={i} {...feature} />
        ))}
      </div>
    </OnboardingStep>
  );
};
