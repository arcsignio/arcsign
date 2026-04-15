/**
 * Onboarding Step 5: API Key Setup
 * Guides users to obtain and validate Alchemy + NodeReal API keys.
 */

import { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { openUrl } from '@tauri-apps/plugin-opener';
import { OnboardingStep } from '../OnboardingStep';
import { setProviderConfig, listProviderConfigs, PROVIDER_TYPES } from '@/api/provider';
import { useSessionStore } from '@/stores/sessionStore';

interface ApiKeySetupStepProps {
  usbPath: string;
}

const KeyIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
  </svg>
);

const TEST_ENDPOINTS: Record<string, string> = {
  alchemy: 'https://eth-mainnet.g.alchemy.com/v2/',
  nodereal: 'https://bsc-mainnet.nodereal.io/v1/',
};

const SIGNUP_URLS: Record<string, string> = {
  alchemy: 'https://dashboard.alchemy.com/signup',
  nodereal: 'https://dashboard.nodereal.io/signup',
};

type TestStatus = 'idle' | 'testing' | 'saving' | 'success' | 'error' | 'configured';

interface ProviderState {
  apiKey: string;
  showKey: boolean;
  status: TestStatus;
  blockNumber: string;
  error: string;
}

const initialProviderState: ProviderState = {
  apiKey: '',
  showKey: false,
  status: 'idle',
  blockNumber: '',
  error: '',
};

async function testApiKey(
  providerType: string,
  apiKey: string
): Promise<{ success: boolean; blockNumber?: string; error?: string }> {
  const endpoint = TEST_ENDPOINTS[providerType];
  if (!endpoint) return { success: false, error: 'Unknown provider' };

  try {
    const res = await fetch(endpoint + apiKey, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_blockNumber',
        params: [],
        id: 1,
      }),
    });
    const data = await res.json();
    if (data.result) {
      return {
        success: true,
        blockNumber: parseInt(data.result, 16).toString(),
      };
    }
    return {
      success: false,
      error: data.error?.message || 'Invalid API key',
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Connection failed',
    };
  }
}

interface ProviderCardProps {
  providerType: string;
  name: string;
  desc: string;
  chains: string;
  signupUrl: string;
  state: ProviderState;
  onKeyChange: (key: string) => void;
  onToggleShow: () => void;
  onTest: () => void;
  onReconfigure: () => void;
  t: (key: string, opts?: Record<string, string>) => string;
}

const ProviderCard = ({
  name,
  desc,
  chains,
  signupUrl,
  state,
  onKeyChange,
  onToggleShow,
  onTest,
  onReconfigure,
  t,
}: ProviderCardProps) => {
  const isConfigured = state.status === 'configured';
  const isSuccess = state.status === 'success';

  return (
    <div className={`api-provider-card ${isConfigured || isSuccess ? 'success' : ''}`}>
      <div className="api-provider-header">
        <strong>{name}</strong>
        {!isConfigured && (
          <button
            className="api-link-button"
            onClick={() => openUrl(signupUrl).catch(() => {})}
            type="button"
          >
            {t('onboarding.apiKeyGetFreeKey')}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 4 }}>
              <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </button>
        )}
      </div>
      <p className="api-provider-desc">{desc}</p>
      <p className="api-provider-chains">{chains}</p>

      {isConfigured ? (
        <div className="api-configured-row">
          <div className="api-status api-status-success">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            {t('onboarding.apiKeyAlreadyConfigured')}
          </div>
          <button
            className="api-reconfigure-button"
            onClick={onReconfigure}
            type="button"
          >
            {t('onboarding.apiKeyReconfigure')}
          </button>
        </div>
      ) : (
        <>
          <div className="api-key-input-row">
            <div className="api-key-input-wrapper">
              <input
                type={state.showKey ? 'text' : 'password'}
                value={state.apiKey}
                onChange={(e) => onKeyChange(e.target.value)}
                placeholder={t('onboarding.apiKeyEnterKey')}
                disabled={state.status === 'testing' || state.status === 'saving'}
                autoComplete="off"
              />
              <button
                className="api-key-toggle"
                onClick={onToggleShow}
                type="button"
                tabIndex={-1}
              >
                {state.showKey ? t('onboarding.apiKeyHide') : t('onboarding.apiKeyShow')}
              </button>
            </div>
            <button
              className="api-test-button"
              onClick={onTest}
              disabled={!state.apiKey.trim() || state.status === 'testing' || state.status === 'saving' || state.status === 'success'}
              type="button"
            >
              {state.status === 'testing'
                ? t('onboarding.apiKeyTesting')
                : state.status === 'saving'
                ? t('onboarding.apiKeySaving')
                : state.status === 'success'
                ? t('onboarding.apiKeySaved')
                : t('onboarding.apiKeyTest')}
            </button>
          </div>

          {isSuccess && (
            <div className="api-status api-status-success">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              {t('onboarding.apiKeyConnected', { blockNumber: state.blockNumber })}
            </div>
          )}

          {state.status === 'error' && (
            <div className="api-status api-status-error">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
              {state.error || t('onboarding.apiKeyFailed')}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export const ApiKeySetupStep = ({ usbPath }: ApiKeySetupStepProps) => {
  const { t } = useTranslation();
  const { getToken } = useSessionStore();

  const [alchemy, setAlchemy] = useState<ProviderState>({ ...initialProviderState });
  const [nodereal, setNodereal] = useState<ProviderState>({ ...initialProviderState });

  // Check for existing provider configs on mount
  useEffect(() => {
    const checkExisting = async () => {
      const sessionToken = getToken();
      if (!sessionToken) return;

      try {
        const configs = await listProviderConfigs(null, usbPath, sessionToken);
        for (const config of configs) {
          if (config.providerType === PROVIDER_TYPES.ALCHEMY && config.hasApiKey) {
            setAlchemy((s) => ({ ...s, status: 'configured' }));
          }
          if (config.providerType === PROVIDER_TYPES.NODEREAL && config.hasApiKey) {
            setNodereal((s) => ({ ...s, status: 'configured' }));
          }
        }
      } catch {
        // Non-critical - just show empty fields
      }
    };

    checkExisting();
  }, [usbPath, getToken]);

  const handleTest = useCallback(
    async (
      providerType: string,
      state: ProviderState,
      setState: React.Dispatch<React.SetStateAction<ProviderState>>
    ) => {
      if (!state.apiKey.trim()) return;

      setState((s) => ({ ...s, status: 'testing', error: '' }));

      const result = await testApiKey(providerType, state.apiKey);

      if (result.success) {
        // Save to USB via provider API
        setState((s) => ({ ...s, status: 'saving' }));
        try {
          const sessionToken = getToken();
          if (!sessionToken) {
            setState((s) => ({
              ...s,
              status: 'error',
              error: 'Session expired',
            }));
            return;
          }

          await setProviderConfig({
            providerType,
            apiKey: state.apiKey,
            chainId: 'global',
            networkId: 'mainnet',
            priority: 100,
            enabled: true,
            usbPath,
            sessionToken,
          });

          setState((s) => ({
            ...s,
            status: 'success',
            blockNumber: result.blockNumber || '',
          }));
        } catch (err) {
          setState((s) => ({
            ...s,
            status: 'error',
            error: err instanceof Error ? err.message : 'Failed to save',
          }));
        }
      } else {
        setState((s) => ({
          ...s,
          status: 'error',
          error: result.error || t('onboarding.apiKeyInvalid'),
        }));
      }
    },
    [usbPath, getToken, t]
  );

  return (
    <OnboardingStep icon={<KeyIcon />} title={t('onboarding.apiKeyTitle')}>
      <p className="api-intro">{t('onboarding.apiKeyBody')}</p>

      <div className="api-providers">
        <ProviderCard
          providerType={PROVIDER_TYPES.ALCHEMY}
          name="Alchemy"
          desc={t('onboarding.apiKeyAlchemyDesc')}
          chains={t('onboarding.apiKeyAlchemyChains')}
          signupUrl={SIGNUP_URLS.alchemy}
          state={alchemy}
          onKeyChange={(key) =>
            setAlchemy((s) => ({ ...s, apiKey: key, status: s.status === 'error' ? 'idle' : s.status }))
          }
          onToggleShow={() => setAlchemy((s) => ({ ...s, showKey: !s.showKey }))}
          onTest={() => handleTest(PROVIDER_TYPES.ALCHEMY, alchemy, setAlchemy)}
          onReconfigure={() => setAlchemy({ ...initialProviderState })}
          t={t}
        />

        <ProviderCard
          providerType={PROVIDER_TYPES.NODEREAL}
          name="NodeReal"
          desc={t('onboarding.apiKeyNoderealDesc')}
          chains={t('onboarding.apiKeyNoderealChains')}
          signupUrl={SIGNUP_URLS.nodereal}
          state={nodereal}
          onKeyChange={(key) =>
            setNodereal((s) => ({ ...s, apiKey: key, status: s.status === 'error' ? 'idle' : s.status }))
          }
          onToggleShow={() => setNodereal((s) => ({ ...s, showKey: !s.showKey }))}
          onTest={() => handleTest(PROVIDER_TYPES.NODEREAL, nodereal, setNodereal)}
          onReconfigure={() => setNodereal({ ...initialProviderState })}
          t={t}
        />
      </div>

      <p className="api-skip-hint">{t('onboarding.apiKeySkipHint')}</p>

      <style>{`
        .api-intro {
          text-align: center;
          margin: 0 0 20px;
          color: #6b7280;
        }

        .api-providers {
          display: flex;
          flex-direction: column;
          gap: 16px;
          margin-bottom: 16px;
        }

        .api-provider-card {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          padding: 16px;
          transition: border-color 0.2s;
        }

        .api-provider-card.success {
          border-color: #10b981;
          background: #f0fdf4;
        }

        .api-provider-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }

        .api-provider-header strong {
          font-size: 16px;
          color: #111827;
        }

        .api-link-button {
          display: inline-flex;
          align-items: center;
          padding: 4px 10px;
          background: none;
          border: 1px solid #2dd4bf;
          border-radius: 6px;
          color: #0d9488;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .api-link-button:hover {
          background: rgba(45, 212, 191, 0.08);
        }

        .api-provider-desc {
          margin: 0 0 2px;
          font-size: 13px;
          color: #4b5563;
        }

        .api-provider-chains {
          margin: 0 0 12px;
          font-size: 12px;
          color: #9ca3af;
          font-style: italic;
        }

        .api-key-input-row {
          display: flex;
          gap: 8px;
        }

        .api-key-input-wrapper {
          flex: 1;
          position: relative;
        }

        .api-key-input-wrapper input {
          width: 100%;
          padding: 8px 60px 8px 12px;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          font-size: 13px;
          color: #111827;
          transition: border-color 0.2s;
          box-sizing: border-box;
        }

        .api-key-input-wrapper input:focus {
          outline: none;
          border-color: #2dd4bf;
        }

        .api-key-input-wrapper input:disabled {
          background: #f3f4f6;
        }

        .api-key-toggle {
          position: absolute;
          right: 8px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          color: #9ca3af;
          font-size: 11px;
          cursor: pointer;
          padding: 2px 4px;
        }

        .api-key-toggle:hover {
          color: #6b7280;
        }

        .api-test-button {
          padding: 8px 16px;
          background: linear-gradient(135deg, #0d9488 0%, #2dd4bf 100%);
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.2s;
        }

        .api-test-button:hover:not(:disabled) {
          box-shadow: 0 2px 8px rgba(45, 212, 191, 0.3);
        }

        .api-test-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .api-status {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-top: 8px;
          padding: 6px 10px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 500;
        }

        .api-status-success {
          background: #dcfce7;
          color: #16a34a;
        }

        .api-status-error {
          background: #fee2e2;
          color: #dc2626;
        }

        .api-configured-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }

        .api-configured-row .api-status {
          margin-top: 0;
        }

        .api-reconfigure-button {
          background: none;
          border: none;
          color: #6b7280;
          font-size: 12px;
          cursor: pointer;
          padding: 4px 8px;
          text-decoration: underline;
          white-space: nowrap;
          flex-shrink: 0;
        }

        .api-reconfigure-button:hover {
          color: #0d9488;
        }

        .api-skip-hint {
          text-align: center;
          margin: 0;
          font-size: 12px;
          color: #9ca3af;
        }
      `}</style>
    </OnboardingStep>
  );
};
