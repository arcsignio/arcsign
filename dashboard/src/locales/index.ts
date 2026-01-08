/**
 * i18n Configuration
 * Multi-language support for ArcSign Dashboard
 * Default: English, Supported: English, Traditional Chinese
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import enCommon from './en/common.json';
import zhTWCommon from './zh-TW/common.json';

// Supported languages
export const SUPPORTED_LANGUAGES = {
  en: { name: 'English', nativeName: 'English' },
  'zh-TW': { name: 'Chinese (Traditional)', nativeName: '繁體中文' },
} as const;

export type SupportedLanguage = keyof typeof SUPPORTED_LANGUAGES;

// Default language
export const DEFAULT_LANGUAGE: SupportedLanguage = 'en';

// Language resources
const resources = {
  en: {
    common: enCommon,
  },
  'zh-TW': {
    common: zhTWCommon,
  },
};

// Initialize i18n
i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: DEFAULT_LANGUAGE,
    defaultNS: 'common',
    ns: ['common'],

    // Language detection options
    detection: {
      // Order of detection methods
      order: ['localStorage', 'navigator'],
      // Key for localStorage
      lookupLocalStorage: 'arcsign-language',
      // Cache user language
      caches: ['localStorage'],
    },

    interpolation: {
      escapeValue: false, // React already escapes values
    },

    react: {
      useSuspense: false, // Disable suspense for SSR compatibility
    },
  });

export default i18n;

/**
 * Get current language
 */
export const getCurrentLanguage = (): SupportedLanguage => {
  return (i18n.language as SupportedLanguage) || DEFAULT_LANGUAGE;
};

/**
 * Change language
 */
export const changeLanguage = async (language: SupportedLanguage): Promise<void> => {
  await i18n.changeLanguage(language);
};

/**
 * Check if language is supported
 */
export const isLanguageSupported = (language: string): language is SupportedLanguage => {
  return language in SUPPORTED_LANGUAGES;
};
