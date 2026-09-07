import { useState } from "react";
import styles from "./AddTokenDialog.module.css";
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
    <div className={styles.addTokenOverlay} role="dialog" aria-modal="true">
      <div className={styles.addTokenDialog}>
        <h3>{t("addToken.title", "Import token")}</h3>
        <p className={styles.addTokenNetwork}>
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
          <span className={styles.addTokenHintError}>
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
          <span className={styles.addTokenHintError}>
            {t("addToken.invalidDecimals", "Decimals must be 0–36")}
          </span>
        )}

        {error && <div className={styles.addTokenError}>{error}</div>}

        <div className={styles.addTokenActions}>
          <button type="button" className={styles.addTokenCancel} onClick={onClose}>
            {t("common.cancel", "Cancel")}
          </button>
          <button
            type="button"
            className={styles.addTokenSubmit}
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            {isSubmitting
              ? t("addToken.adding", "Adding…")
              : t("addToken.add", "Add token")}
          </button>
        </div>
      </div>
    </div>
  );
}

export default AddTokenDialog;
