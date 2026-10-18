/**
 * TransactionLabelModal Component
 * Feature: Transaction Labels (v1.3) — edit/delete labels for individual transactions
 */

import React, { useState, useEffect } from "react";
import styles from "./TransactionLabelModal.module.css";
import { useTranslation } from "react-i18next";
import type { TxLabelEntry, TxLabelCategory } from "@/types/txLabel";

interface TransactionLabelModalProps {
  network: string;
  txHash: string;
  existingLabel?: TxLabelEntry;
  onSave: (name: string, category: string, notes: string) => Promise<boolean>;
  onDelete: () => Promise<boolean>;
  onClose: () => void;
}

const CATEGORIES: TxLabelCategory[] = ["swap", "transfer", "stake", "nft", "approval", "other"];

export const TransactionLabelModal: React.FC<TransactionLabelModalProps> = ({
  network,
  txHash,
  existingLabel,
  onSave,
  onDelete,
  onClose,
}) => {
  const { t } = useTranslation();
  const [name, setName] = useState(existingLabel?.label.name ?? "");
  const [category, setCategory] = useState(existingLabel?.label.category ?? "other");
  const [notes, setNotes] = useState(existingLabel?.label.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (existingLabel) {
      setName(existingLabel.label.name);
      setCategory(existingLabel.label.category ?? "other");
      setNotes(existingLabel.label.notes ?? "");
    }
  }, [existingLabel]);

  const handleSave = async () => {
    if (!name.trim()) {
      setError(t("txLabel.nameRequired", "Label name is required"));
      return;
    }
    setSaving(true);
    setError(null);
    const ok = await onSave(name.trim(), category, notes.trim());
    setSaving(false);
    if (ok) onClose();
    else setError(t("txLabel.saveFailed", "Failed to save label"));
  };

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    const ok = await onDelete();
    setDeleting(false);
    if (ok) onClose();
    else setError(t("txLabel.deleteFailed", "Failed to delete label"));
  };

  const shortenHash = (h: string) =>
    h.length > 14 ? `${h.slice(0, 8)}...${h.slice(-6)}` : h;

  return (
    <div className={styles.txlabelOverlay} onClick={onClose}>
      <div className={styles.txlabelModal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.txlabelHeader}>
          <h3>{existingLabel ? t("txLabel.editLabel") : t("txLabel.addLabel")}</h3>
          <button className={styles.txlabelClose} onClick={onClose}>&times;</button>
        </div>

        <div className={styles.txlabelTxInfo}>
          <span className={styles.txlabelNetwork}>{network}</span>
          <span className={styles.txlabelHash}>{shortenHash(txHash)}</span>
        </div>

        {error && <div className={styles.txlabelError}>{error}</div>}

        <div className={styles.txlabelForm}>
          <div className={styles.txlabelField}>
            <label>{t("txLabel.name")}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("txLabel.namePlaceholder", "e.g. Buy USDC on Uniswap")}
              maxLength={100}
              autoFocus
            />
          </div>

          <div className={styles.txlabelField}>
            <label>{t("txLabel.category")}</label>
            <div className={styles.txlabelCategories}>
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  className={`${styles.txlabelCatBtn} ${category === cat ? styles.active : ""}`}
                  onClick={() => setCategory(cat)}
                  type="button"
                >
                  {t(`txLabel.categories.${cat}`)}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.txlabelField}>
            <label>{t("txLabel.notes")}</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t("txLabel.notesPlaceholder", "Optional notes...")}
              maxLength={500}
              rows={3}
            />
          </div>
        </div>

        <div className={styles.txlabelActions}>
          {existingLabel && (
            <button
              className={styles.txlabelDeleteBtn}
              onClick={handleDelete}
              disabled={deleting || saving}
            >
              {deleting ? "..." : t("txLabel.deleteLabel", "Delete")}
            </button>
          )}
          <div className={styles.txlabelActionsRight}>
            <button className={styles.txlabelCancelBtn} onClick={onClose} disabled={saving || deleting}>
              {t("common.cancel", "Cancel")}
            </button>
            <button
              className={styles.txlabelSaveBtn}
              onClick={handleSave}
              disabled={saving || deleting || !name.trim()}
            >
              {saving ? "..." : t("txLabel.save", "Save")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
