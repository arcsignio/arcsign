import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { DecodedIntent, ClearSignRisk } from "@/services/clearsign/types";
import type { SecurityReport } from "@/services/tauri-api";
import { isHighRiskSign } from "@/services/clearsign/riskGate";

const RISK_KEY: Record<ClearSignRisk, string> = {
  "unlimited-approval": "clearSign.riskUnlimited",
  "approve-all-nfts": "clearSign.riskApproveAllNfts",
  "permit-approval": "clearSign.riskPermit",
};

export function ClearSignSummary({
  intent,
  security,
  acknowledged,
  onAcknowledgeChange,
}: {
  intent: DecodedIntent | null;
  security?: SecurityReport;
  acknowledged?: boolean;
  onAcknowledgeChange?: (checked: boolean) => void;
}) {
  const { t } = useTranslation();
  const [showRaw, setShowRaw] = useState(false);

  return (
    <div>
      {intent && (!intent.readable ? (
        <div
          style={{
            padding: "0.75rem 1rem",
            background: "#fffbeb",
            border: "1px solid #fde68a",
            borderRadius: "10px",
            fontSize: "0.8125rem",
            color: "#92400e",
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: "0.25rem" }}>
            <span aria-hidden="true">⚠️ </span>
            <span>{t("clearSign.unreadableTitle")}</span>
          </div>
          <div style={{ marginBottom: "0.5rem" }}>{t("clearSign.unreadableHint")}</div>
          <button
            onClick={() => setShowRaw((v) => !v)}
            style={{
              fontSize: "0.75rem",
              color: "#92400e",
              textDecoration: "underline",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
            }}
          >
            {showRaw ? t("clearSign.hideRaw") : t("clearSign.showRaw")}
          </button>
          {showRaw && (
            <pre
              style={{
                marginTop: "0.5rem",
                fontSize: "0.7rem",
                whiteSpace: "pre-wrap",
                wordBreak: "break-all",
              }}
            >
              {intent.raw}
            </pre>
          )}
        </div>
      ) : (
        <div
          style={{
            padding: "0.75rem 1rem",
            background: "#f0fdfa",
            border: "1px solid #99f6e4",
            borderRadius: "10px",
            fontSize: "0.8125rem",
            color: "#0f172a",
          }}
        >
          <div style={{ fontWeight: 700, color: "#0f766e", marginBottom: "0.4rem" }}>
            {intent.title}
          </div>
          {intent.params.map((p, i) => (
            <div
              key={i}
              style={{ display: "flex", justifyContent: "space-between", gap: "1rem" }}
            >
              <span style={{ color: "#64748b" }}>{p.label}</span>
              <span style={{ fontFamily: "monospace" }}>{p.value}</span>
            </div>
          ))}
          {intent.risks.length > 0 && (
            <div
              style={{
                marginTop: "0.5rem",
                display: "flex",
                flexWrap: "wrap",
                gap: "0.35rem",
              }}
            >
              {intent.risks.map((r) => (
                <span
                  key={r}
                  style={{
                    fontSize: "0.7rem",
                    fontWeight: 700,
                    color: "#ef4444",
                    background: "rgba(239,68,68,0.1)",
                    padding: "0.1rem 0.4rem",
                    borderRadius: "4px",
                  }}
                >
                  <span aria-hidden="true">⚠️ </span>
                  <span>{t(RISK_KEY[r])}</span>
                </span>
              ))}
            </div>
          )}
          {intent.abiSource === "sourcify-partial" && (
            <div style={{ marginTop: "0.4rem", fontSize: "0.7rem", color: "#92400e" }}>
              <span aria-hidden="true">ℹ️ </span>
              <span>{t("clearSign.abiUnverified")}</span>
            </div>
          )}
        </div>
      ))}

      {/* Security report — Plan A: security not passed; Plan B (txguard) passes it in.
          The blacklist match + warnings show for EVERYONE (proRequired only means the
          Pro-gated simulation preview was skipped, not that the blacklist check ran). */}
      {security && (
        <div
          style={{
            marginTop: "0.5rem",
            padding: "0.75rem 1rem",
            borderRadius: "10px",
            fontSize: "0.8125rem",
            background:
              security.riskLevel === "danger"
                ? "#fef2f2"
                : security.riskLevel === "warning"
                ? "#fffbeb"
                : "#f0fdf4",
            border: `1px solid ${
              security.riskLevel === "danger"
                ? "#fecaca"
                : security.riskLevel === "warning"
                ? "#fde68a"
                : "#bbf7d0"
            }`,
            color: "#0f172a",
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: "0.25rem" }}>
            {t("clearSign.securityHeading")}
          </div>
          {security.blacklistMatch && (
            <div style={{ color: "#ef4444", fontWeight: 600 }}>
              <span aria-hidden="true">⚠️ </span>
              <span>
                {t("clearSign.blacklistHit")}: {security.blacklistMatch.source} (
                {security.blacklistMatch.category})
              </span>
            </div>
          )}
          {/* Simulation preview is Pro-only — gate it on !proRequired so Free users
              still see the blacklist warning above but not the skipped simulation. */}
          {!security.proRequired && security.simulation?.assetChanges?.length ? (
            <div style={{ marginTop: "0.35rem" }}>
              <div style={{ color: "#64748b" }}>{t("clearSign.simulatedChanges")}</div>
              {security.simulation.assetChanges.map((c, i) => (
                <div key={i} style={{ fontFamily: "monospace", fontSize: "0.75rem" }}>
                  {JSON.stringify(c)}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      )}

      {/* High-risk acknowledgment — friction gate, controlled by parent dialog */}
      {isHighRiskSign(security) && (
        <label
          style={{
            marginTop: "0.5rem",
            display: "flex",
            alignItems: "flex-start",
            gap: "0.5rem",
            padding: "0.75rem 1rem",
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: "10px",
            fontSize: "0.8125rem",
            fontWeight: 600,
            color: "#b91c1c",
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={acknowledged ?? false}
            onChange={(e) => onAcknowledgeChange?.(e.target.checked)}
            style={{ marginTop: "0.15rem" }}
          />
          <span>{t("clearSign.ackRisk")}</span>
        </label>
      )}
    </div>
  );
}

export default ClearSignSummary;
