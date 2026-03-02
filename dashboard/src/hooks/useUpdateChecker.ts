/**
 * OTA Update Checker Hook
 * Feature: Custom auto-update UI replacing native Tauri dialog
 * Uses @tauri-apps/api/updater for check/install and @tauri-apps/api/process for relaunch.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { checkUpdate, installUpdate, onUpdaterEvent } from '@tauri-apps/api/updater';
import { relaunch } from '@tauri-apps/api/process';

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
  const unlistenRef = useRef<(() => void) | null>(null);

  // Cleanup updater event listener on unmount
  useEffect(() => {
    return () => {
      if (unlistenRef.current) {
        unlistenRef.current();
        unlistenRef.current = null;
      }
    };
  }, []);

  const checkForUpdates = useCallback(async () => {
    // Mark as manual check if called directly (not from auto-check)
    isManualCheckRef.current = true;

    setState({ status: 'checking', manifest: null, error: null });

    try {
      const { shouldUpdate, manifest } = await checkUpdate();

      if (shouldUpdate && manifest) {
        const updateManifest: UpdateManifest = {
          version: manifest.version,
          date: manifest.date,
          body: manifest.body,
        };

        // Auto-check respects skipped version; manual check does not
        if (!isManualCheckRef.current) {
          const skippedVersion = localStorage.getItem(SKIPPED_VERSION_KEY);
          if (skippedVersion === manifest.version) {
            setState(initialState);
            return;
          }
        }

        setState({ status: 'available', manifest: updateManifest, error: null });
      } else {
        setState({ status: 'up-to-date', manifest: null, error: null });
        // Auto-dismiss "up to date" after 3 seconds
        setTimeout(() => {
          setState((prev) => (prev.status === 'up-to-date' ? initialState : prev));
        }, 3000);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      // "Could not fetch" = no release published yet → treat as up-to-date
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
      // Listen for updater events
      if (unlistenRef.current) {
        unlistenRef.current();
      }
      unlistenRef.current = await onUpdaterEvent(({ error, status: eventStatus }) => {
        const s = eventStatus as string;
        if (s === 'DOWNLOADED') {
          setState((prev) => ({ ...prev, status: 'installing' }));
        } else if (s === 'UPDATED') {
          setState((prev) => ({ ...prev, status: 'done' }));
          // Auto-relaunch after 1.5 seconds
          setTimeout(() => {
            relaunch().catch(() => {
              // If relaunch fails, user can click the button manually
            });
          }, 1500);
        } else if (s === 'ERROR') {
          setState((prev) => ({
            ...prev,
            status: 'error',
            error: error || 'Unknown error during update',
          }));
        }
        // PENDING: keep current status (downloading)
      });

      // Start the actual install (download + install)
      await installUpdate();
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
          const { shouldUpdate, manifest } = await checkUpdate();
          if (shouldUpdate && manifest) {
            const skippedVersion = localStorage.getItem(SKIPPED_VERSION_KEY);
            if (skippedVersion === manifest.version) {
              setState(initialState);
              return;
            }
            setState({
              status: 'available',
              manifest: { version: manifest.version, date: manifest.date, body: manifest.body },
              error: null,
            });
          } else {
            // For auto-check, silently go back to idle (don't show "up to date")
            setState(initialState);
          }
        } catch {
          // For auto-check, silently ignore errors
          setState(initialState);
        }
      })();
    }, AUTO_CHECK_DELAY);

    return () => clearTimeout(timer);
  }, [enabled]);

  return { state, checkForUpdates, startInstall, dismissUpdate, skipVersion };
}
