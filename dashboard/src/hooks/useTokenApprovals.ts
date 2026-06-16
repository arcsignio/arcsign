/**
 * React Hook for Token Approvals management
 * Fetches active ERC-20 approvals and provides revoke functionality
 * Feature: Token Approvals Management (v1.3 Dashboard)
 */

import { useState, useCallback } from "react";
import tauriApi from "@/services/tauri-api";
import type { ApprovalEntry } from "@/types/approvals";

interface UseTokenApprovalsResult {
  approvals: ApprovalEntry[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useTokenApprovals(
  walletId: string,
  password: string,
  usbPath: string,
  sessionToken?: string
): UseTokenApprovalsResult {
  const [approvals, setApprovals] = useState<ApprovalEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadApprovals = useCallback(async () => {
    if (!walletId || !password || !usbPath) return;

    try {
      setIsLoading(true);
      setError(null);

      const response = await tauriApi.getTokenApprovals({
        walletId,
        password,
        usbPath,
        sessionToken,
      });

      // Handle FFI response wrapping
      const data = (response as any)?.data ?? response;
      setApprovals(data.approvals || []);
    } catch (err) {
      // parseError (tauri-api) throws a plain AppError-shaped object
      // { code, message, details } — NOT an Error instance — so reading
      // err.message directly is what surfaces the backend's actionable message
      // (e.g. "Alchemy API key not configured..."). Gating on `instanceof Error`
      // would silently drop it and show a useless generic string.
      const errorMessage =
        (err as { message?: string })?.message || "Failed to load token approvals";
      setError(errorMessage);
      console.error("Token approvals load failed:", err);
    } finally {
      setIsLoading(false);
    }
  }, [walletId, password, usbPath, sessionToken]);

  return {
    approvals,
    isLoading,
    error,
    refresh: loadApprovals,
  };
}
