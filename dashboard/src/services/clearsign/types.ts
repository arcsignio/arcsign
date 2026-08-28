// Decoded, human-readable intent of a transaction calldata or EIP-712 message.
// Produced entirely locally (no external API). `readable: false` means we could
// not decode it — the UI must then warn and fall back to raw hex.

export type ClearSignRisk = "unlimited-approval" | "approve-all-nfts" | "permit-approval";

export interface DecodedParam {
  label: string; // e.g. "To", "Amount", "Spender"
  value: string; // already human-formatted (address shortened, amount with symbol)
}

export interface DecodedIntent {
  readable: boolean;        // false → show "cannot read" warning + raw hex
  title: string;            // e.g. "Transfer 100 USDC", or "Unreadable transaction"
  params: DecodedParam[];   // structured rows shown under the title
  risks: ClearSignRisk[];   // risk badges (unlimited approve, setApprovalForAll, permit)
  raw: string;              // the original hex / typed-data JSON, always kept
  abiSource?: "local" | "sourcify-full" | "sourcify-partial" | "erc7730";
  /** Present only when abiSource === "erc7730". Display metadata, never a security signal. */
  descriptorMeta?: {
    owner: string;        // protocol that published the descriptor, e.g. "Uniswap Labs"
    contractName: string; // e.g. "Uniswap v3 Router 2"
  };
  /**
   * ERC-8213 fingerprint of the exact bytes being signed. Always present for
   * transactions and typed data. A statement of fact for cross-device
   * verification — never a verdict, and never an input to any safety gate.
   */
  digest?: {
    kind: "calldata" | "eip712";
    primary: string;
    /** EIP-712 only: the two halves, shown behind a disclosure. */
    detail?: { domainHash: string; messageHash: string };
  };
}
