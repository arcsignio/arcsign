import { useTranslation } from "react-i18next";

// Pure presentation: when the backend says requiresAcknowledge, show a red
// warning + the "I understand the risk" checkbox. Controlled by the parent.
export function SignGateAcknowledge({
  requiresAcknowledge,
  acknowledged,
  onChange,
}: {
  requiresAcknowledge: boolean;
  acknowledged: boolean;
  onChange: (checked: boolean) => void;
}) {
  const { t } = useTranslation();
  if (!requiresAcknowledge) return null;
  return (
    <label
      style={{
        marginTop: "0.5rem", display: "flex", alignItems: "flex-start", gap: "0.5rem",
        padding: "0.75rem 1rem", background: "#fef2f2", border: "1px solid #fecaca",
        borderRadius: "10px", fontSize: "0.8125rem", fontWeight: 600, color: "#b91c1c", cursor: "pointer",
      }}
    >
      <input type="checkbox" checked={acknowledged} onChange={(e) => onChange(e.target.checked)} style={{ marginTop: "0.15rem" }} />
      <span>{t("clearSign.ackRisk")}</span>
    </label>
  );
}

export default SignGateAcknowledge;
