/**
 * AddressBook Component
 * Feature: Address Book — manage contacts stored on USB
 * Supports: CRUD operations, search, chain filter, clipboard copy,
 *           and optional address selection for SendTransaction integration
 */

import { useState, useEffect, useMemo, useCallback } from "react";
import styles from "./AddressBook.module.css";
import { shortenAddress as sharedShorten } from "@/utils/formatAmount";
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
  return sharedShorten(address, 6, 4);
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
    <div className={styles.abRoot}>
      {/* Header */}
      <header className={styles.abHeader}>
        <button onClick={onBack} className={styles.abBackBtn}>
          <span className={styles.abBackArrow}>&larr;</span>
          {t("addressBook.back")}
        </button>

        <h2 className={styles.abTitle}>{t("addressBook.title")}</h2>

        <button onClick={openAddModal} className={styles.abAddBtn}>
          + {t("addressBook.addContact")}
        </button>
      </header>

      {/* Search + chain filter */}
      <div className={styles.abToolbar}>
        <div className={styles.abSearchWrap}>
          <svg
            className={styles.abSearchIcon}
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
            className={styles.abSearchInput}
            placeholder={t("addressBook.search")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <select
          className={styles.abChainSelect}
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
        <div className={styles.abError}>
          <p>{error}</p>
          <button onClick={loadContacts}>{t("addressBook.retry")}</button>
        </div>
      )}

      {/* Loading state */}
      {isLoading && contacts.length === 0 && (
        <div className={styles.abLoading}>
          <div className={styles.abSpinner} />
          <p>{t("addressBook.loading")}</p>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && filteredContacts.length === 0 && (
        <div className={styles.abEmpty}>
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
          {/* Contacts exist but none match — a filtered-out list is not an
              empty address book, and telling the user to add their first
              contact when they already have some is actively misleading. */}
          {contacts.length > 0 ? (
            <p>{t("addressBook.noResults")}</p>
          ) : (
            <>
              <h3>{t("addressBook.emptyTitle")}</h3>
              <p>{t("addressBook.emptyMessage")}</p>
            </>
          )}
        </div>
      )}

      {/* Contact list */}
      {filteredContacts.length > 0 && (
        <div className={styles.abList}>
          {filteredContacts.map((contact) => (
            <div key={contact.id} className={styles.abCard}>
              <div className={styles.abCardMain}>
                {/* Avatar circle with first letter */}
                <div className={styles.abAvatar}>
                  {contact.name.charAt(0).toUpperCase()}
                </div>

                <div className={styles.abCardInfo}>
                  <div className={styles.abCardTopRow}>
                    <span className={styles.abCardName}>{contact.name}</span>
                    <span className={styles.abChainBadge}>{contact.symbol}</span>
                  </div>
                  <span className={styles.abCardAddress}>
                    {shortenAddress(contact.address)}
                  </span>
                  {contact.notes && (
                    <span className={styles.abCardNotes}>{contact.notes}</span>
                  )}
                </div>
              </div>

              <div className={styles.abCardActions}>
                {onSelectAddress && (
                  <button
                    className={`${styles.abActionBtn} ${styles.abSelectBtn}`.trim()}
                    title={t("addressBook.select")}
                    onClick={() =>
                      onSelectAddress(contact.address, contact.symbol)
                    }
                  >
                    {t("addressBook.select")}
                  </button>
                )}
                <button
                  className={`${styles.abActionBtn} ${styles.abCopyBtn}`.trim()}
                  title={
                    copiedId === contact.id
                      ? t("addressBook.copied")
                      : t("addressBook.copyAddress")
                  }
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
                  {/* The checkmark swap is silent to a screen reader, and a
                      changed title attribute is not announced either. */}
                  <span className={styles.abSrOnly} aria-live="polite">
                    {copiedId === contact.id ? t("addressBook.copied") : ""}
                  </span>
                </button>
                <button
                  className={`${styles.abActionBtn} ${styles.abEditBtn}`.trim()}
                  title={t("addressBook.edit")}
                  onClick={() => openEditModal(contact)}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </button>
                <button
                  className={`${styles.abActionBtn} ${styles.abDeleteBtn}`.trim()}
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
        <div className={styles.abOverlay} onClick={closeModal}>
          <div
            className={styles.abModal}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-labelledby="ab-modal-title"
          >
            <h3 id="ab-modal-title" className={styles.abModalTitle}>
              {editingContact
                ? t("addressBook.editContact")
                : t("addressBook.addContact")}
            </h3>

            {formError && <div className={styles.abFormError}>{formError}</div>}

            <label className={styles.abLabel}>
              {t("addressBook.name")}
              <input
                type="text"
                className={styles.abInput}
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder={t("addressBook.namePlaceholder")}
                autoFocus
              />
            </label>

            <label className={styles.abLabel}>
              {t("addressBook.address")}
              <input
                type="text"
                className={`${styles.abInputMono} ${styles.abInput} `.trim()}
                value={formAddress}
                onChange={(e) => setFormAddress(e.target.value)}
                placeholder={t("addressBook.addressPlaceholder")}
              />
            </label>

            <label className={styles.abLabel}>
              {t("addressBook.chain")}
              <select
                className={styles.abInput}
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

            <label className={styles.abLabel}>
              {t("addressBook.notes")}
              <textarea
                className={styles.abTextarea}
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder={t("addressBook.notesPlaceholder")}
                rows={3}
              />
            </label>

            <div className={styles.abModalActions}>
              <button
                className={styles.abModalCancel}
                onClick={closeModal}
                disabled={isSaving}
              >
                {t("addressBook.cancel")}
              </button>
              <button
                className={styles.abModalSave}
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
          className={styles.abOverlay}
          onClick={() => !isDeleting && setDeleteTarget(null)}
        >
          <div
            className={`${styles.abModalSm} ${styles.abModal} `.trim()}
            onClick={(e) => e.stopPropagation()}
            role="alertdialog"
            aria-labelledby="ab-delete-title"
          >
            <div className={styles.abDeleteIconWrap}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            </div>
            <h3 id="ab-delete-title" className={styles.abModalTitle}>
              {t("addressBook.deleteContact")}
            </h3>
            <p className={styles.abDeleteMsg}>
              {t("addressBook.deleteMessage", { name: deleteTarget.name })}
            </p>
            <div className={styles.abModalActions}>
              <button
                className={styles.abModalCancel}
                onClick={() => setDeleteTarget(null)}
                disabled={isDeleting}
              >
                {t("addressBook.cancel")}
              </button>
              <button
                className={styles.abModalDelete}
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
    </div>
  );
}
