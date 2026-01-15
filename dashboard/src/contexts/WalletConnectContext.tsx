/**
 * WalletConnect Context
 * Feature: WalletConnect v2 integration - Global state management
 * Updated: 2026-01-14
 *
 * Manages:
 * - WalletConnect client lifecycle
 * - Active sessions
 * - Pairing and approval flows
 * - Session persistence and recovery
 */

import React, { createContext, useContext, useState, useCallback } from 'react';
import type { SessionTypes } from '@walletconnect/types';
import { getWalletConnectClient, WalletConnectClient } from '@/services/walletconnect/client';
import { generateNamespaces } from '@/services/walletconnect/session-manager';
import type { SessionApprovalRequest, WalletConnectConfig } from '@/services/walletconnect/types';
import { invoke } from '@tauri-apps/api/tauri';
import { useAppPassword } from './AppPasswordContext';

interface WalletConnectContextValue {
  // Client state
  initialized: boolean;
  initializing: boolean;
  error: string | null;

  // Active sessions
  sessions: SessionTypes.Struct[];

  // UI state
  showPairingModal: boolean;
  sessionProposal: SessionApprovalRequest | null;

  // Actions
  init: (config: WalletConnectConfig) => Promise<void>;
  openPairingModal: (address?: string) => void;
  closePairingModal: () => void;
  pair: (uri: string) => Promise<void>;
  approveSession: (address?: string) => Promise<void>;
  rejectSession: () => Promise<void>;
  disconnectSession: (topic: string) => Promise<void>;

  // Session recovery
  recoverSessions: (sessionToken: string, usbPath: string) => Promise<void>;
}

const WalletConnectContext = createContext<WalletConnectContextValue | null>(null);

interface WalletConnectSession {
  topic: string;
  data: string;
}

export const WalletConnectProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { getSessionToken, usbPath } = useAppPassword();

  const [client, setClient] = useState<WalletConnectClient | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [sessions, setSessions] = useState<SessionTypes.Struct[]>([]);
  const [showPairingModal, setShowPairingModal] = useState(false);
  const [sessionProposal, setSessionProposal] = useState<SessionApprovalRequest | null>(null);
  const [currentAddress, setCurrentAddress] = useState<string | null>(null);

  // Initialize WalletConnect client
  const init = useCallback(async (config: WalletConnectConfig) => {
    if (initializing || initialized) {
      console.log('[WC Context] Already initialized or initializing');
      return;
    }

    setInitializing(true);
    setError(null);

    try {
      console.log('[WC Context] Initializing WalletConnect...');

      const wcClient = getWalletConnectClient(config);
      await wcClient.init();

      setClient(wcClient);
      setInitialized(true);

      // Load active sessions
      const activeSessions = wcClient.getActiveSessions();
      setSessions(activeSessions);

      // Setup event listeners
      setupEventListeners(wcClient);

      console.log('[WC Context] WalletConnect initialized successfully');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to initialize WalletConnect';
      setError(errorMessage);
      console.error('[WC Context] Initialization failed:', err);
    } finally {
      setInitializing(false);
    }
  }, [initializing, initialized]);

  // Setup event listeners
  const setupEventListeners = (wcClient: WalletConnectClient) => {
    console.log('[WC Context] Setting up event listeners...');

    // Session proposal (after pairing)
    wcClient.on('session_proposal', (proposal) => {
      console.log('[WC Context] Session proposal received:', proposal);
      setSessionProposal(proposal as SessionApprovalRequest);
      setShowPairingModal(false); // Close pairing modal
    });

    // Session request (method calls from dApp)
    wcClient.on('session_request', async (request) => {
      console.log('[WC Context] Session request received:', request);
      // TODO: Route to appropriate handler (Phase 2)
    });

    // Session update
    wcClient.on('session_update', (update) => {
      console.log('[WC Context] Session updated:', update);
      const updatedSessions = wcClient.getActiveSessions();
      setSessions(updatedSessions);
    });

    // Session delete
    wcClient.on('session_delete', (deletion) => {
      console.log('[WC Context] Session deleted:', deletion);
      const updatedSessions = wcClient.getActiveSessions();
      setSessions(updatedSessions);
    });
  };

  // Pair with dApp
  const pair = useCallback(async (uri: string) => {
    if (!client || !initialized) {
      throw new Error('WalletConnect not initialized');
    }

    try {
      console.log('[WC Context] Initiating pairing...');
      await client.pair(uri);
      console.log('[WC Context] Pairing initiated, waiting for session_proposal...');
    } catch (err) {
      console.error('[WC Context] Pairing failed:', err);
      throw err;
    }
  }, [client, initialized]);

  // Approve session
  const approveSession = useCallback(async (address?: string) => {
    if (!client || !sessionProposal) {
      throw new Error('No session proposal to approve');
    }

    // Use provided address or stored currentAddress
    const walletAddress = address || currentAddress;
    if (!walletAddress) {
      throw new Error('No wallet address available for session approval');
    }

    try {
      console.log('[WC Context] Approving session for address:', walletAddress);

      // Generate namespaces
      const namespaces = generateNamespaces(
        walletAddress,
        sessionProposal.params.requiredNamespaces,
        sessionProposal.params.optionalNamespaces
      );

      // Approve session
      const session = await client.approveSession(sessionProposal.params.id, namespaces);

      // Update sessions
      const updatedSessions = client.getActiveSessions();
      setSessions(updatedSessions);

      console.log('[WC Context] Session approved:', session.topic);

      // Persist sessions to USB (encrypted + HMAC)
      const sessionToken = getSessionToken();
      if (sessionToken && usbPath) {
        try {
          // Convert sessions to persistable format
          const sessionsToSave = updatedSessions.map(s => ({
            topic: s.topic,
            data: JSON.stringify(s),
          }));

          await invoke('save_wc_sessions', {
            usbPath,
            sessions: sessionsToSave,
            sessionToken,
          });

          console.log('[WC Context] ✅ Sessions persisted to USB');
        } catch (persistError) {
          console.error('[WC Context] Failed to persist sessions:', persistError);
          // Don't throw - session approval succeeded even if persistence failed
        }
      } else {
        console.warn('[WC Context] Cannot persist sessions - missing sessionToken or usbPath');
      }

      // Clear proposal and address
      setSessionProposal(null);
      setCurrentAddress(null);
    } catch (err) {
      console.error('[WC Context] Session approval failed:', err);
      throw err;
    }
  }, [client, sessionProposal, currentAddress]);

  // Reject session
  const rejectSession = useCallback(async () => {
    if (!client || !sessionProposal) {
      throw new Error('No session proposal to reject');
    }

    try {
      console.log('[WC Context] Rejecting session...');
      await client.rejectSession(sessionProposal.params.id, 'User rejected');
      setSessionProposal(null);
      console.log('[WC Context] Session rejected');
    } catch (err) {
      console.error('[WC Context] Session rejection failed:', err);
      throw err;
    }
  }, [client, sessionProposal]);

  // Disconnect session
  const disconnectSession = useCallback(async (topic: string) => {
    if (!client) {
      throw new Error('WalletConnect not initialized');
    }

    try {
      console.log('[WC Context] Disconnecting session:', topic);
      await client.disconnectSession(topic, 'User disconnected');

      // Update sessions
      const updatedSessions = client.getActiveSessions();
      setSessions(updatedSessions);

      console.log('[WC Context] Session disconnected');

      // Update USB storage
      const sessionToken = getSessionToken();
      if (sessionToken && usbPath) {
        try {
          await invoke('delete_wc_session', {
            usbPath,
            sessionToken,
            topic,
          });
          console.log('[WC Context] ✅ Session removed from USB');
        } catch (persistError) {
          console.error('[WC Context] Failed to remove session from USB:', persistError);
        }
      }
    } catch (err) {
      console.error('[WC Context] Session disconnect failed:', err);
      throw err;
    }
  }, [client, getSessionToken, usbPath]);

  // Recover sessions from USB after app unlock
  const recoverSessions = useCallback(async (sessionToken: string, usbPath: string) => {
    if (!client || !initialized) {
      console.log('[WC Context] Client not initialized, skipping session recovery');
      return;
    }

    try {
      console.log('[WC Context] Recovering sessions from USB...');

      // Load encrypted sessions from USB
      const wcSessions = await invoke<WalletConnectSession[]>('load_wc_sessions', {
        usbPath,
        sessionToken,
      });

      console.log(`[WC Context] Loaded ${wcSessions.length} sessions from USB`);

      // WalletConnect SignClient automatically restores sessions from its internal storage
      // We just need to sync our React state with the client's active sessions
      const activeSessions = client.getActiveSessions();

      if (activeSessions.length > 0) {
        setSessions(activeSessions);
        console.log(`[WC Context] ✅ Recovered ${activeSessions.length} active sessions`);
      } else if (wcSessions.length > 0) {
        // If client has no sessions but we have them in USB, there might be a sync issue
        console.warn('[WC Context] Sessions found in USB but not in client. They may have expired.');
        // TODO: Could implement session re-establishment if needed (Phase 2)
      }
    } catch (err) {
      console.error('[WC Context] Session recovery failed:', err);
      // Don't throw - recovery failure shouldn't block app startup
    }
  }, [client, initialized]);

  // Modal actions
  const openPairingModal = useCallback((address?: string) => {
    if (address) {
      setCurrentAddress(address);
    }
    setShowPairingModal(true);
  }, []);

  const closePairingModal = useCallback(() => {
    setShowPairingModal(false);
  }, []);

  const value: WalletConnectContextValue = {
    initialized,
    initializing,
    error,
    sessions,
    showPairingModal,
    sessionProposal,
    init,
    openPairingModal,
    closePairingModal,
    pair,
    approveSession,
    rejectSession,
    disconnectSession,
    recoverSessions,
  };

  return (
    <WalletConnectContext.Provider value={value}>
      {children}
    </WalletConnectContext.Provider>
  );
};

export const useWalletConnect = (): WalletConnectContextValue => {
  const context = useContext(WalletConnectContext);
  if (!context) {
    throw new Error('useWalletConnect must be used within WalletConnectProvider');
  }
  return context;
};
