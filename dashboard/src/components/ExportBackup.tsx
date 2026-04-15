/**
 * ExportBackup component
 * Exports a wallet as an encrypted .arcsign backup file
 * No password needed — mnemonic.enc inside is already AES-256-GCM encrypted
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { save } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';
import tauriApi from '@/services/tauri-api';

interface ExportBackupProps {
  walletId: string;
  walletName: string;
  usbPath: string;
  onSuccess?: () => void;
  onCancel: () => void;
}

export const ExportBackup: React.FC<ExportBackupProps> = ({
  walletId,
  walletName,
  usbPath,
  onSuccess,
  onCancel,
}) => {
  const { t } = useTranslation();
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    setError(null);

    try {
      // 1. Get backup data from backend
      const result = await tauriApi.exportBackup({
        wallet_id: walletId,
        usb_path: usbPath,
      });

      // 2. Open save dialog
      const filePath = await save({
        defaultPath: `${walletName || 'wallet'}.arcsign`,
        filters: [{ name: 'ArcSign Backup', extensions: ['arcsign'] }],
      });

      if (!filePath) {
        // User cancelled the dialog
        setIsExporting(false);
        return;
      }

      // 3. Decode base64 and write to file
      const binaryData = Uint8Array.from(atob(result.backupData), c => c.charCodeAt(0));
      await writeFile(filePath, binaryData);

      setSuccess(true);
      onSuccess?.();
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message :
        (err as { message?: string })?.message || String(err);
      setError(errMsg);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="export-backup-overlay">
      <div className="export-backup-dialog">
        <h2>{t('backup.exportTitle')}</h2>
        <p className="export-backup-desc">{t('backup.exportDescription')}</p>

        <div className="export-backup-wallet-info">
          <span className="export-backup-wallet-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M22 10H18a2 2 0 000 4h4"/></svg>
          </span>
          <span className="export-backup-wallet-name">{walletName}</span>
        </div>

        {error && (
          <div className="export-backup-error">{error}</div>
        )}

        {success && (
          <div className="export-backup-success">{t('backup.exportSuccess')}</div>
        )}

        <div className="export-backup-actions">
          <button
            className="export-backup-cancel"
            onClick={onCancel}
            disabled={isExporting}
          >
            {t('common.cancel', 'Cancel')}
          </button>
          {!success && (
            <button
              className="export-backup-confirm"
              onClick={handleExport}
              disabled={isExporting}
            >
              {isExporting ? t('backup.exporting') : t('backup.exportTitle')}
            </button>
          )}
        </div>
      </div>

      <style>{`
        .export-backup-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .export-backup-dialog {
          background: white;
          border-radius: 16px;
          padding: 32px;
          max-width: 420px;
          width: 90%;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
        }

        .export-backup-dialog h2 {
          margin: 0 0 8px;
          font-size: 20px;
          font-weight: 600;
          color: #111827;
        }

        .export-backup-desc {
          margin: 0 0 24px;
          font-size: 14px;
          color: #6b7280;
        }

        .export-backup-wallet-info {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px;
          background: #f9fafb;
          border-radius: 12px;
          margin-bottom: 24px;
        }

        .export-backup-wallet-icon {
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #e0f2f1;
          border-radius: 10px;
          color: #0d9488;
        }

        .export-backup-wallet-name {
          font-size: 16px;
          font-weight: 600;
          color: #111827;
        }

        .export-backup-error {
          padding: 12px 16px;
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 8px;
          color: #dc2626;
          font-size: 14px;
          margin-bottom: 16px;
        }

        .export-backup-success {
          padding: 12px 16px;
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
          border-radius: 8px;
          color: #16a34a;
          font-size: 14px;
          margin-bottom: 16px;
        }

        .export-backup-actions {
          display: flex;
          gap: 12px;
          justify-content: flex-end;
        }

        .export-backup-cancel {
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

        .export-backup-cancel:hover {
          border-color: #9ca3af;
          color: #374151;
        }

        .export-backup-confirm {
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

        .export-backup-confirm:hover {
          background: #0f766e;
        }

        .export-backup-confirm:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
};
