/**
 * Mnemonic validation schemas
 * Feature: User Dashboard for Wallet Management
 * Task: T069 - Create mnemonic validation schema with Zod
 * Generated: 2025-10-17
 * Updated: 2025-01-09 - Added i18n support for validation messages
 * Updated: 2025-01-12 - Implemented BIP39 checksum validation
 */

import { z } from "zod";
import { createPasswordSchema, passwordSchema } from "./password";
import * as bip39 from "bip39";

/**
 * Type for translation function
 */
type TFunction = (key: string, options?: Record<string, unknown>) => string;

/**
 * Normalize mnemonic whitespace (FR-030)
 */
export function normalizeMnemonic(mnemonic: string): string {
  return mnemonic.trim().toLowerCase().split(/\s+/).join(" ");
}

/**
 * Validate mnemonic word count (12 or 24 words)
 */
function validateMnemonicLength(mnemonic: string): boolean {
  const normalized = normalizeMnemonic(mnemonic);
  const wordCount = normalized.split(" ").length;
  return wordCount === 12 || wordCount === 24;
}

/**
 * Get BIP39 wordlist (complete 2048 words)
 */
export function getBIP39Wordlist(): string[] {
  return bip39.wordlists.english;
}

/**
 * Validate that all words are from BIP39 wordlist
 * Uses the official BIP39 wordlist for validation
 */
function validateMnemonicWords(mnemonic: string): boolean {
  const normalized = normalizeMnemonic(mnemonic);
  const words = normalized.split(" ");
  const wordlist = getBIP39Wordlist();

  // Check that all words are in the BIP39 wordlist
  return words.every((word) => wordlist.includes(word));
}

/**
 * Create mnemonic schema with i18n support
 * Requirements: FR-006 (BIP39 import), FR-029 (validation), FR-030 (normalization)
 * Includes full BIP39 checksum validation
 */
export const createMnemonicSchema = (t: TFunction) =>
  z
    .string()
    .trim()
    .min(1, t("validation.mnemonicRequired"))
    .transform(normalizeMnemonic)
    .refine(validateMnemonicLength, {
      message: t("validation.mnemonicWordCount"),
    })
    .refine(validateMnemonicWords, {
      message: t("validation.mnemonicInvalidWords"),
    })
    .refine(validateMnemonicChecksum, {
      message: t("validation.mnemonicInvalidChecksum"),
    });

/**
 * Default mnemonic schema (English fallback)
 * Requirements: FR-006 (BIP39 import), FR-029 (validation), FR-030 (normalization)
 * Includes full BIP39 checksum validation
 */
export const mnemonicSchema = z
  .string()
  .trim()
  .min(1, "Mnemonic phrase is required")
  .transform(normalizeMnemonic)
  .refine(validateMnemonicLength, {
    message: "Mnemonic must be 12 or 24 words",
  })
  .refine(validateMnemonicWords, {
    message: "Mnemonic contains invalid words. Please check your phrase.",
  })
  .refine(validateMnemonicChecksum, {
    message: "Invalid mnemonic checksum. Please verify your recovery phrase.",
  });

/**
 * Create wallet import form schema with i18n support
 * Requirements: FR-006, FR-007 (passphrase), FR-029, FR-030
 */
export const createWalletImportSchema = (t: TFunction) =>
  z
    .object({
      mnemonic: createMnemonicSchema(t),
      password: createPasswordSchema(t),
      confirmPassword: z.string(),
      usePassphrase: z.boolean().default(false),
      passphrase: z.string().optional(),
      name: z
        .string()
        .trim()
        .min(1, t("validation.walletNameRequired"))
        .max(50, t("validation.walletNameTooLong")),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: t("validation.passwordsNotMatch"),
      path: ["confirmPassword"],
    })
    .refine(
      (data) => {
        // If passphrase is enabled, it must not be empty
        if (
          data.usePassphrase &&
          (!data.passphrase || data.passphrase.trim() === "")
        ) {
          return false;
        }
        return true;
      },
      {
        message: t("validation.passphraseCannotBeEmpty"),
        path: ["passphrase"],
      }
    );

/**
 * Default wallet import form schema (English fallback)
 * Requirements: FR-006, FR-007 (passphrase), FR-029, FR-030
 */
export const walletImportSchema = z
  .object({
    mnemonic: mnemonicSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
    usePassphrase: z.boolean().default(false),
    passphrase: z.string().optional(),
    name: z
      .string()
      .trim()
      .min(1, "Wallet name is required")
      .max(50, "Wallet name must be 50 characters or less"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })
  .refine(
    (data) => {
      // If passphrase is enabled, it must not be empty
      if (
        data.usePassphrase &&
        (!data.passphrase || data.passphrase.trim() === "")
      ) {
        return false;
      }
      return true;
    },
    {
      message: "BIP39 passphrase cannot be empty when enabled",
      path: ["passphrase"],
    }
  );

/**
 * Type inference for wallet import form
 */
export type WalletImportFormData = z.infer<typeof walletImportSchema>;

/**
 * Validate mnemonic checksum using BIP39 standard
 * This performs full BIP39 validation including checksum verification
 */
export function validateMnemonicChecksum(mnemonic: string): boolean {
  const normalized = normalizeMnemonic(mnemonic);

  // Use bip39 library for complete validation (wordlist + checksum)
  return bip39.validateMnemonic(normalized);
}

/**
 * Get mnemonic validation error message with i18n support (FR-029)
 */
export function getMnemonicValidationError(mnemonic: string, t?: TFunction): string | null {
  const normalized = normalizeMnemonic(mnemonic);

  if (!normalized) {
    return t ? t("validation.mnemonicRequired") : "Mnemonic phrase is required";
  }

  if (!validateMnemonicLength(normalized)) {
    const wordCount = normalized.split(" ").length;
    return t
      ? t("validation.mnemonicWordCountError", { count: wordCount })
      : `Mnemonic must be 12 or 24 words (you entered ${wordCount} words)`;
  }

  if (!validateMnemonicWords(normalized)) {
    return t
      ? t("validation.mnemonicInvalidWords")
      : "Mnemonic contains invalid words. Please check your phrase.";
  }

  if (!validateMnemonicChecksum(normalized)) {
    return t
      ? t("validation.mnemonicInvalidChecksum")
      : "Invalid mnemonic checksum. Please verify your recovery phrase.";
  }

  return null;
}
