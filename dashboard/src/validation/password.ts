/**
 * Password and mnemonic validation schemas
 * Feature: User Dashboard for Wallet Management
 * Task: T033 - Create password validation schema with Zod
 * Generated: 2025-10-17
 * Updated: 2025-01-09 - Added i18n support for validation messages
 */

import { z } from 'zod';

/**
 * Type for translation function
 */
type TFunction = (key: string, options?: Record<string, unknown>) => string;

/**
 * Create password validation schema with i18n support
 * Requirements: 12+ chars, uppercase, lowercase, number
 */
export const createPasswordSchema = (t: TFunction) =>
  z
    .string()
    .trim()
    .min(12, t('validation.passwordMinLength'))
    .regex(/[A-Z]/, t('validation.passwordUppercase'))
    .regex(/[a-z]/, t('validation.passwordLowercase'))
    .regex(/[0-9]/, t('validation.passwordNumber'));

/**
 * Default password validation schema (English fallback)
 * Requirements: 12+ chars, uppercase, lowercase, number
 */
export const passwordSchema = z
  .string()
  .trim()
  .min(12, 'Password must be at least 12 characters long')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

/**
 * Create wallet creation form schema with i18n support
 */
export const createWalletCreateSchema = (t: TFunction) =>
  z
    .object({
      password: createPasswordSchema(t),
      confirmPassword: z.string(),
      walletName: z.string().optional(),
      passphrase: z.string().optional(),
      mnemonicLength: z.coerce.number().int().default(24),
      usbPath: z.string().min(1, t('validation.usbRequired')),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: t('validation.passwordsNotMatch'),
      path: ['confirmPassword'],
    });

/**
 * Default wallet creation form schema (English fallback)
 */
export const walletCreateSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string(),
    walletName: z.string().optional(),
    passphrase: z.string().optional(),
    mnemonicLength: z.coerce.number().int().default(24),
    usbPath: z.string().min(1, 'USB drive is required'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export type WalletCreateFormData = z.infer<typeof walletCreateSchema>;

/**
 * Create mnemonic validation schema with i18n support
 * Requirements: 12 or 24 words, space-separated
 */
export const createMnemonicSchema = (t: TFunction) =>
  z
    .string()
    .trim()
    .transform((val) => {
      // Normalize whitespace
      return val.split(/\s+/).join(' ').toLowerCase();
    })
    .refine(
      (val) => {
        const words = val.split(' ');
        return words.length === 12 || words.length === 24;
      },
      {
        message: t('validation.mnemonicWordCount'),
      }
    );

/**
 * Default mnemonic validation schema (English fallback)
 * Requirements: 12 or 24 words, space-separated
 */
export const mnemonicSchema = z
  .string()
  .trim()
  .transform((val) => {
    // Normalize whitespace
    return val.split(/\s+/).join(' ').toLowerCase();
  })
  .refine(
    (val) => {
      const words = val.split(' ');
      return words.length === 12 || words.length === 24;
    },
    {
      message: 'Mnemonic must be 12 or 24 words',
    }
  );

/**
 * Create wallet import form schema with i18n support
 */
export const createWalletImportSchema = (t: TFunction) =>
  z.object({
    mnemonic: createMnemonicSchema(t),
    password: createPasswordSchema(t),
    confirmPassword: z.string(),
    walletName: z
      .string()
      .trim()
      .max(50, t('validation.walletNameTooLong'))
      .optional(),
    passphrase: z.string().optional(),
    usbPath: z.string().min(1, t('validation.usbRequired')),
  }).refine((data) => data.password === data.confirmPassword, {
    message: t('validation.passwordsNotMatch'),
    path: ['confirmPassword'],
  });

/**
 * Default wallet import form schema (English fallback)
 */
export const walletImportSchema = z.object({
  mnemonic: mnemonicSchema,
  password: passwordSchema,
  confirmPassword: z.string(),
  walletName: z
    .string()
    .trim()
    .max(50, 'Wallet name must be 50 characters or less')
    .optional(),
  passphrase: z.string().optional(),
  usbPath: z.string().min(1, 'USB drive is required'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export type WalletImportFormData = z.infer<typeof walletImportSchema>;

/**
 * Create wallet rename schema with i18n support
 */
export const createWalletRenameSchema = (t: TFunction) =>
  z.object({
    walletId: z.string().min(1),
    newName: z
      .string()
      .trim()
      .min(1, t('validation.walletNameRequired'))
      .max(50, t('validation.walletNameTooLong')),
    usbPath: z.string().min(1),
  });

/**
 * Default wallet rename schema (English fallback)
 */
export const walletRenameSchema = z.object({
  walletId: z.string().min(1),
  newName: z
    .string()
    .trim()
    .min(1, 'Wallet name is required')
    .max(50, 'Wallet name must be 50 characters or less'),
  usbPath: z.string().min(1),
});

export type WalletRenameFormData = z.infer<typeof walletRenameSchema>;
