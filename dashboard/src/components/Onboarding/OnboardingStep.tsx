/**
 * Reusable onboarding step layout
 * Renders icon, title, and children content in a consistent layout.
 */

import React from 'react';

interface OnboardingStepProps {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}

export const OnboardingStep: React.FC<OnboardingStepProps> = ({ icon, title, children }) => {
  return (
    <div className="onboarding-step">
      <div className="onboarding-step-icon">{icon}</div>
      <h2 className="onboarding-step-title">{title}</h2>
      <div className="onboarding-step-content">{children}</div>

      <style>{`
        .onboarding-step {
          text-align: center;
        }

        .onboarding-step-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 64px;
          height: 64px;
          margin: 0 auto 20px;
          background: linear-gradient(135deg, rgba(13, 148, 136, 0.1) 0%, rgba(45, 212, 191, 0.1) 100%);
          border-radius: 16px;
          color: #0d9488;
        }

        .onboarding-step-title {
          margin: 0 0 16px;
          font-size: 24px;
          font-weight: 700;
          color: #111827;
        }

        .onboarding-step-content {
          text-align: left;
          color: #4b5563;
          font-size: 15px;
          line-height: 1.6;
        }
      `}</style>
    </div>
  );
};
