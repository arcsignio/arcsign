/**
 * ImportAllBackups component (Pro feature)
 * Restores all wallets from an encrypted .arcsign-bundle file
 * Password required to decrypt the outer layer
 */

import React, { useState } from 'react';
import styles from "./ImportAllBackups.module.css";
import { useTranslation } from 'react-i18next';
import { open } from '@tauri-apps/plugin-dialog';
import { readFile } from '@tauri-apps/plugin-fs';
import tauriApi from '@/services/tauri-api';
import { PasswordInput } from '@/components/PasswordInput';

interface ImportAllBackupsProps {
  usbPath: string;
  onSuccess: () => void;
  onBack: () => void;
}

export const ImportAllBackups: React.FC<ImportAllBackupsProps> = ({
  usbPath,
  onSuccess,
  onBack,
}) => {
  const { t } = useTranslation();
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileData, setFileData] = useState<string | null>(null); // base64
  const [password, setPassword] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSelectFile = async () => {
    try {
      const filePath = await open({
        filters: [{ name: 'ArcSign Bundle', extensions: ['arcsign-bundle'] }],
        multiple: false,
      });

      if (!filePath || Array.isArray(filePath)) return;

      setSelectedFile(filePath);
      setError(null);

      // Read file and encode as base64
      const bytes = await readFile(filePath);
      const binary = Array.from(bytes).map(b => String.fromCharCode(b)).join('');
      setFileData(btoa(binary));
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setError(errMsg);
    }
  };

  const handleImport = async () => {
    if (!fileData || !password) return;

    setIsImporting(true);
    setError(null);

    try {
      const result = await tauriApi.importAllBackups({
        bundle_data: fileData,
        password,
        usb_path: usbPath,
      });

      // Clear sensitive data
      setPassword('');
      setFileData(null);

      const count = result.data?.importedCount || (result as any).importedCount || 0;
      // Show success briefly then navigate
      alert(t('backup.importAllSuccess', { count }));
      onSuccess();
    } catch (err: unknown) {
      const errObj = err as { code?: string; message?: string };
      if (errObj.code === 'INVALID_PASSWORD' || errObj.code === 'FfiInvalidPassword') {
        setError(t('backup.wrongPassword'));
      } else if (errObj.code === 'BUNDLE_INVALID' || errObj.message?.includes('bundle')) {
        setError(t('backup.invalidBundle'));
      } else if (errObj.code === 'BUNDLE_CORRUPTED') {
        setError(t('backup.bundleCorrupted'));
      } else {
        setError(errObj.message || String(err));
      }
    } finally {
      setIsImporting(false);
    }
  };

  const fileName = selectedFile ? selectedFile.split('/').pop()?.split('\\').pop() : null;

  return (
    <div className={styles.importAllPage}>
      <button onClick={onBack} className={styles.backButton}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{display:'inline',verticalAlign:'middle',marginRight:4}}><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
        {t('settings.backToWallets')}
      </button>

      <header className={styles.importAllHeader}>
        <h1>{t('backup.importAllTitle')}</h1>
        <p className={styles.importAllDesc}>{t('backup.importAllDescription')}</p>
      </header>

      <div className={styles.importAllForm}>
        {/* File Selection */}
        <div className={styles.importAllField}>
          <label>{t('backup.selectBundleFile')}</label>
          <button
            className={styles.importAllFileButton}
            onClick={handleSelectFile}
            disabled={isImporting}
          >
            {fileName ? (
              <span className={styles.importAllFileSelected}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                {fileName}
              </span>
            ) : (
              <span className={styles.importAllFilePlaceholder}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                {t('backup.selectBundleFile')}
              </span>
            )}
          </button>
        </div>

        {/* Password */}
        <div className={styles.importAllField}>
          <label>{t('backup.enterBundlePassword')}</label>
          <PasswordInput
            className={styles.importAllInput}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t('backup.enterBundlePassword')}
            disabled={isImporting}
          />
        </div>

        {error && (
          <div className={styles.importAllError}>{error}</div>
        )}

        <button
          className={styles.importAllSubmit}
          onClick={handleImport}
          disabled={!fileData || !password || isImporting}
        >
          {isImporting ? t('backup.importingAll') : t('backup.importAllTitle')}
        </button>
      </div>
    </div>
  );
};
