/**
 * ERC-7730 descriptor resolution.
 *
 * Asks the backend to render calldata through the official registry descriptor,
 * which describes what each parameter MEANS — something an ABI alone cannot say
 * (which argument is the slippage floor, which is the recipient, which is the
 * deadline).
 *
 * Returns null whenever that is not possible — no descriptor, a backend error,
 * a malformed reply — so the caller keeps its existing calldata decoding. A
 * descriptor failure must never block or alter signing.
 *
 * SECURITY: descriptors are display only. Nothing here feeds the blacklist,
 * requiresAcknowledge, or the signing gate.
 */

import { invoke } from "@tauri-apps/api/core";
import type { DecodedIntent, ClearSignRisk } from "./types";

export interface ResolveDescriptorArgs {
  chainId: number;
  to: string;
  /** 4-byte function selector, 0x-prefixed. */
  selector: string;
  /** Calldata already decoded by the caller (the backend does no ABI decoding). */
  decoded: Record<string, unknown>;
  /** Original hex, always preserved on the returned intent. */
  raw: string;
  usbPath?: string;
  sessionToken?: string;
  tokens?: Array<{ address: string; symbol: string; decimals: number }>;
  /** Risks detected by the existing decoder; carried through unchanged. */
  risks?: ClearSignRisk[];
}

interface ResolvedIntentDto {
  intent: string;
  owner: string;
  contractName: string;
  fields: Array<{ label: string; value: string }>;
}

export async function intentFromDescriptor(
  args: ResolveDescriptorArgs,
): Promise<DecodedIntent | null> {
  let dto: ResolvedIntentDto | null;
  try {
    dto = await invoke<ResolvedIntentDto | null>("resolve_descriptor", {
      input: {
        chainId: args.chainId,
        to: args.to,
        selector: args.selector,
        decoded: args.decoded,
        usbPath: args.usbPath ?? "",
        sessionToken: args.sessionToken ?? "",
        tokens: args.tokens ?? [],
      },
    });
  } catch {
    return null; // never let a descriptor failure reach the signing flow
  }

  if (!dto || !Array.isArray(dto.fields) || dto.fields.length === 0) {
    return null;
  }

  return {
    readable: true,
    title: dto.intent || dto.contractName,
    params: dto.fields.map((f) => ({ label: f.label, value: f.value })),
    // Risk badges come from the existing detector, not from the descriptor:
    // a descriptor describes intent, it does not assess danger.
    risks: args.risks ?? [],
    raw: args.raw,
    abiSource: "erc7730",
    descriptorMeta: { owner: dto.owner, contractName: dto.contractName },
  };
}

export interface DescriptorStatus {
  version: string;
  count: number;
}

/** Read the active descriptor set's version and size. */
export async function getDescriptorStatus(
  usbPath: string,
  sessionToken?: string,
): Promise<DescriptorStatus | null> {
  try {
    return await invoke<DescriptorStatus>("get_descriptor_status", {
      input: { usbPath, sessionToken: sessionToken ?? "" },
    });
  } catch {
    return null;
  }
}

/**
 * Download the latest descriptor set. This is the only descriptor code path
 * that touches the network, and it runs only on explicit user action.
 */
export async function updateDescriptors(
  usbPath: string,
  sessionToken?: string,
): Promise<DescriptorStatus> {
  return invoke<DescriptorStatus>("update_descriptors", {
    input: { usbPath, sessionToken: sessionToken ?? "" },
  });
}
