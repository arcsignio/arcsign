/**
 * LanguageSwitcher Component
 * Allows users to switch between supported languages
 */

import React from 'react';
import { useLanguage } from '@/hooks/useLanguage';
import type { SupportedLanguage } from '@/locales';

interface LanguageSwitcherProps {
  /** Display style: 'dropdown' | 'toggle' | 'buttons' */
  variant?: 'dropdown' | 'toggle' | 'buttons';
  /** Additional CSS classes */
  className?: string;
}

/**
 * Language Switcher Component
 * Default variant is 'toggle' for simple English/Chinese switching
 */
export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({
  variant = 'toggle',
  className = '',
}) => {
  const { currentLanguage, supportedLanguages, changeLanguage, toggleLanguage } = useLanguage();

  // Toggle variant - simple button to switch between EN/中文
  if (variant === 'toggle') {
    return (
      <button
        onClick={toggleLanguage}
        className={`language-switcher-toggle ${className}`}
        title={currentLanguage === 'en' ? '切換至中文' : 'Switch to English'}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.25rem',
          padding: '0.375rem 0.75rem',
          fontSize: '0.875rem',
          fontWeight: 500,
          color: '#4b5563',
          backgroundColor: '#f3f4f6',
          border: '1px solid #d1d5db',
          borderRadius: '0.375rem',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = '#e5e7eb';
          e.currentTarget.style.borderColor = '#9ca3af';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = '#f3f4f6';
          e.currentTarget.style.borderColor = '#d1d5db';
        }}
      >
        <span style={{ fontSize: '1rem' }}>🌐</span>
        <span>{currentLanguage === 'en' ? '中文' : 'EN'}</span>
      </button>
    );
  }

  // Dropdown variant
  if (variant === 'dropdown') {
    return (
      <div className={`language-switcher-dropdown ${className}`}>
        <select
          value={currentLanguage}
          onChange={(e) => changeLanguage(e.target.value as SupportedLanguage)}
          style={{
            padding: '0.375rem 2rem 0.375rem 0.75rem',
            fontSize: '0.875rem',
            color: '#374151',
            backgroundColor: '#ffffff',
            border: '1px solid #d1d5db',
            borderRadius: '0.375rem',
            cursor: 'pointer',
            appearance: 'none',
            backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
            backgroundPosition: 'right 0.5rem center',
            backgroundRepeat: 'no-repeat',
            backgroundSize: '1.5em 1.5em',
          }}
        >
          {Object.entries(supportedLanguages).map(([code, { nativeName }]) => (
            <option key={code} value={code}>
              {nativeName}
            </option>
          ))}
        </select>
      </div>
    );
  }

  // Buttons variant
  return (
    <div
      className={`language-switcher-buttons ${className}`}
      style={{
        display: 'inline-flex',
        borderRadius: '0.375rem',
        overflow: 'hidden',
        border: '1px solid #d1d5db',
      }}
    >
      {Object.entries(supportedLanguages).map(([code, { nativeName }]) => (
        <button
          key={code}
          onClick={() => changeLanguage(code as SupportedLanguage)}
          style={{
            padding: '0.375rem 0.75rem',
            fontSize: '0.875rem',
            fontWeight: currentLanguage === code ? 600 : 400,
            color: currentLanguage === code ? '#ffffff' : '#4b5563',
            backgroundColor: currentLanguage === code ? '#3b82f6' : '#ffffff',
            border: 'none',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          {nativeName}
        </button>
      ))}
    </div>
  );
};

export default LanguageSwitcher;
