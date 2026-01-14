/**
 * WalletConnect Sign Client Wrapper
 * Feature: WalletConnect v2 integration - Client initialization and lifecycle
 * Updated: 2026-01-14
 */

import SignClient from '@walletconnect/sign-client';
import type { SessionTypes } from '@walletconnect/types';
import type { WalletConnectConfig } from './types';

export class WalletConnectClient {
  private client: SignClient | null = null;
  private config: WalletConnectConfig;
  private initialized = false;

  constructor(config: WalletConnectConfig) {
    this.config = config;
  }

  /**
   * Initialize WalletConnect Sign Client
   */
  async init(): Promise<void> {
    if (this.initialized) {
      console.warn('[WC] Client already initialized');
      return;
    }

    try {
      console.log('[WC] Initializing Sign Client...', {
        projectId: this.config.projectId.slice(0, 8) + '...',
        metadata: this.config.metadata,
      });

      this.client = await SignClient.init({
        projectId: this.config.projectId,
        relayUrl: this.config.relayUrl || 'wss://relay.walletconnect.com',
        metadata: this.config.metadata,
      });

      this.initialized = true;
      console.log('[WC] Sign Client initialized successfully');

      // Log active sessions
      const sessions = this.client.session.getAll();
      console.log(`[WC] Active sessions: ${sessions.length}`);
    } catch (error) {
      console.error('[WC] Failed to initialize Sign Client:', error);
      throw new Error(`Failed to initialize WalletConnect: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get the Sign Client instance
   */
  getClient(): SignClient {
    if (!this.client || !this.initialized) {
      throw new Error('WalletConnect client not initialized. Call init() first.');
    }
    return this.client;
  }

  /**
   * Check if client is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Pair with dApp using WC URI (wc:...)
   * Desktop wallet doesn't scan QR - it receives URI via paste/clipboard/deep-link
   */
  async pair(uri: string): Promise<void> {
    const client = this.getClient();

    try {
      console.log('[WC] Pairing with URI:', uri.slice(0, 20) + '...');
      await client.pair({ uri });
      console.log('[WC] Pairing initiated successfully');
    } catch (error) {
      console.error('[WC] Pairing failed:', error);
      throw new Error(`Failed to pair: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Approve session proposal
   */
  async approveSession(
    proposalId: number,
    namespaces: Record<string, SessionTypes.Namespace>
  ): Promise<any> {
    const client = this.getClient();

    try {
      console.log('[WC] Approving session:', { proposalId, namespaces });

      const session = await client.approve({
        id: proposalId,
        namespaces,
      });

      console.log('[WC] Session approved:', session.topic);
      return session;
    } catch (error) {
      console.error('[WC] Session approval failed:', error);
      throw new Error(`Failed to approve session: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Reject session proposal
   */
  async rejectSession(proposalId: number, reason: string): Promise<void> {
    const client = this.getClient();

    try {
      console.log('[WC] Rejecting session:', { proposalId, reason });

      await client.reject({
        id: proposalId,
        reason: {
          code: 4001, // User rejected
          message: reason,
        },
      });

      console.log('[WC] Session rejected');
    } catch (error) {
      console.error('[WC] Session rejection failed:', error);
      throw new Error(`Failed to reject session: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Disconnect a session
   */
  async disconnectSession(topic: string, reason: string): Promise<void> {
    const client = this.getClient();

    try {
      console.log('[WC] Disconnecting session:', { topic, reason });

      await client.disconnect({
        topic,
        reason: {
          code: 6000, // User disconnected
          message: reason,
        },
      });

      console.log('[WC] Session disconnected');
    } catch (error) {
      console.error('[WC] Session disconnect failed:', error);
      throw new Error(`Failed to disconnect session: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): SessionTypes.Struct[] {
    const client = this.getClient();
    return client.session.getAll();
  }

  /**
   * Get session by topic
   */
  getSession(topic: string): SessionTypes.Struct | undefined {
    const client = this.getClient();
    return client.session.get(topic);
  }

  /**
   * Respond to session request
   */
  async respondSessionRequest(
    topic: string,
    response: { id: number; result?: unknown; error?: { code: number; message: string; data?: unknown } }
  ): Promise<void> {
    const client = this.getClient();

    try {
      if (response.error) {
        console.log('[WC] Sending error response:', response);
        const errorResponse: any = {
          code: response.error.code,
          message: response.error.message,
        };
        if (response.error.data) {
          errorResponse.data = String(response.error.data);
        }
        await client.respond({
          topic,
          response: {
            id: response.id,
            jsonrpc: '2.0',
            error: errorResponse,
          },
        });
      } else {
        console.log('[WC] Sending success response:', { id: response.id, result: response.result });
        await client.respond({
          topic,
          response: {
            id: response.id,
            jsonrpc: '2.0',
            result: response.result,
          },
        });
      }
    } catch (error) {
      console.error('[WC] Failed to respond to session request:', error);
      throw new Error(`Failed to respond: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Emit event to dApp
   */
  async emitSessionEvent(
    topic: string,
    event: { name: string; data: unknown },
    chainId: string
  ): Promise<void> {
    const client = this.getClient();

    try {
      console.log('[WC] Emitting event:', { topic, event, chainId });

      await client.emit({
        topic,
        event,
        chainId,
      });

      console.log('[WC] Event emitted successfully');
    } catch (error) {
      console.error('[WC] Failed to emit event:', error);
      throw new Error(`Failed to emit event: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Subscribe to client events
   */
  on(event: string, callback: (args: any) => void): void {
    const client = this.getClient();
    // @ts-ignore - WalletConnect types are complex, use any for flexibility
    client.on(event, callback);
  }

  /**
   * Clean up and destroy client
   */
  async destroy(): Promise<void> {
    if (!this.client) {
      return;
    }

    try {
      console.log('[WC] Destroying client...');

      // Disconnect all sessions
      const sessions = this.client.session.getAll();
      await Promise.all(
        sessions.map(session =>
          this.disconnectSession(session.topic, 'Client destroyed')
        )
      );

      this.client = null;
      this.initialized = false;

      console.log('[WC] Client destroyed');
    } catch (error) {
      console.error('[WC] Error during client destruction:', error);
    }
  }
}

// Singleton instance
let walletConnectClient: WalletConnectClient | null = null;

/**
 * Get or create WalletConnect client instance
 */
export function getWalletConnectClient(config?: WalletConnectConfig): WalletConnectClient {
  if (!walletConnectClient && config) {
    walletConnectClient = new WalletConnectClient(config);
  }

  if (!walletConnectClient) {
    throw new Error('WalletConnect client not initialized. Provide config on first call.');
  }

  return walletConnectClient;
}

/**
 * Reset singleton (for testing)
 */
export function resetWalletConnectClient(): void {
  walletConnectClient = null;
}
