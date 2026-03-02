/**
 * Onboarding Flow - Main orchestrator
 * Full-screen step-by-step onboarding with progress indicator and navigation.
 */

import { useState, useEffect, useCallback } from 'react';
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
    <div className="onboarding-overlay">
      {/* Language Switcher */}
      <div className="onboarding-top-left">
        <LanguageSwitcher variant="toggle" />
      </div>

      {/* Skip button */}
      <button
        className="onboarding-skip"
        onClick={handleSkip}
        type="button"
      >
        {t('onboarding.skip')}
      </button>

      <div className="onboarding-container">
        {/* Progress dots */}
        <div className="onboarding-progress">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div
              key={i}
              className={`onboarding-dot ${
                i === currentStep ? 'active' : i < currentStep ? 'completed' : ''
              }`}
            />
          ))}
        </div>

        {/* Step indicator */}
        <div className="onboarding-step-indicator">
          {t('onboarding.stepOf', {
            current: String(currentStep + 1),
            total: String(TOTAL_STEPS),
          })}
        </div>

        {/* Step content */}
        <div
          className={`onboarding-content ${
            animating
              ? direction === 'forward'
                ? 'slide-out-left'
                : 'slide-out-right'
              : 'slide-in'
          }`}
        >
          {renderStep()}
        </div>

        {/* Navigation buttons */}
        <div className="onboarding-nav">
          {currentStep > 0 ? (
            <button
              className="onboarding-nav-back"
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
              className="onboarding-nav-next"
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

      <style>{`
        .onboarding-overlay {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #0a1c32 0%, #0f2b46 40%, #134e5e 100%);
          padding: 20px;
          position: relative;
          overflow: hidden;
        }

        .onboarding-overlay::before {
          content: '';
          position: absolute;
          top: -50%;
          left: -50%;
          width: 200%;
          height: 200%;
          background: radial-gradient(circle at 30% 50%, rgba(45, 212, 191, 0.06) 0%, transparent 50%),
                      radial-gradient(circle at 70% 30%, rgba(94, 234, 212, 0.04) 0%, transparent 40%);
          pointer-events: none;
        }

        .onboarding-top-left {
          position: absolute;
          top: 20px;
          left: 20px;
          z-index: 10;
        }

        .onboarding-top-left button {
          background: rgba(255, 255, 255, 0.95) !important;
          border-color: rgba(255, 255, 255, 0.3) !important;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
        }

        .onboarding-top-left button:hover {
          background: #ffffff !important;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        }

        .onboarding-skip {
          position: absolute;
          top: 24px;
          right: 24px;
          z-index: 10;
          background: none;
          border: 1px solid rgba(255, 255, 255, 0.25);
          color: rgba(255, 255, 255, 0.7);
          padding: 6px 16px;
          border-radius: 6px;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .onboarding-skip:hover {
          background: rgba(255, 255, 255, 0.1);
          color: white;
          border-color: rgba(255, 255, 255, 0.4);
        }

        .onboarding-container {
          width: 100%;
          max-width: 640px;
          background: white;
          border-radius: 16px;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
          padding: 32px 40px;
          position: relative;
          z-index: 1;
        }

        .onboarding-progress {
          display: flex;
          justify-content: center;
          gap: 8px;
          margin-bottom: 8px;
        }

        .onboarding-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: #e5e7eb;
          transition: all 0.3s ease;
        }

        .onboarding-dot.active {
          background: #2dd4bf;
          box-shadow: 0 0 8px rgba(45, 212, 191, 0.4);
          transform: scale(1.2);
        }

        .onboarding-dot.completed {
          background: #0d9488;
        }

        .onboarding-step-indicator {
          text-align: center;
          font-size: 12px;
          color: #9ca3af;
          margin-bottom: 24px;
        }

        .onboarding-content {
          min-height: 360px;
          transition: opacity 0.2s ease, transform 0.2s ease;
        }

        .onboarding-content.slide-in {
          opacity: 1;
          transform: translateX(0);
        }

        .onboarding-content.slide-out-left {
          opacity: 0;
          transform: translateX(-20px);
        }

        .onboarding-content.slide-out-right {
          opacity: 0;
          transform: translateX(20px);
        }

        .onboarding-nav {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 24px;
          padding-top: 20px;
          border-top: 1px solid #f3f4f6;
        }

        .onboarding-nav-back {
          display: inline-flex;
          align-items: center;
          padding: 10px 20px;
          background: none;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          color: #6b7280;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .onboarding-nav-back:hover:not(:disabled) {
          border-color: #d1d5db;
          background: #f9fafb;
        }

        .onboarding-nav-back:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .onboarding-nav-next {
          display: inline-flex;
          align-items: center;
          padding: 10px 24px;
          background: linear-gradient(135deg, #0d9488 0%, #2dd4bf 100%);
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          margin-left: auto;
        }

        .onboarding-nav-next:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(45, 212, 191, 0.4);
        }

        .onboarding-nav-next:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
};
