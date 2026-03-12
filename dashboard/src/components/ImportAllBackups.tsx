/**
 * ImportAllBackups component (Pro feature)
 * Restores all wallets from an encrypted .arcsign-bundle file
 * Password required to decrypt the outer layer
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { open } from '@tauri-apps/api/dialog';
import { readBinaryFile } from '@tauri-apps/api/fs';
import tauriApi from '@/services/tauri-api';

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
      const bytes = await readBinaryFile(filePath);
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
    <div className="import-all-page">
      <button onClick={onBack} className="back-button">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{display:'inline',verticalAlign:'middle',marginRight:4}}><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
        {t('settings.backToWallets')}
      </button>

      <header className="import-all-header">
        <h1>{t('backup.importAllTitle')}</h1>
        <p className="import-all-desc">{t('backup.importAllDescription')}</p>
      </header>

      <div className="import-all-form">
        {/* File Selection */}
        <div className="import-all-field">
          <label>{t('backup.selectBundleFile')}</label>
          <button
            className="import-all-file-button"
            onClick={handleSelectFile}
            disabled={isImporting}
          >
            {fileName ? (
              <span className="import-all-file-selected">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                {fileName}
              </span>
            ) : (
              <span className="import-all-file-placeholder">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                {t('backup.selectBundleFile')}
              </span>
            )}
          </button>
        </div>

        {/* Password */}
        <div className="import-all-field">
          <label>{t('backup.enterBundlePassword')}</label>
          <input
            type="password"
            className="import-all-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t('backup.enterBundlePassword')}
            disabled={isImporting}
          />
        </div>

        {error && (
          <div className="import-all-error">{error}</div>
        )}

        <button
          className="import-all-submit"
          onClick={handleImport}
          disabled={!fileData || !password || isImporting}
        >
          {isImporting ? t('backup.importingAll') : t('backup.importAllTitle')}
        </button>
      </div>

      <style>{`
        .import-all-page {
          max-width: 560px;
          margin: 0 auto;
          padding: 20px;
        }

        .back-button {
          background: none;
          border: none;
          color: #2dd4bf;
          cursor: pointer;
          font-size: 14px;
          padding: 8px 0;
          margin-bottom: 16px;
        }

        .back-button:hover {
          text-decoration: underline;
        }

        .import-all-header {
          margin-bottom: 32px;
        }

        .import-all-header h1 {
          margin: 0 0 8px;
          font-size: 28px;
          font-weight: 600;
          color: #111827;
        }

        .import-all-desc {
          margin: 0;
          color: #6b7280;
          font-size: 16px;
        }

        .import-all-form {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .import-all-field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .import-all-field label {
          font-size: 14px;
          font-weight: 500;
          color: #374151;
        }

        .import-all-file-button {
          padding: 14px 16px;
          background: #f9fafb;
          border: 2px dashed #d1d5db;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s;
          text-align: left;
        }

        .import-all-file-button:hover {
          border-color: #2dd4bf;
          background: #f0fdfa;
        }

        .import-all-file-placeholder {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #9ca3af;
          font-size: 14px;
        }

        .import-all-file-selected {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #111827;
          font-size: 14px;
          font-weight: 500;
        }

        .import-all-input {
          padding: 12px 16px;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          font-size: 14px;
          color: #111827;
          outline: none;
          transition: border-color 0.2s;
        }

        .import-all-input:focus {
          border-color: #2dd4bf;
          box-shadow: 0 0 0 3px rgba(45, 212, 191, 0.1);
        }

        .import-all-input::placeholder {
          color: #9ca3af;
        }

        .import-all-error {
          padding: 12px 16px;
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 8px;
          color: #dc2626;
          font-size: 14px;
        }

        .import-all-submit {
          padding: 14px 24px;
          background: #0d9488;
          border: none;
          border-radius: 10px;
          color: white;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          margin-top: 8px;
        }

        .import-all-submit:hover {
          background: #0f766e;
          box-shadow: 0 4px 12px rgba(13, 148, 136, 0.3);
        }

        .import-all-submit:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          box-shadow: none;
        }
      `}</style>
    </div>
  );
};
