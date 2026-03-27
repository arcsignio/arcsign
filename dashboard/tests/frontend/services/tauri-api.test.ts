/**
 * Tests for src/services/tauri-api.ts
 * Verifies Tauri invoke calls, parseError utility, and API method behavior
 */

import { describe, it, expect, vi } from 'vitest';
import { invoke } from '@tauri-apps/api';

// We need to import the individual named exports
import {
  detectUsb,
  createWallet,
  importWallet,
  listWallets,
  renameWallet,
  deleteWallet,
  exportBackup,
  importBackup,
  exportAllBackups,
  importAllBackups,
  loadAddresses,
  getTokenBalances,
  getNFTs,
  getAssetTransfers,
  buildTransaction,
  signTransaction,
  broadcastTransaction,
  estimateFee,
  isFirstTimeSetup,
  initializeApp,
  unlockApp,
  enableScreenshotProtection,
  disableScreenshotProtection,
  clearSensitiveMemory,
  getTokenApprovals,
  listContacts,
  addContact,
  updateContact,
  deleteContact,
  setTransactionLabel,
  getTransactionLabels,
  deleteTransactionLabel,
  updateWebsocketAccounts,
  updateWebsocketUsbPath,
  devModeSign,
  queryTransactionStatus,
  validatePassphrase,
  getSwapQuote,
  buildSwapTransaction,
  getSwapApproval,
  checkSwapAllowance,
  getNativeTokenAddress,
  getSwapTokens,
  getPendingTransaction,
  respondToTransaction,
  cancelPendingTransaction,
  getPendingMessageSign,
  respondToMessageSign,
  cancelPendingMessageSign,
  signMessage,
  signTypedData,
  checkAllMemberships,
  getDeviceMembershipStatus,
  getDeviceMembershipStatusWithToken,
  addDeviceMembershipBinding,
  removeDeviceMembershipBinding,
  syncMembershipBindingWithToken,
  removeMembershipBindingWithToken,
  createSession,
  validateSession,
  revokeSession,
  createWalletSession,
  validateWalletSession,
  revokeWalletSession,
  loadDevSigningHistory,
  appendDevSigningHistory,
  clearDevSigningHistory,
  loadDevSettings,
  saveDevSettings,
  createDevSession,
  getDevSession,
  endDevSession,
  tauriApi,
} from '@/services/tauri-api';

const mockInvoke = vi.mocked(invoke);

describe('tauri-api service', () => {
  // ==========================================================================
  // parseError (tested indirectly through API methods that throw)
  // ==========================================================================
  describe('parseError', () => {
    it('parses JSON string errors with code and message', async () => {
      const jsonError = JSON.stringify({
        code: 'WALLET_NOT_FOUND',
        message: 'Wallet does not exist',
        details: 'ID: abc-123',
      });
      mockInvoke.mockImplementation(() => Promise.reject(jsonError));

      try {
        await detectUsb();
        expect.unreachable('should have thrown');
      } catch (err: any) {
        expect(err.code).toBe('WALLET_NOT_FOUND');
        expect(err.message).toBe('Wallet does not exist');
        expect(err.details).toBe('ID: abc-123');
      }
    });

    it('parses plain string errors', async () => {
      mockInvoke.mockImplementation(() => Promise.reject('something went wrong'));

      try {
        await detectUsb();
        expect.unreachable('should have thrown');
      } catch (err: any) {
        expect(err.code).toBe('UNKNOWN_ERROR');
        expect(err.message).toBe('something went wrong');
      }
    });

    it('parses object errors with code and message', async () => {
      mockInvoke.mockImplementation(() =>
        Promise.reject({ code: 'USB_ERROR', message: 'Device not found' })
      );

      try {
        await detectUsb();
        expect.unreachable('should have thrown');
      } catch (err: any) {
        expect(err.code).toBe('USB_ERROR');
        expect(err.message).toBe('Device not found');
      }
    });

    it('handles object errors without code/message', async () => {
      mockInvoke.mockImplementation(() => Promise.reject({ foo: 'bar' }));

      try {
        await detectUsb();
        expect.unreachable('should have thrown');
      } catch (err: any) {
        expect(err.code).toBe('UNKNOWN_ERROR');
        expect(err.message).toBe('An unexpected error occurred');
      }
    });

    it('handles null/undefined errors', async () => {
      mockInvoke.mockImplementation(() => Promise.reject(null));

      try {
        await detectUsb();
        expect.unreachable('should have thrown');
      } catch (err: any) {
        expect(err.code).toBe('UNKNOWN_ERROR');
        expect(err.message).toBe('An unexpected error occurred');
      }
    });
  });

  // ==========================================================================
  // USB Detection
  // ==========================================================================
  describe('detectUsb', () => {
    it('calls invoke with "detect_usb" and returns devices', async () => {
      const devices = [
        { path: '/dev/sda1', name: 'USB Drive', is_writable: true, available_space: 1000000 },
      ];
      mockInvoke.mockImplementation(() => Promise.resolve(devices));

      const result = await detectUsb();

      expect(mockInvoke).toHaveBeenCalledWith('detect_usb');
      expect(result).toEqual(devices);
    });
  });

  // ==========================================================================
  // Wallet Management
  // ==========================================================================
  describe('createWallet', () => {
    it('calls invoke with "create_wallet" and camelCase params', async () => {
      const mockResponse = { id: 'w1', name: 'Test', mnemonic: 'word1 word2' };
      mockInvoke.mockImplementation(() => Promise.resolve(mockResponse));

      const result = await createWallet({
        password: 'pass123',
        usb_path: '/dev/sda1',
        name: 'Test',
        passphrase: '',
        mnemonic_length: 12,
      });

      expect(mockInvoke).toHaveBeenCalledWith('create_wallet', {
        password: 'pass123',
        usbPath: '/dev/sda1',
        name: 'Test',
        passphrase: '',
        mnemonicLength: 12,
      });
      expect(result).toEqual(mockResponse);
    });
  });

  describe('importWallet', () => {
    it('calls invoke with "import_wallet" and correct params', async () => {
      const mockResponse = { id: 'w2', name: 'Imported' };
      mockInvoke.mockImplementation(() => Promise.resolve(mockResponse));

      await importWallet({
        mnemonic: 'word1 word2 word3',
        password: 'pass',
        usb_path: '/dev/sda1',
        passphrase: 'extra',
        name: 'Imported',
      });

      expect(mockInvoke).toHaveBeenCalledWith('import_wallet', {
        mnemonic: 'word1 word2 word3',
        password: 'pass',
        usbPath: '/dev/sda1',
        passphrase: 'extra',
        name: 'Imported',
      });
    });
  });

  describe('listWallets', () => {
    it('calls invoke with "list_wallets" and usbPath', async () => {
      const wallets = [{ id: 'w1', name: 'Wallet1' }];
      mockInvoke.mockImplementation(() => Promise.resolve(wallets));

      const result = await listWallets('/dev/sda1');

      expect(mockInvoke).toHaveBeenCalledWith('list_wallets', { usbPath: '/dev/sda1' });
      expect(result).toEqual(wallets);
    });
  });

  describe('renameWallet', () => {
    it('calls invoke with "rename_wallet" and maps snake_case to camelCase', async () => {
      mockInvoke.mockImplementation(() => Promise.resolve({ id: 'w1', name: 'New Name' }));

      await renameWallet({
        wallet_id: 'w1',
        new_name: 'New Name',
        usb_path: '/dev/sda1',
      });

      expect(mockInvoke).toHaveBeenCalledWith('rename_wallet', {
        walletId: 'w1',
        newName: 'New Name',
        usbPath: '/dev/sda1',
      });
    });
  });

  describe('deleteWallet', () => {
    it('calls invoke with "delete_wallet"', async () => {
      mockInvoke.mockImplementation(() => Promise.resolve(undefined));

      await deleteWallet({
        wallet_id: 'w1',
        password: 'pass',
        usb_path: '/dev/sda1',
      });

      expect(mockInvoke).toHaveBeenCalledWith('delete_wallet', {
        walletId: 'w1',
        password: 'pass',
        usbPath: '/dev/sda1',
      });
    });
  });

  // ==========================================================================
  // Backup Management
  // ==========================================================================
  describe('exportBackup', () => {
    it('calls invoke with "export_backup" and returns backup data', async () => {
      const backup = { walletName: 'W1', backupData: 'base64data', exportedAt: '2025-01-01' };
      mockInvoke.mockImplementation(() => Promise.resolve(backup));

      const result = await exportBackup({ wallet_id: 'w1', usb_path: '/dev/sda1' });

      expect(mockInvoke).toHaveBeenCalledWith('export_backup', {
        walletId: 'w1',
        usbPath: '/dev/sda1',
      });
      expect(result).toEqual(backup);
    });
  });

  describe('importBackup', () => {
    it('calls invoke with "import_backup" with optional name defaulting to null', async () => {
      mockInvoke.mockImplementation(() => Promise.resolve({ id: 'w1' }));

      await importBackup({
        backup_data: 'base64data',
        password: 'pass',
        usb_path: '/dev/sda1',
      });

      expect(mockInvoke).toHaveBeenCalledWith('import_backup', {
        backupData: 'base64data',
        password: 'pass',
        usbPath: '/dev/sda1',
        name: null,
      });
    });
  });

  // ==========================================================================
  // Address & Token Management
  // ==========================================================================
  describe('loadAddresses', () => {
    it('calls invoke with "load_addresses"', async () => {
      mockInvoke.mockImplementation(() => Promise.resolve({ addresses: [] }));

      await loadAddresses({
        wallet_id: 'w1',
        password: 'pass',
        usb_path: '/dev/sda1',
      });

      expect(mockInvoke).toHaveBeenCalledWith('load_addresses', {
        walletId: 'w1',
        password: 'pass',
        usbPath: '/dev/sda1',
      });
    });
  });

  describe('getTokenBalances', () => {
    it('calls invoke with "get_token_balances" passing all params', async () => {
      mockInvoke.mockImplementation(() => Promise.resolve({ balances: [] }));

      await getTokenBalances({
        walletId: 'w1',
        password: 'pass',
        usbPath: '/dev/sda1',
        sessionToken: 'tok123',
        includeTestnets: false,
      });

      expect(mockInvoke).toHaveBeenCalledWith('get_token_balances', {
        walletId: 'w1',
        password: 'pass',
        usbPath: '/dev/sda1',
        sessionToken: 'tok123',
        appPassword: undefined,
        includeTestnets: false,
      });
    });
  });

  describe('getNFTs', () => {
    it('calls invoke with "get_nfts"', async () => {
      mockInvoke.mockImplementation(() => Promise.resolve({ nfts: [] }));

      await getNFTs({
        walletId: 'w1',
        password: 'pass',
        usbPath: '/dev/sda1',
        sessionToken: 'tok',
      });

      expect(mockInvoke).toHaveBeenCalledWith('get_nfts', {
        walletId: 'w1',
        password: 'pass',
        usbPath: '/dev/sda1',
        sessionToken: 'tok',
        appPassword: undefined,
      });
    });
  });

  describe('getTokenApprovals', () => {
    it('calls invoke with "get_token_approvals"', async () => {
      mockInvoke.mockImplementation(() => Promise.resolve({ approvals: [] }));

      await getTokenApprovals({
        walletId: 'w1',
        password: 'pass',
        usbPath: '/dev/sda1',
        sessionToken: 'tok',
      });

      expect(mockInvoke).toHaveBeenCalledWith('get_token_approvals', {
        walletId: 'w1',
        password: 'pass',
        usbPath: '/dev/sda1',
        sessionToken: 'tok',
        appPassword: undefined,
      });
    });
  });

  // ==========================================================================
  // Transaction Operations
  // ==========================================================================
  describe('getAssetTransfers', () => {
    it('calls invoke with "get_asset_transfers" and wraps params in input', async () => {
      const response = { transfers: [], pageKey: '', address: '0x1', network: 'eth-mainnet', count: 0 };
      mockInvoke.mockImplementation(() => Promise.resolve(response));

      const result = await getAssetTransfers({
        address: '0x1',
        usbPath: '/dev/sda1',
        sessionToken: 'tok',
      });

      expect(mockInvoke).toHaveBeenCalledWith('get_asset_transfers', {
        input: {
          address: '0x1',
          network: 'eth-mainnet',
          maxCount: 50,
          pageKey: '',
          usbPath: '/dev/sda1',
          sessionToken: 'tok',
          appPassword: '',
        },
      });
      expect(result).toEqual(response);
    });
  });

  describe('buildTransaction', () => {
    it('calls invoke with "build_transaction" wrapping params in input', async () => {
      const mockResp = { id: 'tx1', chainId: 'ethereum', from: '0x1', to: '0x2', amount: '100', fee: '21000', signingPayload: '', humanReadable: '', buildTimestamp: '' };
      mockInvoke.mockImplementation(() => Promise.resolve(mockResp));

      await buildTransaction({
        chainId: 'ethereum',
        from: '0x1',
        to: '0x2',
        amount: '0.1',
        usbPath: '/dev/sda1',
        sessionToken: 'tok',
      });

      expect(mockInvoke).toHaveBeenCalledWith('build_transaction', {
        input: expect.objectContaining({
          chainId: 'ethereum',
          from: '0x1',
          to: '0x2',
          amount: '0.1',
          feeSpeed: 'normal',
          tokenAddress: '',
          data: '',
          usbPath: '/dev/sda1',
          sessionToken: 'tok',
          isPro: false,
        }),
      });
    });
  });

  describe('broadcastTransaction', () => {
    it('calls invoke with "broadcast_transaction" wrapping params in input', async () => {
      const signedTx = { txHash: '0xabc', signature: 'sig', serializedTx: 'raw', signedBy: '0x1', signTimestamp: '' };
      mockInvoke.mockImplementation(() => Promise.resolve({ txHash: '0xabc', submittedAt: '', status: 'pending' }));

      await broadcastTransaction({
        chainId: 'ethereum',
        signedTx,
        usbPath: '/dev/sda1',
        sessionToken: 'tok',
      });

      expect(mockInvoke).toHaveBeenCalledWith('broadcast_transaction', {
        input: {
          chainId: 'ethereum',
          signedTx,
          usbPath: '/dev/sda1',
          sessionToken: 'tok',
          appPassword: undefined,
        },
      });
    });
  });

  describe('estimateFee', () => {
    it('calls invoke with "estimate_fee" wrapping params in input', async () => {
      mockInvoke.mockImplementation(() => Promise.resolve({ chainId: 'ethereum', minFee: '1', recommendedFee: '2', maxFee: '3', confidence: 95, estimatedBlocks: 1, timestamp: '' }));

      await estimateFee({
        chainId: 'ethereum',
        from: '0x1',
        to: '0x2',
        amount: '0.1',
        usbPath: '/dev/sda1',
        sessionToken: 'tok',
      });

      expect(mockInvoke).toHaveBeenCalledWith('estimate_fee', {
        input: {
          chainId: 'ethereum',
          from: '0x1',
          to: '0x2',
          amount: '0.1',
          usbPath: '/dev/sda1',
          sessionToken: 'tok',
          appPassword: undefined,
        },
      });
    });
  });

  // ==========================================================================
  // App Authentication
  // ==========================================================================
  describe('isFirstTimeSetup', () => {
    it('calls invoke with "is_first_time_setup" and returns boolean', async () => {
      mockInvoke.mockImplementation(() => Promise.resolve(true));

      const result = await isFirstTimeSetup('/dev/sda1');

      expect(mockInvoke).toHaveBeenCalledWith('is_first_time_setup', { usbPath: '/dev/sda1' });
      expect(result).toBe(true);
    });
  });

  describe('initializeApp', () => {
    it('calls invoke with "initialize_app" wrapping params in input', async () => {
      mockInvoke.mockImplementation(() => Promise.resolve('session-token'));

      const result = await initializeApp('password123', '/dev/sda1');

      expect(mockInvoke).toHaveBeenCalledWith('initialize_app', {
        input: { password: 'password123', usbPath: '/dev/sda1' },
      });
      expect(result).toBe('session-token');
    });
  });

  describe('unlockApp', () => {
    it('calls invoke with "unlock_app" wrapping params in input', async () => {
      const config = { version: '1.0', createdAt: '', updatedAt: '', wallets: [], providers: [], settings: { autoLockMinutes: 5, requirePasswordOnStart: true } };
      mockInvoke.mockImplementation(() => Promise.resolve(config));

      const result = await unlockApp('password', '/dev/sda1');

      expect(mockInvoke).toHaveBeenCalledWith('unlock_app', {
        input: { password: 'password', usbPath: '/dev/sda1' },
      });
      expect(result).toEqual(config);
    });
  });

  // ==========================================================================
  // Security Commands
  // ==========================================================================
  describe('security commands', () => {
    it('enableScreenshotProtection calls invoke with no params', async () => {
      mockInvoke.mockImplementation(() => Promise.resolve(undefined));

      await enableScreenshotProtection();

      expect(mockInvoke).toHaveBeenCalledWith('enable_screenshot_protection');
    });

    it('disableScreenshotProtection calls invoke with no params', async () => {
      mockInvoke.mockImplementation(() => Promise.resolve(undefined));

      await disableScreenshotProtection();

      expect(mockInvoke).toHaveBeenCalledWith('disable_screenshot_protection');
    });

    it('clearSensitiveMemory calls invoke with no params', async () => {
      mockInvoke.mockImplementation(() => Promise.resolve(undefined));

      await clearSensitiveMemory();

      expect(mockInvoke).toHaveBeenCalledWith('clear_sensitive_memory');
    });
  });

  // ==========================================================================
  // Contacts
  // ==========================================================================
  describe('listContacts', () => {
    it('calls invoke with "list_contacts" providing defaults for optional params', async () => {
      mockInvoke.mockImplementation(() => Promise.resolve({ contacts: [] }));

      await listContacts('/dev/sda1');

      expect(mockInvoke).toHaveBeenCalledWith('list_contacts', {
        usbPath: '/dev/sda1',
        sessionToken: '',
        appPassword: '',
      });
    });
  });

  // ==========================================================================
  // WebSocket Account Updates
  // ==========================================================================
  describe('updateWebsocketAccounts', () => {
    it('calls invoke with "update_websocket_accounts" and accounts array', async () => {
      mockInvoke.mockImplementation(() => Promise.resolve(undefined));

      await updateWebsocketAccounts(['0xabc', '0xdef']);

      expect(mockInvoke).toHaveBeenCalledWith('update_websocket_accounts', {
        accounts: ['0xabc', '0xdef'],
      });
    });

    it('does not throw on error (non-critical operation)', async () => {
      mockInvoke.mockImplementation(() => Promise.reject('ws error'));

      // Should not throw
      await updateWebsocketAccounts(['0xabc']);
    });
  });

  describe('updateWebsocketUsbPath', () => {
    it('calls invoke with "update_websocket_usb_path" and usbPath', async () => {
      mockInvoke.mockImplementation(() => Promise.resolve(undefined));

      await updateWebsocketUsbPath('/dev/sda1');

      expect(mockInvoke).toHaveBeenCalledWith('update_websocket_usb_path', {
        usbPath: '/dev/sda1',
      });
    });

    it('accepts null usbPath', async () => {
      mockInvoke.mockImplementation(() => Promise.resolve(undefined));

      await updateWebsocketUsbPath(null);

      expect(mockInvoke).toHaveBeenCalledWith('update_websocket_usb_path', {
        usbPath: null,
      });
    });

    it('does not throw on error (non-critical operation)', async () => {
      mockInvoke.mockImplementation(() => Promise.reject('ws error'));

      await updateWebsocketUsbPath('/dev/sda1');
    });
  });

  // ==========================================================================
  // Bundle Backup (Pro feature)
  // ==========================================================================
  describe('exportAllBackups', () => {
    it('calls invoke with "export_all_backups" and maps snake_case to camelCase', async () => {
      const mockResp = { success: true, data: { bundleData: 'b64', walletCount: 2, exportedAt: '2025-01-01' } };
      mockInvoke.mockImplementation(() => Promise.resolve(mockResp));

      const result = await exportAllBackups({ password: 'pass', usb_path: '/dev/sda1' });

      expect(mockInvoke).toHaveBeenCalledWith('export_all_backups', {
        password: 'pass',
        usbPath: '/dev/sda1',
      });
      expect(result).toEqual(mockResp);
    });

    it('throws parsed error on failure', async () => {
      mockInvoke.mockImplementation(() => Promise.reject('export failed'));

      try {
        await exportAllBackups({ password: 'pass', usb_path: '/dev/sda1' });
        expect.unreachable('should have thrown');
      } catch (err: any) {
        expect(err.code).toBe('UNKNOWN_ERROR');
        expect(err.message).toBe('export failed');
      }
    });
  });

  describe('importAllBackups', () => {
    it('calls invoke with "import_all_backups" and maps snake_case to camelCase', async () => {
      const mockResp = { success: true, data: { wallets: [], importedCount: 0, importedAt: '' } };
      mockInvoke.mockImplementation(() => Promise.resolve(mockResp));

      const result = await importAllBackups({
        bundle_data: 'b64data',
        password: 'pass',
        usb_path: '/dev/sda1',
      });

      expect(mockInvoke).toHaveBeenCalledWith('import_all_backups', {
        bundleData: 'b64data',
        password: 'pass',
        usbPath: '/dev/sda1',
      });
      expect(result).toEqual(mockResp);
    });
  });

  // ==========================================================================
  // Contacts: addContact, updateContact, deleteContact
  // ==========================================================================
  describe('addContact', () => {
    it('calls invoke with "add_contact" and defaults optional fields', async () => {
      const mockResp = { contact: { id: 'c1', name: 'Alice', address: '0x1', symbol: 'ETH', coinName: 'Ethereum', notes: '', createdAt: '', updatedAt: '' } };
      mockInvoke.mockImplementation(() => Promise.resolve(mockResp));

      await addContact({
        name: 'Alice',
        address: '0x1',
        symbol: 'ETH',
        coinName: 'Ethereum',
        usbPath: '/dev/sda1',
      });

      expect(mockInvoke).toHaveBeenCalledWith('add_contact', {
        name: 'Alice',
        address: '0x1',
        symbol: 'ETH',
        coinName: 'Ethereum',
        notes: '',
        usbPath: '/dev/sda1',
        sessionToken: '',
        appPassword: '',
      });
    });
  });

  describe('updateContact', () => {
    it('calls invoke with "update_contact"', async () => {
      const mockResp = { contact: { id: 'c1', name: 'Bob', address: '0x2', symbol: 'BTC', coinName: 'Bitcoin', notes: 'note', createdAt: '', updatedAt: '' } };
      mockInvoke.mockImplementation(() => Promise.resolve(mockResp));

      await updateContact({
        contactId: 'c1',
        name: 'Bob',
        address: '0x2',
        symbol: 'BTC',
        coinName: 'Bitcoin',
        notes: 'note',
        usbPath: '/dev/sda1',
        sessionToken: 'tok',
      });

      expect(mockInvoke).toHaveBeenCalledWith('update_contact', {
        contactId: 'c1',
        name: 'Bob',
        address: '0x2',
        symbol: 'BTC',
        coinName: 'Bitcoin',
        notes: 'note',
        usbPath: '/dev/sda1',
        sessionToken: 'tok',
        appPassword: '',
      });
    });
  });

  describe('deleteContact', () => {
    it('calls invoke with "delete_contact" and defaults optional params', async () => {
      mockInvoke.mockImplementation(() => Promise.resolve({ deleted: true, deletedAt: '2025-01-01' }));

      const result = await deleteContact('c1', '/dev/sda1');

      expect(mockInvoke).toHaveBeenCalledWith('delete_contact', {
        contactId: 'c1',
        usbPath: '/dev/sda1',
        sessionToken: '',
        appPassword: '',
      });
      expect(result.deleted).toBe(true);
    });
  });

  // ==========================================================================
  // Transaction Labels
  // ==========================================================================
  describe('setTransactionLabel', () => {
    it('calls invoke with "set_transaction_label" and defaults optional fields', async () => {
      const mockResp = { label: { name: 'Swap', category: '', notes: '', createdAt: '', updatedAt: '' } };
      mockInvoke.mockImplementation(() => Promise.resolve(mockResp));

      await setTransactionLabel({
        network: 'eth-mainnet',
        txHash: '0xabc',
        name: 'Swap',
        usbPath: '/dev/sda1',
      });

      expect(mockInvoke).toHaveBeenCalledWith('set_transaction_label', {
        network: 'eth-mainnet',
        txHash: '0xabc',
        name: 'Swap',
        category: '',
        notes: '',
        usbPath: '/dev/sda1',
        sessionToken: '',
        appPassword: '',
      });
    });
  });

  describe('getTransactionLabels', () => {
    it('calls invoke with "get_transaction_labels" and defaults optional params', async () => {
      mockInvoke.mockImplementation(() => Promise.resolve({ labels: [] }));

      await getTransactionLabels('/dev/sda1');

      expect(mockInvoke).toHaveBeenCalledWith('get_transaction_labels', {
        usbPath: '/dev/sda1',
        network: '',
        sessionToken: '',
        appPassword: '',
      });
    });

    it('passes network filter when provided', async () => {
      mockInvoke.mockImplementation(() => Promise.resolve({ labels: [] }));

      await getTransactionLabels('/dev/sda1', 'eth-mainnet', 'tok');

      expect(mockInvoke).toHaveBeenCalledWith('get_transaction_labels', {
        usbPath: '/dev/sda1',
        network: 'eth-mainnet',
        sessionToken: 'tok',
        appPassword: '',
      });
    });
  });

  describe('deleteTransactionLabel', () => {
    it('calls invoke with "delete_transaction_label"', async () => {
      mockInvoke.mockImplementation(() => Promise.resolve({ deleted: true }));

      const result = await deleteTransactionLabel('eth-mainnet', '0xabc', '/dev/sda1');

      expect(mockInvoke).toHaveBeenCalledWith('delete_transaction_label', {
        network: 'eth-mainnet',
        txHash: '0xabc',
        usbPath: '/dev/sda1',
        sessionToken: '',
        appPassword: '',
      });
      expect(result.deleted).toBe(true);
    });
  });

  // ==========================================================================
  // signTransaction (dedicated test)
  // ==========================================================================
  describe('signTransaction', () => {
    it('calls invoke with "sign_transaction" wrapping params in input', async () => {
      const mockResp = { txHash: '0xhash', signature: 'sig', serializedTx: 'raw', signedBy: '0x1', signTimestamp: '' };
      mockInvoke.mockImplementation(() => Promise.resolve(mockResp));

      const unsignedTx = {
        id: 'tx1',
        chainId: 'ethereum',
        from: '0x1',
        to: '0x2',
        amount: '100',
        fee: '21000',
        signingPayload: 'payload',
        humanReadable: '{}',
        buildTimestamp: '',
      };

      const result = await signTransaction({
        chainId: 'ethereum',
        walletId: 'w1',
        password: 'pass',
        fromAddress: '0x1',
        unsignedTx,
        usbPath: '/dev/sda1',
        sessionToken: 'tok',
      });

      expect(mockInvoke).toHaveBeenCalledWith('sign_transaction', {
        input: {
          chainId: 'ethereum',
          walletId: 'w1',
          password: 'pass',
          passphrase: '',
          fromAddress: '0x1',
          unsignedTx,
          usbPath: '/dev/sda1',
          sessionToken: 'tok',
          appPassword: undefined,
        },
      });
      expect(result).toEqual(mockResp);
    });
  });

  // ==========================================================================
  // devModeSign
  // ==========================================================================
  describe('devModeSign', () => {
    it('calls invoke with "dev_mode_sign" wrapping params in input with defaults', async () => {
      const mockResp = { txHash: '0xh', signature: 'sig', serializedTx: 'raw', signedBy: '0x1' };
      mockInvoke.mockImplementation(() => Promise.resolve(mockResp));

      const result = await devModeSign({
        walletId: 'w1',
        password: 'pass',
        usbPath: '/dev/sda1',
        from: '0x1',
        to: '0x2',
        data: '0xdeadbeef',
        value: '0x0',
        gas: '0x5208',
        chainId: 1,
        nonce: 0,
      });

      expect(mockInvoke).toHaveBeenCalledWith('dev_mode_sign', {
        input: {
          walletId: 'w1',
          password: 'pass',
          passphrase: '',
          usbPath: '/dev/sda1',
          from: '0x1',
          to: '0x2',
          data: '0xdeadbeef',
          value: '0x0',
          gas: '0x5208',
          gasPrice: undefined,
          maxFeePerGas: undefined,
          maxPriorityFeePerGas: undefined,
          chainId: 1,
          nonce: 0,
        },
      });
      expect(result).toEqual(mockResp);
    });
  });

  // ==========================================================================
  // queryTransactionStatus
  // ==========================================================================
  describe('queryTransactionStatus', () => {
    it('calls invoke with "query_transaction_status" wrapping params in input', async () => {
      const mockResp = { txHash: '0xabc', status: 'confirmed', blockNumber: 100, confirmations: 12 };
      mockInvoke.mockImplementation(() => Promise.resolve(mockResp));

      const result = await queryTransactionStatus({
        chainId: 'ethereum',
        txHash: '0xabc',
        usbPath: '/dev/sda1',
        sessionToken: 'tok',
      });

      expect(mockInvoke).toHaveBeenCalledWith('query_transaction_status', {
        input: {
          chainId: 'ethereum',
          txHash: '0xabc',
          usbPath: '/dev/sda1',
          sessionToken: 'tok',
          appPassword: undefined,
        },
      });
      expect(result).toEqual(mockResp);
    });
  });

  // ==========================================================================
  // validatePassphrase
  // ==========================================================================
  describe('validatePassphrase', () => {
    it('calls invoke with "validate_passphrase" with direct params', async () => {
      const mockResp = { valid: true, derivedAddress: '0xabc', expectedAddress: '0xabc' };
      mockInvoke.mockImplementation(() => Promise.resolve(mockResp));

      const result = await validatePassphrase({
        walletId: 'w1',
        password: 'pass',
        passphrase: 'mypassphrase',
        usbPath: '/dev/sda1',
      });

      expect(mockInvoke).toHaveBeenCalledWith('validate_passphrase', {
        walletId: 'w1',
        password: 'pass',
        passphrase: 'mypassphrase',
        usbPath: '/dev/sda1',
      });
      expect(result.valid).toBe(true);
    });
  });

  // ==========================================================================
  // Swap API Functions
  // ==========================================================================
  describe('getSwapQuote', () => {
    it('calls invoke with "get_swap_quote" wrapping params in input with defaults', async () => {
      const mockResp = {
        dex: 'OpenOcean', fromToken: { symbol: 'ETH', name: 'Ether', address: '0x', decimals: 18 },
        toToken: { symbol: 'USDC', name: 'USD Coin', address: '0xusdc', decimals: 6 },
        fromAmount: '1000', toAmount: '2000', toAmountMin: '1980', exchangeRate: '2.0',
        priceImpact: '0.1', estimatedGas: '200000', gasCostETH: '0.01', route: ['ETH', 'USDC'],
        protocols: ['Uniswap'], validUntil: 9999999999, needsApproval: false, approvalAddress: '',
      };
      mockInvoke.mockImplementation(() => Promise.resolve(mockResp));

      const result = await getSwapQuote({
        chainId: 'ethereum',
        fromTokenAddress: '0xeth',
        toTokenAddress: '0xusdc',
        amount: '1000',
        fromAddress: '0x1',
        usbPath: '/dev/sda1',
        sessionToken: 'tok',
      });

      expect(mockInvoke).toHaveBeenCalledWith('get_swap_quote', {
        input: {
          chainId: 'ethereum',
          fromTokenAddress: '0xeth',
          toTokenAddress: '0xusdc',
          amount: '1000',
          fromAddress: '0x1',
          slippage: 0.5,
          provider: 'openocean',
          isPro: false,
          usbPath: '/dev/sda1',
          sessionToken: 'tok',
          appPassword: undefined,
        },
      });
      expect(result.dex).toBe('OpenOcean');
    });
  });

  describe('buildSwapTransaction', () => {
    it('calls invoke with "build_swap_transaction" wrapping params in input', async () => {
      const mockResp = { quote: {}, txData: { from: '0x1', to: '0x2', data: '0x', value: '0', gas: 200000, gasPrice: '1' }, chainId: 1 };
      mockInvoke.mockImplementation(() => Promise.resolve(mockResp));

      await buildSwapTransaction({
        chainId: 'ethereum',
        fromTokenAddress: '0xeth',
        toTokenAddress: '0xusdc',
        amount: '1000',
        fromAddress: '0x1',
        usbPath: '/dev/sda1',
      });

      expect(mockInvoke).toHaveBeenCalledWith('build_swap_transaction', {
        input: {
          chainId: 'ethereum',
          fromTokenAddress: '0xeth',
          toTokenAddress: '0xusdc',
          amount: '1000',
          fromAddress: '0x1',
          slippage: 0.5,
          provider: 'openocean',
          isPro: false,
          usbPath: '/dev/sda1',
          sessionToken: undefined,
          appPassword: undefined,
        },
      });
    });
  });

  describe('getSwapApproval', () => {
    it('calls invoke with "get_swap_approval" wrapping params in input', async () => {
      const mockResp = { data: '0xapprove', gasPrice: '1', to: '0xtoken', value: '0' };
      mockInvoke.mockImplementation(() => Promise.resolve(mockResp));

      await getSwapApproval({
        chainId: 'ethereum',
        tokenAddress: '0xtoken',
        spenderAddress: '0xrouter',
        usbPath: '/dev/sda1',
        sessionToken: 'tok',
      });

      expect(mockInvoke).toHaveBeenCalledWith('get_swap_approval', {
        input: {
          chainId: 'ethereum',
          tokenAddress: '0xtoken',
          spenderAddress: '0xrouter',
          amount: '',
          usbPath: '/dev/sda1',
          sessionToken: 'tok',
          appPassword: undefined,
        },
      });
    });
  });

  describe('checkSwapAllowance', () => {
    it('calls invoke with "check_swap_allowance" wrapping params in input', async () => {
      mockInvoke.mockImplementation(() => Promise.resolve({ allowance: '1000000', hasAllowance: true }));

      const result = await checkSwapAllowance({
        chainId: 'ethereum',
        tokenAddress: '0xtoken',
        walletAddress: '0xwallet',
        usbPath: '/dev/sda1',
      });

      expect(mockInvoke).toHaveBeenCalledWith('check_swap_allowance', {
        input: {
          chainId: 'ethereum',
          tokenAddress: '0xtoken',
          walletAddress: '0xwallet',
          usbPath: '/dev/sda1',
          sessionToken: undefined,
          appPassword: undefined,
        },
      });
      expect(result.hasAllowance).toBe(true);
    });
  });

  describe('getNativeTokenAddress', () => {
    it('calls invoke with "get_native_token_address" and extracts address', async () => {
      mockInvoke.mockImplementation(() => Promise.resolve({ address: '0xeeee' }));

      const result = await getNativeTokenAddress();

      expect(mockInvoke).toHaveBeenCalledWith('get_native_token_address');
      expect(result).toBe('0xeeee');
    });
  });

  describe('getSwapTokens', () => {
    it('calls invoke with "get_swap_tokens" wrapping params in input with defaults', async () => {
      mockInvoke.mockImplementation(() => Promise.resolve({ tokens: [{ symbol: 'ETH', name: 'Ether', address: '0x', decimals: 18 }] }));

      const result = await getSwapTokens({
        chainId: 'ethereum',
        usbPath: '/dev/sda1',
        sessionToken: 'tok',
      });

      expect(mockInvoke).toHaveBeenCalledWith('get_swap_tokens', {
        input: {
          chainId: 'ethereum',
          provider: 'openocean',
          usbPath: '/dev/sda1',
          sessionToken: 'tok',
          appPassword: undefined,
        },
      });
      expect(result.tokens).toHaveLength(1);
    });
  });

  // ==========================================================================
  // WebSocket Pending Transactions
  // ==========================================================================
  describe('getPendingTransaction', () => {
    it('calls invoke with "get_pending_transaction" and returns result', async () => {
      const pending = { request_id: 1, from: '0x1', to: '0x2', data: '0x', value: '0', chain_id: 1, description: 'test', broadcast: true };
      mockInvoke.mockImplementation(() => Promise.resolve(pending));

      const result = await getPendingTransaction();

      expect(mockInvoke).toHaveBeenCalledWith('get_pending_transaction');
      expect(result).toEqual(pending);
    });

    it('returns null when no pending transaction', async () => {
      mockInvoke.mockImplementation(() => Promise.resolve(null));

      const result = await getPendingTransaction();

      expect(result).toBeNull();
    });
  });

  describe('respondToTransaction', () => {
    it('calls invoke with "respond_to_transaction" wrapping in input, omits undefined optional fields', async () => {
      mockInvoke.mockImplementation(() => Promise.resolve(undefined));

      await respondToTransaction({
        requestId: 1,
        success: true,
        txHash: '0xhash',
      });

      expect(mockInvoke).toHaveBeenCalledWith('respond_to_transaction', {
        input: {
          requestId: 1,
          success: true,
          txHash: '0xhash',
        },
      });
    });

    it('skips invoke when requestId is invalid (NaN)', async () => {
      mockInvoke.mockImplementation(() => Promise.resolve(undefined));

      await respondToTransaction({
        requestId: NaN,
        success: false,
      });

      expect(mockInvoke).not.toHaveBeenCalled();
    });

    it('skips invoke when requestId is undefined', async () => {
      mockInvoke.mockImplementation(() => Promise.resolve(undefined));

      await respondToTransaction({
        requestId: undefined as any,
        success: false,
      });

      expect(mockInvoke).not.toHaveBeenCalled();
    });

    it('includes error field when provided', async () => {
      mockInvoke.mockImplementation(() => Promise.resolve(undefined));

      await respondToTransaction({
        requestId: 2,
        success: false,
        error: 'User rejected',
      });

      expect(mockInvoke).toHaveBeenCalledWith('respond_to_transaction', {
        input: {
          requestId: 2,
          success: false,
          error: 'User rejected',
        },
      });
    });
  });

  describe('cancelPendingTransaction', () => {
    it('calls invoke with "cancel_pending_transaction"', async () => {
      mockInvoke.mockImplementation(() => Promise.resolve(undefined));

      await cancelPendingTransaction();

      expect(mockInvoke).toHaveBeenCalledWith('cancel_pending_transaction');
    });
  });

  // ==========================================================================
  // WebSocket Pending Message Sign
  // ==========================================================================
  describe('getPendingMessageSign', () => {
    it('calls invoke with "get_pending_message_sign" and returns result', async () => {
      const pending = { requestId: 1, address: '0x1', signType: 'personal_sign', message: 'hello', description: 'sign msg' };
      mockInvoke.mockImplementation(() => Promise.resolve(pending));

      const result = await getPendingMessageSign();

      expect(mockInvoke).toHaveBeenCalledWith('get_pending_message_sign');
      expect(result).toEqual(pending);
    });

    it('returns null when no pending message sign', async () => {
      mockInvoke.mockImplementation(() => Promise.resolve(null));

      const result = await getPendingMessageSign();

      expect(result).toBeNull();
    });
  });

  describe('respondToMessageSign', () => {
    it('calls invoke with "respond_to_message_sign" wrapping in input', async () => {
      mockInvoke.mockImplementation(() => Promise.resolve(undefined));

      await respondToMessageSign({
        requestId: 1,
        success: true,
        signature: '0xsig',
      });

      expect(mockInvoke).toHaveBeenCalledWith('respond_to_message_sign', {
        input: {
          requestId: 1,
          success: true,
          signature: '0xsig',
        },
      });
    });

    it('skips invoke when requestId is NaN', async () => {
      mockInvoke.mockImplementation(() => Promise.resolve(undefined));

      await respondToMessageSign({
        requestId: NaN,
        success: false,
      });

      expect(mockInvoke).not.toHaveBeenCalled();
    });

    it('includes error field when provided', async () => {
      mockInvoke.mockImplementation(() => Promise.resolve(undefined));

      await respondToMessageSign({
        requestId: 3,
        success: false,
        error: 'rejected',
      });

      expect(mockInvoke).toHaveBeenCalledWith('respond_to_message_sign', {
        input: {
          requestId: 3,
          success: false,
          error: 'rejected',
        },
      });
    });
  });

  describe('cancelPendingMessageSign', () => {
    it('calls invoke with "cancel_pending_message_sign"', async () => {
      mockInvoke.mockImplementation(() => Promise.resolve(undefined));

      await cancelPendingMessageSign();

      expect(mockInvoke).toHaveBeenCalledWith('cancel_pending_message_sign');
    });
  });

  // ==========================================================================
  // Message Signing (EIP-191, EIP-712)
  // ==========================================================================
  describe('signMessage', () => {
    it('calls invoke with "sign_message" wrapping params in input', async () => {
      const mockResp = { signature: '0xsig', address: '0x1' };
      mockInvoke.mockImplementation(() => Promise.resolve(mockResp));

      const result = await signMessage({
        walletId: 'w1',
        password: 'pass',
        usbPath: '/dev/sda1',
        address: '0x1',
        message: '0x68656c6c6f',
      });

      expect(mockInvoke).toHaveBeenCalledWith('sign_message', {
        input: {
          walletId: 'w1',
          password: 'pass',
          passphrase: '',
          usbPath: '/dev/sda1',
          address: '0x1',
          message: '0x68656c6c6f',
        },
      });
      expect(result).toEqual(mockResp);
    });
  });

  describe('signTypedData', () => {
    it('calls invoke with "sign_typed_data" and JSON.stringify typedData', async () => {
      const mockResp = { signature: '0xsig', address: '0x1' };
      mockInvoke.mockImplementation(() => Promise.resolve(mockResp));

      const typedData = { domain: { name: 'Test' }, types: {}, primaryType: 'Test', message: {} };

      const result = await signTypedData({
        walletId: 'w1',
        password: 'pass',
        usbPath: '/dev/sda1',
        address: '0x1',
        typedData,
      });

      expect(mockInvoke).toHaveBeenCalledWith('sign_typed_data', {
        input: {
          walletId: 'w1',
          password: 'pass',
          passphrase: '',
          usbPath: '/dev/sda1',
          address: '0x1',
          typedData: JSON.stringify(typedData),
        },
      });
      expect(result).toEqual(mockResp);
    });
  });

  // ==========================================================================
  // Membership (NFT verification)
  // ==========================================================================
  describe('checkAllMemberships', () => {
    it('calls invoke with "check_all_memberships" wrapping in input', async () => {
      const mockResp = {
        totalNftCount: 2, boundNftCount: 1, isPro: true, daysRemaining: 365,
        walletLimit: 4, addressNftCounts: [], bindingRequired: true,
      };
      mockInvoke.mockImplementation(() => Promise.resolve(mockResp));

      const result = await checkAllMemberships(['0xaddr1', '0xaddr2'], '0xdevicehash');

      expect(mockInvoke).toHaveBeenCalledWith('check_all_memberships', {
        input: { addresses: ['0xaddr1', '0xaddr2'], deviceHash: '0xdevicehash' },
      });
      expect(result.isPro).toBe(true);
    });

    it('works without deviceHash', async () => {
      mockInvoke.mockImplementation(() => Promise.resolve({
        totalNftCount: 0, boundNftCount: 0, isPro: false, daysRemaining: 0,
        walletLimit: 1, addressNftCounts: [], bindingRequired: false,
      }));

      await checkAllMemberships(['0xaddr1']);

      expect(mockInvoke).toHaveBeenCalledWith('check_all_memberships', {
        input: { addresses: ['0xaddr1'], deviceHash: undefined },
      });
    });
  });

  // ==========================================================================
  // USB Device Membership (Device Binding System)
  // ==========================================================================
  describe('getDeviceMembershipStatus', () => {
    it('calls invoke with "get_device_membership_status" wrapping in input', async () => {
      const mockResp = {
        deviceId: 'uuid', deviceIdHash: '0xhash', walletLimit: 3,
        walletCount: 1, canCreateWallet: true, memberships: [], lockedWalletIds: [],
      };
      mockInvoke.mockImplementation(() => Promise.resolve(mockResp));

      const result = await getDeviceMembershipStatus({
        usbPath: '/dev/sda1',
        appPassword: 'pass',
      });

      expect(mockInvoke).toHaveBeenCalledWith('get_device_membership_status', {
        input: { usbPath: '/dev/sda1', appPassword: 'pass' },
      });
      expect(result.deviceId).toBe('uuid');
    });
  });

  describe('getDeviceMembershipStatusWithToken', () => {
    it('calls invoke with "get_device_membership_status_with_token" wrapping in input', async () => {
      const mockResp = {
        deviceId: 'uuid', deviceIdHash: '0xhash', walletLimit: 3,
        walletCount: 1, canCreateWallet: true, memberships: [], lockedWalletIds: [],
      };
      mockInvoke.mockImplementation(() => Promise.resolve(mockResp));

      const result = await getDeviceMembershipStatusWithToken({ token: 'session-tok' });

      expect(mockInvoke).toHaveBeenCalledWith('get_device_membership_status_with_token', {
        input: { token: 'session-tok' },
      });
      expect(result.deviceId).toBe('uuid');
    });
  });

  describe('addDeviceMembershipBinding', () => {
    it('calls invoke with "add_device_membership_binding" wrapping in input', async () => {
      mockInvoke.mockImplementation(() => Promise.resolve(undefined));

      await addDeviceMembershipBinding({
        usbPath: '/dev/sda1',
        appPassword: 'pass',
        nftTokenId: '1',
        nftContract: '0xcontract',
        chainId: '56',
        boundAddress: '0xaddr',
        signature: '0xsig',
      });

      expect(mockInvoke).toHaveBeenCalledWith('add_device_membership_binding', {
        input: {
          usbPath: '/dev/sda1',
          appPassword: 'pass',
          nftTokenId: '1',
          nftContract: '0xcontract',
          chainId: '56',
          boundAddress: '0xaddr',
          signature: '0xsig',
        },
      });
    });
  });

  describe('removeDeviceMembershipBinding', () => {
    it('calls invoke with "remove_device_membership_binding" wrapping in input', async () => {
      mockInvoke.mockImplementation(() => Promise.resolve(undefined));

      await removeDeviceMembershipBinding({
        usbPath: '/dev/sda1',
        appPassword: 'pass',
        nftTokenId: '1',
        nftContract: '0xcontract',
      });

      expect(mockInvoke).toHaveBeenCalledWith('remove_device_membership_binding', {
        input: {
          usbPath: '/dev/sda1',
          appPassword: 'pass',
          nftTokenId: '1',
          nftContract: '0xcontract',
        },
      });
    });
  });

  describe('syncMembershipBindingWithToken', () => {
    it('calls invoke with "sync_membership_binding_with_token" wrapping in input', async () => {
      mockInvoke.mockImplementation(() => Promise.resolve(undefined));

      await syncMembershipBindingWithToken({
        token: 'session-tok',
        nftTokenId: '1',
        nftContract: '0xcontract',
        chainId: '56',
        boundAddress: '0xaddr',
      });

      expect(mockInvoke).toHaveBeenCalledWith('sync_membership_binding_with_token', {
        input: {
          token: 'session-tok',
          nftTokenId: '1',
          nftContract: '0xcontract',
          chainId: '56',
          boundAddress: '0xaddr',
        },
      });
    });
  });

  describe('removeMembershipBindingWithToken', () => {
    it('calls invoke with "remove_membership_binding_with_token" wrapping in input', async () => {
      mockInvoke.mockImplementation(() => Promise.resolve(undefined));

      await removeMembershipBindingWithToken({
        token: 'session-tok',
        nftTokenId: '1',
        nftContract: '0xcontract',
      });

      expect(mockInvoke).toHaveBeenCalledWith('remove_membership_binding_with_token', {
        input: {
          token: 'session-tok',
          nftTokenId: '1',
          nftContract: '0xcontract',
        },
      });
    });
  });

  // ==========================================================================
  // Session Management
  // ==========================================================================
  describe('createSession', () => {
    it('calls invoke with "create_session" wrapping in input', async () => {
      const mockResp = { token: 'tok', expiresAt: 9999999999, usbPath: '/dev/sda1' };
      mockInvoke.mockImplementation(() => Promise.resolve(mockResp));

      const result = await createSession({ usbPath: '/dev/sda1', appPassword: 'pass' });

      expect(mockInvoke).toHaveBeenCalledWith('create_session', {
        input: { usbPath: '/dev/sda1', appPassword: 'pass' },
      });
      expect(result.token).toBe('tok');
    });
  });

  describe('validateSession', () => {
    it('calls invoke with "validate_session" wrapping in input', async () => {
      const mockResp = { valid: true, usbPath: '/dev/sda1', expiresAt: 9999999999 };
      mockInvoke.mockImplementation(() => Promise.resolve(mockResp));

      const result = await validateSession({ token: 'tok' });

      expect(mockInvoke).toHaveBeenCalledWith('validate_session', {
        input: { token: 'tok' },
      });
      expect(result.valid).toBe(true);
    });
  });

  describe('revokeSession', () => {
    it('calls invoke with "revoke_session" wrapping in input', async () => {
      mockInvoke.mockImplementation(() => Promise.resolve({ revoked: true }));

      const result = await revokeSession({ token: 'tok' });

      expect(mockInvoke).toHaveBeenCalledWith('revoke_session', {
        input: { token: 'tok' },
      });
      expect(result.revoked).toBe(true);
    });
  });

  // ==========================================================================
  // Wallet Session Management
  // ==========================================================================
  describe('createWalletSession', () => {
    it('calls invoke with "create_wallet_session" wrapping in input', async () => {
      const mockResp = { token: 'wtok', walletId: 'w1', expiresAt: 9999999999, usbPath: '/dev/sda1' };
      mockInvoke.mockImplementation(() => Promise.resolve(mockResp));

      const result = await createWalletSession({
        walletId: 'w1',
        password: 'pass',
        usbPath: '/dev/sda1',
      });

      expect(mockInvoke).toHaveBeenCalledWith('create_wallet_session', {
        input: { walletId: 'w1', password: 'pass', usbPath: '/dev/sda1' },
      });
      expect(result.token).toBe('wtok');
    });
  });

  describe('validateWalletSession', () => {
    it('calls invoke with "validate_wallet_session" wrapping in input', async () => {
      const mockResp = { valid: true, walletId: 'w1', expiresAt: 9999999999, usbPath: '/dev/sda1' };
      mockInvoke.mockImplementation(() => Promise.resolve(mockResp));

      const result = await validateWalletSession({ token: 'wtok' });

      expect(mockInvoke).toHaveBeenCalledWith('validate_wallet_session', {
        input: { token: 'wtok' },
      });
      expect(result.valid).toBe(true);
    });
  });

  describe('revokeWalletSession', () => {
    it('calls invoke with "revoke_wallet_session" wrapping in input', async () => {
      mockInvoke.mockImplementation(() => Promise.resolve({ revoked: true }));

      const result = await revokeWalletSession({ token: 'wtok' });

      expect(mockInvoke).toHaveBeenCalledWith('revoke_wallet_session', {
        input: { token: 'wtok' },
      });
      expect(result.revoked).toBe(true);
    });
  });

  // ==========================================================================
  // Developer Mode Signing History
  // ==========================================================================
  describe('loadDevSigningHistory', () => {
    it('calls invoke with "load_dev_signing_history" and returns entries', async () => {
      const entries = [{ id: 'e1', type: 'deploy', from: '0x1', network: 'sepolia', chainId: 11155111, status: 'approved', timestamp: 1000 }];
      mockInvoke.mockImplementation(() => Promise.resolve(entries));

      const result = await loadDevSigningHistory({ usbPath: '/dev/sda1', walletId: 'w1' });

      expect(mockInvoke).toHaveBeenCalledWith('load_dev_signing_history', {
        usbPath: '/dev/sda1',
        walletId: 'w1',
      });
      expect(result).toEqual(entries);
    });
  });

  describe('appendDevSigningHistory', () => {
    it('calls invoke with "append_dev_signing_history" and entry', async () => {
      mockInvoke.mockImplementation(() => Promise.resolve(undefined));

      const entry = { id: 'e1', type: 'call' as const, from: '0x1', network: 'sepolia', chainId: 11155111, status: 'approved' as const, timestamp: 1000 };

      await appendDevSigningHistory({ usbPath: '/dev/sda1', walletId: 'w1', entry });

      expect(mockInvoke).toHaveBeenCalledWith('append_dev_signing_history', {
        usbPath: '/dev/sda1',
        walletId: 'w1',
        entry,
      });
    });
  });

  describe('clearDevSigningHistory', () => {
    it('calls invoke with "clear_dev_signing_history"', async () => {
      mockInvoke.mockImplementation(() => Promise.resolve(undefined));

      await clearDevSigningHistory({ usbPath: '/dev/sda1', walletId: 'w1' });

      expect(mockInvoke).toHaveBeenCalledWith('clear_dev_signing_history', {
        usbPath: '/dev/sda1',
        walletId: 'w1',
      });
    });
  });

  // ==========================================================================
  // Developer Mode Settings
  // ==========================================================================
  describe('loadDevSettings', () => {
    it('calls invoke with "load_dev_settings"', async () => {
      const mockResp = { version: 1, explorerApiKeys: {}, updatedAt: 1000 };
      mockInvoke.mockImplementation(() => Promise.resolve(mockResp));

      const result = await loadDevSettings({ usbPath: '/dev/sda1' });

      expect(mockInvoke).toHaveBeenCalledWith('load_dev_settings', {
        usbPath: '/dev/sda1',
      });
      expect(result).toEqual(mockResp);
    });
  });

  describe('saveDevSettings', () => {
    it('calls invoke with "save_dev_settings"', async () => {
      mockInvoke.mockImplementation(() => Promise.resolve(undefined));

      const settings = { version: 1, explorerApiKeys: { etherscan: 'key1' }, updatedAt: 1000 };

      await saveDevSettings({ usbPath: '/dev/sda1', settings });

      expect(mockInvoke).toHaveBeenCalledWith('save_dev_settings', {
        usbPath: '/dev/sda1',
        settings,
      });
    });
  });

  // ==========================================================================
  // Developer Mode Session (Auto-signing)
  // ==========================================================================
  describe('createDevSession', () => {
    it('calls invoke with "create_dev_session" with defaults for optional params', async () => {
      const mockResp = { sessionToken: 'dev-tok', expiresAt: 9999999999, trustedNetworks: ['sepolia'], addresses: ['0x1'] };
      mockInvoke.mockImplementation(() => Promise.resolve(mockResp));

      const result = await createDevSession({
        walletId: 'w1',
        password: 'pass',
        usbPath: '/dev/sda1',
      });

      expect(mockInvoke).toHaveBeenCalledWith('create_dev_session', {
        walletId: 'w1',
        password: 'pass',
        passphrase: null,
        usbPath: '/dev/sda1',
        durationMinutes: 30,
        trustedNetworks: ['sepolia', 'goerli', 'bsc-testnet', 'mumbai'],
      });
      expect(result.sessionToken).toBe('dev-tok');
    });

    it('uses provided optional values', async () => {
      const mockResp = { sessionToken: 'dev-tok', expiresAt: 9999999999, trustedNetworks: ['sepolia'], addresses: ['0x1'] };
      mockInvoke.mockImplementation(() => Promise.resolve(mockResp));

      await createDevSession({
        walletId: 'w1',
        password: 'pass',
        passphrase: 'mypp',
        usbPath: '/dev/sda1',
        durationMinutes: 60,
        trustedNetworks: ['sepolia'],
      });

      expect(mockInvoke).toHaveBeenCalledWith('create_dev_session', {
        walletId: 'w1',
        password: 'pass',
        passphrase: 'mypp',
        usbPath: '/dev/sda1',
        durationMinutes: 60,
        trustedNetworks: ['sepolia'],
      });
    });
  });

  describe('getDevSession', () => {
    it('calls invoke with "get_dev_session"', async () => {
      const mockResp = { active: true, walletId: 'w1', expiresAt: 9999999999, remainingMs: 1000, signCount: 5, trustedNetworks: ['sepolia'], addresses: ['0x1'] };
      mockInvoke.mockImplementation(() => Promise.resolve(mockResp));

      const result = await getDevSession({ sessionToken: 'dev-tok' });

      expect(mockInvoke).toHaveBeenCalledWith('get_dev_session', {
        sessionToken: 'dev-tok',
      });
      expect(result.active).toBe(true);
    });
  });

  describe('endDevSession', () => {
    it('calls invoke with "end_dev_session"', async () => {
      mockInvoke.mockImplementation(() => Promise.resolve(undefined));

      await endDevSession({ sessionToken: 'dev-tok' });

      expect(mockInvoke).toHaveBeenCalledWith('end_dev_session', {
        sessionToken: 'dev-tok',
      });
    });
  });

  // ==========================================================================
  // tauriApi default export object
  // ==========================================================================
  describe('tauriApi object', () => {
    it('exposes all major API methods', () => {
      expect(tauriApi.detectUsb).toBe(detectUsb);
      expect(tauriApi.createWallet).toBe(createWallet);
      expect(tauriApi.listWallets).toBe(listWallets);
      expect(tauriApi.buildTransaction).toBe(buildTransaction);
      expect(tauriApi.broadcastTransaction).toBe(broadcastTransaction);
      expect(tauriApi.estimateFee).toBe(estimateFee);
      expect(tauriApi.enableScreenshotProtection).toBe(enableScreenshotProtection);
      expect(typeof tauriApi.signTransaction).toBe('function');
      expect(typeof tauriApi.getSwapQuote).toBe('function');
      expect(typeof tauriApi.signMessage).toBe('function');
      expect(typeof tauriApi.checkAllMemberships).toBe('function');
      expect(typeof tauriApi.createSession).toBe('function');
    });

    it('exposes all newly tested API methods', () => {
      expect(tauriApi.exportAllBackups).toBe(exportAllBackups);
      expect(tauriApi.importAllBackups).toBe(importAllBackups);
      expect(tauriApi.updateWebsocketAccounts).toBe(updateWebsocketAccounts);
      expect(tauriApi.updateWebsocketUsbPath).toBe(updateWebsocketUsbPath);
      expect(tauriApi.devModeSign).toBe(devModeSign);
      expect(tauriApi.queryTransactionStatus).toBe(queryTransactionStatus);
      expect(tauriApi.validatePassphrase).toBe(validatePassphrase);
      expect(tauriApi.getSwapQuote).toBe(getSwapQuote);
      expect(tauriApi.buildSwapTransaction).toBe(buildSwapTransaction);
      expect(tauriApi.getSwapApproval).toBe(getSwapApproval);
      expect(tauriApi.checkSwapAllowance).toBe(checkSwapAllowance);
      expect(tauriApi.getNativeTokenAddress).toBe(getNativeTokenAddress);
      expect(tauriApi.getSwapTokens).toBe(getSwapTokens);
      expect(tauriApi.getPendingTransaction).toBe(getPendingTransaction);
      expect(tauriApi.respondToTransaction).toBe(respondToTransaction);
      expect(tauriApi.cancelPendingTransaction).toBe(cancelPendingTransaction);
      expect(tauriApi.getPendingMessageSign).toBe(getPendingMessageSign);
      expect(tauriApi.respondToMessageSign).toBe(respondToMessageSign);
      expect(tauriApi.cancelPendingMessageSign).toBe(cancelPendingMessageSign);
      expect(tauriApi.signMessage).toBe(signMessage);
      expect(tauriApi.signTypedData).toBe(signTypedData);
      expect(tauriApi.checkAllMemberships).toBe(checkAllMemberships);
      expect(tauriApi.getDeviceMembershipStatus).toBe(getDeviceMembershipStatus);
      expect(tauriApi.getDeviceMembershipStatusWithToken).toBe(getDeviceMembershipStatusWithToken);
      expect(tauriApi.addDeviceMembershipBinding).toBe(addDeviceMembershipBinding);
      expect(tauriApi.removeDeviceMembershipBinding).toBe(removeDeviceMembershipBinding);
      expect(tauriApi.syncMembershipBindingWithToken).toBe(syncMembershipBindingWithToken);
      expect(tauriApi.removeMembershipBindingWithToken).toBe(removeMembershipBindingWithToken);
      expect(tauriApi.createSession).toBe(createSession);
      expect(tauriApi.validateSession).toBe(validateSession);
      expect(tauriApi.revokeSession).toBe(revokeSession);
      expect(tauriApi.createWalletSession).toBe(createWalletSession);
      expect(tauriApi.validateWalletSession).toBe(validateWalletSession);
      expect(tauriApi.revokeWalletSession).toBe(revokeWalletSession);
      expect(tauriApi.loadDevSigningHistory).toBe(loadDevSigningHistory);
      expect(tauriApi.appendDevSigningHistory).toBe(appendDevSigningHistory);
      expect(tauriApi.clearDevSigningHistory).toBe(clearDevSigningHistory);
      expect(tauriApi.loadDevSettings).toBe(loadDevSettings);
      expect(tauriApi.saveDevSettings).toBe(saveDevSettings);
      expect(tauriApi.createDevSession).toBe(createDevSession);
      expect(tauriApi.getDevSession).toBe(getDevSession);
      expect(tauriApi.endDevSession).toBe(endDevSession);
    });
  });
});
