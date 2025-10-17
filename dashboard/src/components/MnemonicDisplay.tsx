/**
 * Secure mnemonic display component
 * Feature: User Dashboard for Wallet Management
 * Tasks: T036, T037, T038, T041 - Mnemonic display with countdown, screenshot protection, and memory clearing
 * Generated: 2025-10-17
 */

import { useState, useEffect, useRef } from 'react';
import tauriApi from '@/services/tauri-api';

interface MnemonicDisplayProps {
  mnemonic: string;
  onConfirm: () => void;
}

export function MnemonicDisplay({ mnemonic, onConfirm }: MnemonicDisplayProps) {
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
      <h2>Backup Your Mnemonic Phrase</h2>

      {/* Security Warning */}
      <div className="warning-message">
        <strong>⚠️ IMPORTANT - Read Carefully:</strong>
        <ul>
          <li>Write down these words in order on paper</li>
          <li>Store the paper in a secure location</li>
          <li>Never share your mnemonic with anyone</li>
          <li>You cannot recover your wallet without this mnemonic</li>
          <li>Screenshot protection is enabled - this window cannot be captured</li>
        </ul>
      </div>

      {/* Countdown Timer */}
      <div className="countdown">
        <p>
          This screen will close automatically in{' '}
          <strong>{timeRemaining} seconds</strong>
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
          {copied ? '✓ Copied!' : 'Copy to Clipboard'}
        </button>
        <small className="warning">
          Warning: Clipboard will be cleared after 30 seconds for security
        </small>
      </div>

      {/* Confirmation Checklist */}
      <div className="confirmation-checklist">
        <p>Before continuing, confirm that you have:</p>
        <ul>
          <li>✓ Written down all {mnemonicWords.length} words in order</li>
          <li>✓ Stored the backup in a secure location</li>
          <li>✓ Verified the spelling of each word</li>
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
          ? 'I Have Backed Up My Mnemonic'
          : `Wait ${5 - Math.floor((Date.now() - Date.now()) / 1000)} seconds...`}
      </button>

      {!canConfirm && (
        <small className="button-disabled-notice">
          Button will be enabled in 5 seconds to prevent accidental clicks
        </small>
      )}
    </div>
  );
}
