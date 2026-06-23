import { useEffect, useState } from "react";
import { checkTransactionSecurity, type SecurityReport } from "@/services/tauri-api";
import { isHighRiskSign } from "@/services/clearsign/riskGate";

export interface SignGateParams {
  from: string;
  to: string;
  chainId: string;
  value: string;
  data: string;
  usbPath: string;
  sessionToken: string;
  isPro: boolean;
}

export interface SignGate {
  security?: SecurityReport;
  requiresAcknowledge: boolean;
  acknowledged: boolean;
  setAcknowledged: (v: boolean) => void;
}

// UI coordination only — calls the backend security check, surfaces its
// requiresAcknowledge conclusion (computed in Go), and holds the acknowledged
// checkbox state. No danger judgment here — that's the backend's job. The real
// gate is the backend SignTransaction; this is the knowing-consent UX.
export function useSignGate(params: SignGateParams | null): SignGate {
  const [security, setSecurity] = useState<SecurityReport | undefined>(undefined);
  const [acknowledged, setAcknowledged] = useState(false);

  const key = params ? `${params.chainId}:${params.to}:${params.data}` : "";
  const usbPath = params?.usbPath;
  const sessionToken = params?.sessionToken;
  const isPro = params?.isPro;

  useEffect(() => {
    if (!params || !params.usbPath) {
      setSecurity(undefined);
      setAcknowledged(false);
      return;
    }
    let cancelled = false;
    setAcknowledged(false); // reset on a new tx (no stale-ack leak)
    checkTransactionSecurity({
      from: params.from, to: params.to, chainId: params.chainId,
      value: params.value, data: params.data,
      usbPath: params.usbPath, sessionToken: params.sessionToken, isPro: params.isPro,
    })
      .then((r) => { if (!cancelled) setSecurity(r); })
      .catch(() => { if (!cancelled) setSecurity(undefined); }); // advisory — never block
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, usbPath, sessionToken, isPro]);

  return {
    security,
    requiresAcknowledge: isHighRiskSign(security), // reads backend conclusion
    acknowledged,
    setAcknowledged,
  };
}
