/**
 * Reusable onboarding step layout
 * Renders icon, title, and children content in a consistent layout.
 */

import React from 'react';
import styles from "./OnboardingStep.module.css";

interface OnboardingStepProps {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}

export const OnboardingStep: React.FC<OnboardingStepProps> = ({ icon, title, children }) => {
  return (
    <div className={styles.onboardingStep}>
      <div className={styles.onboardingStepIcon}>{icon}</div>
      <h2 className={styles.onboardingStepTitle}>{title}</h2>
      <div className={styles.onboardingStepContent}>{children}</div>
    </div>
  );
};
