/**
 * Onboarding State Store
 * Feature: First-time user onboarding flow
 * Tracks onboarding completion and step progress with localStorage persistence.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface OnboardingState {
  /** Whether the user has completed onboarding at least once */
  hasCompletedOnboarding: boolean;

  /** Whether to force-show onboarding (triggered from Settings) */
  showOnboarding: boolean;

  /** Current step index (0-based, 6 steps total) */
  currentStep: number;

  /** Mark onboarding as completed */
  completeOnboarding: () => void;

  /** Re-trigger onboarding from Settings */
  triggerOnboarding: () => void;

  /** Set the current step */
  setStep: (step: number) => void;

  /** Reset onboarding state */
  reset: () => void;
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      hasCompletedOnboarding: false,
      showOnboarding: false,
      currentStep: 0,

      completeOnboarding: () =>
        set({ hasCompletedOnboarding: true, showOnboarding: false, currentStep: 0 }),

      triggerOnboarding: () =>
        set({ showOnboarding: true, currentStep: 0 }),

      setStep: (step: number) =>
        set({ currentStep: step }),

      reset: () =>
        set({ hasCompletedOnboarding: false, showOnboarding: false, currentStep: 0 }),
    }),
    {
      name: 'arcsign-onboarding',
    }
  )
);

/** Hook: should onboarding be displayed? */
export const useShouldShowOnboarding = () =>
  useOnboardingStore((state) => !state.hasCompletedOnboarding || state.showOnboarding);
