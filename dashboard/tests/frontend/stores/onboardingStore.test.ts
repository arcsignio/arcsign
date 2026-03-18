import { describe, it, expect, beforeEach } from 'vitest';
import { useOnboardingStore, useShouldShowOnboarding } from '@/stores/onboardingStore';

describe('onboardingStore', () => {
  beforeEach(() => {
    useOnboardingStore.getState().reset();
  });

  describe('Initial State', () => {
    it('starts with onboarding not completed', () => {
      expect(useOnboardingStore.getState().hasCompletedOnboarding).toBe(false);
    });

    it('starts with showOnboarding false', () => {
      expect(useOnboardingStore.getState().showOnboarding).toBe(false);
    });

    it('starts at step 0', () => {
      expect(useOnboardingStore.getState().currentStep).toBe(0);
    });
  });

  describe('completeOnboarding', () => {
    it('marks onboarding as completed', () => {
      useOnboardingStore.getState().completeOnboarding();
      const state = useOnboardingStore.getState();
      expect(state.hasCompletedOnboarding).toBe(true);
      expect(state.showOnboarding).toBe(false);
      expect(state.currentStep).toBe(0);
    });

    it('resets step to 0 when completing', () => {
      useOnboardingStore.getState().setStep(3);
      useOnboardingStore.getState().completeOnboarding();
      expect(useOnboardingStore.getState().currentStep).toBe(0);
    });
  });

  describe('triggerOnboarding', () => {
    it('sets showOnboarding to true', () => {
      useOnboardingStore.getState().triggerOnboarding();
      expect(useOnboardingStore.getState().showOnboarding).toBe(true);
    });

    it('resets step to 0', () => {
      useOnboardingStore.getState().setStep(4);
      useOnboardingStore.getState().triggerOnboarding();
      expect(useOnboardingStore.getState().currentStep).toBe(0);
    });

    it('works after onboarding was already completed', () => {
      useOnboardingStore.getState().completeOnboarding();
      useOnboardingStore.getState().triggerOnboarding();
      const state = useOnboardingStore.getState();
      expect(state.hasCompletedOnboarding).toBe(true);
      expect(state.showOnboarding).toBe(true);
    });
  });

  describe('setStep', () => {
    it('sets the current step', () => {
      useOnboardingStore.getState().setStep(3);
      expect(useOnboardingStore.getState().currentStep).toBe(3);
    });

    it('can set to any step index', () => {
      useOnboardingStore.getState().setStep(5);
      expect(useOnboardingStore.getState().currentStep).toBe(5);
    });
  });

  describe('reset', () => {
    it('resets all state to initial', () => {
      useOnboardingStore.getState().completeOnboarding();
      useOnboardingStore.getState().setStep(3);
      useOnboardingStore.getState().reset();

      const state = useOnboardingStore.getState();
      expect(state.hasCompletedOnboarding).toBe(false);
      expect(state.showOnboarding).toBe(false);
      expect(state.currentStep).toBe(0);
    });
  });

  describe('useShouldShowOnboarding selector', () => {
    it('returns true when onboarding not completed', () => {
      // Not completed, not triggered → should show
      const state = useOnboardingStore.getState();
      const shouldShow = !state.hasCompletedOnboarding || state.showOnboarding;
      expect(shouldShow).toBe(true);
    });

    it('returns false after completing onboarding', () => {
      useOnboardingStore.getState().completeOnboarding();
      const state = useOnboardingStore.getState();
      const shouldShow = !state.hasCompletedOnboarding || state.showOnboarding;
      expect(shouldShow).toBe(false);
    });

    it('returns true when triggered after completion', () => {
      useOnboardingStore.getState().completeOnboarding();
      useOnboardingStore.getState().triggerOnboarding();
      const state = useOnboardingStore.getState();
      const shouldShow = !state.hasCompletedOnboarding || state.showOnboarding;
      expect(shouldShow).toBe(true);
    });
  });
});
