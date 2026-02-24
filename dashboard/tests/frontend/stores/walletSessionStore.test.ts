import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useWalletSessionStore } from '@/stores/walletSessionStore';
import tauriApi from '@/services/tauri-api';

vi.mock('@/services/tauri-api', () => ({
  default: {
    createWalletSession: vi.fn(),
    validateWalletSession: vi.fn(),
    revokeWalletSession: vi.fn(),
  },
}));

describe('walletSessionStore', () => {
  beforeEach(() => {
    useWalletSessionStore.setState({
      tokens: new Map(),
      expirations: new Map(),
      usbPaths: new Map(),
      isAuthenticating: false,
      error: null,
    });
    vi.clearAllMocks();
  });

  describe('Initial State', () => {
    it('starts with empty tokens map', () => {
      expect(useWalletSessionStore.getState().tokens.size).toBe(0);
    });

    it('starts not authenticating', () => {
      expect(useWalletSessionStore.getState().isAuthenticating).toBe(false);
    });

    it('starts with no error', () => {
      expect(useWalletSessionStore.getState().error).toBeNull();
    });
  });

  describe('createWalletSession', () => {
    it('stores token for wallet on success', async () => {
      const futureExpiry = Math.floor(Date.now() / 1000) + 900; // 15 min
      vi.mocked(tauriApi.createWalletSession).mockResolvedValue({
        token: 'wallet-token-123',
        walletId: 'wallet-1',
        expiresAt: futureExpiry,
        usbPath: '/dev/usb0',
      });

      await useWalletSessionStore.getState().createWalletSession(
        'wallet-1', 'password123', '/dev/usb0'
      );

      const state = useWalletSessionStore.getState();
      expect(state.tokens.get('wallet-1')).toBe('wallet-token-123');
      expect(state.expirations.get('wallet-1')).toBe(futureExpiry);
      expect(state.usbPaths.get('wallet-1')).toBe('/dev/usb0');
      expect(state.isAuthenticating).toBe(false);
      expect(state.error).toBeNull();
    });

    it('sets error on failure', async () => {
      vi.mocked(tauriApi.createWalletSession).mockRejectedValue(
        new Error('Wrong password')
      );

      await expect(
        useWalletSessionStore.getState().createWalletSession('w1', 'bad', '/usb')
      ).rejects.toThrow('Wrong password');

      expect(useWalletSessionStore.getState().error).toBe('Wrong password');
      expect(useWalletSessionStore.getState().isAuthenticating).toBe(false);
    });

    it('manages multiple wallet sessions independently', async () => {
      const futureExpiry = Math.floor(Date.now() / 1000) + 900;

      vi.mocked(tauriApi.createWalletSession)
        .mockResolvedValueOnce({
          token: 'token-w1',
          walletId: 'w1',
          expiresAt: futureExpiry,
          usbPath: '/dev/usb0',
        })
        .mockResolvedValueOnce({
          token: 'token-w2',
          walletId: 'w2',
          expiresAt: futureExpiry + 100,
          usbPath: '/dev/usb0',
        });

      await useWalletSessionStore.getState().createWalletSession('w1', 'pass1', '/dev/usb0');
      await useWalletSessionStore.getState().createWalletSession('w2', 'pass2', '/dev/usb0');

      const state = useWalletSessionStore.getState();
      expect(state.tokens.get('w1')).toBe('token-w1');
      expect(state.tokens.get('w2')).toBe('token-w2');
    });
  });

  describe('validateWalletSession', () => {
    it('returns true for valid session', async () => {
      const futureExpiry = Math.floor(Date.now() / 1000) + 900;
      const tokens = new Map([['w1', 'valid-token']]);
      const expirations = new Map([['w1', futureExpiry]]);
      useWalletSessionStore.setState({ tokens, expirations });

      vi.mocked(tauriApi.validateWalletSession).mockResolvedValue({
        valid: true,
        walletId: 'w1',
        expiresAt: futureExpiry,
        usbPath: '/dev/usb0',
      });

      const result = await useWalletSessionStore.getState().validateWalletSession('w1');
      expect(result).toBe(true);
    });

    it('returns false when no token for wallet', async () => {
      const result = await useWalletSessionStore.getState().validateWalletSession('w1');
      expect(result).toBe(false);
      expect(tauriApi.validateWalletSession).not.toHaveBeenCalled();
    });

    it('clears session on invalid response', async () => {
      const tokens = new Map([['w1', 'expired-token']]);
      useWalletSessionStore.setState({ tokens });

      vi.mocked(tauriApi.validateWalletSession).mockResolvedValue({
        valid: false,
        walletId: 'w1',
        expiresAt: 0,
        usbPath: '',
      });

      const result = await useWalletSessionStore.getState().validateWalletSession('w1');
      expect(result).toBe(false);
      expect(useWalletSessionStore.getState().tokens.has('w1')).toBe(false);
    });

    it('clears session on API error', async () => {
      const tokens = new Map([['w1', 'token']]);
      useWalletSessionStore.setState({ tokens });

      vi.mocked(tauriApi.validateWalletSession).mockRejectedValue(new Error('timeout'));

      const result = await useWalletSessionStore.getState().validateWalletSession('w1');
      expect(result).toBe(false);
      expect(useWalletSessionStore.getState().tokens.has('w1')).toBe(false);
    });
  });

  describe('revokeWalletSession', () => {
    it('clears wallet session after revoke', async () => {
      const tokens = new Map([['w1', 'token-123']]);
      const expirations = new Map([['w1', 999]]);
      const usbPaths = new Map([['w1', '/dev/usb0']]);
      useWalletSessionStore.setState({ tokens, expirations, usbPaths });

      vi.mocked(tauriApi.revokeWalletSession).mockResolvedValue({ revoked: true });

      await useWalletSessionStore.getState().revokeWalletSession('w1');

      const state = useWalletSessionStore.getState();
      expect(state.tokens.has('w1')).toBe(false);
      expect(state.expirations.has('w1')).toBe(false);
      expect(state.usbPaths.has('w1')).toBe(false);
    });

    it('clears session even if revoke API fails', async () => {
      const tokens = new Map([['w1', 'token']]);
      useWalletSessionStore.setState({ tokens });

      vi.mocked(tauriApi.revokeWalletSession).mockRejectedValue(new Error('fail'));

      await useWalletSessionStore.getState().revokeWalletSession('w1');

      expect(useWalletSessionStore.getState().tokens.has('w1')).toBe(false);
    });

    it('handles revoke for non-existent session', async () => {
      await useWalletSessionStore.getState().revokeWalletSession('nonexistent');
      expect(tauriApi.revokeWalletSession).not.toHaveBeenCalled();
    });
  });

  describe('clearWalletSession', () => {
    it('removes all data for a specific wallet', () => {
      const tokens = new Map([['w1', 't1'], ['w2', 't2']]);
      const expirations = new Map([['w1', 100], ['w2', 200]]);
      const usbPaths = new Map([['w1', '/u1'], ['w2', '/u2']]);
      useWalletSessionStore.setState({ tokens, expirations, usbPaths });

      useWalletSessionStore.getState().clearWalletSession('w1');

      const state = useWalletSessionStore.getState();
      expect(state.tokens.has('w1')).toBe(false);
      expect(state.tokens.get('w2')).toBe('t2');
    });
  });

  describe('isWalletSessionValid', () => {
    it('returns false when no token', () => {
      expect(useWalletSessionStore.getState().isWalletSessionValid('w1')).toBe(false);
    });

    it('returns false when expired', () => {
      const pastExpiry = Math.floor(Date.now() / 1000) - 100;
      const tokens = new Map([['w1', 'token']]);
      const expirations = new Map([['w1', pastExpiry]]);
      useWalletSessionStore.setState({ tokens, expirations });

      expect(useWalletSessionStore.getState().isWalletSessionValid('w1')).toBe(false);
    });

    it('returns false when expiring within 1 minute buffer', () => {
      const nearExpiry = Math.floor(Date.now() / 1000) + 30; // 30 seconds
      const tokens = new Map([['w1', 'token']]);
      const expirations = new Map([['w1', nearExpiry]]);
      useWalletSessionStore.setState({ tokens, expirations });

      expect(useWalletSessionStore.getState().isWalletSessionValid('w1')).toBe(false);
    });

    it('returns true for valid session', () => {
      const futureExpiry = Math.floor(Date.now() / 1000) + 900;
      const tokens = new Map([['w1', 'valid']]);
      const expirations = new Map([['w1', futureExpiry]]);
      useWalletSessionStore.setState({ tokens, expirations });

      expect(useWalletSessionStore.getState().isWalletSessionValid('w1')).toBe(true);
    });
  });

  describe('getWalletToken', () => {
    it('returns token when session is valid', () => {
      const futureExpiry = Math.floor(Date.now() / 1000) + 900;
      const tokens = new Map([['w1', 'my-token']]);
      const expirations = new Map([['w1', futureExpiry]]);
      useWalletSessionStore.setState({ tokens, expirations });

      expect(useWalletSessionStore.getState().getWalletToken('w1')).toBe('my-token');
    });

    it('returns null when session is invalid', () => {
      expect(useWalletSessionStore.getState().getWalletToken('w1')).toBeNull();
    });
  });

  describe('revokeAllSessions', () => {
    it('revokes all wallet sessions', async () => {
      const tokens = new Map([['w1', 't1'], ['w2', 't2']]);
      const expirations = new Map([['w1', 100], ['w2', 200]]);
      useWalletSessionStore.setState({ tokens, expirations });

      vi.mocked(tauriApi.revokeWalletSession).mockResolvedValue({ revoked: true });

      await useWalletSessionStore.getState().revokeAllSessions();

      const state = useWalletSessionStore.getState();
      expect(state.tokens.size).toBe(0);
      expect(state.expirations.size).toBe(0);
    });
  });
});
