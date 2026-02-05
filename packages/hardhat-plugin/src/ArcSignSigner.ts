/**
 * ArcSign Signer
 *
 * Implements ethers.js Signer interface using ArcSign wallet.
 */

import { AbstractSigner, Provider, TransactionRequest, TransactionResponse, TypedDataDomain, TypedDataField } from "ethers";
import { ArcSignClient, DevContext } from "./ArcSignClient";
import path from "path";

export class ArcSignSigner extends AbstractSigner {
  private client: ArcSignClient;
  private _address: string;

  // Public address property for compatibility with scripts that use signer.address
  public readonly address: string;

  constructor(address: string, client: ArcSignClient, provider: Provider | null = null) {
    super(provider);
    this.client = client;
    this._address = address;
    this.address = address;
  }

  /**
   * Get current script context (detected at call time)
   */
  private getCurrentScriptContext(): DevContext {
    return this.detectScriptContext();
  }

  /**
   * Detect script context from stack trace
   * Note: Should be called at signing time to capture the actual script
   */
  private detectScriptContext(): DevContext {
    const stack = new Error().stack || "";
    const lines = stack.split("\n");

    // Debug: log stack trace to help troubleshoot
    console.log("[ArcSign] Stack trace for script detection:");
    lines.slice(0, 10).forEach(line => console.log("  ", line));

    // Look for scripts/ directory or common deploy patterns in stack
    for (const line of lines) {
      // Match both formats: "at func (path:line:col)" and "at path:line:col"
      const match = line.match(/(?:at\s+(?:[\w.<>]+\s+)?)?(?:\()?([^()]+\.(ts|js)):\d+:\d+/);
      if (match) {
        const filePath = match[1];
        // Skip node_modules and internal files
        if (filePath.includes("node_modules")) continue;

        // Check for common script patterns
        if (filePath.includes("scripts/") ||
            filePath.includes("deploy") ||
            filePath.includes("hardhat") ||
            filePath.endsWith(".ts") ||
            filePath.endsWith(".js")) {
          const scriptName = path.basename(filePath);
          // Skip if it's our own files
          if (scriptName.includes("ArcSign")) continue;

          console.log("[ArcSign] Detected script:", scriptName);
          return {
            script_name: scriptName,
            project_path: path.dirname(filePath),
            is_dev_wallet: true,
          };
        }
      }
    }

    console.log("[ArcSign] Could not detect script name from stack trace");
    return {
      is_dev_wallet: true,
    };
  }

  /**
   * Connect this signer to a provider
   */
  connect(provider: Provider | null): ArcSignSigner {
    return new ArcSignSigner(this._address, this.client, provider);
  }

  /**
   * Get the address
   */
  async getAddress(): Promise<string> {
    return this._address;
  }

  /**
   * Sign a message (EIP-191)
   */
  async signMessage(message: string | Uint8Array): Promise<string> {
    const messageStr = typeof message === "string"
      ? message
      : "0x" + Buffer.from(message).toString("hex");

    console.log(`[ArcSign] Signing message with ${this.formatAddress(this._address)}...`);
    console.log(`[ArcSign] ⏳ Waiting for approval in ArcSign Dashboard...`);

    const result = await this.client.personalSign(this._address, messageStr, {
      ...this.getCurrentScriptContext(),
      description: "Sign Message",
    });

    console.log(`[ArcSign] ✓ Message signed`);
    return result.signature;
  }

  /**
   * Sign typed data (EIP-712)
   */
  async signTypedData(
    domain: TypedDataDomain,
    types: Record<string, TypedDataField[]>,
    value: Record<string, unknown>
  ): Promise<string> {
    const typedData = {
      types: {
        EIP712Domain: [
          { name: "name", type: "string" },
          { name: "version", type: "string" },
          { name: "chainId", type: "uint256" },
          { name: "verifyingContract", type: "address" },
        ],
        ...types,
      },
      primaryType: Object.keys(types)[0],
      domain,
      message: value,
    };

    console.log(`[ArcSign] Signing typed data with ${this.formatAddress(this._address)}...`);
    console.log(`[ArcSign] ⏳ Waiting for approval in ArcSign Dashboard...`);

    const result = await this.client.signTypedData(this._address, typedData, {
      ...this.getCurrentScriptContext(),
      description: "Sign Typed Data",
    });

    console.log(`[ArcSign] ✓ Typed data signed`);
    return result.signature;
  }

  /**
   * Sign a transaction
   */
  async signTransaction(tx: TransactionRequest): Promise<string> {
    if (!this.provider) {
      throw new Error("Provider not set");
    }

    // Resolve addresses and estimate gas if needed
    const resolvedTx = await this.populateTransaction(tx);

    console.log(`[ArcSign] Signing transaction...`);
    console.log(`[ArcSign]   From: ${this.formatAddress(this._address)}`);
    console.log(`[ArcSign]   To: ${resolvedTx.to ? this.formatAddress(resolvedTx.to.toString()) : "(Contract Deploy)"}`);
    console.log(`[ArcSign]   Value: ${resolvedTx.value || "0"}`);
    console.log(`[ArcSign] ⏳ Waiting for approval in ArcSign Dashboard...`);

    const network = await this.provider.getNetwork();

    const result = await this.client.devSignTransaction({
      from: this._address,
      to: resolvedTx.to?.toString() || "",
      data: resolvedTx.data?.toString() || "0x",
      value: resolvedTx.value?.toString(),
      gas: resolvedTx.gasLimit?.toString(),
      gasPrice: resolvedTx.gasPrice?.toString(),
      maxFeePerGas: resolvedTx.maxFeePerGas?.toString(),
      maxPriorityFeePerGas: resolvedTx.maxPriorityFeePerGas?.toString(),
      chainId: Number(network.chainId),
      nonce: resolvedTx.nonce !== undefined ? Number(resolvedTx.nonce) : undefined,
      context: {
        ...this.getCurrentScriptContext(),
        description: resolvedTx.to ? "Contract Call" : "Deploy Contract",
      },
    });

    if (!result.signed_tx) {
      throw new Error("No signed transaction returned");
    }

    console.log(`[ArcSign] ✓ Transaction signed`);

    // The signed_tx from ArcSign is base64 encoded - convert to hex with 0x prefix
    // RPC nodes expect hex format for eth_sendRawTransaction
    const signedTxHex = this.base64ToHex(result.signed_tx);
    return signedTxHex;
  }

  /**
   * Send a transaction
   */
  async sendTransaction(tx: TransactionRequest): Promise<TransactionResponse> {
    if (!this.provider) {
      throw new Error("Provider not set");
    }

    // Sign the transaction
    const signedTx = await this.signTransaction(tx);

    // Broadcast it
    console.log(`[ArcSign] Broadcasting transaction...`);
    const response = await this.provider.broadcastTransaction(signedTx);
    console.log(`[ArcSign] ✓ Transaction submitted: ${response.hash}`);

    return response;
  }

  /**
   * Format address for display
   */
  private formatAddress(address: string): string {
    if (address.length >= 10) {
      return `${address.slice(0, 6)}...${address.slice(-4)}`;
    }
    return address;
  }

  /**
   * Convert base64 encoded string to hex with 0x prefix
   * ArcSign returns signed transactions in base64, but RPC expects hex
   */
  private base64ToHex(base64: string): string {
    // Decode base64 to bytes
    const bytes = Buffer.from(base64, "base64");
    // Convert to hex with 0x prefix
    return "0x" + bytes.toString("hex");
  }
}
