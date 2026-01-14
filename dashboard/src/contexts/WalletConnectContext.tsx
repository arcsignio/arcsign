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

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { SessionTypes } from '@walletconnect/types';
import { getWalletConnectClient, WalletConnectClient } from '@/services/walletconnect/client';
import { generateNamespaces } from '@/services/walletconnect/session-manager';
import type { SessionApprovalRequest, WalletConnectConfig } from '@/services/walletconnect/types';
import { invoke } from '@tauri-apps/api/tauri';

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
  openPairingModal: () => void;
  closePairingModal: () => void;
  pair: (uri: string) => Promise<void>;
  approveSession: (address: string) => Promise<void>;
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
  const [client, setClient] = useState<WalletConnectClient | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [sessions, setSessions] = useState<SessionTypes.Struct[]>([]);
  const [showPairingModal, setShowPairingModal] = useState(false);
  const [sessionProposal, setSessionProposal] = useState<SessionApprovalRequest | null>(null);

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
  const approveSession = useCallback(async (address: string) => {
    if (!client || !sessionProposal) {
      throw new Error('No session proposal to approve');
    }

    try {
      console.log('[WC Context] Approving session for address:', address);

      // Generate namespaces
      const namespaces = generateNamespaces(
        address,
        sessionProposal.params.requiredNamespaces,
        sessionProposal.params.optionalNamespaces
      );

      // Approve session
      const session = await client.approveSession(sessionProposal.params.id, namespaces);

      // Update sessions
      const updatedSessions = client.getActiveSessions();
      setSessions(updatedSessions);

      // Clear proposal
      setSessionProposal(null);

      console.log('[WC Context] Session approved:', session.topic);

      // TODO: Persist session to USB (Phase 1 completion)
      // Will be implemented when integrating with AppPasswordContext
    } catch (err) {
      console.error('[WC Context] Session approval failed:', err);
      throw err;
    }
  }, [client, sessionProposal]);

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

      // TODO: Remove from USB storage
    } catch (err) {
      console.error('[WC Context] Session disconnect failed:', err);
      throw err;
    }
  }, [client]);

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

      // TODO: Restore sessions to WalletConnect client
      // This requires client.core.pairing.restore() or similar
      // Will be implemented in Phase 1 completion

      // For now, just update the sessions list
      const activeSessions = client.getActiveSessions();
      setSessions(activeSessions);
    } catch (err) {
      console.error('[WC Context] Session recovery failed:', err);
      // Don't throw - recovery failure shouldn't block app startup
    }
  }, [client, initialized]);

  // Modal actions
  const openPairingModal = useCallback(() => {
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
