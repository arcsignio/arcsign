/**
 * InactivityWarningDialog Component
 * Feature: User Dashboard for Wallet Management
 * Task: T092 - Auto-logout warning dialog
 * Requirement: SEC-006 - Auto-logout after 15 minutes
 * Generated: 2025-10-17
 */

import React from 'react';

interface InactivityWarningDialogProps {
  isOpen: boolean;
  remainingSeconds: number;
  onStayLoggedIn: () => void;
  onLogout: () => void;
}

/**
 * Warning dialog shown before auto-logout
 * Displays countdown and allows user to stay logged in
 */
export const InactivityWarningDialog: React.FC<InactivityWarningDialogProps> = ({
  isOpen,
  remainingSeconds,
  onStayLoggedIn,
  onLogout,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
      <div
        className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl"
        role="dialog"
        aria-labelledby="inactivity-warning-title"
        aria-describedby="inactivity-warning-description"
      >
        {/* Warning Icon */}
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center">
            <svg
              className="w-10 h-10 text-yellow-600"
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
          id="inactivity-warning-title"
          className="text-xl font-semibold text-center mb-2"
        >
          Inactivity Detected
        </h2>

        {/* Description */}
        <p
          id="inactivity-warning-description"
          className="text-sm text-gray-600 text-center mb-6"
        >
          You will be automatically logged out in{' '}
          <span className="font-semibold text-gray-900">{remainingSeconds}</span>{' '}
          {remainingSeconds === 1 ? 'second' : 'seconds'} due to inactivity.
        </p>

        {/* Countdown Progress Bar */}
        <div className="mb-6">
          <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
            <div
              className="bg-yellow-600 h-full transition-all duration-1000 ease-linear"
              style={{ width: `${(remainingSeconds / 60) * 100}%` }}
            />
          </div>
        </div>

        {/* Security Message */}
        <div className="mb-6 p-3 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-xs text-blue-800">
            <strong>Security Notice:</strong> All sensitive data will be cleared from memory
            when you are logged out.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onStayLoggedIn}
            className="flex-1 px-4 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            autoFocus
          >
            Stay Logged In
          </button>
          <button
            onClick={onLogout}
            className="px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-md hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"
          >
            Logout Now
          </button>
        </div>

        {/* Keyboard Hint */}
        <p className="text-xs text-gray-500 text-center mt-4">
          Press <kbd className="px-1 py-0.5 bg-gray-100 border border-gray-300 rounded">Enter</kbd>{' '}
          to stay logged in
        </p>
      </div>
    </div>
  );
};

export default InactivityWarningDialog;
