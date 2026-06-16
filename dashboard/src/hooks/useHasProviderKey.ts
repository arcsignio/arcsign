import { useEffect, useState } from 'react';
import { listProviderConfigs } from '@/api/provider';

export interface ProviderKeyStatus {
  hasAlchemyKey: boolean;
  hasNodeRealKey: boolean;
  isLoading: boolean;
}

// Reports which provider API keys are configured, so a UI can tell
// "missing key" apart from "genuinely no data". Reads the existing provider
// config list — no chain calls, no key values exposed.
export function useHasProviderKey(
  usbPath: string,
  sessionToken?: string,
  appPassword?: string,
): ProviderKeyStatus {
  const [status, setStatus] = useState<ProviderKeyStatus>({
    hasAlchemyKey: false,
    hasNodeRealKey: false,
    isLoading: !!usbPath,
  });

  useEffect(() => {
    let mounted = true;
    if (!usbPath) {
      setStatus({ hasAlchemyKey: false, hasNodeRealKey: false, isLoading: false });
      return;
    }
    (async () => {
      try {
        const configs = await listProviderConfigs('global', usbPath, sessionToken, appPassword);
        const has = (type: string) =>
          configs.some((c) => c.providerType === type && c.enabled && c.hasApiKey);
        if (mounted) {
          setStatus({
            hasAlchemyKey: has('alchemy'),
            hasNodeRealKey: has('nodereal'),
            isLoading: false,
          });
        }
      } catch {
        if (mounted) {
          setStatus({ hasAlchemyKey: false, hasNodeRealKey: false, isLoading: false });
        }
      }
    })();
    return () => { mounted = false; };
  }, [usbPath, sessionToken, appPassword]);

  return status;
}
