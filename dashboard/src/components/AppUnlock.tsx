/**
 * App-level authentication component
 * Feature: App-level password protection (方案 A)
 *
 * Handles:
 * - First-time setup: Create app password and initialize app_config.enc
 * - Unlock: Verify password and load app configuration
 */

import { useState, useEffect } from 'react';
import tauriApi, { type AppError, type AppConfig } from '@/services/tauri-api';
import { LoadingSpinner } from '@/components/LoadingSpinner';

interface AppUnlockProps {
  usbPath: string;
  onUnlockSuccess: (appConfig: AppConfig, password: string) => void;
}

export function AppUnlock({ usbPath, onUnlockSuccess }: AppUnlockProps) {
  const [isFirstTime, setIsFirstTime] = useState<boolean | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkingSetup, setCheckingSetup] = useState(true);

  // Check if this is first-time setup
  useEffect(() => {
    const checkFirstTime = async () => {
      setCheckingSetup(true);
      try {
        const result = await tauriApi.isFirstTimeSetup(usbPath);
        setIsFirstTime(result);
      } catch (err) {
        const error = err as AppError;
        setError(`Failed to check setup status: ${error.message}`);
      } finally {
        setCheckingSetup(false);
      }
    };

    checkFirstTime();
  }, [usbPath]);

  const handleInitialize = async () => {
    // Validate passwords match
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await tauriApi.initializeApp(password, usbPath);

      // After initialization, unlock with the same password
      const appConfig = await tauriApi.unlockApp(password, usbPath);
      onUnlockSuccess(appConfig, password);
    } catch (err) {
      const error = err as AppError;
      setError(`Failed to initialize app: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleUnlock = async () => {
    if (!password) {
      setError('Please enter your password');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const appConfig = await tauriApi.unlockApp(password, usbPath);
      onUnlockSuccess(appConfig, password);
    } catch (err) {
      const error = err as AppError;
      setError(`Failed to unlock: ${error.message}`);
      setPassword(''); // Clear password on failure
    } finally {
      setLoading(false);
    }
  };

  if (checkingSetup) {
    return (
      <div className="app-unlock">
        <div className="unlock-container">
          <LoadingSpinner size="lg" message="Checking setup status..." />
        </div>
      </div>
    );
  }

  return (
    <div className="app-unlock">
      <div className="unlock-container">
        <div className="unlock-header">
          <h1>🔐 ArcSign</h1>
          <p className="subtitle">Secure Cold Wallet Management</p>
        </div>

        {isFirstTime ? (
          // First-time setup
          <div className="setup-form">
            <h2>Welcome to ArcSign</h2>
            <p className="description">
              Create a master password to protect your wallet configuration and API settings.
              This password will be required each time you start the application.
            </p>

            <div className="security-note">
              <strong>Security Note:</strong>
              <ul>
                <li>This password encrypts your app configuration (app_config.enc)</li>
                <li>Your wallet mnemonics are separately encrypted with individual wallet passwords</li>
                <li>All data is stored on your USB drive using AES-256-GCM encryption</li>
              </ul>
            </div>

            {error && (
              <div className="alert alert-error">{error}</div>
            )}

            <div className="form-group">
              <label htmlFor="password">Master Password</label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter master password (min 8 characters)"
                disabled={loading}
                autoFocus
              />
            </div>

            <div className="form-group">
              <label htmlFor="confirm-password">Confirm Password</label>
              <input
                type="password"
                id="confirm-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && password && confirmPassword) {
                    handleInitialize();
                  }
                }}
                placeholder="Re-enter password"
                disabled={loading}
              />
            </div>

            <button
              onClick={handleInitialize}
              className="btn-primary btn-large"
              disabled={loading || !password || !confirmPassword}
            >
              {loading ? 'Initializing...' : 'Create Master Password'}
            </button>
          </div>
        ) : (
          // Unlock existing app
          <div className="unlock-form">
            <h2>Unlock ArcSign</h2>
            <p className="description">
              Enter your master password to access your wallets and settings.
            </p>

            {error && (
              <div className="alert alert-error">{error}</div>
            )}

            <div className="form-group">
              <label htmlFor="unlock-password">Master Password</label>
              <input
                type="password"
                id="unlock-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && password) {
                    handleUnlock();
                  }
                }}
                placeholder="Enter your master password"
                disabled={loading}
                autoFocus
              />
            </div>

            <button
              onClick={handleUnlock}
              className="btn-primary btn-large"
              disabled={loading || !password}
            >
              {loading ? 'Unlocking...' : 'Unlock'}
            </button>
          </div>
        )}

        <div className="usb-info">
          <small>USB Drive: {usbPath}</small>
        </div>
      </div>

      <style>{`
        .app-unlock {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          padding: 20px;
        }

        .unlock-container {
          width: 100%;
          max-width: 500px;
          background: white;
          border-radius: 16px;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
          padding: 40px;
        }

        .unlock-header {
          text-align: center;
          margin-bottom: 32px;
        }

        .unlock-header h1 {
          margin: 0;
          font-size: 36px;
          font-weight: 700;
          color: #1a1a1a;
        }

        .subtitle {
          margin: 8px 0 0;
          color: #666;
          font-size: 14px;
        }

        .setup-form h2,
        .unlock-form h2 {
          margin: 0 0 12px;
          font-size: 24px;
          font-weight: 600;
          color: #1a1a1a;
        }

        .description {
          margin-bottom: 24px;
          color: #666;
          line-height: 1.6;
          font-size: 14px;
        }

        .security-note {
          margin-bottom: 24px;
          padding: 16px;
          background: #f0f9ff;
          border-left: 4px solid #3b82f6;
          border-radius: 4px;
          font-size: 13px;
          line-height: 1.5;
        }

        .security-note strong {
          display: block;
          margin-bottom: 8px;
          color: #1e40af;
        }

        .security-note ul {
          margin: 0;
          padding-left: 20px;
          color: #1e40af;
        }

        .security-note li {
          margin-bottom: 4px;
        }

        .form-group {
          margin-bottom: 20px;
        }

        .form-group label {
          display: block;
          margin-bottom: 8px;
          font-weight: 500;
          color: #333;
          font-size: 14px;
        }

        .form-group input {
          width: 100%;
          padding: 12px 16px;
          border: 2px solid #e5e7eb;
          border-radius: 8px;
          font-size: 15px;
          transition: border-color 0.2s;
          box-sizing: border-box;
        }

        .form-group input:focus {
          outline: none;
          border-color: #3b82f6;
        }

        .form-group input:disabled {
          background-color: #f3f4f6;
          cursor: not-allowed;
        }

        .alert {
          padding: 12px 16px;
          border-radius: 8px;
          margin-bottom: 20px;
          font-size: 14px;
        }

        .alert-error {
          background-color: #fee2e2;
          color: #991b1b;
          border: 1px solid #fecaca;
        }

        .btn-primary {
          width: 100%;
          padding: 14px 24px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: transform 0.2s, box-shadow 0.2s;
        }

        .btn-primary:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
        }

        .btn-primary:active:not(:disabled) {
          transform: translateY(0);
        }

        .btn-primary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-large {
          padding: 16px 24px;
          font-size: 17px;
        }

        .usb-info {
          margin-top: 24px;
          text-align: center;
          color: #999;
          font-size: 12px;
        }
      `}</style>
    </div>
  );
}
