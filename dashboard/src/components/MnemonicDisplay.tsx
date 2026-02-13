/**
 * Secure mnemonic display component
 * Feature: User Dashboard for Wallet Management
 * Tasks: T036, T037, T038, T041 - Mnemonic display with countdown, screenshot protection, and memory clearing
 * Generated: 2025-10-17
 */

import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import tauriApi from '@/services/tauri-api';

interface MnemonicDisplayProps {
  mnemonic: string;
  onConfirm: () => void;
}

export function MnemonicDisplay({ mnemonic, onConfirm }: MnemonicDisplayProps) {
  const { t } = useTranslation();
  const [timeRemaining, setTimeRemaining] = useState(30);
  const [canConfirm, setCanConfirm] = useState(false);
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const confirmDelayRef = useRef<NodeJS.Timeout | null>(null);

  // Enable screenshot protection on mount
  useEffect(() => {
    const enableProtection = async () => {
      try {
        await tauriApi.enableScreenshotProtection();
      } catch (err) {
        console.warn('Screenshot protection not available on this platform');
      }
    };

    enableProtection();

    // Disable screenshot protection on unmount
    return () => {
      tauriApi.disableScreenshotProtection().catch((err) => {
        console.warn('Failed to disable screenshot protection:', err);
      });
    };
  }, []);

  // Clear sensitive memory on unmount
  useEffect(() => {
    return () => {
      tauriApi.clearSensitiveMemory().catch((err) => {
        console.warn('Failed to clear sensitive memory:', err);
      });
    };
  }, []);

  // Countdown timer (30 seconds)
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          // Auto-close after 30 seconds
          handleConfirm();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  // Enable confirm button after 5 seconds (prevent accidental clicks)
  useEffect(() => {
    confirmDelayRef.current = setTimeout(() => {
      setCanConfirm(true);
    }, 5000);

    return () => {
      if (confirmDelayRef.current) {
        clearTimeout(confirmDelayRef.current);
      }
    };
  }, []);

  const handleConfirm = async () => {
    // Clear sensitive memory
    try {
      await tauriApi.clearSensitiveMemory();
    } catch (err) {
      console.warn('Failed to clear memory:', err);
    }

    // Call parent confirm handler
    onConfirm();
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(mnemonic);
      setCopied(true);

      // Reset copied state after 2 seconds
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  const mnemonicWords = mnemonic.split(' ');

  return (
    <div className="mnemonic-display">
      <h2>{t('mnemonicBackup.title')}</h2>

      {/* Security Warning */}
      <div className="warning-message">
        <strong><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> {t('mnemonicBackup.importantWarning')}</strong>
        <ul>
          <li>{t('mnemonicBackup.writeDown')}</li>
          <li>{t('mnemonicBackup.storeSecurely')}</li>
          <li>{t('mnemonic.neverShare')}</li>
          <li>{t('mnemonic.cannotRecover')}</li>
          <li>{t('mnemonicBackup.screenshotProtection')}</li>
        </ul>
      </div>

      {/* Countdown Timer */}
      <div className="countdown">
        <p>
          {t('mnemonicBackup.autoCloseIn')}{' '}
          <strong>{timeRemaining} {t('mnemonicBackup.secondsUnit')}</strong>
        </p>
      </div>

      {/* Mnemonic Words Grid */}
      <div className="mnemonic-grid">
        {mnemonicWords.map((word, index) => (
          <div key={index} className="mnemonic-word">
            <span className="word-number">{index + 1}</span>
            <span className="word-text">{word}</span>
          </div>
        ))}
      </div>

      {/* Copy Button */}
      <div className="copy-section">
        <button onClick={handleCopy} type="button" className="copy-button">
          {copied ? t('mnemonicBackup.copied') : t('mnemonicBackup.copyToClipboard')}
        </button>
        <small className="warning">
          {t('mnemonicBackup.clipboardWarning')}
        </small>
      </div>

      {/* Confirmation Checklist */}
      <div className="confirmation-checklist">
        <p>{t('mnemonicBackup.beforeContinuing')}</p>
        <ul>
          <li>✓ {t('mnemonicBackup.writtenAllWords', { count: mnemonicWords.length })}</li>
          <li>✓ {t('mnemonicBackup.storedBackup')}</li>
          <li>✓ {t('mnemonicBackup.verifiedSpelling')}</li>
        </ul>
      </div>

      {/* Confirm Button */}
      <button
        onClick={handleConfirm}
        disabled={!canConfirm}
        className="confirm-button"
        type="button"
      >
        {canConfirm
          ? t('mnemonicBackup.confirmBackedUp')
          : t('mnemonicBackup.waitSeconds')}
      </button>

      {!canConfirm && (
        <small className="button-disabled-notice">
          {t('mnemonicBackup.buttonEnableNotice')}
        </small>
      )}
    </div>
  );
}
