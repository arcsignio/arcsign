/**
 * DigestPanel — the ERC-8213 fingerprint of the bytes about to be signed.
 *
 * A statement of fact, not a verdict: it carries no semantic colour because the
 * app cannot verify it for you. Verification happens by recomputing the same
 * digest on a separate device and comparing — which is the whole point.
 *
 * The full 64 characters are always shown, grouped like a GPG/SSH fingerprint.
 * Truncating would drop the work of forging a match from 2^256 to feasible.
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { formatDigest } from "@/services/clearsign/digest";
import type { DecodedIntent } from "@/services/clearsign/types";

export function DigestPanel({ digest }: { digest: NonNullable<DecodedIntent["digest"]> }) {
  const { t } = useTranslation();
  const [showDetail, setShowDetail] = useState(false);
  const [copied, setCopied] = useState(false);

  return (
    <div
      style={{
        marginTop: "0.75rem",
        paddingTop: "0.75rem",
        borderTop: "1px solid #e2e8f0",
        fontSize: "0.75rem",
        color: "#64748b",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <span style={{ fontWeight: 600 }}>
          {digest.kind === "eip712"
            ? t("clearSign.digestEip712")
            : t("clearSign.digestCalldata")}
        </span>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard
              ?.writeText(digest.primary)
              .then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              })
              .catch(() => setCopied(false));
          }}
          style={{
            border: "none", background: "transparent", color: "#0f766e",
            cursor: "pointer", fontSize: "0.75rem", padding: 0,
          }}
        >
          {copied ? t("clearSign.digestCopied") : t("clearSign.digestCopy")}
        </button>
      </div>

      <div
        style={{
          fontFamily: "monospace",
          wordBreak: "break-all",
          lineHeight: 1.6,
          marginTop: "0.25rem",
        }}
      >
        {formatDigest(digest.primary)}
      </div>

      <div style={{ marginTop: "0.25rem", fontSize: "0.7rem" }}>
        {t("clearSign.digestHint")}
      </div>

      {digest.detail && (
        <>
          <button
            type="button"
            onClick={() => setShowDetail((v) => !v)}
            style={{
              marginTop: "0.4rem", border: "none", background: "transparent",
              color: "#0f766e", cursor: "pointer", fontSize: "0.7rem", padding: 0,
            }}
          >
            {showDetail
              ? t("clearSign.digestHideDetail")
              : t("clearSign.digestShowDetail")}
          </button>

          {showDetail && (
            <div style={{ marginTop: "0.4rem", display: "grid", gap: "0.4rem" }}>
              <div>
                <div style={{ fontWeight: 600 }}>{t("clearSign.digestDomainHash")}</div>
                <div style={{ fontFamily: "monospace", wordBreak: "break-all" }}>
                  {formatDigest(digest.detail.domainHash)}
                </div>
              </div>
              <div>
                <div style={{ fontWeight: 600 }}>{t("clearSign.digestMessageHash")}</div>
                <div style={{ fontFamily: "monospace", wordBreak: "break-all" }}>
                  {formatDigest(digest.detail.messageHash)}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default DigestPanel;
