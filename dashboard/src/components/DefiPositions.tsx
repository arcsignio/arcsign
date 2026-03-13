/**
 * DeFi Positions Component - Display staking positions with live APY
 * Feature: DeFi tab in WalletDetail
 *
 * Detects receipt tokens (stETH, ankrETH, eETH, ankrBNB) from the user's
 * existing token balances and displays them alongside live APY data.
 */

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import type { TokenBalance } from "@/types/tokens";
import { getStakableAssetsWithMetrics } from "@/constants/stakingRegistry";
import type { StakingProvider } from "@/types/defi";

// Known receipt tokens mapped to their staking provider ID
const RECEIPT_TOKEN_MAP: Record<string, { providerId: string; stakedAsset: string }> = {
  // Lowercase contract addresses → provider lookup
  "0xae7ab96520de3a18e5e111b5eaab095312d7fe84": { providerId: "lido-eth", stakedAsset: "ETH" },
  "0xe95a203b1a91a908f9b9ce46459d101078c2c3cb": { providerId: "ankr-eth", stakedAsset: "ETH" },
  "0x35fa164735182de50811e8e2e824cfb9b6118ac2": { providerId: "etherfi-eth", stakedAsset: "ETH" },
  "0x52f24a5e03aee338da5fd9df68d2b6fae1178827": { providerId: "ankr-bnb", stakedAsset: "BNB" },
};

// Also match by symbol for networks where we don't have exact contract
const RECEIPT_SYMBOL_MAP: Record<string, string> = {
  stETH: "lido-eth",
  ankrETH: "ankr-eth",
  eETH: "etherfi-eth",
  ankrBNB: "ankr-bnb",
};

interface DefiPosition {
  token: TokenBalance;
  provider: StakingProvider | null;
  providerId: string;
  stakedAsset: string;
}

interface DefiPositionsProps {
  tokens: TokenBalance[];
}

export function DefiPositions({ tokens }: DefiPositionsProps) {
  const { t } = useTranslation();
  const [providers, setProviders] = useState<Map<string, StakingProvider>>(new Map());
  const [isLoadingApy, setIsLoadingApy] = useState(true);

  // Fetch live APY data
  useEffect(() => {
    let cancelled = false;
    async function loadMetrics() {
      try {
        const assets = await getStakableAssetsWithMetrics();
        const providerMap = new Map<string, StakingProvider>();
        for (const asset of assets) {
          for (const provider of asset.providers) {
            providerMap.set(provider.id, provider);
          }
        }
        if (!cancelled) {
          setProviders(providerMap);
        }
      } catch {
        // Silently fail - APY is optional
      } finally {
        if (!cancelled) {
          setIsLoadingApy(false);
        }
      }
    }
    loadMetrics();
    return () => { cancelled = true; };
  }, []);

  // Find receipt tokens in user's balances
  const positions: DefiPosition[] = [];
  for (const token of tokens) {
    const addr = token.tokenAddress?.toLowerCase();
    const match = addr ? RECEIPT_TOKEN_MAP[addr] : null;
    const symbolMatch = RECEIPT_SYMBOL_MAP[token.tokenSymbol];

    if (match) {
      positions.push({
        token,
        provider: providers.get(match.providerId) || null,
        providerId: match.providerId,
        stakedAsset: match.stakedAsset,
      });
    } else if (symbolMatch) {
      const info = Object.values(RECEIPT_TOKEN_MAP).find(
        (v) => v.providerId === symbolMatch
      );
      positions.push({
        token,
        provider: providers.get(symbolMatch) || null,
        providerId: symbolMatch,
        stakedAsset: info?.stakedAsset || "",
      });
    }
  }

  // Empty state
  if (positions.length === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "3rem 1.5rem", color: "#64748b" }}>
        <div style={{ marginBottom: "1rem" }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
        </div>
        <p style={{ fontWeight: "600", color: "#1e293b", marginBottom: "0.5rem" }}>
          {t("defiPositions.empty")}
        </p>
        <p style={{ fontSize: "0.875rem" }}>
          {t("defiPositions.emptyDescription")}
        </p>
      </div>
    );
  }

  // Total staked value
  const totalStakedUsd = positions.reduce((sum, p) => sum + (p.token.usdValue || 0), 0);

  return (
    <div style={{ padding: "1rem" }}>
      {/* Summary */}
      <div style={{
        background: "linear-gradient(135deg, #0d9488 0%, #0f766e 100%)",
        borderRadius: "0.75rem",
        padding: "1.25rem",
        color: "#fff",
        marginBottom: "1rem",
      }}>
        <p style={{ fontSize: "0.75rem", opacity: 0.8, margin: "0 0 0.25rem" }}>
          {t("defiPositions.totalStaked")}
        </p>
        <p style={{ fontSize: "1.5rem", fontWeight: 700, margin: 0 }}>
          ${totalStakedUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
        <p style={{ fontSize: "0.75rem", opacity: 0.7, margin: "0.25rem 0 0" }}>
          {positions.length} {t("defiPositions.activePositions")}
        </p>
      </div>

      {/* Position cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {positions.map((pos) => (
          <PositionCard
            key={`${pos.token.tokenAddress}-${pos.token.network}`}
            position={pos}
            isLoadingApy={isLoadingApy}
            t={t}
          />
        ))}
      </div>
    </div>
  );
}

function PositionCard({
  position,
  isLoadingApy,
  t,
}: {
  position: DefiPosition;
  isLoadingApy: boolean;
  t: (key: string) => string;
}) {
  const { token, provider } = position;
  const apy = provider?.apy;

  return (
    <div style={{
      border: "1px solid #e2e8f0",
      borderRadius: "0.75rem",
      padding: "1rem",
      background: "#fff",
    }}>
      {/* Header: Protocol + Token */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          {/* Protocol logo */}
          {(provider?.logoUrl || token.tokenLogo) && (
            <img
              src={provider?.logoUrl || token.tokenLogo}
              alt=""
              style={{ width: 32, height: 32, borderRadius: "50%" }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          )}
          <div>
            <p style={{ fontWeight: 600, color: "#1e293b", margin: 0, fontSize: "0.9375rem" }}>
              {provider?.name || token.tokenName}
            </p>
            <p style={{ fontSize: "0.75rem", color: "#94a3b8", margin: "0.125rem 0 0" }}>
              {position.stakedAsset} {t("defiPositions.staking")} &middot; {token.networkLabel}
            </p>
          </div>
        </div>

        {/* APY badge */}
        {isLoadingApy ? (
          <span style={{
            fontSize: "0.75rem", color: "#94a3b8",
            padding: "0.25rem 0.5rem",
            background: "#f1f5f9",
            borderRadius: "0.375rem",
          }}>
            ...
          </span>
        ) : apy !== undefined && apy !== null ? (
          <span style={{
            fontSize: "0.875rem", fontWeight: 600, color: "#059669",
            background: "#d1fae5",
            padding: "0.25rem 0.5rem",
            borderRadius: "0.375rem",
          }}>
            {apy.toFixed(2)}% APY
          </span>
        ) : null}
      </div>

      {/* Balance info */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "baseline",
        padding: "0.5rem 0",
        borderTop: "1px solid #f1f5f9",
      }}>
        <div>
          <p style={{ fontSize: "0.75rem", color: "#94a3b8", margin: "0 0 0.125rem", textTransform: "uppercase", fontWeight: 600 }}>
            {t("defiPositions.balance")}
          </p>
          <p style={{ fontSize: "1rem", fontWeight: 600, color: "#1e293b", margin: 0 }}>
            {formatBalance(token.balance)} {token.tokenSymbol}
          </p>
        </div>
        <div style={{ textAlign: "right" }}>
          <p style={{ fontSize: "0.75rem", color: "#94a3b8", margin: "0 0 0.125rem", textTransform: "uppercase", fontWeight: 600 }}>
            {t("defiPositions.value")}
          </p>
          <p style={{ fontSize: "1rem", fontWeight: 600, color: "#1e293b", margin: 0 }}>
            ${(token.usdValue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* Verified badge */}
      {provider?.verified && (
        <div style={{
          display: "flex", alignItems: "center", gap: "0.25rem",
          fontSize: "0.6875rem", color: "#0d9488", marginTop: "0.5rem",
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
            <polyline points="22 4 12 14.01 9 11.01"/>
          </svg>
          {t("defiPositions.verified")}
          {provider.audits && provider.audits.length > 0 && (
            <span style={{ color: "#94a3b8" }}>
              &middot; {provider.audits.map(a => a.auditor).join(", ")}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function formatBalance(balance: string): string {
  const num = parseFloat(balance);
  if (isNaN(num)) return "0";
  if (num < 0.001) return "<0.001";
  if (num < 1) return num.toFixed(4);
  if (num < 1000) return num.toFixed(3);
  return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
}
