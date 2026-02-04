/**
 * Dashboard home page
 * Feature: User Dashboard for Wallet Management
 * Tasks: T039, T040, T044 - Dashboard with wallet creation and list management
 * Generated: 2025-10-17
 */

import { useState, useEffect, useCallback } from "react";
import {
  useDashboardStore,
  useSelectedWallet,
  useHasWallets,
  useWalletLimitInfo,
  useLockedWalletIds,
} from "@/stores/dashboardStore";
import tauriApi, { type AppError, type PendingTransactionInfo } from "@/services/tauri-api";
import { WalletCreate } from "@/components/WalletCreate";
import { WalletImport } from "@/components/WalletImport";
import { AddressList } from "@/components/AddressList";
import { ProviderSettings } from "@/components/ProviderSettings";
import { Settings } from "@/pages/Settings";
import { MembershipSettings } from "@/pages/MembershipSettings";
import { DeveloperMode } from "@/pages/DeveloperMode";
import { WalletDetail } from "@/components/WalletDetail";
import { InactivityWarningDialog } from "@/components/InactivityWarningDialog";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { DeleteWalletDialog } from "@/components/DeleteWalletDialog";
import { TransactionSignDialog } from "@/components/TransactionSignDialog";
import { MembershipBadge } from "@/components/MembershipBadge";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useInactivityLogout } from "@/hooks/useInactivityLogout";
import { useSessionStore } from "@/stores/sessionStore";
import { useTranslation } from "react-i18next";
import type { Address } from "@/types/address";
import type { Wallet } from "@/types/wallet";

type View = "list" | "create" | "import" | "addresses" | "settings" | "api-settings" | "membership" | "detail" | "developer";

export function Dashboard() {
  const { t } = useTranslation();
  const [currentView, setCurrentView] = useState<View>("list");
  const [isLoadingWallets, setIsLoadingWallets] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Address view state (T061)
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [isLoadingAddresses, setIsLoadingAddresses] = useState(false);
  const [addressError, setAddressError] = useState<string | null>(null);
  const [passwordForAddresses, setPasswordForAddresses] = useState<string>("");
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [walletIdForAddresses, setWalletIdForAddresses] = useState<
    string | null
  >(null);

  // Delete wallet state
  const [walletToDelete, setWalletToDelete] = useState<Wallet | null>(null);
  const [isDeletingWallet, setIsDeletingWallet] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Pending transaction state (for mint-page integration)
  const [pendingTransaction, setPendingTransaction] = useState<PendingTransactionInfo | null>(null);
  const [isSigningTransaction, setIsSigningTransaction] = useState(false);
  const [rejectCooldown, setRejectCooldown] = useState(false); // Prevent immediate re-polling after reject

  const {
    wallets,
    usbPath,
    setWallets,
    setUsbPath,
    selectWallet,
    selectedWalletId,
  } = useDashboardStore();

  const selectedWallet = useSelectedWallet();
  const hasWallets = useHasWallets();
  const walletLimitInfo = useWalletLimitInfo();
  const lockedWalletIds = useLockedWalletIds();

  const { setMembership } = useDashboardStore();
  const { getToken } = useSessionStore();

  // Auto-logout after 15 minutes of inactivity (SEC-006, T092)
  // continueUsing: locks app and requires password re-entry
  const { showWarning, remainingSeconds, continueUsing, logout } =
    useInactivityLogout({
      enabled: true,
      onLogout: () => {
        // Navigate to list view after logout
        setCurrentView("list");
        setError(t("dashboard.loggedOutInactivity"));
      },
    });

  // Poll for pending transactions from mint-page
  useEffect(() => {
    const pollPendingTransactions = async () => {
      // Don't poll if we're already handling a transaction or in cooldown
      if (isSigningTransaction || pendingTransaction || rejectCooldown) return;

      try {
        const tx = await tauriApi.getPendingTransaction();
        if (tx) {
          console.log("📥 Pending transaction received:", tx);
          setPendingTransaction(tx);
        }
      } catch (err) {
        // Silently ignore polling errors (channel might be disconnected briefly)
        console.debug("Polling error (non-critical):", err);
      }
    };

    // Poll every 500ms for pending transactions
    const interval = setInterval(pollPendingTransactions, 500);
    return () => clearInterval(interval);
  }, [isSigningTransaction, pendingTransaction, rejectCooldown]);

  // Helper: Convert hex value to decimal wei string
  const hexToDecimalWei = (hexValue: string): string => {
    if (!hexValue || hexValue === "0x0" || hexValue === "0") return "0";
    // Remove 0x prefix if present
    const hex = hexValue.startsWith("0x") ? hexValue.slice(2) : hexValue;
    // Convert hex to decimal BigInt and return as string
    return BigInt("0x" + hex).toString();
  };

  // Handle transaction confirmation
  const handleTransactionConfirm = useCallback(async (requestId: number, password: string) => {
    if (!usbPath || !pendingTransaction) return;

    setIsSigningTransaction(true);

    try {
      // Find the wallet that owns this address
      const wallet = wallets.find((w) =>
        w.addresses?.some((addr) =>
          addr.address.toLowerCase() === pendingTransaction.from.toLowerCase()
        )
      );

      if (!wallet) {
        throw new Error(t("dashboard.noWalletForAddress"));
      }

      // Map chain_id to chainId string for our transaction API
      const chainId = pendingTransaction.chain_id === 97 ? "bsc-testnet" :
                      pendingTransaction.chain_id === 56 ? "bsc" :
                      pendingTransaction.chain_id === 1 ? "ethereum" : "bsc";

      console.log("🔐 Signing transaction for wallet:", wallet.name);
      console.log("📋 Transaction details:", {
        from: pendingTransaction.from,
        to: pendingTransaction.to,
        value: pendingTransaction.value,
        data: pendingTransaction.data?.substring(0, 20) + "...",
        chainId,
      });

      // ✅ Use session token instead of appPassword (zero password storage)
      const sessionToken = getToken();
      if (!sessionToken) {
        throw new Error(t("dashboard.sessionExpired"));
      }

      // Convert hex value to decimal for our API
      const valueInWei = hexToDecimalWei(pendingTransaction.value);
      console.log("💰 Value in wei:", valueInWei);

      // For contract calls, we need to use a different approach
      // The pending transaction already has the encoded data
      // We need to build a raw transaction with this data

      // Build the transaction using our ChainAdapter
      // Note: For contract calls, amount is just for native token transfer
      // The actual call data is in pendingTransaction.data
      const unsignedTx = await tauriApi.buildTransaction({
        chainId,
        from: pendingTransaction.from,
        to: pendingTransaction.to,
        amount: valueInWei, // Use converted decimal value
        data: pendingTransaction.data, // Contract call data (hex-encoded)
        usbPath,
        sessionToken, // ✅ Use session token
      });

      // Sign the transaction
      const signedTx = await tauriApi.signTransaction({
        chainId,
        walletId: wallet.id,
        password,
        fromAddress: pendingTransaction.from,
        unsignedTx,
        usbPath,
        sessionToken, // ✅ Use session token
      });

      let txHash: string | undefined;

      // Broadcast if requested
      if (pendingTransaction.broadcast) {
        const broadcastResult = await tauriApi.broadcastTransaction({
          chainId,
          signedTx,
          usbPath,
          sessionToken, // ✅ Use session token
        });
        txHash = broadcastResult.txHash;
        console.log("📡 Transaction broadcasted:", txHash);
      }

      // Send success response back to WebSocket
      try {
        await tauriApi.respondToTransaction({
          requestId,
          success: true,
          txHash,
          signedTx: signedTx.serializedTx,
        });
        console.log("✅ Transaction completed successfully");
      } catch (respondErr) {
        console.warn("Failed to send success response:", respondErr);
      }
    } catch (err) {
      console.error("❌ Transaction failed:", err);
      const errorMessage = err instanceof Error ? err.message : "Transaction failed";

      // Send error response back to WebSocket (ignore errors if already responded)
      try {
        await tauriApi.respondToTransaction({
          requestId,
          success: false,
          error: errorMessage,
        });
      } catch (respondErr) {
        console.warn("Failed to send error response (may have already responded):", respondErr);
      }
    } finally {
      setIsSigningTransaction(false);
      setPendingTransaction(null);
    }
  }, [usbPath, pendingTransaction, wallets]);

  // Handle transaction rejection
  const handleTransactionReject = useCallback(async (requestId: number) => {
    // Clear UI state FIRST to ensure dialog closes immediately
    setPendingTransaction(null);
    setIsSigningTransaction(false);

    // Enable cooldown to prevent immediate re-polling (2 seconds)
    setRejectCooldown(true);
    setTimeout(() => setRejectCooldown(false), 2000);

    // Then try to notify WebSocket (non-blocking)
    try {
      await tauriApi.respondToTransaction({
        requestId,
        success: false,
        error: "Transaction rejected by user",
      });
    } catch (err) {
      // Ignore errors - the important thing is closing the dialog
      console.warn("Failed to send rejection (non-critical):", err);
    }
  }, []);

  // Load USB path and wallets on mount
  useEffect(() => {
    const loadWallets = async () => {
      setIsLoadingWallets(true);
      setError(null);

      try {
        // Detect USB first
        const devices = await tauriApi.detectUsb();
        if (devices.length === 0) {
          setError(t("dashboard.noUsbDetected"));
          setIsLoadingWallets(false);
          return;
        }

        // Use first USB device (or stored USB path)
        const usbDevice = devices[0];
        setUsbPath(usbDevice.path);

        // Load wallets from USB
        const walletList = await tauriApi.listWallets(usbDevice.path);
        setWallets(walletList);

        // Update WebSocket server with BSC addresses for mint-page integration
        const bscAddresses: string[] = [];
        for (const wallet of walletList) {
          if (wallet.addresses) {
            const bscAddr = wallet.addresses.find(
              (addr) => addr.symbol === 'BNB' || addr.symbol === 'BSC'
            );
            if (bscAddr) {
              bscAddresses.push(bscAddr.address);
            }
          }
        }
        if (bscAddresses.length > 0) {
          tauriApi.updateWebsocketAccounts(bscAddresses);
        }

        // Auto-select first wallet if none selected
        if (walletList.length > 0 && !selectedWalletId) {
          selectWallet(walletList[0].id);
        }

        // Load membership status with locked wallet IDs using session token
        const sessionToken = getToken();
        if (sessionToken) {
          try {
            const membershipStatus = await tauriApi.getDeviceMembershipStatusWithToken({ token: sessionToken });
            setMembership({
              walletLimit: membershipStatus.walletLimit,
              nftCount: membershipStatus.memberships.length,
              isPro: membershipStatus.memberships.length > 0,
              lockedWalletIds: membershipStatus.lockedWalletIds || [],
            });
          } catch (membershipErr) {
            console.warn("Failed to load membership status:", membershipErr);
            // Non-critical error - continue without membership info
          }
        }
      } catch (err) {
        const error = err as AppError;
        setError(error.message || "Failed to load wallets");
      } finally {
        setIsLoadingWallets(false);
      }
    };

    loadWallets();
  }, [refreshTrigger]); // Re-run when refreshTrigger changes

  // Manual reload function
  const handleReload = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  const handleCreateWallet = () => {
    setCurrentView("create");
  };

  const handleImportWallet = () => {
    setCurrentView("import");
  };

  const handleBackToList = () => {
    setCurrentView("list");
  };

  const handleWalletSelect = (walletId: string) => {
    selectWallet(walletId);
    setCurrentView("detail");
  };

  // Handle "View Addresses" button click (T061)
  const handleViewAddresses = (walletId: string) => {
    setWalletIdForAddresses(walletId);
    setShowPasswordPrompt(true);
    setPasswordForAddresses("");
    setAddressError(null);
  };

  // Load addresses after password is entered (T061)
  const handleLoadAddresses = async () => {
    if (!walletIdForAddresses || !usbPath || !passwordForAddresses) {
      setAddressError(t("dashboard.missingRequiredInfo"));
      return;
    }

    setIsLoadingAddresses(true);
    setAddressError(null);

    try {
      const response = await tauriApi.loadAddresses({
        wallet_id: walletIdForAddresses,
        password: passwordForAddresses,
        usb_path: usbPath,
      });

      setAddresses(response.addresses);
      setCurrentView("addresses");
      setShowPasswordPrompt(false);
      setPasswordForAddresses(""); // Clear password after use
    } catch (err) {
      const error = err as AppError;
      setAddressError(error.message || "Failed to load addresses");
    } finally {
      setIsLoadingAddresses(false);
    }
  };

  // Cancel password prompt
  const handleCancelPasswordPrompt = () => {
    setShowPasswordPrompt(false);
    setPasswordForAddresses("");
    setWalletIdForAddresses(null);
    setAddressError(null);
  };

  // Handle delete wallet button click
  const handleDeleteWallet = (wallet: Wallet, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent wallet selection
    setWalletToDelete(wallet);
    setDeleteError(null);
  };

  // Confirm and execute wallet deletion
  const handleConfirmDelete = async (password: string) => {
    if (!walletToDelete || !usbPath) {
      setDeleteError("Missing required information");
      return;
    }

    setIsDeletingWallet(true);
    setDeleteError(null);

    try {
      await tauriApi.deleteWallet({
        wallet_id: walletToDelete.id,
        password,
        usb_path: usbPath,
      });

      // Success: close dialog and reload wallets
      setWalletToDelete(null);
      handleReload();
    } catch (err) {
      const error = err as AppError;
      setDeleteError(error.message || "Failed to delete wallet");
    } finally {
      setIsDeletingWallet(false);
    }
  };

  // Cancel delete wallet
  const handleCancelDelete = () => {
    setWalletToDelete(null);
    setDeleteError(null);
  };

  // Show wallet creation view
  if (currentView === "create") {
    // ✅ WalletCreate should use session token internally (no password prop)
    return (
      <div className="dashboard">
        <WalletCreate
          onCancel={handleBackToList}
          onSuccess={() => {
            handleReload(); // Reload wallets after creation
            handleBackToList();
          }}
        />
      </div>
    );
  }

  // Show wallet detail view with assets
  if (currentView === "detail" && selectedWallet && usbPath) {
    return (
      <div className="dashboard">
        <WalletDetail
          wallet={selectedWallet}
          usbPath={usbPath}
          onBack={handleBackToList}
          onViewAddresses={() => handleViewAddresses(selectedWallet.id)}
        />
      </div>
    );
  }

  // Show wallet import view (T075)
  if (currentView === "import") {
    return (
      <div className="dashboard">
        <button onClick={handleBackToList} className="back-button">
          ← {t("dashboard.backToWallets")}
        </button>
        {usbPath ? (
          <WalletImport
            usbPath={usbPath}
            onSuccess={() => {
              handleReload(); // Reload wallets after import
              handleBackToList();
            }}
            onCancel={handleBackToList}
          />
        ) : (
          <div className="error-message">
            {t("dashboard.noUsbDetected")}
          </div>
        )}
      </div>
    );
  }

  // Show address list view (T061)
  if (currentView === "addresses") {
    const wallet = wallets.find((w) => w.id === walletIdForAddresses);
    return (
      <div className="dashboard">
        <button onClick={handleBackToList} className="back-button">
          ← {t("dashboard.backToWallets")}
        </button>
        <header className="dashboard-header">
          <div className="flex-1">
            <h1>{t("dashboard.walletAddresses")}</h1>
            {wallet && <p className="text-gray-600">{wallet.name}</p>}
          </div>
        </header>
        <AddressList
          addresses={addresses}
          isLoading={isLoadingAddresses}
          error={addressError}
        />
      </div>
    );
  }

  // Handle settings navigation
  const handleSettingsNavigate = (view: string) => {
    if (view === "api-settings") {
      setCurrentView("api-settings");
    } else if (view === "membership") {
      setCurrentView("membership");
    }
  };

  // Show settings menu
  if (currentView === "settings") {
    return (
      <div className="dashboard">
        <Settings
          onBack={handleBackToList}
          onNavigate={handleSettingsNavigate}
        />
      </div>
    );
  }

  // Show membership settings
  if (currentView === "membership") {
    return (
      <div className="dashboard">
        <MembershipSettings
          onBack={() => setCurrentView("settings")}
          usbPath={usbPath || ""}
        />
      </div>
    );
  }

  // Show API provider settings view
  if (currentView === "api-settings") {
    return (
      <div className="dashboard">
        <button onClick={() => setCurrentView("settings")} className="back-button">
          ← {t("dashboard.backToSettings")}
        </button>
        {usbPath ? (
          <ProviderSettings />
        ) : (
          <div className="settings-prompt">
            <h2>{t("dashboard.apiProviderSettings")}</h2>
            <p>
              {t("dashboard.noUsbForProviders")}
            </p>
            <button onClick={() => setCurrentView("settings")} className="primary-button">
              {t("dashboard.backToSettings")}
            </button>
          </div>
        )}
      </div>
    );
  }

  // Show developer mode view
  if (currentView === "developer") {
    return (
      <DeveloperMode
        onBack={handleBackToList}
        usbPath={usbPath || ""}
      />
    );
  }

  // Show wallet list view
  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="header-title-section">
          <h1>{t("dashboard.title")}</h1>
          <MembershipBadge onClick={() => setCurrentView("membership")} />
        </div>
        <div className="header-actions">
          <LanguageSwitcher variant="toggle" />
          <button
            onClick={() => setCurrentView("settings")}
            className="secondary-button"
            title={t('nav.settings')}
          >
            ⚙️ {t('nav.settings')}
          </button>
          <button
            onClick={handleReload}
            disabled={isLoadingWallets}
            className="secondary-button"
            title={t('actions.reload')}
          >
            {isLoadingWallets ? `↻ ${t('common.loading')}` : `↻ ${t('actions.reload')}`}
          </button>
          <button
            onClick={handleCreateWallet}
            className="primary-button"
            disabled={!walletLimitInfo.canCreate}
            title={!walletLimitInfo.canCreate ? `${t('wallet.walletLimitReached')} (${walletLimitInfo.current}/${walletLimitInfo.limit})` : undefined}
          >
            + {t('wallet.createWallet')}
          </button>
          <button
            onClick={handleImportWallet}
            className="secondary-button"
            disabled={!walletLimitInfo.canCreate}
            title={!walletLimitInfo.canCreate ? `${t('wallet.walletLimitReached')} (${walletLimitInfo.current}/${walletLimitInfo.limit})` : undefined}
          >
            {t('wallet.importWallet')}
          </button>
        </div>
      </header>

      {error && (
        <div className="error-message" role="alert">
          {error}
        </div>
      )}

      {isLoadingWallets ? (
        <div className="loading">
          <LoadingSpinner size="lg" message={t("dashboard.loadingWallets")} />
        </div>
      ) : !hasWallets ? (
        <div className="empty-state">
          <h2>{t("dashboard.noWalletsFound")}</h2>
          <p>{t("dashboard.createFirstWalletDesc")}</p>
          <button onClick={handleCreateWallet} className="primary-button large">
            {t("dashboard.createFirstWallet")}
          </button>
        </div>
      ) : (
        <div className="wallet-list">
          <h2>{t("dashboard.yourWallets")}</h2>
          <div className="wallets-grid">
            {wallets.map((wallet) => {
              const isLocked = lockedWalletIds.includes(wallet.id);
              return (
                <div
                  key={wallet.id}
                  className={`wallet-card ${
                    selectedWalletId === wallet.id ? "selected" : ""
                  } ${isLocked ? "locked" : ""}`}
                  onClick={() => handleWalletSelect(wallet.id)}
                >
                  <div className="wallet-card-header">
                    <h3>
                      {wallet.name}
                      {isLocked && <span className="lock-icon" title={t("dashboard.walletLockedTitle")}>🔒</span>}
                    </h3>
                    <button
                      className="delete-wallet-button"
                      onClick={(e) => handleDeleteWallet(wallet, e)}
                      title={t("wallet.deleteWallet")}
                      aria-label={t("dashboard.deleteWalletAria", { name: wallet.name })}
                    >
                      🗑️
                    </button>
                  </div>
                  {isLocked && (
                    <div className="locked-banner">
                      <span>⚠️ {t("dashboard.walletLocked")}</span>
                    </div>
                  )}
                  <div className="wallet-info">
                    <p>
                      <strong>{t("wallet.created")}:</strong>{" "}
                      {new Date(wallet.created_at).toLocaleDateString()}
                    </p>
                    <p>
                      <strong>{t("wallet.addresses")}:</strong> {wallet.address_count}
                    </p>
                    {wallet.has_passphrase && (
                      <span className="badge">{t("wallet.protectedWithPassphrase")}</span>
                    )}
                  </div>
                  <button
                    className="view-addresses-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleWalletSelect(wallet.id);
                    }}
                  >
                    {t("dashboard.viewAssets")} →
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {selectedWallet && (
        <div className="selected-wallet-info">
          <h3>{t("dashboard.selected")}: {selectedWallet.name}</h3>
          <p className="wallet-id">
            {t("wallet.walletId")}: {selectedWallet.id.substring(0, 16)}...
          </p>
        </div>
      )}

      {usbPath && (
        <div className="usb-info">
          <small>USB: {usbPath}</small>
        </div>
      )}

      {/* Password Prompt Modal (T061) */}
      {showPasswordPrompt && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-semibold mb-4">
              {t("dashboard.enterWalletPassword")}
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              {t("dashboard.enterPasswordDesc")}
            </p>

            {addressError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded">
                <p className="text-sm text-red-800">{addressError}</p>
              </div>
            )}

            <div className="mb-4">
              <label
                htmlFor="address-password"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                {t("dashboard.password")}
              </label>
              <input
                type="password"
                id="address-password"
                value={passwordForAddresses}
                onChange={(e) => setPasswordForAddresses(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleLoadAddresses();
                  }
                }}
                placeholder={t("dashboard.enterWalletPasswordPlaceholder")}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
                disabled={isLoadingAddresses}
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleLoadAddresses}
                disabled={isLoadingAddresses || !passwordForAddresses}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoadingAddresses ? t("common.loading") : t("dashboard.unlockWallet")}
              </button>
              <button
                onClick={handleCancelPasswordPrompt}
                disabled={isLoadingAddresses}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                {t("actions.cancel")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Inactivity Warning Dialog (SEC-006, T092) */}
      <InactivityWarningDialog
        isOpen={showWarning}
        remainingSeconds={remainingSeconds}
        onContinue={continueUsing}
        onLogout={logout}
      />

      {/* Delete Wallet Dialog */}
      <DeleteWalletDialog
        wallet={walletToDelete}
        isOpen={!!walletToDelete}
        onClose={handleCancelDelete}
        onConfirm={handleConfirmDelete}
        isDeleting={isDeletingWallet}
        error={deleteError}
      />

      {/* Transaction Sign Dialog (for mint-page integration) */}
      <TransactionSignDialog
        transaction={pendingTransaction}
        onConfirm={handleTransactionConfirm}
        onReject={handleTransactionReject}
      />
    </div>
  );
}
