/**
 * DescriptorSettings — manage the ERC-7730 transaction-description data.
 *
 * ArcSign ships with a descriptor snapshot compiled into the binary, so clear
 * signing works fully offline. This screen is the ONLY place that fetches new
 * descriptors, and only when the user presses Update — hence the explicit
 * "this connects to the internet" notice.
 */

import { useCallback, useEffect, useState } from "react";
import styles from "./DescriptorSettings.module.css";
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
    <div className={styles.descriptorSettings}>
      <button onClick={onBack} className="back-button">
        ← {t("common.back", "Back")}
      </button>

      <h2>{t("descriptors.title", "Transaction descriptions")}</h2>
      <p className={styles.descriptorSettings_Intro}>
        {t(
          "descriptors.intro",
          "Descriptions published by protocol authors let ArcSign show what a transaction actually does, instead of raw contract data.",
        )}
      </p>

      <dl className={styles.descriptorSettings_Status}>
        <dt>{t("descriptors.version", "Version")}</dt>
        <dd>{status?.version || t("descriptors.builtIn", "built-in")}</dd>
        <dt>{t("descriptors.count", "Descriptions")}</dt>
        <dd>{status ? status.count : "—"}</dd>
      </dl>

      <button
        type="button"
        className={styles.descriptorSettings_Update}
        onClick={handleUpdate}
        disabled={updating}
      >
        {updating
          ? t("descriptors.updating", "Updating…")
          : t("descriptors.update", "Update")}
      </button>

      <p className={styles.descriptorSettings_Notice}>
        {t(
          "descriptors.networkNotice",
          "Updating connects to GitHub to download the latest descriptions. Nothing is sent about your wallet.",
        )}
      </p>

      {updated !== null && (
        <p className={styles.descriptorSettings_Ok}>
          {t("descriptors.updateDone", "Updated — {{count}} descriptions available.", {
            count: updated,
          })}
        </p>
      )}
      {error && (
        <p className={styles.descriptorSettings_Error}>
          {t("descriptors.updateFailed", "Update failed:")} {error}
        </p>
      )}
    </div>
  );
}

export default DescriptorSettings;
