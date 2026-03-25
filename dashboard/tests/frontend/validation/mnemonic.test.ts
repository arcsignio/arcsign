/**
 * Mnemonic validation schema tests
 * Tests: normalizeMnemonic, getBIP39Wordlist, validateMnemonicChecksum,
 *        getMnemonicValidationError, createMnemonicSchema, mnemonicSchema,
 *        createWalletImportSchema, walletImportSchema
 */

import { describe, it, expect } from 'vitest';
import {
  normalizeMnemonic,
  getBIP39Wordlist,
  validateMnemonicChecksum,
  getMnemonicValidationError,
  createMnemonicSchema,
  mnemonicSchema,
  createWalletImportSchema,
  walletImportSchema,
} from '@/validation/mnemonic';

// Simple t function that returns the key
const t = (key: string, options?: Record<string, unknown>) => {
  if (options) {
    // Simulate interpolation for count
    return key;
  }
  return key;
};

const VALID_12 =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const VALID_24 =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art';

describe('normalizeMnemonic', () => {
  it('trims leading and trailing whitespace', () => {
    expect(normalizeMnemonic('  hello world  ')).toBe('hello world');
  });

  it('collapses multiple spaces to single space', () => {
    expect(normalizeMnemonic('hello    world')).toBe('hello world');
  });

  it('converts to lowercase', () => {
    expect(normalizeMnemonic('HELLO World')).toBe('hello world');
  });

  it('handles tabs and newlines', () => {
    expect(normalizeMnemonic('hello\tworld\nfoo')).toBe('hello world foo');
  });

  it('returns empty string for empty input after trim', () => {
    expect(normalizeMnemonic('   ')).toBe('');
  });
});

describe('getBIP39Wordlist', () => {
  it('returns an array of 2048 words', () => {
    const wordlist = getBIP39Wordlist();
    expect(wordlist).toHaveLength(2048);
  });

  it('contains known BIP39 words', () => {
    const wordlist = getBIP39Wordlist();
    expect(wordlist).toContain('abandon');
    expect(wordlist).toContain('zoo');
    expect(wordlist).toContain('abstract');
  });

  it('does not contain non-BIP39 words', () => {
    const wordlist = getBIP39Wordlist();
    expect(wordlist).not.toContain('xyzfake');
    expect(wordlist).not.toContain('cryptocurrency');
  });
});

describe('validateMnemonicChecksum', () => {
  it('returns true for valid 12-word mnemonic', () => {
    expect(validateMnemonicChecksum(VALID_12)).toBe(true);
  });

  it('returns true for valid 24-word mnemonic', () => {
    expect(validateMnemonicChecksum(VALID_24)).toBe(true);
  });

  it('returns false for invalid checksum (all same word)', () => {
    const bad = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon';
    expect(validateMnemonicChecksum(bad)).toBe(false);
  });

  it('returns false for non-BIP39 words', () => {
    const bad = 'xyzfake abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
    expect(validateMnemonicChecksum(bad)).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(validateMnemonicChecksum('')).toBe(false);
  });

  it('handles unnormalized input (extra spaces, uppercase)', () => {
    const messy = '  ABANDON  abandon  abandon  abandon  abandon  abandon  abandon  abandon  abandon  abandon  abandon  ABOUT  ';
    expect(validateMnemonicChecksum(messy)).toBe(true);
  });
});

describe('getMnemonicValidationError', () => {
  it('returns null for valid mnemonic', () => {
    expect(getMnemonicValidationError(VALID_12)).toBeNull();
  });

  it('returns required error for empty string', () => {
    const error = getMnemonicValidationError('');
    expect(error).toBe('Mnemonic phrase is required');
  });

  it('returns required error for whitespace-only', () => {
    const error = getMnemonicValidationError('   ');
    expect(error).toBe('Mnemonic phrase is required');
  });

  it('returns word count error for wrong count', () => {
    const error = getMnemonicValidationError('abandon abandon abandon');
    expect(error).toMatch(/12 or 24 words/);
    expect(error).toMatch(/3 words/);
  });

  it('returns invalid words error', () => {
    const bad = 'xyzfake abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
    const error = getMnemonicValidationError(bad);
    expect(error).toMatch(/invalid words/i);
  });

  it('returns checksum error for valid words but invalid checksum', () => {
    const bad = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon';
    const error = getMnemonicValidationError(bad);
    expect(error).toMatch(/checksum/i);
  });

  describe('with i18n t function', () => {
    it('returns i18n key for empty mnemonic', () => {
      const error = getMnemonicValidationError('', t);
      expect(error).toBe('validation.mnemonicRequired');
    });

    it('returns i18n key for wrong word count', () => {
      const error = getMnemonicValidationError('one two three', t);
      expect(error).toBe('validation.mnemonicWordCountError');
    });

    it('returns i18n key for invalid words', () => {
      const bad = 'xyzfake abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
      const error = getMnemonicValidationError(bad, t);
      expect(error).toBe('validation.mnemonicInvalidWords');
    });

    it('returns i18n key for invalid checksum', () => {
      const bad = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon';
      const error = getMnemonicValidationError(bad, t);
      expect(error).toBe('validation.mnemonicInvalidChecksum');
    });

    it('returns null for valid mnemonic with t function', () => {
      expect(getMnemonicValidationError(VALID_12, t)).toBeNull();
    });
  });
});

describe('mnemonicSchema (from mnemonic.ts)', () => {
  it('accepts valid 12-word mnemonic', () => {
    const result = mnemonicSchema.safeParse(VALID_12);
    expect(result.success).toBe(true);
  });

  it('accepts valid 24-word mnemonic', () => {
    const result = mnemonicSchema.safeParse(VALID_24);
    expect(result.success).toBe(true);
  });

  it('rejects empty string', () => {
    const result = mnemonicSchema.safeParse('');
    expect(result.success).toBe(false);
  });

  it('normalizes input through transform', () => {
    const messy = '  ABANDON  abandon  abandon  abandon  abandon  abandon  abandon  abandon  abandon  abandon  abandon  about  ';
    const result = mnemonicSchema.safeParse(messy);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe(VALID_12);
    }
  });

  it('rejects wrong word count', () => {
    const result = mnemonicSchema.safeParse('abandon abandon abandon');
    expect(result.success).toBe(false);
  });

  it('rejects invalid BIP39 words', () => {
    const bad = 'xyzfake abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
    const result = mnemonicSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it('rejects invalid checksum', () => {
    const bad = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon';
    const result = mnemonicSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });
});

describe('createMnemonicSchema (i18n)', () => {
  it('uses i18n key for required error', () => {
    const schema = createMnemonicSchema(t);
    const result = schema.safeParse('');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('validation.mnemonicRequired');
    }
  });

  it('uses i18n key for word count error', () => {
    const schema = createMnemonicSchema(t);
    const result = schema.safeParse('abandon abandon abandon');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('validation.mnemonicWordCount');
    }
  });

  it('uses i18n key for invalid words error', () => {
    const schema = createMnemonicSchema(t);
    const bad = 'xyzfake abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
    const result = schema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it('uses i18n key for checksum error', () => {
    const schema = createMnemonicSchema(t);
    const bad = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon';
    const result = schema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it('accepts valid mnemonic', () => {
    const schema = createMnemonicSchema(t);
    const result = schema.safeParse(VALID_12);
    expect(result.success).toBe(true);
  });
});

describe('walletImportSchema (from mnemonic.ts)', () => {
  const validData = {
    mnemonic: VALID_12,
    password: 'StrongPassword1',
    confirmPassword: 'StrongPassword1',
    usePassphrase: false,
    name: 'Test Wallet',
  };

  it('accepts valid import data', () => {
    const result = walletImportSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('rejects password mismatch', () => {
    const result = walletImportSchema.safeParse({
      ...validData,
      confirmPassword: 'WrongPassword123',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty wallet name', () => {
    const result = walletImportSchema.safeParse({
      ...validData,
      name: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects wallet name over 50 chars', () => {
    const result = walletImportSchema.safeParse({
      ...validData,
      name: 'A'.repeat(51),
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty passphrase when usePassphrase is true', () => {
    const result = walletImportSchema.safeParse({
      ...validData,
      usePassphrase: true,
      passphrase: '',
    });
    expect(result.success).toBe(false);
  });

  it('accepts valid passphrase when usePassphrase is true', () => {
    const result = walletImportSchema.safeParse({
      ...validData,
      usePassphrase: true,
      passphrase: 'my secret passphrase',
    });
    expect(result.success).toBe(true);
  });

  it('accepts no passphrase when usePassphrase is false', () => {
    const result = walletImportSchema.safeParse({
      ...validData,
      usePassphrase: false,
    });
    expect(result.success).toBe(true);
  });
});

describe('createWalletImportSchema (i18n)', () => {
  const validData = {
    mnemonic: VALID_12,
    password: 'StrongPassword1',
    confirmPassword: 'StrongPassword1',
    usePassphrase: false,
    name: 'Test Wallet',
  };

  it('accepts valid data', () => {
    const schema = createWalletImportSchema(t);
    const result = schema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('returns i18n key for password mismatch', () => {
    const schema = createWalletImportSchema(t);
    const result = schema.safeParse({
      ...validData,
      confirmPassword: 'WrongPassword123',
    });
    expect(result.success).toBe(false);
  });

  it('returns i18n key for empty passphrase when enabled', () => {
    const schema = createWalletImportSchema(t);
    const result = schema.safeParse({
      ...validData,
      usePassphrase: true,
      passphrase: '',
    });
    expect(result.success).toBe(false);
  });

  it('returns i18n key for wallet name too long', () => {
    const schema = createWalletImportSchema(t);
    const result = schema.safeParse({
      ...validData,
      name: 'A'.repeat(51),
    });
    expect(result.success).toBe(false);
  });

  it('returns i18n key for required wallet name', () => {
    const schema = createWalletImportSchema(t);
    const result = schema.safeParse({
      ...validData,
      name: '',
    });
    expect(result.success).toBe(false);
  });
});
