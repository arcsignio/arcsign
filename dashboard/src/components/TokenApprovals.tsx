/**
 * Token Approvals Management Component
 * Displays active ERC-20 token approvals and allows revocation
 * Feature: Token Approvals Management (v1.3 Dashboard)
 *
 * Free: view + single revoke
 * Pro: view + batch revoke
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useTokenApprovals } from "@/hooks/useTokenApprovals";
import { useMembership } from "@/hooks/useMembership";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { APPROVE_SELECTOR } from "@/constants/contracts";
import tauriApi from "@/services/tauri-api";
import type { ApprovalEntry } from "@/types/approvals";

// Network ID → ChainAdapter chainId mapping
const NETWORK_TO_CHAIN_ID: Record<string, string> = {
  "eth-mainnet": "ethereum",
  "polygon-mainnet": "polygon",
  "arb-mainnet": "arbitrum",
  "opt-mainnet": "optimism",
  "base-mainnet": "base",
  "bnb-mainnet": "bnb",
};

// Network badge colors
const NETWORK_COLORS: Record<string, string> = {
  "eth-mainnet": "#627EEA",
  "polygon-mainnet": "#8247E5",
  "arb-mainnet": "#28A0F0",
  "opt-mainnet": "#FF0420",
  "base-mainnet": "#0052FF",
  "bnb-mainnet": "#F0B90B",
};

function truncateAddress(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

// Traffic-light colors for the risk badge / row accent.
const RISK_COLORS: Record<string, string> = {
  red: "#ef4444",
  yellow: "#f59e0b",
  green: "#10b981",
};

function riskColor(level?: string): string {
  return RISK_COLORS[level ?? "yellow"] ?? "#f59e0b";
}

function formatAllowance(allowance: string, isUnlimited: boolean, symbol: string): string {
  if (isUnlimited) return "Unlimited";
  // For very large numbers, show in scientific notation
  try {
    const num = BigInt(allowance);
    if (num > BigInt("1000000000000000000000000")) {
      return `>1T ${symbol}`;
    }
    // Assume 18 decimals for display (rough approximation)
    const display = Number(num) / 1e18;
    if (display < 0.001) return `<0.001 ${symbol}`;
    if (display > 1000000) return `${(display / 1000000).toFixed(1)}M ${symbol}`;
    if (display > 1000) return `${(display / 1000).toFixed(1)}K ${symbol}`;
    return `${display.toFixed(2)} ${symbol}`;
  } catch {
    return allowance;
  }
}

interface TokenApprovalsProps {
  walletId: string;
  password: string;
  usbPath: string;
  sessionToken?: string;
  bscAddress?: string;
}

export function TokenApprovals({
  walletId,
  password,
  usbPath,
  sessionToken,
  bscAddress,
}: TokenApprovalsProps) {
  const { t } = useTranslation();
  const { approvals, isLoading, error, refresh } = useTokenApprovals(
    walletId,
    password,
    usbPath,
    sessionToken
  );

  const { isPro } = useMembership(bscAddress || null);

  const [filterNetwork, setFilterNetwork] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [batchRevoking, setBatchRevoking] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
  const [revokeResult, setRevokeResult] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Load on mount
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Approval unique key
  const getApprovalId = (a: ApprovalEntry) =>
    `${a.network}:${a.tokenAddress}:${a.spender}:${a.ownerAddress}`;

  // Available networks from results
  const availableNetworks = useMemo(() => {
    const nets = new Map<string, string>();
    approvals.forEach((a) => {
      if (!nets.has(a.network)) {
        nets.set(a.network, a.networkLabel || a.network);
      }
    });
    return Array.from(nets.entries());
  }, [approvals]);

  // Filtered + risk-sorted approvals (most dangerous first: red → yellow → green).
  const filteredApprovals = useMemo(() => {
    const base =
      filterNetwork === "all"
        ? approvals
        : approvals.filter((a) => a.network === filterNetwork);
    const rank: Record<string, number> = { red: 0, yellow: 1, green: 2 };
    return [...base].sort(
      (a, b) => (rank[a.riskLevel ?? "yellow"] ?? 1) - (rank[b.riskLevel ?? "yellow"] ?? 1)
    );
  }, [approvals, filterNetwork]);

  // Toggle selection
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    const ids = filteredApprovals.map(getApprovalId);
    setSelectedIds(new Set(ids));
  };

  const deselectAll = () => setSelectedIds(new Set());

  // Build approve(spender, 0) calldata
  const buildRevokeData = (spenderAddress: string): string => {
    const cleanSpender = spenderAddress.replace("0x", "").padStart(64, "0");
    const zeroAmount = "0".padStart(64, "0");
    return APPROVE_SELECTOR + cleanSpender + zeroAmount;
  };

  // Single revoke
  const handleRevoke = useCallback(
    async (approval: ApprovalEntry) => {
      const id = getApprovalId(approval);
      setRevokingId(id);
      setRevokeResult(null);

      try {
        const chainId = NETWORK_TO_CHAIN_ID[approval.network];
        if (!chainId) throw new Error(`Unsupported network: ${approval.network}`);

        const revokeData = buildRevokeData(approval.spender);

        // Build transaction: to = token contract, amount = 0, data = approve(spender, 0)
        const buildResult = await tauriApi.buildTransaction({
          chainId,
          from: approval.ownerAddress,
          to: approval.tokenAddress,
          amount: "0",
          data: revokeData,
          usbPath,
          sessionToken,
        });

        // Sign transaction
        const signResult = await tauriApi.signTransaction({
          chainId,
          walletId,
          password,
          fromAddress: approval.ownerAddress,
          unsignedTx: buildResult,
          usbPath,
          sessionToken,
        });

        // Broadcast
        await tauriApi.broadcastTransaction({
          chainId,
          signedTx: signResult,
          usbPath,
          sessionToken,
        });

        setRevokeResult({
          type: "success",
          message: t("tokenApprovals.revokeSuccess"),
        });

        // Refresh list after short delay
        setTimeout(() => refresh(), 2000);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setRevokeResult({ type: "error", message: msg });
      } finally {
        setRevokingId(null);
      }
    },
    [walletId, password, usbPath, sessionToken, refresh, t]
  );

  // Batch revoke (Pro only)
  const handleBatchRevoke = useCallback(async () => {
    if (!isPro) return;

    const toRevoke = filteredApprovals.filter((a) =>
      selectedIds.has(getApprovalId(a))
    );
    if (toRevoke.length === 0) return;

    setBatchRevoking(true);
    setBatchProgress({ current: 0, total: toRevoke.length });
    setRevokeResult(null);

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < toRevoke.length; i++) {
      const approval = toRevoke[i];
      setBatchProgress({ current: i + 1, total: toRevoke.length });

      try {
        const chainId = NETWORK_TO_CHAIN_ID[approval.network];
        if (!chainId) throw new Error(`Unsupported network`);

        const revokeData = buildRevokeData(approval.spender);

        const buildResult = await tauriApi.buildTransaction({
          chainId,
          from: approval.ownerAddress,
          to: approval.tokenAddress,
          amount: "0",
          data: revokeData,
          usbPath,
          sessionToken,
        });

        const signResult = await tauriApi.signTransaction({
          chainId,
          walletId,
          password,
          fromAddress: approval.ownerAddress,
          unsignedTx: buildResult,
          usbPath,
          sessionToken,
        });

        await tauriApi.broadcastTransaction({
          chainId,
          signedTx: signResult,
          usbPath,
          sessionToken,
        });

        successCount++;
      } catch {
        failCount++;
      }
    }

    setBatchRevoking(false);
    setSelectedIds(new Set());

    const parts: string[] = [];
    if (successCount > 0) parts.push(`${successCount} ${t("tokenApprovals.success")}`);
    if (failCount > 0) parts.push(`${failCount} ${t("tokenApprovals.failed")}`);
    setRevokeResult({
      type: failCount === 0 ? "success" : "error",
      message: parts.join(", "),
    });

    setTimeout(() => refresh(), 2000);
  }, [isPro, filteredApprovals, selectedIds, walletId, password, usbPath, sessionToken, refresh, t]);

  // ========================================================================
  // Render
  // ========================================================================

  // Loading
  if (isLoading && approvals.length === 0) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "3rem 1.5rem",
          color: "#64748b",
        }}
      >
        <LoadingSpinner size="md" />
        <p style={{ marginTop: "1rem", fontSize: "0.875rem" }}>
          {t("tokenApprovals.loading")}
        </p>
      </div>
    );
  }

  // Error (and no data)
  if (error && approvals.length === 0) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "3rem 1.5rem",
          color: "#64748b",
        }}
      >
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        <p style={{ marginTop: "1rem", fontWeight: "600", color: "#1e293b" }}>
          {t("tokenApprovals.loadError")}
        </p>
        <p style={{ fontSize: "0.875rem", marginBottom: "1rem" }}>{error}</p>
        <button
          onClick={refresh}
          style={{
            padding: "0.5rem 1.5rem",
            background: "#0d9488",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
            fontWeight: "500",
          }}
        >
          {t("tokenApprovals.retry")}
        </button>
      </div>
    );
  }

  // Empty state
  if (approvals.length === 0) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "3rem 1.5rem",
          color: "#64748b",
        }}
      >
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <polyline points="9 12 12 15 16 10" style={{ stroke: "#0d9488" }} />
        </svg>
        <p
          style={{
            marginTop: "1rem",
            marginBottom: "0.5rem",
            fontWeight: "600",
            color: "#1e293b",
          }}
        >
          {t("tokenApprovals.empty")}
        </p>
        <p style={{ fontSize: "0.875rem" }}>
          {t("tokenApprovals.emptyDescription")}
        </p>
      </div>
    );
  }

  // Data view
  return (
    <div style={{ padding: "0 0 1rem 0" }}>
      {/* Summary bar */}
      <div
        style={{
          margin: "0 1.5rem 1rem",
          padding: "0.75rem 1rem",
          background: "linear-gradient(135deg, rgba(13, 148, 136, 0.1), rgba(45, 212, 191, 0.05))",
          borderRadius: "12px",
          border: "1px solid rgba(13, 148, 136, 0.2)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <span style={{ fontSize: "0.875rem", fontWeight: "600", color: "#0d9488" }}>
            {filteredApprovals.length} {t("tokenApprovals.activeApprovals")}
          </span>
        </div>
        <button
          onClick={refresh}
          disabled={isLoading}
          style={{
            padding: "0.25rem 0.75rem",
            fontSize: "0.75rem",
            background: "rgba(13, 148, 136, 0.1)",
            color: "#0d9488",
            border: "1px solid rgba(13, 148, 136, 0.3)",
            borderRadius: "6px",
            cursor: isLoading ? "not-allowed" : "pointer",
            opacity: isLoading ? 0.5 : 1,
          }}
        >
          {isLoading ? "..." : t("tokenApprovals.refresh")}
        </button>
      </div>

      {/* Network filter chips */}
      {availableNetworks.length > 1 && (
        <div
          style={{
            display: "flex",
            gap: "0.5rem",
            padding: "0 1.5rem",
            marginBottom: "1rem",
            flexWrap: "wrap",
          }}
        >
          <button
            onClick={() => setFilterNetwork("all")}
            style={{
              padding: "0.25rem 0.75rem",
              fontSize: "0.75rem",
              borderRadius: "16px",
              border: "1px solid",
              borderColor: filterNetwork === "all" ? "#0d9488" : "#e2e8f0",
              background: filterNetwork === "all" ? "rgba(13, 148, 136, 0.1)" : "transparent",
              color: filterNetwork === "all" ? "#0d9488" : "#64748b",
              cursor: "pointer",
              fontWeight: filterNetwork === "all" ? "600" : "400",
            }}
          >
            {t("tokenApprovals.allNetworks")}
          </button>
          {availableNetworks.map(([id, label]) => (
            <button
              key={id}
              onClick={() => setFilterNetwork(id)}
              style={{
                padding: "0.25rem 0.75rem",
                fontSize: "0.75rem",
                borderRadius: "16px",
                border: "1px solid",
                borderColor: filterNetwork === id ? (NETWORK_COLORS[id] || "#0d9488") : "#e2e8f0",
                background: filterNetwork === id ? `${NETWORK_COLORS[id] || "#0d9488"}15` : "transparent",
                color: filterNetwork === id ? (NETWORK_COLORS[id] || "#0d9488") : "#64748b",
                cursor: "pointer",
                fontWeight: filterNetwork === id ? "600" : "400",
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Batch controls (Pro only) */}
      {isPro && filteredApprovals.length > 1 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            padding: "0 1.5rem",
            marginBottom: "0.75rem",
          }}
        >
          <button
            onClick={selectedIds.size > 0 ? deselectAll : selectAll}
            style={{
              fontSize: "0.75rem",
              color: "#0d9488",
              background: "none",
              border: "none",
              cursor: "pointer",
              textDecoration: "underline",
              padding: 0,
            }}
          >
            {selectedIds.size > 0
              ? t("tokenApprovals.deselectAll")
              : t("tokenApprovals.selectAll")}
          </button>
          {selectedIds.size > 0 && (
            <button
              onClick={handleBatchRevoke}
              disabled={batchRevoking}
              style={{
                padding: "0.35rem 1rem",
                fontSize: "0.75rem",
                background: batchRevoking ? "#94a3b8" : "#ef4444",
                color: "#fff",
                border: "none",
                borderRadius: "6px",
                cursor: batchRevoking ? "not-allowed" : "pointer",
                fontWeight: "600",
              }}
            >
              {batchRevoking
                ? `${t("tokenApprovals.processing")} ${batchProgress.current}/${batchProgress.total}`
                : `${t("tokenApprovals.batchRevoke")} (${selectedIds.size})`}
            </button>
          )}
        </div>
      )}

      {/* Pro badge for batch feature */}
      {!isPro && filteredApprovals.length > 1 && (
        <div
          style={{
            margin: "0 1.5rem 0.75rem",
            padding: "0.5rem 0.75rem",
            fontSize: "0.75rem",
            color: "#64748b",
            background: "rgba(100, 116, 139, 0.05)",
            borderRadius: "8px",
            border: "1px solid rgba(100, 116, 139, 0.1)",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <span
            style={{
              fontSize: "0.625rem",
              fontWeight: "700",
              color: "#f59e0b",
              background: "rgba(245, 158, 11, 0.1)",
              padding: "0.1rem 0.4rem",
              borderRadius: "4px",
              letterSpacing: "0.05em",
            }}
          >
            PRO
          </span>
          {t("tokenApprovals.batchRevokeProOnly")}
        </div>
      )}

      {/* Result message */}
      {revokeResult && (
        <div
          style={{
            margin: "0 1.5rem 0.75rem",
            padding: "0.5rem 0.75rem",
            fontSize: "0.8rem",
            borderRadius: "8px",
            background: revokeResult.type === "success"
              ? "rgba(16, 185, 129, 0.1)"
              : "rgba(239, 68, 68, 0.1)",
            border: `1px solid ${revokeResult.type === "success" ? "rgba(16, 185, 129, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
            color: revokeResult.type === "success" ? "#059669" : "#dc2626",
          }}
        >
          {revokeResult.message}
        </div>
      )}

      {/* Approval list */}
      <div style={{ padding: "0 1.5rem" }}>
        {filteredApprovals.map((approval) => {
          const id = getApprovalId(approval);
          const isRevoking = revokingId === id;
          const isSelected = selectedIds.has(id);

          return (
            <div
              key={id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                padding: "0.75rem",
                marginBottom: "0.5rem",
                background: isSelected
                  ? "rgba(13, 148, 136, 0.05)"
                  : "rgba(241, 245, 249, 0.5)",
                borderRadius: "12px",
                border: `1px solid ${isSelected ? "rgba(13, 148, 136, 0.2)" : "rgba(226, 232, 240, 0.8)"}`,
                transition: "all 0.15s ease",
              }}
            >
              {/* Checkbox (Pro only) */}
              {isPro && (
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleSelect(id)}
                  style={{
                    width: "16px",
                    height: "16px",
                    accentColor: "#0d9488",
                    cursor: "pointer",
                    flexShrink: 0,
                  }}
                />
              )}

              {/* Token info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    marginBottom: "0.25rem",
                  }}
                >
                  <span
                    style={{
                      fontWeight: "600",
                      fontSize: "0.875rem",
                      color: "#1e293b",
                    }}
                  >
                    {approval.tokenSymbol || truncateAddress(approval.tokenAddress)}
                  </span>
                  {approval.tokenName && approval.tokenName !== approval.tokenSymbol && (
                    <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                      {approval.tokenName}
                    </span>
                  )}
                  {/* Network badge */}
                  <span
                    style={{
                      fontSize: "0.625rem",
                      fontWeight: "600",
                      color: NETWORK_COLORS[approval.network] || "#64748b",
                      background: `${NETWORK_COLORS[approval.network] || "#64748b"}15`,
                      padding: "0.1rem 0.4rem",
                      borderRadius: "4px",
                    }}
                  >
                    {approval.networkLabel}
                  </span>
                </div>

                {/* Spender + risk badge */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.4rem",
                    fontSize: "0.75rem",
                    color: "#94a3b8",
                    flexWrap: "wrap",
                  }}
                >
                  <span>{t("tokenApprovals.spender")}:</span>
                  {approval.spenderName ? (
                    <span style={{ color: "#e2e8f0", fontWeight: 600 }}>
                      {approval.spenderName}
                    </span>
                  ) : (
                    <span>{truncateAddress(approval.spender)}</span>
                  )}
                  {/* Risk badge */}
                  {approval.riskLevel && (
                    <span
                      style={{
                        fontSize: "0.625rem",
                        fontWeight: 700,
                        color: riskColor(approval.riskLevel),
                        background: `${riskColor(approval.riskLevel)}1a`,
                        padding: "0.1rem 0.4rem",
                        borderRadius: "4px",
                        textTransform: "uppercase",
                      }}
                    >
                      {t(`tokenApprovals.risk.${approval.riskLevel}`)}
                    </span>
                  )}
                  {/* Unknown / EOA hint when not a known protocol */}
                  {!approval.spenderName && approval.isEOA && (
                    <span style={{ fontSize: "0.625rem", color: "#ef4444" }}>
                      {t("tokenApprovals.eoaSpender")}
                    </span>
                  )}
                </div>

                {/* Malicious spender — strong warning */}
                {approval.isMalicious && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.4rem",
                      marginTop: "0.35rem",
                      padding: "0.35rem 0.5rem",
                      background: "rgba(239, 68, 68, 0.12)",
                      border: "1px solid rgba(239, 68, 68, 0.4)",
                      borderRadius: "6px",
                      fontSize: "0.7rem",
                      color: "#ef4444",
                      fontWeight: 600,
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                    <span>{t("tokenApprovals.maliciousWarning")}</span>
                  </div>
                )}

                {/* Allowance */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    marginTop: "0.25rem",
                  }}
                >
                  <span style={{ fontSize: "0.75rem", color: "#64748b" }}>
                    {t("tokenApprovals.allowance")}:
                  </span>
                  {approval.isUnlimited ? (
                    <span
                      style={{
                        fontSize: "0.7rem",
                        fontWeight: "700",
                        color: "#ef4444",
                        background: "rgba(239, 68, 68, 0.1)",
                        padding: "0.1rem 0.4rem",
                        borderRadius: "4px",
                      }}
                    >
                      {t("tokenApprovals.unlimited")}
                    </span>
                  ) : (
                    <span style={{ fontSize: "0.75rem", color: "#64748b" }}>
                      {formatAllowance(
                        approval.allowance,
                        approval.isUnlimited,
                        approval.tokenSymbol
                      )}
                    </span>
                  )}
                </div>
              </div>

              {/* Revoke button */}
              <button
                onClick={() => handleRevoke(approval)}
                disabled={isRevoking || batchRevoking}
                style={{
                  padding: "0.4rem 1rem",
                  fontSize: "0.75rem",
                  fontWeight: "600",
                  background: isRevoking ? "#94a3b8" : "transparent",
                  color: isRevoking ? "#fff" : "#ef4444",
                  border: `1px solid ${isRevoking ? "#94a3b8" : "#ef4444"}`,
                  borderRadius: "8px",
                  cursor: isRevoking || batchRevoking ? "not-allowed" : "pointer",
                  opacity: batchRevoking && !isRevoking ? 0.5 : 1,
                  flexShrink: 0,
                  whiteSpace: "nowrap",
                }}
              >
                {isRevoking ? "..." : t("tokenApprovals.revoke")}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
