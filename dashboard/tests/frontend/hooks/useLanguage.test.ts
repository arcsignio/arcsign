import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLanguage } from '@/hooks/useLanguage';

// Mock react-i18next
const mockChangeLanguage = vi.fn().mockResolvedValue(undefined);
let mockCurrentLanguage = 'en';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: {
      language: mockCurrentLanguage,
      changeLanguage: mockChangeLanguage,
    },
    t: (key: string) => key,
  }),
}));

// Mock locales module
vi.mock('@/locales', () => ({
  SUPPORTED_LANGUAGES: [
    { code: 'en', name: 'English', nativeName: 'English' },
    { code: 'zh-TW', name: 'Chinese (Traditional)', nativeName: '繁體中文' },
  ],
  DEFAULT_LANGUAGE: 'en',
  changeLanguage: vi.fn().mockResolvedValue(undefined),
}));

describe('useLanguage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCurrentLanguage = 'en';
  });

  describe('currentLanguage', () => {
    it('returns current language', () => {
      const { result } = renderHook(() => useLanguage());
      expect(result.current.currentLanguage).toBe('en');
    });

    it('detects Chinese language', () => {
      mockCurrentLanguage = 'zh-TW';
      const { result } = renderHook(() => useLanguage());
      expect(result.current.isChinese).toBe(true);
      expect(result.current.isEnglish).toBe(false);
    });

    it('detects English language', () => {
      mockCurrentLanguage = 'en';
      const { result } = renderHook(() => useLanguage());
      expect(result.current.isEnglish).toBe(true);
      expect(result.current.isChinese).toBe(false);
    });
  });

  describe('supportedLanguages', () => {
    it('returns supported languages list', () => {
      const { result } = renderHook(() => useLanguage());
      expect(result.current.supportedLanguages).toHaveLength(2);
    });
  });

  describe('changeLanguage', () => {
    it('calls i18n changeLanguage', async () => {
      const { changeLanguage: i18nChange } = await import('@/locales');
      const { result } = renderHook(() => useLanguage());

      await act(async () => {
        await result.current.changeLanguage('zh-TW');
      });

      expect(i18nChange).toHaveBeenCalledWith('zh-TW');
    });
  });

  describe('toggleLanguage', () => {
    it('toggles from English to Chinese', async () => {
      mockCurrentLanguage = 'en';
      const { changeLanguage: i18nChange } = await import('@/locales');
      const { result } = renderHook(() => useLanguage());

      await act(async () => {
        await result.current.toggleLanguage();
      });

      expect(i18nChange).toHaveBeenCalledWith('zh-TW');
    });

    it('toggles from Chinese to English', async () => {
      mockCurrentLanguage = 'zh-TW';
      const { changeLanguage: i18nChange } = await import('@/locales');
      const { result } = renderHook(() => useLanguage());

      await act(async () => {
        await result.current.toggleLanguage();
      });

      expect(i18nChange).toHaveBeenCalledWith('en');
    });
  });
});
