/**
 * ExportBackup component
 * Exports a wallet as an encrypted .arcsign backup file
 * No password needed — mnemonic.enc inside is already AES-256-GCM encrypted
 */

import React, { useState } from 'react';
import styles from "./ExportBackup.module.css";
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
    <div className={styles.exportBackupOverlay}>
      <div className={styles.exportBackupDialog}>
        <h2>{t('backup.exportTitle')}</h2>
        <p className={styles.exportBackupDesc}>{t('backup.exportDescription')}</p>

        <div className={styles.exportBackupWalletInfo}>
          <span className={styles.exportBackupWalletIcon}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M22 10H18a2 2 0 000 4h4"/></svg>
          </span>
          <span className={styles.exportBackupWalletName}>{walletName}</span>
        </div>

        {error && (
          <div className={styles.exportBackupError}>{error}</div>
        )}

        {success && (
          <div className={styles.exportBackupSuccess}>{t('backup.exportSuccess')}</div>
        )}

        <div className={styles.exportBackupActions}>
          <button
            className={styles.exportBackupCancel}
            onClick={onCancel}
            disabled={isExporting}
          >
            {t('common.cancel', 'Cancel')}
          </button>
          {!success && (
            <button
              className={styles.exportBackupConfirm}
              onClick={handleExport}
              disabled={isExporting}
            >
              {isExporting ? t('backup.exporting') : t('backup.exportTitle')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
