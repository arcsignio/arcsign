import { useState } from "react";
import { useTranslation } from "react-i18next";
import tauriApi, { type AppError } from "@/services/tauri-api";

export interface AddTokenDialogProps {
  usbPath: string;
  /** The wallet address (on `network`) that will own this token entry. */
  userAddress: string;
  /** Internal network id, e.g. "eth-mainnet". */
  network: string;
  networkLabel: string;
  sessionToken?: string;
  onAdded: () => void;
  onClose: () => void;
}

const EVM_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

/**
 * AddTokenDialog lets the user manually import a token by contract address into
 * the per-USB "touched tokens" store (table B), so its balance is queried on the
 * self-hosted path even if it isn't in the curated common list. This is the
 * escape hatch when incremental discovery misses a token (old airdrop, public
 * RPC log limits). Mirrors MetaMask's "Import token".
 */
export function AddTokenDialog({
  usbPath,
  userAddress,
  network,
  networkLabel,
  sessionToken,
  onAdded,
  onClose,
}: AddTokenDialogProps) {
  const { t } = useTranslation();
  const [contractAddress, setContractAddress] = useState("");
  const [symbol, setSymbol] = useState("");
  const [decimals, setDecimals] = useState("18");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const trimmedAddress = contractAddress.trim();
  const addressValid = EVM_ADDRESS_RE.test(trimmedAddress);
  const decimalsNum = Number(decimals);
  const decimalsValid =
    Number.isInteger(decimalsNum) && decimalsNum >= 0 && decimalsNum <= 36;
  const canSubmit =
    addressValid && symbol.trim().length > 0 && decimalsValid && !isSubmitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setError(null);
    setIsSubmitting(true);
    try {
      await tauriApi.addTouchedToken({
        usbPath,
        userAddress,
        tokenAddress: trimmedAddress,
        network,
        symbol: symbol.trim(),
        decimals: decimalsNum,
        sessionToken,
      });
      onAdded();
      onClose();
    } catch (e) {
      const appErr = e as AppError;
      setError(appErr?.message || t("addToken.error", "Failed to add token"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="add-token-overlay" role="dialog" aria-modal="true">
      <div className="add-token-dialog">
        <h3>{t("addToken.title", "Import token")}</h3>
        <p className="add-token-network">
          {t("addToken.network", "Network")}: {networkLabel}
        </p>

        <label>
          {t("addToken.contractAddress", "Contract address")}
          <input
            type="text"
            value={contractAddress}
            onChange={(e) => setContractAddress(e.target.value)}
            placeholder="0x..."
            spellCheck={false}
            autoComplete="off"
          />
        </label>
        {trimmedAddress.length > 0 && !addressValid && (
          <span className="add-token-hint-error">
            {t("addToken.invalidAddress", "Enter a valid 0x… contract address")}
          </span>
        )}

        <label>
          {t("addToken.symbol", "Symbol")}
          <input
            type="text"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            placeholder="e.g. PEPE"
            maxLength={16}
          />
        </label>

        <label>
          {t("addToken.decimals", "Decimals")}
          <input
            type="number"
            value={decimals}
            onChange={(e) => setDecimals(e.target.value)}
            min={0}
            max={36}
          />
        </label>
        {!decimalsValid && (
          <span className="add-token-hint-error">
            {t("addToken.invalidDecimals", "Decimals must be 0–36")}
          </span>
        )}

        {error && <div className="add-token-error">{error}</div>}

        <div className="add-token-actions">
          <button type="button" className="add-token-cancel" onClick={onClose}>
            {t("common.cancel", "Cancel")}
          </button>
          <button
            type="button"
            className="add-token-submit"
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            {isSubmitting
              ? t("addToken.adding", "Adding…")
              : t("addToken.add", "Add token")}
          </button>
        </div>
      </div>

      <style>{`
        .add-token-overlay {
          position: fixed; inset: 0; z-index: 1000;
          display: flex; align-items: center; justify-content: center;
          background: rgba(0,0,0,0.5);
        }
        .add-token-dialog {
          background: #fff; border-radius: 12px; padding: 24px;
          width: 100%; max-width: 420px;
          box-shadow: 0 10px 40px rgba(0,0,0,0.2);
          display: flex; flex-direction: column; gap: 12px;
        }
        .add-token-dialog h3 { margin: 0; color: #0d9488; }
        .add-token-network { margin: 0; font-size: 13px; color: #6b7280; }
        .add-token-dialog label {
          display: flex; flex-direction: column; gap: 4px;
          font-size: 13px; font-weight: 500; color: #374151;
        }
        .add-token-dialog input {
          padding: 8px 10px; border: 1px solid #d1d5db; border-radius: 8px;
          font-size: 14px;
        }
        .add-token-dialog input:focus {
          outline: none; border-color: #2dd4bf;
          box-shadow: 0 0 0 3px rgba(45,212,191,0.2);
        }
        .add-token-hint-error { color: #dc2626; font-size: 12px; }
        .add-token-error {
          background: #fef2f2; color: #b91c1c; padding: 8px 10px;
          border-radius: 8px; font-size: 13px;
        }
        .add-token-actions {
          display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px;
        }
        .add-token-actions button {
          padding: 8px 16px; border-radius: 8px; font-size: 14px;
          font-weight: 500; cursor: pointer; border: none;
        }
        .add-token-cancel { background: #f3f4f6; color: #374151; }
        .add-token-submit { background: #0d9488; color: #fff; }
        .add-token-submit:disabled { opacity: 0.5; cursor: not-allowed; }
      `}</style>
    </div>
  );
}

export default AddTokenDialog;
