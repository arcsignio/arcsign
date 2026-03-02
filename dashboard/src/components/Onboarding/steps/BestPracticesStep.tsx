/**
 * Onboarding Step 4: Security Best Practices
 */

import { useTranslation } from 'react-i18next';
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
  <div className="practice-item">
    <div className="practice-check">
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
      <p className="practices-intro">{t('onboarding.practicesBody')}</p>
      <div className="practices-list">
        {practices.map((practice, i) => (
          <PracticeItem key={i} {...practice} />
        ))}
      </div>

      <style>{`
        .practices-intro {
          text-align: center;
          margin: 0 0 20px;
          color: #6b7280;
        }

        .practices-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .practice-item {
          display: flex;
          gap: 12px;
          padding: 12px 16px;
          background: #fffbeb;
          border: 1px solid #fde68a;
          border-radius: 8px;
        }

        .practice-check {
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f59e0b;
          color: white;
          border-radius: 50%;
          flex-shrink: 0;
          margin-top: 2px;
        }

        .practice-item h4 {
          margin: 0 0 2px;
          font-size: 14px;
          font-weight: 600;
          color: #92400e;
        }

        .practice-item p {
          margin: 0;
          font-size: 13px;
          color: #78716c;
          line-height: 1.4;
        }
      `}</style>
    </OnboardingStep>
  );
};
