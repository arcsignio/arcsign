/**
 * Password and mnemonic validation schemas
 * Feature: User Dashboard for Wallet Management
 * Task: T033 - Create password validation schema with Zod
 * Generated: 2025-10-17
 */

import { z } from 'zod';

/**
 * Password validation schema
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
 * Wallet creation form schema
 */
export const walletCreateSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string(),
    walletName: z
      .string()
      .trim()
      .min(1, 'Wallet name is required')
      .max(50, 'Wallet name must be 50 characters or less')
      .optional(),
    passphrase: z.string().optional(),
    mnemonicLength: z.union([z.literal(12), z.literal(24)]).default(24),
    usbPath: z.string().min(1, 'USB drive is required'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export type WalletCreateFormData = z.infer<typeof walletCreateSchema>;

/**
 * Mnemonic validation schema
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
 * Wallet import form schema
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
 * Wallet rename schema
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
