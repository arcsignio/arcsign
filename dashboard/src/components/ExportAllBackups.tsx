/**
 * ExportAllBackups component (Pro feature)
 * Exports all wallets as an encrypted .arcsign-bundle file
 * Password required for outer AES-256-GCM encryption layer
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { save } from '@tauri-apps/api/dialog';
import { writeBinaryFile } from '@tauri-apps/api/fs';
import tauriApi from '@/services/tauri-api';

interface ExportAllBackupsProps {
  usbPath: string;
  walletCount: number;
  onSuccess?: () => void;
  onCancel: () => void;
}

export const ExportAllBackups: React.FC<ExportAllBackupsProps> = ({
  usbPath,
  walletCount,
  onSuccess,
  onCancel,
}) => {
  const { t } = useTranslation();
  const [password, setPassword] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleExport = async () => {
    if (!password) return;

    setIsExporting(true);
    setError(null);

    try {
      // 1. Export bundle from backend
      const result = await tauriApi.exportAllBackups({
        password,
        usb_path: usbPath,
      });

      // Clear password from state
      setPassword('');

      // 2. Open save dialog
      const filePath = await save({
        defaultPath: `arcsign-all-wallets.arcsign-bundle`,
        filters: [{ name: 'ArcSign Bundle', extensions: ['arcsign-bundle'] }],
      });

      if (!filePath) {
        setIsExporting(false);
        return;
      }

      // 3. Decode base64 and write to file
      const bundleData = result.data?.bundleData || (result as any).bundleData;
      const binaryData = Uint8Array.from(atob(bundleData), c => c.charCodeAt(0));
      await writeBinaryFile(filePath, binaryData);

      setSuccess(true);
      onSuccess?.();
    } catch (err: unknown) {
      const errObj = err as { code?: string; message?: string };
      if (errObj.code === 'INVALID_PASSWORD' || errObj.code === 'FfiInvalidPassword') {
        setError(t('backup.wrongPassword'));
      } else {
        setError(errObj.message || String(err));
      }
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="export-all-overlay">
      <div className="export-all-dialog">
        <h2>{t('backup.exportAllTitle')}</h2>
        <p className="export-all-desc">{t('backup.exportAllDescription')}</p>

        <div className="export-all-info">
          <span className="export-all-info-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M22 10H18a2 2 0 000 4h4"/></svg>
          </span>
          <span className="export-all-info-text">
            {walletCount} {t('wallet.wallets', 'wallets')}
          </span>
        </div>

        {/* Password input */}
        <div className="export-all-field">
          <label>{t('backup.enterPassword')}</label>
          <input
            type="password"
            className="export-all-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t('backup.enterPassword')}
            disabled={isExporting || success}
          />
        </div>

        {error && (
          <div className="export-all-error">{error}</div>
        )}

        {success && (
          <div className="export-all-success">{t('backup.exportAllSuccess')}</div>
        )}

        <div className="export-all-actions">
          <button
            className="export-all-cancel"
            onClick={onCancel}
            disabled={isExporting}
          >
            {success ? t('common.close', 'Close') : t('common.cancel', 'Cancel')}
          </button>
          {!success && (
            <button
              className="export-all-confirm"
              onClick={handleExport}
              disabled={isExporting || !password}
            >
              {isExporting ? t('backup.exportingAll') : t('backup.exportAllConfirm')}
            </button>
          )}
        </div>
      </div>

      <style>{`
        .export-all-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .export-all-dialog {
          background: white;
          border-radius: 16px;
          padding: 32px;
          max-width: 420px;
          width: 90%;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
        }

        .export-all-dialog h2 {
          margin: 0 0 8px;
          font-size: 20px;
          font-weight: 600;
          color: #111827;
        }

        .export-all-desc {
          margin: 0 0 24px;
          font-size: 14px;
          color: #6b7280;
        }

        .export-all-info {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px;
          background: #f9fafb;
          border-radius: 12px;
          margin-bottom: 20px;
        }

        .export-all-info-icon {
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #e0f2f1;
          border-radius: 10px;
          color: #0d9488;
        }

        .export-all-info-text {
          font-size: 16px;
          font-weight: 600;
          color: #111827;
        }

        .export-all-field {
          display: flex;
          flex-direction: column;
          gap: 6px;
          margin-bottom: 20px;
        }

        .export-all-field label {
          font-size: 14px;
          font-weight: 500;
          color: #374151;
        }

        .export-all-input {
          padding: 12px 16px;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          font-size: 14px;
          color: #111827;
          outline: none;
          transition: border-color 0.2s;
        }

        .export-all-input:focus {
          border-color: #2dd4bf;
          box-shadow: 0 0 0 3px rgba(45, 212, 191, 0.1);
        }

        .export-all-error {
          padding: 12px 16px;
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 8px;
          color: #dc2626;
          font-size: 14px;
          margin-bottom: 16px;
        }

        .export-all-success {
          padding: 12px 16px;
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
          border-radius: 8px;
          color: #16a34a;
          font-size: 14px;
          margin-bottom: 16px;
        }

        .export-all-actions {
          display: flex;
          gap: 12px;
          justify-content: flex-end;
        }

        .export-all-cancel {
          padding: 10px 20px;
          background: transparent;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          color: #6b7280;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .export-all-cancel:hover {
          border-color: #9ca3af;
          color: #374151;
        }

        .export-all-confirm {
          padding: 10px 24px;
          background: #0d9488;
          border: none;
          border-radius: 8px;
          color: white;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .export-all-confirm:hover {
          background: #0f766e;
        }

        .export-all-confirm:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
};
