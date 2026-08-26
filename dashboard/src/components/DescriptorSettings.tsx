/**
 * DescriptorSettings — manage the ERC-7730 transaction-description data.
 *
 * ArcSign ships with a descriptor snapshot compiled into the binary, so clear
 * signing works fully offline. This screen is the ONLY place that fetches new
 * descriptors, and only when the user presses Update — hence the explicit
 * "this connects to the internet" notice.
 */

import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  getDescriptorStatus,
  updateDescriptors,
  type DescriptorStatus,
} from "@/services/clearsign/resolveDescriptor";

interface DescriptorSettingsProps {
  usbPath: string;
  sessionToken?: string;
  onBack: () => void;
}

export function DescriptorSettings({ usbPath, sessionToken, onBack }: DescriptorSettingsProps) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<DescriptorStatus | null>(null);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updated, setUpdated] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    setStatus(await getDescriptorStatus(usbPath, sessionToken));
  }, [usbPath, sessionToken]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleUpdate = async () => {
    setUpdating(true);
    setError(null);
    setUpdated(null);
    try {
      const next = await updateDescriptors(usbPath, sessionToken);
      setStatus(next);
      setUpdated(next.count);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="descriptor-settings">
      <button onClick={onBack} className="back-button">
        ← {t("common.back", "Back")}
      </button>

      <h2>{t("descriptors.title", "Transaction descriptions")}</h2>
      <p className="descriptor-settings__intro">
        {t(
          "descriptors.intro",
          "Descriptions published by protocol authors let ArcSign show what a transaction actually does, instead of raw contract data.",
        )}
      </p>

      <dl className="descriptor-settings__status">
        <dt>{t("descriptors.version", "Version")}</dt>
        <dd>{status?.version || t("descriptors.builtIn", "built-in")}</dd>
        <dt>{t("descriptors.count", "Descriptions")}</dt>
        <dd>{status ? status.count : "—"}</dd>
      </dl>

      <button
        type="button"
        className="descriptor-settings__update"
        onClick={handleUpdate}
        disabled={updating}
      >
        {updating
          ? t("descriptors.updating", "Updating…")
          : t("descriptors.update", "Update")}
      </button>

      <p className="descriptor-settings__notice">
        {t(
          "descriptors.networkNotice",
          "Updating connects to GitHub to download the latest descriptions. Nothing is sent about your wallet.",
        )}
      </p>

      {updated !== null && (
        <p className="descriptor-settings__ok">
          {t("descriptors.updateDone", "Updated — {{count}} descriptions available.", {
            count: updated,
          })}
        </p>
      )}
      {error && (
        <p className="descriptor-settings__error">
          {t("descriptors.updateFailed", "Update failed:")} {error}
        </p>
      )}

      <style>{`
        .descriptor-settings { padding: 1.5rem; max-width: 640px; }
        .descriptor-settings h2 { margin: 1rem 0 0.5rem; font-size: 1.25rem; }
        .descriptor-settings__intro { color: #6b7280; font-size: 0.9rem; line-height: 1.6; }
        .descriptor-settings__status {
          display: grid; grid-template-columns: auto 1fr; gap: 0.5rem 1.5rem;
          margin: 1.5rem 0; padding: 1rem; border: 1px solid #e5e7eb; border-radius: 8px;
        }
        .descriptor-settings__status dt { color: #6b7280; font-size: 0.875rem; }
        .descriptor-settings__status dd { margin: 0; font-weight: 600; }
        .descriptor-settings__update {
          padding: 0.625rem 1.25rem; border: none; border-radius: 8px;
          background: #0d9488; color: #fff; font-weight: 600; cursor: pointer;
        }
        .descriptor-settings__update:hover:not(:disabled) { background: #0f766e; }
        .descriptor-settings__update:disabled { opacity: 0.5; cursor: not-allowed; }
        .descriptor-settings__notice {
          margin-top: 0.75rem; color: #6b7280; font-size: 0.8125rem; line-height: 1.5;
        }
        .descriptor-settings__ok { color: #0d9488; font-size: 0.875rem; }
        .descriptor-settings__error { color: #dc2626; font-size: 0.875rem; }
      `}</style>
    </div>
  );
}

export default DescriptorSettings;
