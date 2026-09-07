/**
 * ExportAllBackups component (Pro feature)
 * Exports all wallets as an encrypted .arcsign-bundle file
 * Password required for outer AES-256-GCM encryption layer
 */

import React, { useState } from 'react';
import styles from "./ExportAllBackups.module.css";
import { useTranslation } from 'react-i18next';
import { save } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';
import tauriApi from '@/services/tauri-api';
import { PasswordInput } from '@/components/PasswordInput';

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
      await writeFile(filePath, binaryData);

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
    <div className={styles.exportAllOverlay}>
      <div className={styles.exportAllDialog}>
        <h2>{t('backup.exportAllTitle')}</h2>
        <p className={styles.exportAllDesc}>{t('backup.exportAllDescription')}</p>

        <div className={styles.exportAllInfo}>
          <span className={styles.exportAllInfoIcon}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M22 10H18a2 2 0 000 4h4"/></svg>
          </span>
          <span className={styles.exportAllInfoText}>
            {walletCount} {t('wallet.wallets', 'wallets')}
          </span>
        </div>

        {/* Password input */}
        <div className={styles.exportAllField}>
          <label>{t('backup.enterPassword')}</label>
          <PasswordInput
            className={styles.exportAllInput}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t('backup.enterPassword')}
            disabled={isExporting || success}
          />
        </div>

        {error && (
          <div className={styles.exportAllError}>{error}</div>
        )}

        {success && (
          <div className={styles.exportAllSuccess}>{t('backup.exportAllSuccess')}</div>
        )}

        <div className={styles.exportAllActions}>
          <button
            className={styles.exportAllCancel}
            onClick={onCancel}
            disabled={isExporting}
          >
            {success ? t('common.close', 'Close') : t('common.cancel', 'Cancel')}
          </button>
          {!success && (
            <button
              className={styles.exportAllConfirm}
              onClick={handleExport}
              disabled={isExporting || !password}
            >
              {isExporting ? t('backup.exportingAll') : t('backup.exportAllConfirm')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
