import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useSessionStore } from '@/stores/sessionStore';
import tauriApi from '@/services/tauri-api';

// Mock tauriApi
vi.mock('@/services/tauri-api', () => ({
  default: {
    createSession: vi.fn(),
    validateSession: vi.fn(),
    revokeSession: vi.fn(),
  },
}));

describe('sessionStore', () => {
  beforeEach(() => {
    // Reset store state between tests
    useSessionStore.setState({
      token: null,
      expiresAt: null,
      usbPath: null,
      isAuthenticating: false,
      error: null,
    });
    vi.clearAllMocks();
  });

  describe('Initial State', () => {
    it('starts with null token', () => {
      const state = useSessionStore.getState();
      expect(state.token).toBeNull();
    });

    it('starts with null expiresAt', () => {
      const state = useSessionStore.getState();
      expect(state.expiresAt).toBeNull();
    });

    it('starts with null usbPath', () => {
      const state = useSessionStore.getState();
      expect(state.usbPath).toBeNull();
    });

    it('starts not authenticating', () => {
      const state = useSessionStore.getState();
      expect(state.isAuthenticating).toBe(false);
    });

    it('starts with no error', () => {
      const state = useSessionStore.getState();
      expect(state.error).toBeNull();
    });
  });

  describe('createSession', () => {
    it('sets token on successful creation', async () => {
      const mockResponse = {
        token: 'test-token-abc123',
        expiresAt: Math.floor(Date.now() / 1000) + 86400,
        usbPath: '/dev/usb0',
      };
      vi.mocked(tauriApi.createSession).mockResolvedValue(mockResponse);

      await useSessionStore.getState().createSession('/dev/usb0', 'TestPassword123!');

      const state = useSessionStore.getState();
      expect(state.token).toBe('test-token-abc123');
      expect(state.expiresAt).toBe(mockResponse.expiresAt);
      expect(state.usbPath).toBe('/dev/usb0');
      expect(state.isAuthenticating).toBe(false);
      expect(state.error).toBeNull();
    });

    it('sets isAuthenticating during creation', async () => {
      let resolvePromise: (value: any) => void;
      const pendingPromise = new Promise((resolve) => { resolvePromise = resolve; });
      vi.mocked(tauriApi.createSession).mockReturnValue(pendingPromise as any);

      const promise = useSessionStore.getState().createSession('/dev/usb0', 'TestPassword123!');

      expect(useSessionStore.getState().isAuthenticating).toBe(true);

      resolvePromise!({
        token: 'token',
        expiresAt: Math.floor(Date.now() / 1000) + 86400,
        usbPath: '/dev/usb0',
      });
      await promise;

      expect(useSessionStore.getState().isAuthenticating).toBe(false);
    });

    it('sets error on failed creation', async () => {
      vi.mocked(tauriApi.createSession).mockRejectedValue(new Error('Invalid password'));

      await expect(
        useSessionStore.getState().createSession('/dev/usb0', 'wrong')
      ).rejects.toThrow('Invalid password');

      const state = useSessionStore.getState();
      expect(state.token).toBeNull();
      expect(state.error).toBe('Invalid password');
      expect(state.isAuthenticating).toBe(false);
    });

    it('handles non-Error rejection', async () => {
      vi.mocked(tauriApi.createSession).mockRejectedValue('string error');

      await expect(
        useSessionStore.getState().createSession('/dev/usb0', 'wrong')
      ).rejects.toThrow('Failed to create session');

      expect(useSessionStore.getState().error).toBe('Failed to create session');
    });
  });

  describe('validateSession', () => {
    it('returns true for valid session', async () => {
      const futureExpiry = Math.floor(Date.now() / 1000) + 86400;
      useSessionStore.setState({ token: 'valid-token', expiresAt: futureExpiry });

      vi.mocked(tauriApi.validateSession).mockResolvedValue({
        valid: true,
        usbPath: '/dev/usb0',
        expiresAt: futureExpiry,
      });

      const result = await useSessionStore.getState().validateSession();
      expect(result).toBe(true);
    });

    it('returns false when no token exists', async () => {
      useSessionStore.setState({ token: null });

      const result = await useSessionStore.getState().validateSession();
      expect(result).toBe(false);
      expect(tauriApi.validateSession).not.toHaveBeenCalled();
    });

    it('clears session when backend says invalid', async () => {
      useSessionStore.setState({ token: 'expired-token', expiresAt: 100 });

      vi.mocked(tauriApi.validateSession).mockResolvedValue({
        valid: false,
        usbPath: '',
        expiresAt: 0,
      });

      const result = await useSessionStore.getState().validateSession();
      expect(result).toBe(false);
      expect(useSessionStore.getState().token).toBeNull();
    });

    it('clears session on API error', async () => {
      useSessionStore.setState({ token: 'some-token', expiresAt: 999 });

      vi.mocked(tauriApi.validateSession).mockRejectedValue(new Error('Network error'));

      const result = await useSessionStore.getState().validateSession();
      expect(result).toBe(false);
      expect(useSessionStore.getState().token).toBeNull();
    });
  });

  describe('revokeSession', () => {
    it('clears session state after revoke', async () => {
      useSessionStore.setState({
        token: 'active-token',
        expiresAt: Math.floor(Date.now() / 1000) + 86400,
        usbPath: '/dev/usb0',
      });

      vi.mocked(tauriApi.revokeSession).mockResolvedValue({ revoked: true });

      await useSessionStore.getState().revokeSession();

      const state = useSessionStore.getState();
      expect(state.token).toBeNull();
      expect(state.expiresAt).toBeNull();
      expect(state.usbPath).toBeNull();
    });

    it('clears session even if revoke API fails', async () => {
      useSessionStore.setState({ token: 'token', expiresAt: 999, usbPath: '/dev/usb0' });

      vi.mocked(tauriApi.revokeSession).mockRejectedValue(new Error('API down'));

      await useSessionStore.getState().revokeSession();

      expect(useSessionStore.getState().token).toBeNull();
    });

    it('handles revoke with no token', async () => {
      useSessionStore.setState({ token: null });

      await useSessionStore.getState().revokeSession();

      expect(tauriApi.revokeSession).not.toHaveBeenCalled();
    });
  });

  describe('clearSession', () => {
    it('clears all session fields', () => {
      useSessionStore.setState({
        token: 'token',
        expiresAt: 999,
        usbPath: '/path',
        error: 'some error',
      });

      useSessionStore.getState().clearSession();

      const state = useSessionStore.getState();
      expect(state.token).toBeNull();
      expect(state.expiresAt).toBeNull();
      expect(state.usbPath).toBeNull();
      expect(state.error).toBeNull();
    });
  });

  describe('isSessionValid', () => {
    it('returns false when no token', () => {
      useSessionStore.setState({ token: null, expiresAt: null });
      expect(useSessionStore.getState().isSessionValid()).toBe(false);
    });

    it('returns false when token expired', () => {
      const pastExpiry = Math.floor(Date.now() / 1000) - 100;
      useSessionStore.setState({ token: 'token', expiresAt: pastExpiry });
      expect(useSessionStore.getState().isSessionValid()).toBe(false);
    });

    it('returns false when expiring within 1 minute buffer', () => {
      const nearExpiry = Math.floor(Date.now() / 1000) + 30; // 30 seconds from now
      useSessionStore.setState({ token: 'token', expiresAt: nearExpiry });
      expect(useSessionStore.getState().isSessionValid()).toBe(false);
    });

    it('returns true for valid future token', () => {
      const futureExpiry = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
      useSessionStore.setState({ token: 'valid-token', expiresAt: futureExpiry });
      expect(useSessionStore.getState().isSessionValid()).toBe(true);
    });

    it('clears session when expired token detected', () => {
      const pastExpiry = Math.floor(Date.now() / 1000) - 100;
      useSessionStore.setState({ token: 'expired-token', expiresAt: pastExpiry });

      useSessionStore.getState().isSessionValid();

      expect(useSessionStore.getState().token).toBeNull();
    });
  });

  describe('getToken', () => {
    it('returns token when session is valid', () => {
      const futureExpiry = Math.floor(Date.now() / 1000) + 3600;
      useSessionStore.setState({ token: 'my-token', expiresAt: futureExpiry });
      expect(useSessionStore.getState().getToken()).toBe('my-token');
    });

    it('returns null when session is expired', () => {
      const pastExpiry = Math.floor(Date.now() / 1000) - 100;
      useSessionStore.setState({ token: 'expired-token', expiresAt: pastExpiry });
      expect(useSessionStore.getState().getToken()).toBeNull();
    });

    it('returns null when no token', () => {
      useSessionStore.setState({ token: null, expiresAt: null });
      expect(useSessionStore.getState().getToken()).toBeNull();
    });
  });
});
