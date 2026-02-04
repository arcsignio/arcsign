/**
 * ArcSign WebSocket Client
 *
 * Handles communication with the ArcSign Dashboard via WebSocket.
 */

import WebSocket from "ws";

export interface WsRequest {
  id: number;
  method: string;
  params?: Record<string, unknown>;
}

export interface WsResponse {
  id: number;
  success: boolean;
  result?: unknown;
  error?: string;
}

export interface DevContext {
  script_name?: string;
  project_path?: string;
  description?: string;
  is_dev_wallet?: boolean;
}

export interface TransactionParams {
  from: string;
  to: string;
  data: string;
  value?: string;
  gas?: string;
  gasPrice?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  chainId: number;
  nonce?: number;
  context?: DevContext;
}

export class ArcSignClient {
  private ws: WebSocket | null = null;
  private url: string;
  private requestId = 0;
  private pendingRequests = new Map<number, {
    resolve: (value: WsResponse) => void;
    reject: (error: Error) => void;
  }>();
  private connectPromise: Promise<void> | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;

  constructor(url: string = "ws://127.0.0.1:9527") {
    this.url = url;
  }

  /**
   * Connect to ArcSign Dashboard
   */
  async connect(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    if (this.connectPromise) {
      return this.connectPromise;
    }

    this.connectPromise = new Promise<void>((resolve, reject) => {
      console.log(`[ArcSign] Connecting to ${this.url}...`);

      this.ws = new WebSocket(this.url);

      this.ws.on("open", () => {
        console.log("[ArcSign] Connected to ArcSign Dashboard");
        this.reconnectAttempts = 0;
        this.connectPromise = null;
        resolve();
      });

      this.ws.on("message", (data: WebSocket.Data) => {
        try {
          const response = JSON.parse(data.toString()) as WsResponse;
          const pending = this.pendingRequests.get(response.id);

          if (pending) {
            this.pendingRequests.delete(response.id);
            pending.resolve(response);
          }
        } catch (err) {
          console.error("[ArcSign] Failed to parse response:", err);
        }
      });

      this.ws.on("error", (err) => {
        console.error("[ArcSign] WebSocket error:", err.message);
        this.connectPromise = null;
        reject(new Error(`Failed to connect to ArcSign: ${err.message}`));
      });

      this.ws.on("close", () => {
        console.log("[ArcSign] Connection closed");
        this.ws = null;
        this.connectPromise = null;

        // Reject all pending requests
        for (const [id, pending] of this.pendingRequests) {
          pending.reject(new Error("Connection closed"));
          this.pendingRequests.delete(id);
        }
      });

      // Connection timeout
      setTimeout(() => {
        if (this.ws?.readyState !== WebSocket.OPEN) {
          this.ws?.close();
          this.connectPromise = null;
          reject(new Error("Connection timeout - is ArcSign Dashboard running?"));
        }
      }, 10000);
    });

    return this.connectPromise;
  }

  /**
   * Disconnect from ArcSign Dashboard
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Send a request and wait for response
   */
  private async sendRequest<T = unknown>(method: string, params?: Record<string, unknown>): Promise<T> {
    if (!this.isConnected()) {
      await this.connect();
    }

    const id = ++this.requestId;
    const request: WsRequest = { id, method, params };

    return new Promise<T>((resolve, reject) => {
      // Set timeout for response
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request timeout: ${method}`));
      }, 300000); // 5 minute timeout for signing

      this.pendingRequests.set(id, {
        resolve: (response) => {
          clearTimeout(timeout);
          if (response.success) {
            resolve(response.result as T);
          } else {
            reject(new Error(response.error || "Request failed"));
          }
        },
        reject: (err) => {
          clearTimeout(timeout);
          reject(err);
        },
      });

      this.ws!.send(JSON.stringify(request));
    });
  }

  /**
   * Ping the server
   */
  async ping(): Promise<{ status: string; version: string; wallet: string }> {
    return this.sendRequest("ping");
  }

  /**
   * Get available accounts
   */
  async getAccounts(): Promise<{ accounts: string[]; chainId: number }> {
    return this.sendRequest("get_accounts");
  }

  /**
   * Sign a transaction (developer mode)
   */
  async devSignTransaction(params: TransactionParams): Promise<{
    status: string;
    tx_hash?: string;
    signed_tx?: string;
    network?: string;
  }> {
    return this.sendRequest("dev_sign_transaction", {
      from: params.from,
      to: params.to,
      data: params.data,
      value: params.value || "0x0",
      gas: params.gas,
      gas_price: params.gasPrice,
      max_fee_per_gas: params.maxFeePerGas,
      max_priority_fee_per_gas: params.maxPriorityFeePerGas,
      chain_id: params.chainId,
      nonce: params.nonce,
      context: params.context,
    });
  }

  /**
   * Personal sign (EIP-191)
   */
  async personalSign(address: string, message: string, context?: DevContext): Promise<{
    signature: string;
  }> {
    return this.sendRequest("personal_sign", {
      address,
      message,
      context,
    });
  }

  /**
   * Sign typed data (EIP-712)
   */
  async signTypedData(address: string, typedData: unknown, context?: DevContext): Promise<{
    signature: string;
  }> {
    return this.sendRequest("sign_typed_data_v4", {
      address,
      typed_data: typedData,
      context,
    });
  }

  /**
   * Get developer session status
   */
  async getDevSession(): Promise<{
    active: boolean;
    session?: {
      enabled: boolean;
      expires_at: number;
      trusted_networks: string[];
      sign_count: number;
    };
    remaining_ms?: number;
    message?: string;
  }> {
    return this.sendRequest("dev_get_session");
  }

  /**
   * Create a developer session
   */
  async createDevSession(params: {
    wallet_id: string;
    duration_minutes?: number;
    trusted_networks?: string[];
    max_gas_limit?: string;
  }): Promise<{
    status: string;
    session: {
      enabled: boolean;
      created_at: number;
      expires_at: number;
      trusted_networks: string[];
      sign_count: number;
    };
  }> {
    return this.sendRequest("dev_create_session", params);
  }

  /**
   * End the developer session
   */
  async endDevSession(): Promise<{
    status: string;
    sign_count?: number;
    message?: string;
  }> {
    return this.sendRequest("dev_end_session");
  }
}
