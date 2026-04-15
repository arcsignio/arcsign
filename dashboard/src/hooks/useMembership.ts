/**
 * React Hook for ArcSign Pro Membership
 * Checks NFT ownership on BSC to determine Pro/Free tier
 */

import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { WALLET_LIMIT_FREE } from "@/constants/contracts";

/**
 * Membership status from the backend
 */
export interface MembershipStatus {
  isPro: boolean;
  nftCount: number;
  tokenIds: number[];
  expirations: number[];
  daysRemaining: number;
  walletLimit: number | null;
}

/**
 * Hook to check membership status for a BSC address
 */
export function useMembership(bscAddress: string | null) {
  const [status, setStatus] = useState<MembershipStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkMembership = useCallback(async () => {
    if (!bscAddress) {
      setStatus(null);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const result = await invoke<MembershipStatus>("check_membership", {
        input: { address: bscAddress },
      });

      setStatus(result);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to check membership";
      setError(errorMessage);
      console.error("Membership check failed:", err);

      // Default to free tier on error
      setStatus({
        isPro: false,
        nftCount: 0,
        tokenIds: [],
        expirations: [],
        daysRemaining: 0,
        walletLimit: 1, // Free tier: 1 wallet
      });
    } finally {
      setIsLoading(false);
    }
  }, [bscAddress]);

  useEffect(() => {
    checkMembership();
  }, [checkMembership]);

  return {
    status,
    isLoading,
    error,
    refresh: checkMembership,
    isPro: status?.isPro ?? false,
    walletLimit: status?.walletLimit ?? 1, // Free tier: 1 wallet
  };
}

/**
 * Hook to check if wallet creation is allowed
 */
export function useCanCreateWallet(
  currentWalletCount: number,
  isPro: boolean
) {
  const [canCreate, setCanCreate] = useState(true);
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    const check = async () => {
      try {
        setIsChecking(true);
        const result = await invoke<boolean>("can_create_wallet", {
          currentWalletCount,
          isPro,
        });
        setCanCreate(result);
      } catch (err) {
        console.error("Failed to check wallet creation permission:", err);
        // Default to tier-based logic
        setCanCreate(isPro ? true : currentWalletCount < WALLET_LIMIT_FREE);
      } finally {
        setIsChecking(false);
      }
    };

    check();
  }, [currentWalletCount, isPro]);

  return { canCreate, isChecking };
}

/**
 * Get membership tier name
 */
export function getMembershipTierName(isPro: boolean): string {
  return isPro ? "Pro" : "Free";
}

/**
 * Get wallet limit for a tier
 */
export function getWalletLimitForTier(isPro: boolean): number | null {
  return isPro ? null : 3;
}

/**
 * Format expiration date
 */
export function formatExpirationDate(timestamp: number): string {
  if (timestamp === 0) return "N/A";
  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString();
}

/**
 * Check if membership is expiring soon (within 30 days)
 */
export function isExpiringSoon(daysRemaining: number): boolean {
  return daysRemaining > 0 && daysRemaining <= 30;
}

/**
 * Get days remaining text
 */
export function getDaysRemainingText(daysRemaining: number): string {
  if (daysRemaining === 0) return "Expired";
  if (daysRemaining === 1) return "1 day remaining";
  return `${daysRemaining} days remaining`;
}
