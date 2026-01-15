/**
 * WalletConnect Context
 * Feature: WalletConnect v2 integration - Global state management
 * Updated: 2026-01-15
 *
 * Manages:
 * - WalletConnect client lifecycle
 * - Active sessions
 * - Pairing and approval flows
 * - Session persistence and recovery
 * - Sign request handling (Phase 2)
 */

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import type { SessionTypes } from '@walletconnect/types';
import { getWalletConnectClient, WalletConnectClient } from '@/services/walletconnect/client';
import { generateNamespaces } from '@/services/walletconnect/session-manager';
import type { SessionApprovalRequest, WalletConnectConfig } from '@/services/walletconnect/types';
import { invoke } from '@tauri-apps/api/tauri';
import { useAppPassword } from './AppPasswordContext';
import {
  handleRequest,
  type WCRequest,
  type HandlerContext,
  type SignatureRequestParams,
  type SignatureResult,
} from '@/services/walletconnect/request-handler';
// Import handlers module to auto-register all methods
// To add a new method: just create a handler file in methods/ and import it in methods/index.ts
import '@/services/walletconnect/methods';

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

  // Sign request state (Phase 2)
  signRequest: SignatureRequestParams | null;
  showSignDialog: boolean;

  // Wallet context state (for checking if wallet is ready)
  walletReady: boolean;

  // Actions
  init: (config: WalletConnectConfig) => Promise<void>;
  openPairingModal: (address?: string) => void;
  closePairingModal: () => void;
  pair: (uri: string) => Promise<void>;
  approveSession: (address?: string) => Promise<void>;
  rejectSession: () => Promise<void>;
  disconnectSession: (topic: string) => Promise<void>;
  disconnectAllSessions: () => Promise<void>;

  // Sign request actions (Phase 2)
  approveSignRequest: (password: string) => void;
  rejectSignRequest: () => void;

  // Session recovery
  recoverSessions: (sessionToken: string, usbPath: string) => Promise<void>;

  // Wallet context setter (for connecting handlers with wallet info)
  setWalletContext: (walletId: string, address: string) => void;
  clearWalletContext: () => void;
}

const WalletConnectContext = createContext<WalletConnectContextValue | null>(null);

interface WalletConnectSession {
  topic: string;
  data: string;
}

// Type for pending sign request resolver
interface PendingSignRequest {
  resolve: (result: SignatureResult) => void;
  reject: (error: Error) => void;
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

  // Sign request state (Phase 2)
  const [signRequest, setSignRequest] = useState<SignatureRequestParams | null>(null);
  const [showSignDialog, setShowSignDialog] = useState(false);
  const pendingSignRequestRef = useRef<PendingSignRequest | null>(null);

  // Wallet context for handlers (set from WalletDetail when wallet is selected)
  const [walletId, setWalletId] = useState<string | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);

  // Refs to hold latest values for event handler closures
  // This is necessary because event listeners are set once during init
  // but we need to access the latest values when requests come in
  const walletIdRef = useRef<string | null>(null);
  const walletAddressRef = useRef<string | null>(null);
  const usbPathRef = useRef<string | null>(null);

  // Keep refs in sync with state
  walletIdRef.current = walletId;
  walletAddressRef.current = walletAddress;
  usbPathRef.current = usbPath;

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

  // Request signature from user - shows dialog and waits for approval
  const requestSignature = useCallback((params: SignatureRequestParams): Promise<SignatureResult> => {
    return new Promise((resolve, reject) => {
      // Store the resolver
      pendingSignRequestRef.current = { resolve, reject };
      // Show the sign dialog with request params
      setSignRequest(params);
      setShowSignDialog(true);
    });
  }, []);

  // Get RPC URL for a chain
  const getRpcUrl = useCallback((chainId: number): string | null => {
    // Default RPC URLs for supported chains
    const rpcUrls: Record<number, string> = {
      1: 'https://eth.llamarpc.com',
      56: 'https://bsc-dataseed.binance.org',
      137: 'https://polygon-rpc.com',
      42161: 'https://arb1.arbitrum.io/rpc',
      10: 'https://mainnet.optimism.io',
      8453: 'https://mainnet.base.org',
    };
    return rpcUrls[chainId] || null;
  }, []);

  // Handle session request - main integration point
  // Note: This uses refs to access latest values because event listeners
  // are set once during init but we need current values when requests arrive
  const handleSessionRequest = useCallback(async (
    wcClient: WalletConnectClient,
    request: WCRequest
  ) => {
    const { topic } = request;
    console.log('[WC Context] Processing session request:', { topic, method: request.params.request.method });

    // Get latest values from refs (not closure-captured state)
    const currentWalletId = walletIdRef.current;
    const currentWalletAddress = walletAddressRef.current;
    const currentUsbPath = usbPathRef.current;

    console.log('[WC Context] Current context from refs:', {
      walletId: currentWalletId,
      walletAddress: currentWalletAddress?.slice(0, 10) + '...',
      usbPath: currentUsbPath,
    });

    // Get session for this request
    const activeSessions = wcClient.getActiveSessions();
    const session = activeSessions.find(s => s.topic === topic);

    if (!session) {
      console.error('[WC Context] Session not found for topic:', topic);
      await wcClient.respondSessionRequest(topic, {
        id: request.id,
        error: { code: 4100, message: 'Session not found' },
      });
      return;
    }

    // Get wallet address from session namespaces
    const accounts = session.namespaces?.eip155?.accounts || [];
    const address = accounts[0]?.split(':')[2] || currentWalletAddress;

    if (!address) {
      console.error('[WC Context] No wallet address available');
      await wcClient.respondSessionRequest(topic, {
        id: request.id,
        error: { code: 4100, message: 'No wallet connected' },
      });
      return;
    }

    // Check required context - use refs for latest values
    if (!currentWalletId || !currentUsbPath) {
      console.error('[WC Context] Missing wallet context:', { walletId: currentWalletId, usbPath: currentUsbPath });
      // Note: This happens when WC session is recovered but user hasn't selected a wallet yet
      // User needs to open a wallet in the app before they can sign requests
      await wcClient.respondSessionRequest(topic, {
        id: request.id,
        error: {
          code: 4100,
          message: 'Please open a wallet in ArcSign first. Go to your wallet details page to enable signing.'
        },
      });
      return;
    }

    // Get session token for provider config
    const sessionToken = getSessionToken();
    if (!sessionToken) {
      console.error('[WC Context] No session token available');
      await wcClient.respondSessionRequest(topic, {
        id: request.id,
        error: { code: 4100, message: 'Session expired. Please unlock the app.' },
      });
      return;
    }

    // Build handler context with all required fields
    const context: HandlerContext = {
      address,
      walletId: currentWalletId,
      usbPath: currentUsbPath,
      passphrase: '', // BIP39 passphrase - empty by default
      sessionToken,
      requestSignature,
      getRpcUrl,
    };

    // Route request to handler
    const response = await handleRequest(request, session, context);

    // Send response back to dApp
    console.log('[WC Context] Sending response to dApp:', response);
    await wcClient.respondSessionRequest(topic, response);
  }, [getSessionToken, requestSignature, getRpcUrl]); // No longer depends on state values, uses refs instead

  // Setup event listeners
  const setupEventListeners = useCallback((wcClient: WalletConnectClient) => {
    console.log('[WC Context] Setting up event listeners...');

    // Session proposal (after pairing)
    wcClient.on('session_proposal', (proposal) => {
      console.log('[WC Context] Session proposal received:', proposal);
      setSessionProposal(proposal as SessionApprovalRequest);
      setShowPairingModal(false); // Close pairing modal
    });

    // Session request (method calls from dApp) - Phase 2 integration
    wcClient.on('session_request', async (request) => {
      console.log('[WC Context] Session request received:', request);
      await handleSessionRequest(wcClient, request as WCRequest);
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
  }, [handleSessionRequest]);

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

  // Sign request actions (Phase 2)
  const approveSignRequest = useCallback((password: string) => {
    console.log('[WC Context] User approved sign request');
    if (pendingSignRequestRef.current) {
      pendingSignRequestRef.current.resolve({ approved: true, password });
      pendingSignRequestRef.current = null;
    }
    setShowSignDialog(false);
    setSignRequest(null);
  }, []);

  const rejectSignRequest = useCallback(() => {
    console.log('[WC Context] User rejected sign request');
    if (pendingSignRequestRef.current) {
      pendingSignRequestRef.current.resolve({ approved: false });
      pendingSignRequestRef.current = null;
    }
    setShowSignDialog(false);
    setSignRequest(null);
  }, []);

  // Set wallet context for handlers
  const setWalletContext = useCallback((newWalletId: string, address: string) => {
    console.log('[WC Context] Setting wallet context:', { walletId: newWalletId, address });
    setWalletId(newWalletId);
    setWalletAddress(address);
  }, []);

  // Clear wallet context (on logout/session expiry)
  const clearWalletContext = useCallback(() => {
    console.log('[WC Context] Clearing wallet context');
    setWalletId(null);
    setWalletAddress(null);
  }, []);

  // Disconnect all sessions (for security - on logout/session expiry)
  const disconnectAllSessions = useCallback(async () => {
    if (!client) {
      console.log('[WC Context] Client not initialized, nothing to disconnect');
      return;
    }

    const activeSessions = client.getActiveSessions();
    if (activeSessions.length === 0) {
      console.log('[WC Context] No active sessions to disconnect');
      return;
    }

    console.log(`[WC Context] Disconnecting ${activeSessions.length} sessions for security...`);

    // Disconnect all sessions
    for (const session of activeSessions) {
      try {
        await client.disconnectSession(session.topic, 'Wallet session expired');
        console.log(`[WC Context] Disconnected session: ${session.topic}`);
      } catch (err) {
        console.error(`[WC Context] Failed to disconnect session ${session.topic}:`, err);
      }
    }

    // Clear local state
    setSessions([]);
    clearWalletContext();

    // Clear USB storage
    const sessionToken = getSessionToken();
    if (sessionToken && usbPath) {
      try {
        // Delete all sessions from USB
        for (const session of activeSessions) {
          await invoke('delete_wc_session', {
            usbPath,
            sessionToken,
            topic: session.topic,
          });
        }
        console.log('[WC Context] ✅ All sessions removed from USB');
      } catch (persistError) {
        console.error('[WC Context] Failed to remove sessions from USB:', persistError);
      }
    }

    console.log('[WC Context] ✅ All sessions disconnected for security');
  }, [client, getSessionToken, usbPath, clearWalletContext]);

  const value: WalletConnectContextValue = {
    initialized,
    initializing,
    error,
    sessions,
    showPairingModal,
    sessionProposal,
    // Sign request state (Phase 2)
    signRequest,
    showSignDialog,
    // Wallet context state
    walletReady: !!(walletId && walletAddress),
    // Actions
    init,
    openPairingModal,
    closePairingModal,
    pair,
    approveSession,
    rejectSession,
    disconnectSession,
    disconnectAllSessions,
    // Sign request actions (Phase 2)
    approveSignRequest,
    rejectSignRequest,
    // Session recovery
    recoverSessions,
    // Wallet context setter
    setWalletContext,
    clearWalletContext,
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
