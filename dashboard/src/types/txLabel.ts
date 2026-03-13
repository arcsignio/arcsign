/**
 * Transaction Label types
 * Feature: Transaction Labels (v1.3)
 */

export interface TxLabel {
  name: string;
  category?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TxLabelEntry {
  network: string;
  txHash: string;
  label: TxLabel;
}

export type TxLabelCategory = "swap" | "transfer" | "stake" | "nft" | "approval" | "other";

export interface SetTxLabelParams {
  network: string;
  txHash: string;
  name: string;
  category?: string;
  notes?: string;
}
