/**
 * Provider Settings Component
 * Feature: Provider Registry System - API Key Management
 * Updated: 2025-10-25 - Integrate with app-level password (方案 A)
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
// TODO: Migrate ProviderSettings to use session tokens
// Unused imports removed since component shows "unavailable" message

interface ProviderSettingsProps {
  // usbPath not used in current "unavailable" version
}

export const ProviderSettings: React.FC<ProviderSettingsProps> = () => {
  const { t } = useTranslation();

  // TODO: This component needs migration to session tokens
  // The provider config APIs haven't been migrated to use session tokens yet
  return (
    <div className="provider-settings">
      <div className="header">
        <h2>{t('provider.title')}</h2>
      </div>
      <div className="error-message" style={{ padding: '20px', backgroundColor: '#fff3cd', border: '1px solid #ffc107', borderRadius: '4px', margin: '20px 0' }}>
        <p style={{ margin: 0, color: '#856404' }}>
          ⚠️ Provider Settings feature is temporarily unavailable.
        </p>
        <p style={{ margin: '10px 0 0 0', fontSize: '0.9em', color: '#856404' }}>
          This component needs to be migrated to use session tokens (zero password storage architecture).
          The backend provider config APIs need to be updated first.
        </p>
      </div>
    </div>
  );
};
