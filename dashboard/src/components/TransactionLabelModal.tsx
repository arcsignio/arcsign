/**
 * TransactionLabelModal Component
 * Feature: Transaction Labels (v1.3) — edit/delete labels for individual transactions
 */

import React, { useState, useEffect } from "react";
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
    <div className="txlabel-overlay" onClick={onClose}>
      <div className="txlabel-modal" onClick={(e) => e.stopPropagation()}>
        <div className="txlabel-header">
          <h3>{existingLabel ? t("txLabel.editLabel") : t("txLabel.addLabel")}</h3>
          <button className="txlabel-close" onClick={onClose}>&times;</button>
        </div>

        <div className="txlabel-tx-info">
          <span className="txlabel-network">{network}</span>
          <span className="txlabel-hash">{shortenHash(txHash)}</span>
        </div>

        {error && <div className="txlabel-error">{error}</div>}

        <div className="txlabel-form">
          <div className="txlabel-field">
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

          <div className="txlabel-field">
            <label>{t("txLabel.category")}</label>
            <div className="txlabel-categories">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  className={`txlabel-cat-btn ${category === cat ? "active" : ""}`}
                  onClick={() => setCategory(cat)}
                  type="button"
                >
                  {t(`txLabel.categories.${cat}`)}
                </button>
              ))}
            </div>
          </div>

          <div className="txlabel-field">
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

        <div className="txlabel-actions">
          {existingLabel && (
            <button
              className="txlabel-delete-btn"
              onClick={handleDelete}
              disabled={deleting || saving}
            >
              {deleting ? "..." : t("txLabel.deleteLabel", "Delete")}
            </button>
          )}
          <div className="txlabel-actions-right">
            <button className="txlabel-cancel-btn" onClick={onClose} disabled={saving || deleting}>
              {t("common.cancel", "Cancel")}
            </button>
            <button
              className="txlabel-save-btn"
              onClick={handleSave}
              disabled={saving || deleting || !name.trim()}
            >
              {saving ? "..." : t("txLabel.save", "Save")}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        .txlabel-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
        }
        .txlabel-modal {
          background: white;
          border-radius: 16px;
          width: 100%;
          max-width: 440px;
          padding: 24px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }
        .txlabel-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 16px;
        }
        .txlabel-header h3 {
          margin: 0;
          font-size: 18px;
          color: #111827;
        }
        .txlabel-close {
          background: none;
          border: none;
          font-size: 24px;
          color: #9ca3af;
          cursor: pointer;
          padding: 0 4px;
        }
        .txlabel-close:hover { color: #374151; }
        .txlabel-tx-info {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          background: #f3f4f6;
          border-radius: 8px;
          margin-bottom: 16px;
          font-size: 13px;
          color: #6b7280;
        }
        .txlabel-network {
          padding: 2px 8px;
          background: #0d9488;
          color: white;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 600;
        }
        .txlabel-hash {
          font-family: monospace;
        }
        .txlabel-error {
          padding: 8px 12px;
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 6px;
          color: #dc2626;
          font-size: 13px;
          margin-bottom: 12px;
        }
        .txlabel-form {
          display: flex;
          flex-direction: column;
          gap: 16px;
          margin-bottom: 20px;
        }
        .txlabel-field label {
          display: block;
          font-size: 13px;
          font-weight: 500;
          color: #374151;
          margin-bottom: 6px;
        }
        .txlabel-field input,
        .txlabel-field textarea {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          font-size: 14px;
          color: #111827;
          outline: none;
          transition: border-color 0.2s;
          box-sizing: border-box;
        }
        .txlabel-field input:focus,
        .txlabel-field textarea:focus {
          border-color: #2dd4bf;
          box-shadow: 0 0 0 3px rgba(45,212,191,0.1);
        }
        .txlabel-field textarea {
          resize: vertical;
          min-height: 60px;
        }
        .txlabel-categories {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }
        .txlabel-cat-btn {
          padding: 6px 12px;
          border: 1px solid #d1d5db;
          border-radius: 20px;
          background: white;
          font-size: 13px;
          color: #6b7280;
          cursor: pointer;
          transition: all 0.2s;
        }
        .txlabel-cat-btn:hover {
          border-color: #2dd4bf;
          color: #0d9488;
        }
        .txlabel-cat-btn.active {
          background: #0d9488;
          border-color: #0d9488;
          color: white;
        }
        .txlabel-actions {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .txlabel-actions-right {
          display: flex;
          gap: 8px;
          margin-left: auto;
        }
        .txlabel-cancel-btn {
          padding: 8px 16px;
          background: #f3f4f6;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          color: #6b7280;
          cursor: pointer;
        }
        .txlabel-cancel-btn:hover { background: #e5e7eb; }
        .txlabel-save-btn {
          padding: 8px 20px;
          background: #0d9488;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          color: white;
          cursor: pointer;
          transition: background 0.2s;
        }
        .txlabel-save-btn:hover:not(:disabled) { background: #0f766e; }
        .txlabel-save-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .txlabel-delete-btn {
          padding: 8px 16px;
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 8px;
          font-size: 14px;
          color: #dc2626;
          cursor: pointer;
          transition: all 0.2s;
        }
        .txlabel-delete-btn:hover:not(:disabled) {
          background: #fee2e2;
          border-color: #f87171;
        }
        .txlabel-delete-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
};
