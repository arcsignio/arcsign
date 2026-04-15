/**
 * OTA Update Checker Hook
 * Feature: Custom auto-update UI replacing native Tauri dialog
 * Uses @tauri-apps/plugin-updater (v2) for check/install and @tauri-apps/plugin-process for relaunch.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'installing'
  | 'done'
  | 'error'
  | 'up-to-date';

export interface UpdateManifest {
  version: string;
  date: string;
  body: string;
}

export interface UpdateState {
  status: UpdateStatus;
  manifest: UpdateManifest | null;
  error: string | null;
}

export interface UseUpdateCheckerReturn {
  state: UpdateState;
  checkForUpdates: () => Promise<void>;
  startInstall: () => Promise<void>;
  dismissUpdate: () => void;
  skipVersion: () => void;
}

const SKIPPED_VERSION_KEY = 'arcsign-skipped-version';
const AUTO_CHECK_DELAY = 5000; // 5 seconds after unlock

const initialState: UpdateState = {
  status: 'idle',
  manifest: null,
  error: null,
};

export function useUpdateChecker({ enabled }: { enabled: boolean }): UseUpdateCheckerReturn {
  const [state, setState] = useState<UpdateState>(initialState);
  const isManualCheckRef = useRef(false);
  const autoCheckDoneRef = useRef(false);
  // Tauri v2: store the Update object returned by check() for use in startInstall
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateRef = useRef<any>(null);

  const checkForUpdates = useCallback(async () => {
    isManualCheckRef.current = true;
    setState({ status: 'checking', manifest: null, error: null });

    try {
      // Tauri v2: check() returns Update | null
      const update = await check();

      if (update) {
        const updateManifest: UpdateManifest = {
          version: update.version,
          date: update.date ?? '',
          body: update.body ?? '',
        };

        // Auto-check respects skipped version; manual check does not
        if (!isManualCheckRef.current) {
          const skippedVersion = localStorage.getItem(SKIPPED_VERSION_KEY);
          if (skippedVersion === update.version) {
            setState(initialState);
            return;
          }
        }

        // Store update object for use in startInstall
        updateRef.current = update;
        setState({ status: 'available', manifest: updateManifest, error: null });
      } else {
        setState({ status: 'up-to-date', manifest: null, error: null });
        setTimeout(() => {
          setState((prev) => (prev.status === 'up-to-date' ? initialState : prev));
        }, 3000);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      if (errorMessage.toLowerCase().includes('could not fetch')) {
        setState({ status: 'up-to-date', manifest: null, error: null });
        setTimeout(() => {
          setState((prev) => (prev.status === 'up-to-date' ? initialState : prev));
        }, 3000);
      } else {
        setState({ status: 'error', manifest: null, error: errorMessage });
      }
    } finally {
      isManualCheckRef.current = false;
    }
  }, []);

  const startInstall = useCallback(async () => {
    setState((prev) => ({ ...prev, status: 'downloading' }));

    try {
      const update = updateRef.current;
      if (!update) throw new Error('No update available');

      // Tauri v2: downloadAndInstall() with progress callback
      await update.downloadAndInstall((event: { event: string }) => {
        if (event.event === 'Started') {
          setState((prev) => ({ ...prev, status: 'downloading' }));
        } else if (event.event === 'Finished') {
          setState((prev) => ({ ...prev, status: 'installing' }));
        }
      });

      setState((prev) => ({ ...prev, status: 'done' }));
      setTimeout(() => {
        relaunch().catch(() => {});
      }, 1500);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setState((prev) => ({ ...prev, status: 'error', error: errorMessage }));
    }
  }, []);

  const dismissUpdate = useCallback(() => {
    setState(initialState);
  }, []);

  const skipVersion = useCallback(() => {
    if (state.manifest?.version) {
      localStorage.setItem(SKIPPED_VERSION_KEY, state.manifest.version);
    }
    setState(initialState);
  }, [state.manifest]);

  // Auto-check for updates after unlock (5 second delay, once per session)
  useEffect(() => {
    if (!enabled || autoCheckDoneRef.current) return;

    const timer = setTimeout(() => {
      autoCheckDoneRef.current = true;
      isManualCheckRef.current = false; // Mark as auto-check

      // Run the check inline — completely silent (no UI state changes until update found)
      (async () => {
        try {
          const update = await check();
          if (update) {
            const skippedVersion = localStorage.getItem(SKIPPED_VERSION_KEY);
            if (skippedVersion === update.version) {
              setState(initialState);
              return;
            }
            updateRef.current = update;
            setState({
              status: 'available',
              manifest: { version: update.version, date: update.date ?? '', body: update.body ?? '' },
              error: null,
            });
          } else {
            setState(initialState);
          }
        } catch {
          setState(initialState);
        }
      })();
    }, AUTO_CHECK_DELAY);

    return () => clearTimeout(timer);
  }, [enabled]);

  return { state, checkForUpdates, startInstall, dismissUpdate, skipVersion };
}
