/**
 * Onboarding Flow - Main orchestrator
 * Full-screen step-by-step onboarding with progress indicator and navigation.
 */

import { useState, useEffect, useCallback } from 'react';
import styles from "./OnboardingFlow.module.css";
import { useTranslation } from 'react-i18next';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { WelcomeStep } from './steps/WelcomeStep';
import { SecurityStep } from './steps/SecurityStep';
import { FeaturesStep } from './steps/FeaturesStep';
import { BestPracticesStep } from './steps/BestPracticesStep';
import { ApiKeySetupStep } from './steps/ApiKeySetupStep';
import { GetStartedStep } from './steps/GetStartedStep';

const TOTAL_STEPS = 6;

interface OnboardingFlowProps {
  onComplete: () => void;
  usbPath: string;
}

export const OnboardingFlow = ({ onComplete, usbPath }: OnboardingFlowProps) => {
  const { t } = useTranslation();
  const { currentStep, setStep, completeOnboarding } = useOnboardingStore();
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward');
  const [animating, setAnimating] = useState(false);

  const handleNext = useCallback(() => {
    if (currentStep < TOTAL_STEPS - 1 && !animating) {
      setDirection('forward');
      setAnimating(true);
      setTimeout(() => {
        setStep(currentStep + 1);
        setAnimating(false);
      }, 200);
    }
  }, [currentStep, animating, setStep]);

  const handleBack = useCallback(() => {
    if (currentStep > 0 && !animating) {
      setDirection('backward');
      setAnimating(true);
      setTimeout(() => {
        setStep(currentStep - 1);
        setAnimating(false);
      }, 200);
    }
  }, [currentStep, animating, setStep]);

  const handleSkip = useCallback(() => {
    completeOnboarding();
    onComplete();
  }, [completeOnboarding, onComplete]);

  const handleCreateWallet = useCallback(() => {
    completeOnboarding();
    onComplete();
  }, [completeOnboarding, onComplete]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'Enter') {
        if (currentStep < TOTAL_STEPS - 1) handleNext();
      } else if (e.key === 'ArrowLeft') {
        handleBack();
      } else if (e.key === 'Escape') {
        handleSkip();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentStep, handleNext, handleBack, handleSkip]);

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return <WelcomeStep />;
      case 1:
        return <SecurityStep />;
      case 2:
        return <FeaturesStep />;
      case 3:
        return <BestPracticesStep />;
      case 4:
        return <ApiKeySetupStep usbPath={usbPath} />;
      case 5:
        return <GetStartedStep onCreateWallet={handleCreateWallet} />;
      default:
        return null;
    }
  };

  return (
    <div className={styles.onboardingOverlay}>
      {/* Language Switcher */}
      <div className={styles.onboardingTopLeft}>
        <LanguageSwitcher variant="toggle" />
      </div>

      {/* Skip button */}
      <button
        className={styles.onboardingSkip}
        onClick={handleSkip}
        type="button"
      >
        {t('onboarding.skip')}
      </button>

      <div className={styles.onboardingContainer}>
        {/* Progress dots */}
        <div className={styles.onboardingProgress}>
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div
              key={i}
              className={`${styles.onboardingDot} ${
                i === currentStep ? styles.active : i < currentStep ? styles.completed : ''
              }`}
            />
          ))}
        </div>

        {/* Step indicator */}
        <div className={styles.onboardingStepIndicator}>
          {t('onboarding.stepOf', {
            current: String(currentStep + 1),
            total: String(TOTAL_STEPS),
          })}
        </div>

        {/* Step content */}
        <div
          className={`${styles.onboardingContent} ${
            animating
              ? direction === 'forward'
                ? styles.slideOutLeft
                : styles.slideOutRight
              : styles.slideIn
          }`}
        >
          {renderStep()}
        </div>

        {/* Navigation buttons */}
        <div className={styles.onboardingNav}>
          {currentStep > 0 ? (
            <button
              className={styles.onboardingNavBack}
              onClick={handleBack}
              disabled={animating}
              type="button"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 4 }}>
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
              {t('onboarding.back')}
            </button>
          ) : (
            <div />
          )}

          {currentStep < TOTAL_STEPS - 1 && (
            <button
              className={styles.onboardingNavNext}
              onClick={handleNext}
              disabled={animating}
              type="button"
            >
              {t('onboarding.next')}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 4 }}>
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
