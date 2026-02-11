/**
 * LoadingSpinner Component
 * Feature: User Dashboard for Wallet Management
 * Task: T094 - Loading spinners and skeleton screens
 * Updated: Brand-integrated loading animation with ArcSign logo
 */

import React from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  message?: string;
}

/**
 * Branded loading spinner component
 * Shows ArcSign logo with orbital ring animation for lg size,
 * falls back to simple spinner for sm/md
 */
export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  className = '',
  message,
}) => {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-16 w-16',
  };

  // For large size, use branded logo spinner
  if (size === 'lg') {
    return (
      <div className={`flex flex-col items-center justify-center ${className}`}>
        <div className="logo-spinner" style={{ width: 64, height: 64, position: 'relative' }}>
          <img
            src="/logo.png"
            alt="Loading"
            style={{
              width: 48,
              height: 48,
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              objectFit: 'contain',
            }}
          />
          <svg
            width="64"
            height="64"
            viewBox="0 0 64 64"
            style={{ animation: 'spin 1.5s linear infinite' }}
          >
            <circle
              cx="32"
              cy="32"
              r="30"
              fill="none"
              stroke="#e5e7eb"
              strokeWidth="2"
            />
            <circle
              cx="32"
              cy="32"
              r="30"
              fill="none"
              stroke="#2dd4bf"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeDasharray="60 140"
            />
          </svg>
        </div>
        {message && (
          <p className="mt-3 text-sm text-gray-600">{message}</p>
        )}
        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // For sm/md, use compact spinner with brand color
  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <svg
        className={`animate-spin ${sizeClasses[size]}`}
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        aria-label="Loading"
        style={{ color: '#2dd4bf' }}
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        ></circle>
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        ></path>
      </svg>
      {message && (
        <p className="mt-3 text-sm text-gray-600">{message}</p>
      )}
    </div>
  );
};

export default LoadingSpinner;
