import { useEffect, useState } from "react";
import { checkTransactionSecurity, type SecurityReport } from "@/services/tauri-api";
import { isHighRiskSign } from "@/services/clearsign/riskGate";
import { decodeCalldata } from "@/services/clearsign/decodeCalldata";
import { chainIdToNetwork } from "@/services/clearsign/chainIdToNetwork";
import type { DecodedIntent } from "@/services/clearsign/types";

export interface SignReviewParams {
  from: string;
  to: string;
  chainId: string;
  value: string;
  data: string;
  usbPath: string;
  sessionToken: string;
}

export interface SignReview {
  /** Backend security report. The gate's authority — never computed here. */
  security?: SecurityReport;
  /** Backend-computed conclusion, read verbatim. */
  requiresAcknowledge: boolean;
  acknowledged: boolean;
  setAcknowledged: (v: boolean) => void;
  /** Human-readable intent + ERC-8213 digest. Display only, never a verdict. */
  intent?: DecodedIntent;
}

/**
 * Everything a signing screen needs before the user commits.
 *
 * Two kinds of information travel together because they describe the SAME
 * transaction, not because readability is a safety judgment:
 *   - security / requiresAcknowledge — computed in Go, read verbatim here
 *   - intent — decoded in the frontend, purely for display
 *
 * Bundling them means a screen cannot wire the gate and forget the readability
 * (which is how six screens ended up showing neither).
 */
export function useSignReview(params: SignReviewParams | null): SignReview {
  const [security, setSecurity] = useState<SecurityReport | undefined>(undefined);
  const [intent, setIntent] = useState<DecodedIntent | undefined>(undefined);
  const [acknowledged, setAcknowledged] = useState(false);

  const key = params ? `${params.chainId}:${params.to}:${params.data}` : "";
  const usbPath = params?.usbPath;
  const sessionToken = params?.sessionToken;

  useEffect(() => {
    if (!params || !params.usbPath) {
      setSecurity(undefined);
      setIntent(undefined);
      setAcknowledged(false);
      return;
    }
    let cancelled = false;
    setAcknowledged(false); // reset on a new tx (no stale-ack leak)

    checkTransactionSecurity({
      from: params.from, to: params.to, chainId: params.chainId,
      value: params.value, data: params.data,
      usbPath: params.usbPath, sessionToken: params.sessionToken,
    })
      .then((r) => { if (!cancelled) setSecurity(r); })
      .catch(() => { if (!cancelled) setSecurity(undefined); }); // advisory — never block

    const network = chainIdToNetwork(params.chainId);
    decodeCalldata(network, params.to, params.data, params.value, {
      onlineEnabled: true,
      usb: { usbPath: params.usbPath, sessionToken: params.sessionToken },
    })
      .then((i) => { if (!cancelled) setIntent(i); })
      .catch(() => { if (!cancelled) setIntent(undefined); }); // display only — never block

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, usbPath, sessionToken]);

  return {
    security,
    requiresAcknowledge: isHighRiskSign(security), // reads backend conclusion
    acknowledged,
    setAcknowledged,
    intent,
  };
}
