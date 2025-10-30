/**
 * LibraryCrashDialog Component
 * Feature: 005-go-cli-shared - Backend Communication Architecture Upgrade
 * Task: T046 - Recovery prompt for library crash scenario
 * Requirement: FR-010 - Display error dialog with recovery options
 * Generated: 2025-10-29
 */

import React from 'react';

interface LibraryCrashDialogProps {
  isOpen: boolean;
  errorMessage?: string;
  onReload: () => void;
  onQuit: () => void;
}

/**
 * Dialog shown when the Go shared library crashes or panics
 * Provides recovery options: reload application or quit
 *
 * Recovery Flow:
 * 1. Detect library crash via FFI error containing "panic" or "SIGSEGV"
 * 2. Show this dialog with error details
 * 3. User can choose to reload (restart app) or quit gracefully
 *
 * Usage:
 * ```tsx
 * const [showCrashDialog, setShowCrashDialog] = useState(false);
 * const [crashError, setCrashError] = useState<string | undefined>();
 *
 * // When FFI error is detected:
 * if (error.contains('panic') || error.contains('SIGSEGV')) {
 *   setCrashError(error);
 *   setShowCrashDialog(true);
 * }
 *
 * <LibraryCrashDialog
 *   isOpen={showCrashDialog}
 *   errorMessage={crashError}
 *   onReload={() => window.location.reload()}
 *   onQuit={() => invoke('quit_app')}
 * />
 * ```
 */
export const LibraryCrashDialog: React.FC<LibraryCrashDialogProps> = ({
  isOpen,
  errorMessage,
  onReload,
  onQuit,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50"
      role="alertdialog"
      aria-labelledby="crash-dialog-title"
      aria-describedby="crash-dialog-message"
    >
      <div
        className="bg-white rounded-lg p-6 max-w-lg w-full mx-4 shadow-2xl border-2 border-red-500"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Critical Error Icon */}
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center animate-pulse">
            <svg
              className="w-10 h-10 text-red-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
        </div>

        {/* Title */}
        <h2
          id="crash-dialog-title"
          className="text-xl font-bold text-red-900 text-center mb-3"
        >
          Critical Library Error
        </h2>

        {/* Message */}
        <div id="crash-dialog-message" className="mb-6">
          <p className="text-sm text-gray-700 text-center mb-4">
            The wallet library encountered a critical error and stopped working.
            Your data is safe, but you'll need to reload the application.
          </p>

          {/* Error Details (Collapsible) */}
          {errorMessage && (
            <details className="mt-4">
              <summary className="text-xs text-gray-600 cursor-pointer hover:text-gray-800 font-medium">
                Technical Details
              </summary>
              <div className="mt-2 p-3 bg-gray-50 rounded border border-gray-200 max-h-32 overflow-y-auto">
                <code className="text-xs text-red-700 font-mono whitespace-pre-wrap break-all">
                  {errorMessage}
                </code>
              </div>
            </details>
          )}
        </div>

        {/* Recovery Options */}
        <div className="space-y-3">
          <button
            onClick={onReload}
            className="w-full px-4 py-3 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            autoFocus
          >
            Reload Application
          </button>
          <button
            onClick={onQuit}
            className="w-full px-4 py-3 border-2 border-gray-300 text-gray-700 font-medium rounded-md hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"
          >
            Quit Application
          </button>
        </div>

        {/* Help Text */}
        <p className="mt-4 text-xs text-gray-500 text-center">
          If this error persists, please contact support with the technical details above.
        </p>
      </div>
    </div>
  );
};

export default LibraryCrashDialog;
