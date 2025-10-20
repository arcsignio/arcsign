/**
 * ExportDialog Component
 * Feature: User Dashboard for Wallet Management
 * Task: T090 - Create ExportDialog component
 * Generated: 2025-10-17
 */

import React, { useState } from 'react';
import type { Wallet } from '@/types/wallet';
import { ExportFormat } from '@/types/address';
import tauriApi, { type AppError } from '@/services/tauri-api';

interface ExportDialogProps {
  wallet: Wallet;
  usbPath: string;
  password: string;
  onSuccess?: (filePath: string) => void;
  onClose: () => void;
}

/**
 * ExportDialog component for exporting wallet addresses
 * Requirements: FR-021 (Export to JSON/CSV), SC-008 (Performance <5s)
 */
export const ExportDialog: React.FC<ExportDialogProps> = ({
  wallet,
  usbPath,
  password,
  onSuccess,
  onClose,
}) => {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>(ExportFormat.JSON);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);

  /**
   * Handle export submission
   */
  const handleExport = async () => {
    setIsExporting(true);
    setExportError(null);
    setExportSuccess(null);

    try {
      const response = await tauriApi.exportAddresses(
        wallet.id,
        password,
        usbPath,
        selectedFormat
      );

      setExportSuccess(`Successfully exported ${response.address_count} addresses to ${selectedFormat.toUpperCase()}`);

      // Call success callback if provided
      if (onSuccess) {
        onSuccess(response.file_path);
      }

      // Auto-close after 2 seconds
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err) {
      const error = err as AppError;
      setExportError(error.message || 'Failed to export addresses');
    } finally {
      setIsExporting(false);
    }
  };

  /**
   * Handle backdrop click to close dialog
   */
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && !isExporting) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={handleBackdropClick}
    >
      <div
        className="bg-white rounded-lg p-6 max-w-md w-full mx-4"
        role="dialog"
        aria-labelledby="export-dialog-title"
      >
        <h2 id="export-dialog-title" className="text-xl font-semibold mb-4">
          Export Addresses
        </h2>

        {/* Wallet Info */}
        <div className="mb-6 p-4 bg-gray-50 rounded-md">
          <p className="text-sm text-gray-600">Wallet</p>
          <p className="font-medium text-gray-900">{wallet.name}</p>
          <p className="text-xs text-gray-500 mt-1">{wallet.address_count} addresses</p>
        </div>

        {/* Format Selection */}
        <div className="mb-6">
          <p className="text-sm font-medium text-gray-700 mb-3">Select Export Format</p>

          <div className="space-y-3">
            {/* JSON Option */}
            <label className="flex items-start p-3 border rounded-md cursor-pointer hover:bg-gray-50 transition-colors">
              <input
                type="radio"
                name="exportFormat"
                value={ExportFormat.JSON}
                checked={selectedFormat === ExportFormat.JSON}
                onChange={() => setSelectedFormat(ExportFormat.JSON)}
                className="mt-0.5 mr-3"
                disabled={isExporting}
              />
              <div>
                <div className="font-medium text-gray-900">JSON</div>
                <div className="text-xs text-gray-600 mt-1">
                  Structured data with full metadata. Best for programmatic use and backups.
                </div>
              </div>
            </label>

            {/* CSV Option */}
            <label className="flex items-start p-3 border rounded-md cursor-pointer hover:bg-gray-50 transition-colors">
              <input
                type="radio"
                name="exportFormat"
                value={ExportFormat.CSV}
                checked={selectedFormat === ExportFormat.CSV}
                onChange={() => setSelectedFormat(ExportFormat.CSV)}
                className="mt-0.5 mr-3"
                disabled={isExporting}
              />
              <div>
                <div className="font-medium text-gray-900">CSV</div>
                <div className="text-xs text-gray-600 mt-1">
                  Comma-separated values. Compatible with Excel and spreadsheet applications.
                </div>
              </div>
            </label>
          </div>
        </div>

        {/* Success Message */}
        {exportSuccess && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md">
            <p className="text-sm text-green-800">{exportSuccess}</p>
          </div>
        )}

        {/* Error Message */}
        {exportError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-800">{exportError}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="flex-1 px-4 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isExporting ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Exporting...
              </span>
            ) : (
              'Export'
            )}
          </button>

          <button
            onClick={onClose}
            disabled={isExporting}
            className="px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-md hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
        </div>

        {/* File Location Info */}
        <div className="mt-4 text-xs text-gray-500">
          <p>Export location: USB/{wallet.id.substring(0, 16)}.../addresses/</p>
          <p className="mt-1">File permissions: Owner read/write only (0600)</p>
        </div>
      </div>
    </div>
  );
};

export default ExportDialog;
