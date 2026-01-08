/**
 * useLanguage Hook
 * Provides language switching functionality
 */

import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  SUPPORTED_LANGUAGES,
  type SupportedLanguage,
  DEFAULT_LANGUAGE,
  changeLanguage as i18nChangeLanguage,
} from '@/locales';

export interface UseLanguageReturn {
  /** Current language code */
  currentLanguage: SupportedLanguage;
  /** List of supported languages */
  supportedLanguages: typeof SUPPORTED_LANGUAGES;
  /** Change language */
  changeLanguage: (language: SupportedLanguage) => Promise<void>;
  /** Check if current language is Chinese */
  isChinese: boolean;
  /** Check if current language is English */
  isEnglish: boolean;
  /** Toggle between English and Chinese */
  toggleLanguage: () => Promise<void>;
}

/**
 * Hook for managing language settings
 */
export function useLanguage(): UseLanguageReturn {
  const { i18n } = useTranslation();

  const currentLanguage = (i18n.language as SupportedLanguage) || DEFAULT_LANGUAGE;
  const isChinese = currentLanguage === 'zh-TW';
  const isEnglish = currentLanguage === 'en';

  const changeLanguage = useCallback(async (language: SupportedLanguage) => {
    await i18nChangeLanguage(language);
  }, []);

  const toggleLanguage = useCallback(async () => {
    const newLanguage: SupportedLanguage = isChinese ? 'en' : 'zh-TW';
    await changeLanguage(newLanguage);
  }, [isChinese, changeLanguage]);

  return {
    currentLanguage,
    supportedLanguages: SUPPORTED_LANGUAGES,
    changeLanguage,
    isChinese,
    isEnglish,
    toggleLanguage,
  };
}

export default useLanguage;
