/**
 * useTransactionLabels hook — manages Transaction Labels state + CRUD operations
 * Feature: Transaction Labels (v1.3)
 */

import { useState, useCallback, useRef } from "react";
import type { TxLabelEntry, SetTxLabelParams } from "@/types/txLabel";
import * as tauriApi from "@/services/tauri-api";

interface UseTransactionLabelsReturn {
  labels: TxLabelEntry[];
  labelsMap: Map<string, TxLabelEntry>;
  isLoading: boolean;
  error: string | null;
  loadLabels: (network?: string) => Promise<void>;
  setLabel: (params: SetTxLabelParams) => Promise<boolean>;
  deleteLabel: (network: string, txHash: string) => Promise<boolean>;
  getLabelForTx: (network: string, txHash: string) => TxLabelEntry | undefined;
}

export function useTransactionLabels(
  usbPath: string,
  sessionToken?: string,
): UseTransactionLabelsReturn {
  const [labels, setLabels] = useState<TxLabelEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const labelsMapRef = useRef<Map<string, TxLabelEntry>>(new Map());

  const buildKey = (network: string, txHash: string) => `${network}:${txHash}`;

  const rebuildMap = (entries: TxLabelEntry[]) => {
    const map = new Map<string, TxLabelEntry>();
    for (const entry of entries) {
      map.set(buildKey(entry.network, entry.txHash), entry);
    }
    labelsMapRef.current = map;
    return map;
  };

  const loadLabels = useCallback(async (network?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await tauriApi.getTransactionLabels(usbPath, network, sessionToken);
      const entries = result.labels ?? [];
      setLabels(entries);
      rebuildMap(entries);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [usbPath, sessionToken]);

  const setLabel = useCallback(async (params: SetTxLabelParams): Promise<boolean> => {
    setError(null);
    try {
      const result = await tauriApi.setTransactionLabel({
        ...params,
        usbPath,
        sessionToken,
      });
      const newEntry: TxLabelEntry = {
        network: params.network,
        txHash: params.txHash,
        label: result.label,
      };
      setLabels(prev => {
        const key = buildKey(params.network, params.txHash);
        const exists = prev.some(e => buildKey(e.network, e.txHash) === key);
        const updated = exists
          ? prev.map(e => buildKey(e.network, e.txHash) === key ? newEntry : e)
          : [...prev, newEntry];
        rebuildMap(updated);
        return updated;
      });
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      return false;
    }
  }, [usbPath, sessionToken]);

  const deleteLabel = useCallback(async (network: string, txHash: string): Promise<boolean> => {
    setError(null);
    try {
      await tauriApi.deleteTransactionLabel(network, txHash, usbPath, sessionToken);
      const key = buildKey(network, txHash);
      setLabels(prev => {
        const updated = prev.filter(e => buildKey(e.network, e.txHash) !== key);
        rebuildMap(updated);
        return updated;
      });
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      return false;
    }
  }, [usbPath, sessionToken]);

  const getLabelForTx = useCallback((network: string, txHash: string): TxLabelEntry | undefined => {
    return labelsMapRef.current.get(buildKey(network, txHash));
  }, []);

  return {
    labels,
    labelsMap: labelsMapRef.current,
    isLoading,
    error,
    loadLabels,
    setLabel,
    deleteLabel,
    getLabelForTx,
  };
}
