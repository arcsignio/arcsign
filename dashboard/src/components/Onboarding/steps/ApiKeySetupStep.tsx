/**
 * Onboarding Step 5: API Key Setup
 * Guides users to obtain and validate Alchemy + NodeReal API keys.
 */

import { useState, useCallback, useEffect } from 'react';
import styles from "./ApiKeySetupStep.module.css";
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
    <div className={`${styles.apiProviderCard} ${isConfigured || isSuccess ? styles.success : ''}`}>
      <div className={styles.apiProviderHeader}>
        <strong>{name}</strong>
        {!isConfigured && (
          <button
            className={styles.apiLinkButton}
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
      <p className={styles.apiProviderDesc}>{desc}</p>
      <p className={styles.apiProviderChains}>{chains}</p>

      {isConfigured ? (
        <div className={styles.apiConfiguredRow}>
          <div className={`${styles.apiStatusSuccess} ${styles.apiStatus} `.trim()}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            {t('onboarding.apiKeyAlreadyConfigured')}
          </div>
          <button
            className={styles.apiReconfigureButton}
            onClick={onReconfigure}
            type="button"
          >
            {t('onboarding.apiKeyReconfigure')}
          </button>
        </div>
      ) : (
        <>
          <div className={styles.apiKeyInputRow}>
            <div className={styles.apiKeyInputWrapper}>
              <input
                type={state.showKey ? 'text' : 'password'}
                value={state.apiKey}
                onChange={(e) => onKeyChange(e.target.value)}
                placeholder={t('onboarding.apiKeyEnterKey')}
                disabled={state.status === 'testing' || state.status === 'saving'}
                autoComplete="off"
              />
              <button
                className={styles.apiKeyToggle}
                onClick={onToggleShow}
                type="button"
                tabIndex={-1}
              >
                {state.showKey ? t('onboarding.apiKeyHide') : t('onboarding.apiKeyShow')}
              </button>
            </div>
            <button
              className={styles.apiTestButton}
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
            <div className={`${styles.apiStatusSuccess} ${styles.apiStatus} `.trim()}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              {t('onboarding.apiKeyConnected', { blockNumber: state.blockNumber })}
            </div>
          )}

          {state.status === 'error' && (
            <div className={`${styles.apiStatusError} ${styles.apiStatus} `.trim()}>
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
      <p className={styles.apiIntro}>{t('onboarding.apiKeyBody')}</p>

      <div className={styles.apiProviders}>
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

      <p className={styles.apiSkipHint}>{t('onboarding.apiKeySkipHint')}</p>
    </OnboardingStep>
  );
};
