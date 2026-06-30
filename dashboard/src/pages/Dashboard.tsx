/**
 * Dashboard home page
 * Feature: User Dashboard for Wallet Management
 * Tasks: T039, T040, T044 - Dashboard with wallet creation and list management
 * Generated: 2025-10-17
 */

import { useState, useEffect, useCallback, useRef } from "react";
import {
  useDashboardStore,
  useSelectedWallet,
  useHasWallets,
  useWalletLimitInfo,
  useLockedWalletIds,
} from "@/stores/dashboardStore";
import tauriApi, { type AppError, type PendingTransactionInfo, type PairingPrompt } from "@/services/tauri-api";
import { WalletCreate } from "@/components/WalletCreate";
import { WalletImport } from "@/components/WalletImport";
import { ImportBackup } from "@/components/ImportBackup";
import { ExportBackup } from "@/components/ExportBackup";
import { ExportAllBackups } from "@/components/ExportAllBackups";
import { ImportAllBackups } from "@/components/ImportAllBackups";
import { AddressList } from "@/components/AddressList";
import { ReferralBanner } from "@/components/ReferralBanner";
import { ProviderSettings } from "@/components/ProviderSettings";
import { Settings } from "@/pages/Settings";
import { MembershipSettings } from "@/pages/MembershipSettings";
import { DeveloperMode } from "@/pages/DeveloperMode";
import { WalletDetail } from "@/components/WalletDetail";
import { InactivityWarningDialog } from "@/components/InactivityWarningDialog";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { DeleteWalletDialog } from "@/components/DeleteWalletDialog";
import { TransactionSignDialog } from "@/components/TransactionSignDialog";
import { PairingDialog } from "@/components/PairingDialog";
import { MembershipBadge } from "@/components/MembershipBadge";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useInactivityLogout } from "@/hooks/useInactivityLogout";
import { useSessionStore } from "@/stores/sessionStore";
import { useOnboardingStore } from "@/stores/onboardingStore";
import { useTranslation } from "react-i18next";
import type { Address } from "@/types/address";
import type { Wallet } from "@/types/wallet";

type View = "list" | "create" | "import" | "import-backup" | "import-all-backups" | "export-backup-select" | "export-all-backups" | "addresses" | "settings" | "api-settings" | "membership" | "detail" | "developer";

import { ACTIVE_NETWORK } from '@/constants/contracts';

const NFT_CONTRACT = ACTIVE_NETWORK.nftContract;
const CHAIN_ID = ACTIVE_NETWORK.chainName;

/** Wallet item for export backup selection */
function ExportWalletItem({ wallet, usbPath }: { wallet: Wallet; usbPath: string }) {
  const { t } = useTranslation();
  const [showExport, setShowExport] = useState(false);

  return (
    <>
      <button
        onClick={() => setShowExport(true)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: 20,
          background: 'white',
          border: '1px solid #e5e7eb',
          borderRadius: 12,
          cursor: 'pointer',
          transition: 'all 0.2s',
          textAlign: 'left',
          width: '100%',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#2dd4bf'; e.currentTarget.style.boxShadow = '0 2px 12px rgba(45, 212, 191, 0.1)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.boxShadow = 'none'; }}
      >
        <span style={{
          width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: '#e0f2f1', borderRadius: 12, flexShrink: 0, color: '#0d9488',
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M22 10H18a2 2 0 000 4h4"/></svg>
        </span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 16, color: '#111827' }}>{wallet.name}</div>
          <div style={{ fontSize: 13, color: '#9ca3af', marginTop: 2 }}>
            {wallet.address_count} {t('wallet.addresses', 'addresses')}
          </div>
        </div>
        <span style={{ color: '#9ca3af' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        </span>
      </button>
      {showExport && (
        <ExportBackup
          walletId={wallet.id}
          walletName={wallet.name}
          usbPath={usbPath}
          onSuccess={() => setShowExport(false)}
          onCancel={() => setShowExport(false)}
        />
      )}
    </>
  );
}

export function Dashboard({ onCheckUpdate }: { onCheckUpdate?: () => Promise<void> }) {
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
  const [pairing, setPairing] = useState<PairingPrompt | null>(null);
  const [isSigningTransaction, setIsSigningTransaction] = useState(false);
  const [rejectCooldown, setRejectCooldown] = useState(false); // Prevent immediate re-polling after reject
  const prevViewRef = useRef<View>("list"); // Track previous view for developer mode cleanup
  const [hasPendingDev, setHasPendingDev] = useState(false); // Dev transaction detected, redirect to Developer Mode

  const {
    wallets,
    usbPath,
    setWallets,
    setUsbPath,
    selectWallet,
    selectedWalletId,
    membership,
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

  // Clear pending transaction when entering/leaving developer mode
  // This ensures DeveloperMode page handles all signing requests and prevents
  // old TransactionSignDialog from appearing after leaving developer mode
  useEffect(() => {
    const prevView = prevViewRef.current;

    if (currentView === 'developer') {
      // Only cancel if Dashboard was actively handling a transaction
      // Don't cancel if redirecting due to dev transaction (it's still in the queue for DeveloperMode)
      if (pendingTransaction) {
        console.log("🔧 Entering developer mode, clearing Dashboard pending transaction");
        setPendingTransaction(null);
        tauriApi.cancelPendingTransaction().catch(() => {});
      }
    } else if (prevView === 'developer') {
      // Leaving developer mode: clear any pending state that might have accumulated
      console.log("🔧 Leaving developer mode, clearing pending transactions");
      setPendingTransaction(null);
      setRejectCooldown(true); // Prevent immediate polling
      tauriApi.cancelPendingTransaction().catch(() => {
        // Ignore errors - transaction might not exist
      });
      // Reset cooldown after a delay
      setTimeout(() => setRejectCooldown(false), 2000);
    }

    // Update previous view ref
    prevViewRef.current = currentView;
  }, [currentView]);

  // Poll for pending transactions from mint-page
  // Note: Skip polling when in developer mode - DeveloperMode page handles its own polling
  useEffect(() => {
    const pollPendingTransactions = async () => {
      // Pairing prompts (connection ticket) are independent of the tx-signing
      // gates — poll them on the same interval, even while a tx is in flight.
      try {
        const prompt = await tauriApi.getPendingPairing();
        if (prompt) {
          console.log("🔗 Pairing prompt received:", prompt.origin);
          setPairing(prompt);
        }
      } catch (err) {
        console.debug("Pairing polling error (non-critical):", err);
      }

      // Don't poll in developer mode - let DeveloperMode page handle it
      if (currentView === 'developer') return;
      // Don't poll if we're already handling a transaction or in cooldown
      if (isSigningTransaction || pendingTransaction || rejectCooldown) return;

      try {
        const tx = await tauriApi.getPendingTransaction();
        if (tx) {
          if (tx.script_name) {
            // Dev transaction (Hardhat deploy/call) → redirect to Developer Mode
            console.log("🔧 Dev transaction detected, redirecting to Developer Mode");
            setHasPendingDev(true);
            setCurrentView("developer");
          } else {
            console.log("📥 Pending transaction received:", tx);
            setPendingTransaction(tx);
          }
        }
      } catch (err) {
        // Silently ignore polling errors (channel might be disconnected briefly)
        console.debug("Polling error (non-critical):", err);
      }
    };

    // Poll every 500ms for pending transactions
    const interval = setInterval(pollPendingTransactions, 500);
    return () => clearInterval(interval);
  }, [isSigningTransaction, pendingTransaction, rejectCooldown, currentView]);

  // Helper: Convert hex value to decimal wei string
  const hexToDecimalWei = (hexValue: string): string => {
    if (!hexValue || hexValue === "0x0" || hexValue === "0") return "0";
    // Remove 0x prefix if present
    const hex = hexValue.startsWith("0x") ? hexValue.slice(2) : hexValue;
    // Convert hex to decimal BigInt and return as string
    return BigInt("0x" + hex).toString();
  };

  // Handle transaction confirmation
  const handleTransactionConfirm = useCallback(async (requestId: number, password: string, acknowledgedRisk?: boolean) => {
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

      // Build the transaction using our ChainAdapter
      const unsignedTx = await tauriApi.buildTransaction({
        chainId,
        from: pendingTransaction.from,
        to: pendingTransaction.to,
        amount: valueInWei,
        data: pendingTransaction.data,
        usbPath,
        sessionToken,
      });

      // Sign the transaction
      const signedTx = await tauriApi.signTransaction({
        chainId,
        walletId: wallet.id,
        password,
        fromAddress: pendingTransaction.from,
        unsignedTx,
        usbPath,
        sessionToken,
        acknowledgedRisk: acknowledgedRisk || false,  // user acknowledged a backend-flagged danger
      });

      let txHash: string | undefined;

      // Broadcast if requested
      if (pendingTransaction.broadcast) {
        const broadcastResult = await tauriApi.broadcastTransaction({
          chainId,
          signedTx,
          usbPath,
          sessionToken,
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

        // Update WebSocket server with USB path for Hardhat plugin API key integration
        tauriApi.updateWebsocketUsbPath(usbDevice.path);

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

            // Sync on-chain binding state with USB storage
            // This ensures Pro status is always up-to-date with chain state
            if (membershipStatus.deviceIdHash && bscAddresses.length > 0) {
              try {
                console.log("🔄 [Dashboard] Syncing on-chain membership state...");

                // Get on-chain status for all BSC addresses
                const onChainStatus = await tauriApi.checkAllMemberships(
                  bscAddresses,
                  membershipStatus.deviceIdHash
                );

                let needsRefresh = false;

                // Sync: Add bindings that are on-chain but not in USB
                for (const addrInfo of onChainStatus.addressNftCounts) {
                  for (const token of addrInfo.tokens || []) {
                    // Check if this token is bound to our device on-chain
                    const isOnChainBound = token.boundDeviceHash?.toLowerCase() === membershipStatus.deviceIdHash.toLowerCase();

                    if (isOnChainBound) {
                      // Check if this binding exists in USB
                      const existsInUsb = membershipStatus.memberships.some(
                        m => m.nftTokenId === String(token.tokenId)
                      );

                      if (!existsInUsb) {
                        console.log(`🔄 [Dashboard] Syncing token ${token.tokenId} binding to USB`);
                        try {
                          await tauriApi.syncMembershipBindingWithToken({
                            token: sessionToken,
                            nftTokenId: String(token.tokenId),
                            nftContract: NFT_CONTRACT,
                            chainId: CHAIN_ID,
                            boundAddress: addrInfo.address,
                          });
                          needsRefresh = true;
                        } catch (syncErr) {
                          console.warn(`Failed to sync token ${token.tokenId}:`, syncErr);
                        }
                      }
                    }
                  }
                }

                // Remove: Delete USB bindings that no longer exist on-chain
                for (const usbBinding of membershipStatus.memberships) {
                  // Find the address info for this binding
                  const onChainAddr = onChainStatus.addressNftCounts.find(
                    a => a.address.toLowerCase() === usbBinding.boundAddress.toLowerCase()
                  );

                  // Check if this token is still bound to our device on-chain
                  const stillBound = onChainAddr?.tokens?.some(
                    t => String(t.tokenId) === usbBinding.nftTokenId &&
                        t.boundDeviceHash?.toLowerCase() === membershipStatus.deviceIdHash.toLowerCase()
                  );

                  if (!stillBound) {
                    console.log(`🔄 [Dashboard] Removing stale binding for token ${usbBinding.nftTokenId}`);
                    try {
                      await tauriApi.removeMembershipBindingWithToken({
                        token: sessionToken,
                        nftTokenId: usbBinding.nftTokenId,
                        nftContract: usbBinding.nftContract,
                      });
                      needsRefresh = true;
                    } catch (removeErr) {
                      console.warn(`Failed to remove token ${usbBinding.nftTokenId}:`, removeErr);
                    }
                  }
                }

                // If we made any changes, reload membership status
                if (needsRefresh) {
                  console.log("🔄 [Dashboard] Reloading membership status after sync");
                  const updatedStatus = await tauriApi.getDeviceMembershipStatusWithToken({ token: sessionToken });
                  setMembership({
                    walletLimit: updatedStatus.walletLimit,
                    nftCount: updatedStatus.memberships.length,
                    isPro: updatedStatus.memberships.length > 0,
                    lockedWalletIds: updatedStatus.lockedWalletIds || [],
                  });
                  console.log("✅ [Dashboard] Membership sync complete");
                  return;
                }
              } catch (syncErr) {
                console.warn("Failed to sync on-chain membership:", syncErr);
                // Non-critical - continue with USB membership info
              }
            }

            // Set membership from USB if no sync needed
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

  // Show import from backup view
  if (currentView === "import-backup") {
    return (
      <div className="dashboard">
        {usbPath ? (
          <ImportBackup
            usbPath={usbPath}
            onSuccess={() => {
              handleReload();
              handleBackToList();
            }}
            onBack={handleBackToList}
          />
        ) : (
          <div className="error-message">
            {t("dashboard.noUsbDetected")}
          </div>
        )}
      </div>
    );
  }

  // Show import all backups from bundle view (Pro)
  if (currentView === "import-all-backups") {
    return (
      <div className="dashboard">
        {usbPath ? (
          <ImportAllBackups
            usbPath={usbPath}
            onSuccess={() => {
              handleReload();
              handleBackToList();
            }}
            onBack={handleBackToList}
          />
        ) : (
          <div className="error-message">
            {t("dashboard.noUsbDetected")}
          </div>
        )}
      </div>
    );
  }

  // Show export backup wallet selector view
  if (currentView === "export-backup-select") {
    return (
      <div className="dashboard">
        <div className="export-backup-select-page" style={{ maxWidth: 560, margin: '0 auto', padding: 20 }}>
          <button onClick={() => setCurrentView("settings")} className="back-button">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{display:'inline',verticalAlign:'middle',marginRight:4}}><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
            {t('dashboard.backToSettings')}
          </button>
          <header style={{ marginBottom: 32 }}>
            <h1 style={{ margin: '0 0 8px', fontSize: 28, fontWeight: 600, color: '#111827' }}>{t('backup.exportSettingsTitle')}</h1>
            <p style={{ margin: 0, color: '#6b7280', fontSize: 16 }}>{t('backup.selectWalletToExport')}</p>
          </header>
          {!usbPath ? (
            <div className="error-message">{t("dashboard.noUsbDetected")}</div>
          ) : wallets.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#6b7280', padding: 40 }}>
              {t("dashboard.noWallets")}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {wallets.map((w) => (
                <ExportWalletItem
                  key={w.id}
                  wallet={w}
                  usbPath={usbPath}
                />
              ))}
            </div>
          )}
        </div>
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
    } else if (view === "developer") {
      setCurrentView("developer");
    } else if (view === "export-backup-select") {
      setCurrentView("export-backup-select");
    } else if (view === "export-all-backups") {
      setCurrentView("export-all-backups");
    } else if (view === "onboarding") {
      useOnboardingStore.getState().triggerOnboarding();
    }
  };

  // Show settings menu
  if (currentView === "settings") {
    return (
      <div className="dashboard">
        <Settings
          onBack={handleBackToList}
          onNavigate={handleSettingsNavigate}
          onCheckUpdate={onCheckUpdate}
        />
      </div>
    );
  }

  // Show export all backups dialog (Pro) — renders as overlay on top of settings
  if (currentView === "export-all-backups") {
    return (
      <div className="dashboard">
        <Settings
          onBack={handleBackToList}
          onNavigate={handleSettingsNavigate}
          onCheckUpdate={onCheckUpdate}
        />
        {usbPath && (
          <ExportAllBackups
            usbPath={usbPath}
            walletCount={wallets.length}
            onSuccess={() => setCurrentView("settings")}
            onCancel={() => setCurrentView("settings")}
          />
        )}
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
        onBack={() => { setHasPendingDev(false); handleBackToList(); }}
        usbPath={usbPath || ""}
        hasPendingDev={hasPendingDev}
      />
    );
  }

  // Show wallet list view
  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="header-title-section">
          <img src="/logo.png" alt="ArcSign" className="header-logo" />
          <div className="header-brand">
            <h1>{t("dashboard.title")}</h1>
            <span className="header-tagline">Secure Multi-Chain Wallet</span>
          </div>
          <MembershipBadge onClick={() => setCurrentView("membership")} />
        </div>
        <div className="header-actions">
          <LanguageSwitcher variant="toggle" />
          <button
            onClick={() => setCurrentView("settings")}
            className="secondary-button"
            title={t('nav.settings')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{display:'inline',verticalAlign:'middle',marginRight:4}}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
            {t('nav.settings')}
          </button>
          <button
            onClick={handleReload}
            disabled={isLoadingWallets}
            className="secondary-button"
            title={t('actions.reload')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{display:'inline',verticalAlign:'middle',marginRight:4}} className={isLoadingWallets ? 'animate-spin' : ''}><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>
            {isLoadingWallets ? t('common.loading') : t('actions.reload')}
          </button>
          <button
            onClick={handleCreateWallet}
            className="primary-button"
            disabled={!walletLimitInfo.canCreate}
            title={!walletLimitInfo.canCreate ? `${t('wallet.walletLimitReached')} (${walletLimitInfo.current}/${walletLimitInfo.limit})` : undefined}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{display:'inline',verticalAlign:'middle',marginRight:4}}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            {t('wallet.createWallet')}
          </button>
          <button
            onClick={handleImportWallet}
            className="secondary-button"
            disabled={!walletLimitInfo.canCreate}
            title={!walletLimitInfo.canCreate ? `${t('wallet.walletLimitReached')} (${walletLimitInfo.current}/${walletLimitInfo.limit})` : undefined}
          >
            {t('wallet.importWallet')}
          </button>
          <button
            onClick={() => setCurrentView("import-backup")}
            className="secondary-button"
            disabled={!walletLimitInfo.canCreate}
            title={!walletLimitInfo.canCreate ? `${t('wallet.walletLimitReached')} (${walletLimitInfo.current}/${walletLimitInfo.limit})` : undefined}
          >
            {t('backup.importTitle')}
          </button>
          {membership.isPro && (
            <button
              onClick={() => setCurrentView("import-all-backups")}
              className="secondary-button"
            >
              {t('backup.importAllTitle')}
            </button>
          )}
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
          <div className="empty-state-icon">
            <img src="/logo.png" alt="ArcSign" className="empty-logo" />
          </div>
          <h2>{t("dashboard.noWalletsFound")}</h2>
          <p className="empty-desc">{t("dashboard.createFirstWalletDesc")}</p>
          <button onClick={handleCreateWallet} className="primary-button large">
            {t("dashboard.createFirstWallet")}
          </button>
          <div className="empty-features">
            <span className="feature-tag">54+ Chains</span>
            <span className="feature-tag">DEX Swap</span>
            <span className="feature-tag">WalletConnect</span>
            <span className="feature-tag">USB Cold Storage</span>
          </div>
        </div>
      ) : (
        <div className="wallet-list">
          <ReferralBanner onGoToMembership={() => setCurrentView('membership')} />
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
                      {isLocked && <span className="lock-icon" title={t("dashboard.walletLockedTitle")}><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{display:'inline',verticalAlign:'middle'}}><rect x="3" y="11" width="18" height="11" rx="2" ry="2" fill="none" stroke="currentColor" strokeWidth="2"/><path d="M7 11V7a5 5 0 0110 0v4" fill="none" stroke="currentColor" strokeWidth="2"/></svg></span>}
                    </h3>
                    <button
                      className="delete-wallet-button"
                      onClick={(e) => handleDeleteWallet(wallet, e)}
                      title={t("wallet.deleteWallet")}
                      aria-label={t("dashboard.deleteWalletAria", { name: wallet.name })}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                    </button>
                  </div>
                  {isLocked && (
                    <div className="locked-banner">
                      <span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{display:'inline',verticalAlign:'middle',marginRight:4}}><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>{t("dashboard.walletLocked")}</span>
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
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                autoFocus
                disabled={isLoadingAddresses}
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleLoadAddresses}
                disabled={isLoadingAddresses || !passwordForAddresses}
                className="flex-1 px-4 py-2 bg-teal-600 text-white rounded-md hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
        walletName={pendingTransaction ? wallets.find(w =>
          w.addresses?.some(a => a.address.toLowerCase() === pendingTransaction.from.toLowerCase())
        )?.name : undefined}
        onConfirm={handleTransactionConfirm}
        onReject={handleTransactionReject}
      />

      {/* Pairing Dialog (mint-page connection ticket) */}
      <PairingDialog code={pairing?.code_display ?? null} origin={pairing?.origin ?? null} />
    </div>
  );
}
