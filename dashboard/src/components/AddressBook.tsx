/**
 * AddressBook Component
 * Feature: Address Book — manage contacts stored on USB
 * Supports: CRUD operations, search, chain filter, clipboard copy,
 *           and optional address selection for SendTransaction integration
 */

import { useState, useEffect, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useContacts } from "@/hooks/useContacts";
import type { Contact, AddContactParams, UpdateContactParams } from "@/types/contact";

interface AddressBookProps {
  usbPath: string;
  sessionToken: string;
  onBack: () => void;
  onSelectAddress?: (address: string, symbol: string) => void;
}

const CHAINS = [
  { symbol: "ETH", coinName: "Ethereum" },
  { symbol: "BNB", coinName: "BNB Chain" },
  { symbol: "MATIC", coinName: "Polygon" },
  { symbol: "ARB", coinName: "Arbitrum" },
  { symbol: "OP", coinName: "Optimism" },
  { symbol: "BASE", coinName: "Base" },
  { symbol: "BTC", coinName: "Bitcoin" },
] as const;

/** Shorten an address for display: 0x1234...5678 */
function shortenAddress(address: string): string {
  if (!address || address.length < 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function AddressBook({
  usbPath,
  sessionToken,
  onBack,
  onSelectAddress,
}: AddressBookProps) {
  const { t } = useTranslation();
  const {
    contacts,
    isLoading,
    error,
    loadContacts,
    addContact,
    updateContact,
    deleteContact,
  } = useContacts(usbPath, sessionToken);

  // --- local UI state ---
  const [searchQuery, setSearchQuery] = useState("");
  const [chainFilter, setChainFilter] = useState<string>("ALL");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [formName, setFormName] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formSymbol, setFormSymbol] = useState<string>(CHAINS[0].symbol);
  const [formNotes, setFormNotes] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<Contact | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Load contacts on mount
  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  // --- derived / filtered list ---
  const filteredContacts = useMemo(() => {
    let list = contacts;

    if (chainFilter !== "ALL") {
      list = list.filter((c) => c.symbol === chainFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.address.toLowerCase().includes(q) ||
          c.coinName.toLowerCase().includes(q) ||
          (c.notes && c.notes.toLowerCase().includes(q))
      );
    }

    return list;
  }, [contacts, chainFilter, searchQuery]);

  // --- clipboard ---
  const handleCopy = useCallback(async (contact: Contact) => {
    try {
      await navigator.clipboard.writeText(contact.address);
      setCopiedId(contact.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Fallback — should not happen in Tauri WebView
    }
  }, []);

  // --- modal helpers ---
  const openAddModal = useCallback(() => {
    setEditingContact(null);
    setFormName("");
    setFormAddress("");
    setFormSymbol(CHAINS[0].symbol);
    setFormNotes("");
    setFormError(null);
    setModalOpen(true);
  }, []);

  const openEditModal = useCallback((contact: Contact) => {
    setEditingContact(contact);
    setFormName(contact.name);
    setFormAddress(contact.address);
    setFormSymbol(contact.symbol);
    setFormNotes(contact.notes ?? "");
    setFormError(null);
    setModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setEditingContact(null);
    setFormError(null);
  }, []);

  const selectedChain = CHAINS.find((c) => c.symbol === formSymbol) ?? CHAINS[0];

  const handleSave = useCallback(async () => {
    // Validate
    const trimmedName = formName.trim();
    const trimmedAddress = formAddress.trim();
    if (!trimmedName) {
      setFormError(t("addressBook.errorNameRequired"));
      return;
    }
    if (!trimmedAddress) {
      setFormError(t("addressBook.errorAddressRequired"));
      return;
    }

    setIsSaving(true);
    setFormError(null);

    try {
      if (editingContact) {
        const params: UpdateContactParams = {
          contactId: editingContact.id,
          name: trimmedName,
          address: trimmedAddress,
          symbol: formSymbol,
          coinName: selectedChain.coinName,
          notes: formNotes.trim() || undefined,
        };
        const result = await updateContact(params);
        if (!result) throw new Error(t("addressBook.errorSaveFailed"));
      } else {
        const params: AddContactParams = {
          name: trimmedName,
          address: trimmedAddress,
          symbol: formSymbol,
          coinName: selectedChain.coinName,
          notes: formNotes.trim() || undefined,
        };
        const result = await addContact(params);
        if (!result) throw new Error(t("addressBook.errorSaveFailed"));
      }
      closeModal();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setFormError(msg);
    } finally {
      setIsSaving(false);
    }
  }, [
    formName,
    formAddress,
    formSymbol,
    formNotes,
    editingContact,
    selectedChain,
    addContact,
    updateContact,
    closeModal,
    t,
  ]);

  // --- delete ---
  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteContact(deleteTarget.id);
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  }, [deleteTarget, deleteContact]);

  // --- render ---
  return (
    <div className="ab-root">
      {/* Header */}
      <header className="ab-header">
        <button onClick={onBack} className="ab-back-btn">
          <span className="ab-back-arrow">&larr;</span>
          {t("addressBook.back")}
        </button>

        <h2 className="ab-title">{t("addressBook.title")}</h2>

        <button onClick={openAddModal} className="ab-add-btn">
          + {t("addressBook.addContact")}
        </button>
      </header>

      {/* Search + chain filter */}
      <div className="ab-toolbar">
        <div className="ab-search-wrap">
          <svg
            className="ab-search-icon"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#94a3b8"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            className="ab-search-input"
            placeholder={t("addressBook.searchPlaceholder")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <select
          className="ab-chain-select"
          value={chainFilter}
          onChange={(e) => setChainFilter(e.target.value)}
        >
          <option value="ALL">{t("addressBook.allChains")}</option>
          {CHAINS.map((c) => (
            <option key={c.symbol} value={c.symbol}>
              {c.coinName} ({c.symbol})
            </option>
          ))}
        </select>
      </div>

      {/* Error banner */}
      {error && (
        <div className="ab-error">
          <p>{error}</p>
          <button onClick={loadContacts}>{t("addressBook.retry")}</button>
        </div>
      )}

      {/* Loading state */}
      {isLoading && contacts.length === 0 && (
        <div className="ab-loading">
          <div className="ab-spinner" />
          <p>{t("addressBook.loading")}</p>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && filteredContacts.length === 0 && (
        <div className="ab-empty">
          <svg
            width="56"
            height="56"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#cbd5e1"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          <h3>{t("addressBook.emptyTitle")}</h3>
          <p>{t("addressBook.emptyMessage")}</p>
        </div>
      )}

      {/* Contact list */}
      {filteredContacts.length > 0 && (
        <div className="ab-list">
          {filteredContacts.map((contact) => (
            <div key={contact.id} className="ab-card">
              <div className="ab-card-main">
                {/* Avatar circle with first letter */}
                <div className="ab-avatar">
                  {contact.name.charAt(0).toUpperCase()}
                </div>

                <div className="ab-card-info">
                  <div className="ab-card-top-row">
                    <span className="ab-card-name">{contact.name}</span>
                    <span className="ab-chain-badge">{contact.symbol}</span>
                  </div>
                  <span className="ab-card-address">
                    {shortenAddress(contact.address)}
                  </span>
                  {contact.notes && (
                    <span className="ab-card-notes">{contact.notes}</span>
                  )}
                </div>
              </div>

              <div className="ab-card-actions">
                {onSelectAddress && (
                  <button
                    className="ab-action-btn ab-select-btn"
                    title={t("addressBook.select")}
                    onClick={() =>
                      onSelectAddress(contact.address, contact.symbol)
                    }
                  >
                    {t("addressBook.select")}
                  </button>
                )}
                <button
                  className="ab-action-btn ab-copy-btn"
                  title={t("addressBook.copyAddress")}
                  onClick={() => handleCopy(contact)}
                >
                  {copiedId === contact.id ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                  )}
                </button>
                <button
                  className="ab-action-btn ab-edit-btn"
                  title={t("addressBook.edit")}
                  onClick={() => openEditModal(contact)}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </button>
                <button
                  className="ab-action-btn ab-delete-btn"
                  title={t("addressBook.delete")}
                  onClick={() => setDeleteTarget(contact)}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                    <path d="M10 11v6" />
                    <path d="M14 11v6" />
                    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ---- Add / Edit Modal ---- */}
      {modalOpen && (
        <div className="ab-overlay" onClick={closeModal}>
          <div
            className="ab-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-labelledby="ab-modal-title"
          >
            <h3 id="ab-modal-title" className="ab-modal-title">
              {editingContact
                ? t("addressBook.editContact")
                : t("addressBook.addContact")}
            </h3>

            {formError && <div className="ab-form-error">{formError}</div>}

            <label className="ab-label">
              {t("addressBook.labelName")}
              <input
                type="text"
                className="ab-input"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder={t("addressBook.placeholderName")}
                autoFocus
              />
            </label>

            <label className="ab-label">
              {t("addressBook.labelAddress")}
              <input
                type="text"
                className="ab-input ab-input-mono"
                value={formAddress}
                onChange={(e) => setFormAddress(e.target.value)}
                placeholder={t("addressBook.placeholderAddress")}
              />
            </label>

            <label className="ab-label">
              {t("addressBook.labelChain")}
              <select
                className="ab-input"
                value={formSymbol}
                onChange={(e) => setFormSymbol(e.target.value)}
              >
                {CHAINS.map((c) => (
                  <option key={c.symbol} value={c.symbol}>
                    {c.coinName} ({c.symbol})
                  </option>
                ))}
              </select>
            </label>

            <label className="ab-label">
              {t("addressBook.labelNotes")}
              <textarea
                className="ab-textarea"
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder={t("addressBook.placeholderNotes")}
                rows={3}
              />
            </label>

            <div className="ab-modal-actions">
              <button
                className="ab-modal-cancel"
                onClick={closeModal}
                disabled={isSaving}
              >
                {t("addressBook.cancel")}
              </button>
              <button
                className="ab-modal-save"
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving
                  ? t("addressBook.saving")
                  : editingContact
                  ? t("addressBook.saveChanges")
                  : t("addressBook.addContact")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---- Delete Confirmation ---- */}
      {deleteTarget && (
        <div
          className="ab-overlay"
          onClick={() => !isDeleting && setDeleteTarget(null)}
        >
          <div
            className="ab-modal ab-modal-sm"
            onClick={(e) => e.stopPropagation()}
            role="alertdialog"
            aria-labelledby="ab-delete-title"
          >
            <div className="ab-delete-icon-wrap">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            </div>
            <h3 id="ab-delete-title" className="ab-modal-title">
              {t("addressBook.deleteTitle")}
            </h3>
            <p className="ab-delete-msg">
              {t("addressBook.deleteMessage", { name: deleteTarget.name })}
            </p>
            <div className="ab-modal-actions">
              <button
                className="ab-modal-cancel"
                onClick={() => setDeleteTarget(null)}
                disabled={isDeleting}
              >
                {t("addressBook.cancel")}
              </button>
              <button
                className="ab-modal-delete"
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
              >
                {isDeleting
                  ? t("addressBook.deleting")
                  : t("addressBook.confirmDelete")}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        /* ===== Root / Layout ===== */
        .ab-root {
          padding: 20px;
          max-width: 800px;
          margin: 0 auto;
        }

        /* ===== Header ===== */
        .ab-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 24px;
          padding-bottom: 16px;
          border-bottom: 1px solid #e2e8f0;
        }

        .ab-back-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          background: #f1f5f9;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-size: 14px;
          color: #1e293b;
          transition: background 0.2s;
        }
        .ab-back-btn:hover {
          background: #e2e8f0;
        }

        .ab-back-arrow {
          font-size: 18px;
        }

        .ab-title {
          margin: 0;
          font-size: 20px;
          color: #1e293b;
          font-weight: 700;
        }

        .ab-add-btn {
          padding: 8px 18px;
          background: #0d9488;
          color: #fff;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 600;
          transition: background 0.2s;
        }
        .ab-add-btn:hover {
          background: #0f766e;
        }

        /* ===== Toolbar (search + filter) ===== */
        .ab-toolbar {
          display: flex;
          gap: 12px;
          margin-bottom: 20px;
        }

        .ab-search-wrap {
          flex: 1;
          position: relative;
        }

        .ab-search-icon {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          pointer-events: none;
        }

        .ab-search-input {
          width: 100%;
          padding: 10px 12px 10px 36px;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          font-size: 14px;
          color: #1e293b;
          outline: none;
          background: #ffffff;
          transition: border-color 0.2s;
          box-sizing: border-box;
        }
        .ab-search-input:focus {
          border-color: #2dd4bf;
        }
        .ab-search-input::placeholder {
          color: #94a3b8;
        }

        .ab-chain-select {
          padding: 10px 14px;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          font-size: 14px;
          color: #1e293b;
          background: #ffffff;
          cursor: pointer;
          outline: none;
          min-width: 170px;
          transition: border-color 0.2s;
        }
        .ab-chain-select:focus {
          border-color: #2dd4bf;
        }

        /* ===== Error ===== */
        .ab-error {
          background: #fef2f2;
          border: 1px solid #fee2e2;
          border-radius: 12px;
          padding: 16px;
          text-align: center;
          color: #dc2626;
          margin-bottom: 20px;
        }
        .ab-error p {
          margin: 0 0 12px;
        }
        .ab-error button {
          padding: 8px 16px;
          background: #dc2626;
          color: #fff;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-size: 14px;
        }

        /* ===== Loading ===== */
        .ab-loading {
          text-align: center;
          padding: 48px 24px;
        }
        .ab-loading p {
          margin: 0;
          color: #64748b;
        }

        .ab-spinner {
          width: 40px;
          height: 40px;
          border: 3px solid #e2e8f0;
          border-top-color: #2dd4bf;
          border-radius: 50%;
          animation: ab-spin 1s linear infinite;
          margin: 0 auto 16px;
        }

        @keyframes ab-spin {
          to { transform: rotate(360deg); }
        }

        /* ===== Empty State ===== */
        .ab-empty {
          text-align: center;
          padding: 56px 24px;
          background: #f8fafc;
          border-radius: 12px;
        }
        .ab-empty svg {
          margin-bottom: 16px;
        }
        .ab-empty h3 {
          margin: 0 0 8px;
          color: #1e293b;
          font-size: 18px;
        }
        .ab-empty p {
          margin: 0;
          color: #64748b;
          font-size: 14px;
        }

        /* ===== Contact List ===== */
        .ab-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .ab-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .ab-card:hover {
          border-color: #cbd5e1;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
        }

        .ab-card-main {
          display: flex;
          align-items: center;
          gap: 14px;
          min-width: 0;
          flex: 1;
        }

        .ab-avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: linear-gradient(135deg, #0d9488, #2dd4bf);
          color: #fff;
          font-weight: 700;
          font-size: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .ab-card-info {
          display: flex;
          flex-direction: column;
          gap: 3px;
          min-width: 0;
        }

        .ab-card-top-row {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .ab-card-name {
          font-weight: 600;
          font-size: 15px;
          color: #1e293b;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .ab-chain-badge {
          display: inline-block;
          padding: 2px 8px;
          background: #f0fdfa;
          color: #0d9488;
          border: 1px solid #99f6e4;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 600;
          flex-shrink: 0;
        }

        .ab-card-address {
          font-size: 13px;
          color: #64748b;
          font-family: "SF Mono", "Fira Code", "Cascadia Code", monospace;
        }

        .ab-card-notes {
          font-size: 13px;
          color: #94a3b8;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 340px;
        }

        /* ===== Card Actions ===== */
        .ab-card-actions {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-shrink: 0;
          margin-left: 12px;
        }

        .ab-action-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 34px;
          height: 34px;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          background: #ffffff;
          cursor: pointer;
          color: #64748b;
          transition: background 0.2s, color 0.2s, border-color 0.2s;
        }
        .ab-action-btn:hover {
          background: #f1f5f9;
          color: #1e293b;
          border-color: #cbd5e1;
        }

        .ab-select-btn {
          width: auto;
          padding: 0 14px;
          font-size: 13px;
          font-weight: 600;
          color: #0d9488;
          border-color: #99f6e4;
          background: #f0fdfa;
        }
        .ab-select-btn:hover {
          background: #ccfbf1;
          color: #0f766e;
        }

        .ab-copy-btn:hover {
          color: #0d9488;
        }

        .ab-edit-btn:hover {
          color: #0d9488;
        }

        .ab-delete-btn:hover {
          color: #dc2626;
          border-color: #fecaca;
          background: #fef2f2;
        }

        /* ===== Overlay / Modal ===== */
        .ab-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.45);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 50;
        }

        .ab-modal {
          background: #ffffff;
          border-radius: 16px;
          padding: 28px;
          width: 100%;
          max-width: 480px;
          margin: 16px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
          max-height: 90vh;
          overflow-y: auto;
        }

        .ab-modal-sm {
          max-width: 400px;
          text-align: center;
        }

        .ab-modal-title {
          margin: 0 0 20px;
          font-size: 18px;
          font-weight: 700;
          color: #1e293b;
        }

        .ab-form-error {
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #dc2626;
          padding: 10px 14px;
          border-radius: 8px;
          font-size: 13px;
          margin-bottom: 16px;
        }

        .ab-label {
          display: flex;
          flex-direction: column;
          gap: 6px;
          margin-bottom: 16px;
          font-size: 13px;
          font-weight: 600;
          color: #475569;
        }

        .ab-input {
          padding: 10px 14px;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          font-size: 14px;
          color: #1e293b;
          outline: none;
          background: #ffffff;
          transition: border-color 0.2s;
        }
        .ab-input:focus {
          border-color: #2dd4bf;
        }
        .ab-input::placeholder {
          color: #94a3b8;
        }

        .ab-input-mono {
          font-family: "SF Mono", "Fira Code", "Cascadia Code", monospace;
          font-size: 13px;
        }

        .ab-textarea {
          padding: 10px 14px;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          font-size: 14px;
          color: #1e293b;
          outline: none;
          background: #ffffff;
          resize: vertical;
          font-family: inherit;
          transition: border-color 0.2s;
        }
        .ab-textarea:focus {
          border-color: #2dd4bf;
        }
        .ab-textarea::placeholder {
          color: #94a3b8;
        }

        .ab-modal-actions {
          display: flex;
          gap: 12px;
          margin-top: 24px;
        }

        .ab-modal-cancel {
          flex: 1;
          padding: 10px 16px;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          color: #64748b;
          cursor: pointer;
          transition: background 0.2s;
        }
        .ab-modal-cancel:hover:not(:disabled) {
          background: #f1f5f9;
        }
        .ab-modal-cancel:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .ab-modal-save {
          flex: 1;
          padding: 10px 16px;
          background: #0d9488;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          color: #fff;
          cursor: pointer;
          transition: background 0.2s;
        }
        .ab-modal-save:hover:not(:disabled) {
          background: #0f766e;
        }
        .ab-modal-save:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .ab-modal-delete {
          flex: 1;
          padding: 10px 16px;
          background: #dc2626;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          color: #fff;
          cursor: pointer;
          transition: background 0.2s;
        }
        .ab-modal-delete:hover:not(:disabled) {
          background: #b91c1c;
        }
        .ab-modal-delete:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        /* ===== Delete dialog ===== */
        .ab-delete-icon-wrap {
          display: flex;
          justify-content: center;
          margin-bottom: 12px;
        }

        .ab-delete-msg {
          font-size: 14px;
          color: #64748b;
          margin: 0 0 4px;
        }
      `}</style>
    </div>
  );
}
