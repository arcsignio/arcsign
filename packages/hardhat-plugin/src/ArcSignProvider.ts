/**
 * ArcSign Provider
 *
 * Manages connection to ArcSign Dashboard and creates signers.
 */

import { Provider } from "ethers";
import { ArcSignClient } from "./ArcSignClient";
import { ArcSignSigner } from "./ArcSignSigner";

export class ArcSignProvider {
  private client: ArcSignClient;
  private accounts: string[] = [];

  constructor(wsUrl: string = "ws://127.0.0.1:9527") {
    this.client = new ArcSignClient(wsUrl);
  }

  /**
   * Connect to ArcSign Dashboard
   */
  async connect(): Promise<void> {
    await this.client.connect();

    // Verify connection with ping
    const pingResult = await this.client.ping();
    console.log(`[ArcSign] ✓ Connected to ${pingResult.wallet} v${pingResult.version}`);

    // Get available accounts
    const accountsResult = await this.client.getAccounts();
    this.accounts = accountsResult.accounts;

    if (this.accounts.length === 0) {
      console.warn("[ArcSign] ⚠️ No accounts available. Please unlock a wallet in ArcSign Dashboard.");
    } else {
      console.log(`[ArcSign] Available accounts:`);
      this.accounts.forEach((addr, i) => {
        console.log(`[ArcSign]   [${i}] ${addr}`);
      });
    }
  }

  /**
   * Disconnect from ArcSign Dashboard
   */
  disconnect(): void {
    this.client.disconnect();
  }

  /**
   * Check if connected
   */
  async isConnected(): Promise<boolean> {
    if (!this.client.isConnected()) {
      return false;
    }

    try {
      await this.client.ping();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get available accounts
   */
  async getAccounts(): Promise<string[]> {
    if (this.accounts.length === 0) {
      const result = await this.client.getAccounts();
      this.accounts = result.accounts;
    }
    return this.accounts;
  }

  /**
   * Get signers for all accounts
   */
  async getSigners(provider: Provider): Promise<ArcSignSigner[]> {
    const accounts = await this.getAccounts();

    if (accounts.length === 0) {
      throw new Error(
        "No accounts available from ArcSign. " +
        "Please make sure:\n" +
        "  1. ArcSign Dashboard is running\n" +
        "  2. A wallet is unlocked\n" +
        "  3. The wallet has at least one address"
      );
    }

    return accounts.map((address) => new ArcSignSigner(address, this.client, provider));
  }

  /**
   * Get a signer for a specific address
   */
  async getSigner(address: string, provider: Provider): Promise<ArcSignSigner> {
    const accounts = await this.getAccounts();

    const normalizedAddress = address.toLowerCase();
    const matchedAddress = accounts.find(
      (a) => a.toLowerCase() === normalizedAddress
    );

    if (!matchedAddress) {
      throw new Error(
        `Address ${address} is not available in ArcSign. ` +
        `Available addresses: ${accounts.join(", ")}`
      );
    }

    return new ArcSignSigner(matchedAddress, this.client, provider);
  }

  /**
   * Get the underlying client
   */
  getClient(): ArcSignClient {
    return this.client;
  }

  /**
   * Get developer session status
   */
  async getSession() {
    return this.client.getDevSession();
  }

  /**
   * Create a developer session for auto-signing testnets
   */
  async createSession(params: {
    walletId: string;
    durationMinutes?: number;
    trustedNetworks?: string[];
    maxGasLimit?: string;
  }) {
    return this.client.createDevSession({
      wallet_id: params.walletId,
      duration_minutes: params.durationMinutes,
      trusted_networks: params.trustedNetworks,
      max_gas_limit: params.maxGasLimit,
    });
  }

  /**
   * End the current developer session
   */
  async endSession() {
    return this.client.endDevSession();
  }
}
