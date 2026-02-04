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
  private scriptContext: DevContext;

  constructor(address: string, client: ArcSignClient, provider: Provider | null = null) {
    super(provider);
    this.client = client;
    this._address = address;

    // Detect script context from call stack
    this.scriptContext = this.detectScriptContext();
  }

  /**
   * Detect script context from stack trace
   */
  private detectScriptContext(): DevContext {
    const stack = new Error().stack || "";
    const lines = stack.split("\n");

    // Look for scripts/ directory in stack
    for (const line of lines) {
      const match = line.match(/at.*\((.+\.(ts|js)):\d+:\d+\)/);
      if (match) {
        const filePath = match[1];
        if (filePath.includes("scripts/") || filePath.includes("deploy")) {
          return {
            script_name: path.basename(filePath),
            project_path: path.dirname(filePath),
            is_dev_wallet: true,
          };
        }
      }
    }

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
      ...this.scriptContext,
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
      ...this.scriptContext,
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
        ...this.scriptContext,
        description: resolvedTx.to ? "Contract Call" : "Deploy Contract",
      },
    });

    if (!result.signed_tx) {
      throw new Error("No signed transaction returned");
    }

    console.log(`[ArcSign] ✓ Transaction signed`);
    return result.signed_tx;
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
}
