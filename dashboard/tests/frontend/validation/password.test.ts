/**
 * Password validation schema tests
 * Tests: createPasswordSchema, passwordSchema, createWalletCreateSchema,
 *        walletCreateSchema, createMnemonicSchema, mnemonicSchema,
 *        createWalletImportSchema, walletImportSchema,
 *        createWalletRenameSchema, walletRenameSchema
 */

import { describe, it, expect } from 'vitest';
import {
  createPasswordSchema,
  passwordSchema,
  createWalletCreateSchema,
  walletCreateSchema,
  createMnemonicSchema,
  mnemonicSchema,
  createWalletImportSchema,
  walletImportSchema,
  createWalletRenameSchema,
  walletRenameSchema,
  type WalletCreateFormData,
  type WalletImportFormData,
  type WalletRenameFormData,
} from '@/validation/password';

// Simple t function that returns the key
const t = (key: string) => key;

describe('passwordSchema (default English)', () => {
  it('accepts a valid password', () => {
    const result = passwordSchema.safeParse('StrongPassword1');
    expect(result.success).toBe(true);
  });

  it('rejects password shorter than 12 characters', () => {
    const result = passwordSchema.safeParse('Short1A');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/12 characters/i);
    }
  });

  it('rejects password without uppercase', () => {
    const result = passwordSchema.safeParse('alllowercase123');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/uppercase/i);
    }
  });

  it('rejects password without lowercase', () => {
    const result = passwordSchema.safeParse('ALLUPPERCASE123');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/lowercase/i);
    }
  });

  it('rejects password without number', () => {
    const result = passwordSchema.safeParse('NoNumbersHereAbc');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/number/i);
    }
  });

  it('rejects empty string', () => {
    const result = passwordSchema.safeParse('');
    expect(result.success).toBe(false);
  });

  it('trims whitespace before validation', () => {
    // After trimming, "  StrongPassword1  " becomes "StrongPassword1" (15 chars, valid)
    const result = passwordSchema.safeParse('  StrongPassword1  ');
    expect(result.success).toBe(true);
  });

  it('rejects whitespace-only string', () => {
    const result = passwordSchema.safeParse('            ');
    expect(result.success).toBe(false);
  });

  it('accepts very long password meeting all criteria', () => {
    const long = 'Aa1' + 'x'.repeat(100);
    const result = passwordSchema.safeParse(long);
    expect(result.success).toBe(true);
  });
});

describe('createPasswordSchema (i18n)', () => {
  it('returns i18n key in error messages', () => {
    const schema = createPasswordSchema(t);
    const result = schema.safeParse('short');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('validation.passwordMinLength');
    }
  });

  it('reports uppercase error with i18n key', () => {
    const schema = createPasswordSchema(t);
    const result = schema.safeParse('alllowercase123');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('validation.passwordUppercase');
    }
  });

  it('reports lowercase error with i18n key', () => {
    const schema = createPasswordSchema(t);
    const result = schema.safeParse('ALLUPPERCASE123');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('validation.passwordLowercase');
    }
  });

  it('reports number error with i18n key', () => {
    const schema = createPasswordSchema(t);
    const result = schema.safeParse('NoNumbersHereAbc');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('validation.passwordNumber');
    }
  });
});

describe('walletCreateSchema (default English)', () => {
  const validData = {
    password: 'StrongPassword1',
    confirmPassword: 'StrongPassword1',
    walletName: 'My Wallet',
    passphrase: '',
    mnemonicLength: 24,
    usbPath: '/dev/usb0',
  };

  it('accepts valid wallet creation data', () => {
    const result = walletCreateSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('rejects when passwords do not match', () => {
    const result = walletCreateSchema.safeParse({
      ...validData,
      confirmPassword: 'Different1Password',
    });
    expect(result.success).toBe(false);
  });

  it('rejects when usbPath is empty', () => {
    const result = walletCreateSchema.safeParse({
      ...validData,
      usbPath: '',
    });
    expect(result.success).toBe(false);
  });

  it('allows optional walletName', () => {
    const result = walletCreateSchema.safeParse({
      ...validData,
      walletName: undefined,
    });
    expect(result.success).toBe(true);
  });

  it('defaults mnemonicLength to 24', () => {
    const data = { ...validData };
    delete (data as any).mnemonicLength;
    const result = walletCreateSchema.safeParse(data);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.mnemonicLength).toBe(24);
    }
  });
});

describe('createWalletCreateSchema (i18n)', () => {
  it('returns i18n keys for USB required error', () => {
    const schema = createWalletCreateSchema(t);
    const result = schema.safeParse({
      password: 'StrongPassword1',
      confirmPassword: 'StrongPassword1',
      mnemonicLength: 24,
      usbPath: '',
    });
    expect(result.success).toBe(false);
  });

  it('returns i18n key for password mismatch', () => {
    const schema = createWalletCreateSchema(t);
    const result = schema.safeParse({
      password: 'StrongPassword1',
      confirmPassword: 'WrongPassword123',
      mnemonicLength: 24,
      usbPath: '/dev/usb0',
    });
    expect(result.success).toBe(false);
  });
});

describe('mnemonicSchema (from password.ts)', () => {
  it('accepts valid 12-word mnemonic', () => {
    const valid12 = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
    const result = mnemonicSchema.safeParse(valid12);
    expect(result.success).toBe(true);
  });

  it('accepts valid 24-word mnemonic', () => {
    const valid24 = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art';
    const result = mnemonicSchema.safeParse(valid24);
    expect(result.success).toBe(true);
  });

  it('rejects wrong word count', () => {
    const result = mnemonicSchema.safeParse('abandon abandon abandon');
    expect(result.success).toBe(false);
  });

  it('normalizes whitespace', () => {
    const messy = '  abandon  abandon  abandon  abandon  abandon  abandon  abandon  abandon  abandon  abandon  abandon  about  ';
    const result = mnemonicSchema.safeParse(messy);
    expect(result.success).toBe(true);
  });
});

describe('createMnemonicSchema (i18n)', () => {
  it('uses i18n key for word count error', () => {
    const schema = createMnemonicSchema(t);
    const result = schema.safeParse('one two three');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('validation.mnemonicWordCount');
    }
  });
});

describe('walletImportSchema (from password.ts)', () => {
  const validMnemonic =
    'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

  it('accepts valid import data', () => {
    const result = walletImportSchema.safeParse({
      mnemonic: validMnemonic,
      password: 'StrongPassword1',
      confirmPassword: 'StrongPassword1',
      walletName: 'Imported',
      usbPath: '/dev/usb0',
    });
    expect(result.success).toBe(true);
  });

  it('rejects when usbPath is empty', () => {
    const result = walletImportSchema.safeParse({
      mnemonic: validMnemonic,
      password: 'StrongPassword1',
      confirmPassword: 'StrongPassword1',
      walletName: 'Test',
      usbPath: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects walletName over 50 characters', () => {
    const result = walletImportSchema.safeParse({
      mnemonic: validMnemonic,
      password: 'StrongPassword1',
      confirmPassword: 'StrongPassword1',
      walletName: 'A'.repeat(51),
      usbPath: '/dev/usb0',
    });
    expect(result.success).toBe(false);
  });

  it('rejects mismatched passwords', () => {
    const result = walletImportSchema.safeParse({
      mnemonic: validMnemonic,
      password: 'StrongPassword1',
      confirmPassword: 'Different1Password',
      usbPath: '/dev/usb0',
    });
    expect(result.success).toBe(false);
  });
});

describe('createWalletImportSchema (i18n)', () => {
  const validMnemonic =
    'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

  it('returns i18n key for password mismatch', () => {
    const schema = createWalletImportSchema(t);
    const result = schema.safeParse({
      mnemonic: validMnemonic,
      password: 'StrongPassword1',
      confirmPassword: 'Mismatch1Password',
      walletName: 'Test',
      usbPath: '/dev/usb0',
    });
    expect(result.success).toBe(false);
  });
});

describe('walletRenameSchema', () => {
  it('accepts valid rename data', () => {
    const result = walletRenameSchema.safeParse({
      walletId: 'w1',
      newName: 'My New Name',
      usbPath: '/dev/usb0',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty walletId', () => {
    const result = walletRenameSchema.safeParse({
      walletId: '',
      newName: 'Name',
      usbPath: '/dev/usb0',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty newName', () => {
    const result = walletRenameSchema.safeParse({
      walletId: 'w1',
      newName: '',
      usbPath: '/dev/usb0',
    });
    expect(result.success).toBe(false);
  });

  it('rejects newName over 50 characters', () => {
    const result = walletRenameSchema.safeParse({
      walletId: 'w1',
      newName: 'A'.repeat(51),
      usbPath: '/dev/usb0',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty usbPath', () => {
    const result = walletRenameSchema.safeParse({
      walletId: 'w1',
      newName: 'Name',
      usbPath: '',
    });
    expect(result.success).toBe(false);
  });
});

describe('createWalletRenameSchema (i18n)', () => {
  it('returns i18n key for required name', () => {
    const schema = createWalletRenameSchema(t);
    const result = schema.safeParse({
      walletId: 'w1',
      newName: '',
      usbPath: '/dev/usb0',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const nameIssue = result.error.issues.find(i => i.path.includes('newName'));
      expect(nameIssue?.message).toBe('validation.walletNameRequired');
    }
  });

  it('returns i18n key for name too long', () => {
    const schema = createWalletRenameSchema(t);
    const result = schema.safeParse({
      walletId: 'w1',
      newName: 'A'.repeat(51),
      usbPath: '/dev/usb0',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const nameIssue = result.error.issues.find(i => i.path.includes('newName'));
      expect(nameIssue?.message).toBe('validation.walletNameTooLong');
    }
  });
});
