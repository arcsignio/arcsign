/**
 * Dashboard home page
 * Feature: User Dashboard for Wallet Management
 * Tasks: T039, T040, T044 - Dashboard with wallet creation and list management
 * Generated: 2025-10-17
 */

import { useState, useEffect } from "react";
import {
  useDashboardStore,
  useSelectedWallet,
  useHasWallets,
} from "@/stores/dashboardStore";
import tauriApi, { type AppError } from "@/services/tauri-api";
import { WalletCreate } from "@/components/WalletCreate";
import { WalletImport } from "@/components/WalletImport";
import { AddressList } from "@/components/AddressList";
import { ProviderSettings } from "@/components/ProviderSettings";
import { Settings } from "@/pages/Settings";
import { MembershipSettings } from "@/pages/MembershipSettings";
import { WalletDetail } from "@/components/WalletDetail";
import { InactivityWarningDialog } from "@/components/InactivityWarningDialog";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { DeleteWalletDialog } from "@/components/DeleteWalletDialog";
import { useInactivityLogout } from "@/hooks/useInactivityLogout";
import type { Address } from "@/types/address";
import type { Wallet } from "@/types/wallet";

type View = "list" | "create" | "import" | "addresses" | "settings" | "api-settings" | "membership" | "detail";

export function Dashboard() {
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

  // Auto-logout after 15 minutes of inactivity (SEC-006, T092)
  // continueUsing: locks app and requires password re-entry
  const { showWarning, remainingSeconds, continueUsing, logout } =
    useInactivityLogout({
      enabled: true,
      onLogout: () => {
        // Navigate to list view after logout
        setCurrentView("list");
        setError("You have been logged out due to inactivity.");
      },
    });

  // Load USB path and wallets on mount
  useEffect(() => {
    const loadWallets = async () => {
      setIsLoadingWallets(true);
      setError(null);

      try {
        // Detect USB first
        const devices = await tauriApi.detectUsb();
        if (devices.length === 0) {
          setError("No USB drive detected. Please insert a USB drive.");
          setIsLoadingWallets(false);
          return;
        }

        // Use first USB device (or stored USB path)
        const usbDevice = devices[0];
        setUsbPath(usbDevice.path);

        // Load wallets from USB
        const walletList = await tauriApi.listWallets(usbDevice.path);
        setWallets(walletList);

        // Auto-select first wallet if none selected
        if (walletList.length > 0 && !selectedWalletId) {
          selectWallet(walletList[0].id);
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
      setAddressError("Missing required information");
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
          ← Back to Wallets
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
            No USB drive detected. Please insert a USB drive.
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
          ← Back to Wallets
        </button>
        <header className="dashboard-header">
          <div className="flex-1">
            <h1>Wallet Addresses</h1>
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
        <MembershipSettings onBack={() => setCurrentView("settings")} />
      </div>
    );
  }

  // Show API provider settings view
  if (currentView === "api-settings") {
    return (
      <div className="dashboard">
        <button onClick={() => setCurrentView("settings")} className="back-button">
          ← Back to Settings
        </button>
        {usbPath ? (
          <ProviderSettings usbPath={usbPath} />
        ) : (
          <div className="settings-prompt">
            <h2>API Provider Settings</h2>
            <p>
              No USB drive detected. Please insert a USB drive to configure
              providers.
            </p>
            <button onClick={() => setCurrentView("settings")} className="primary-button">
              Back to Settings
            </button>
          </div>
        )}
      </div>
    );
  }

  // Show wallet list view
  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>ArcSign Dashboard</h1>
        <div className="header-actions">
          <button
            onClick={() => setCurrentView("settings")}
            className="secondary-button"
            title="Application settings"
          >
            ⚙️ Settings
          </button>
          <button
            onClick={handleReload}
            disabled={isLoadingWallets}
            className="secondary-button"
            title="Reload USB and wallets"
          >
            {isLoadingWallets ? "↻ Reloading..." : "↻ Reload"}
          </button>
          <button onClick={handleCreateWallet} className="primary-button">
            + Create New Wallet
          </button>
          <button onClick={handleImportWallet} className="secondary-button">
            Import Wallet
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
          <LoadingSpinner size="lg" message="Loading wallets from USB..." />
        </div>
      ) : !hasWallets ? (
        <div className="empty-state">
          <h2>No Wallets Found</h2>
          <p>Create your first wallet to get started with ArcSign.</p>
          <button onClick={handleCreateWallet} className="primary-button large">
            Create Your First Wallet
          </button>
        </div>
      ) : (
        <div className="wallet-list">
          <h2>Your Wallets</h2>
          <div className="wallets-grid">
            {wallets.map((wallet) => (
              <div
                key={wallet.id}
                className={`wallet-card ${
                  selectedWalletId === wallet.id ? "selected" : ""
                }`}
                onClick={() => handleWalletSelect(wallet.id)}
              >
                <div className="wallet-card-header">
                  <h3>{wallet.name}</h3>
                  <button
                    className="delete-wallet-button"
                    onClick={(e) => handleDeleteWallet(wallet, e)}
                    title="Delete wallet"
                    aria-label={`Delete wallet ${wallet.name}`}
                  >
                    🗑️
                  </button>
                </div>
                <div className="wallet-info">
                  <p>
                    <strong>Created:</strong>{" "}
                    {new Date(wallet.created_at).toLocaleDateString()}
                  </p>
                  <p>
                    <strong>Addresses:</strong> {wallet.address_count}
                  </p>
                  {wallet.has_passphrase && (
                    <span className="badge">Protected with Passphrase</span>
                  )}
                </div>
                <button
                  className="view-addresses-button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleWalletSelect(wallet.id);
                  }}
                >
                  View Assets →
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedWallet && (
        <div className="selected-wallet-info">
          <h3>Selected: {selectedWallet.name}</h3>
          <p className="wallet-id">
            ID: {selectedWallet.id.substring(0, 16)}...
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
              Enter Wallet Password
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              Enter your password to unlock and view the addresses for this
              wallet.
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
                Password
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
                placeholder="Enter wallet password"
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
                {isLoadingAddresses ? "Loading..." : "Unlock Wallet"}
              </button>
              <button
                onClick={handleCancelPasswordPrompt}
                disabled={isLoadingAddresses}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                Cancel
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
    </div>
  );
}
