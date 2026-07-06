import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

// ── Mocks (must precede the hook import) ──────────────────────────────────────
// tauriApi is a default export in @/services/tauri-api; mirror that shape here.
vi.mock("@/services/tauri-api", () => ({
  default: {
    loadAddresses: vi.fn(),
    getTokenBalances: vi.fn(),
    validatePassphrase: vi.fn(),
  },
}));

// Session / WalletConnect deps: the hook obtains these via context hooks/stores
// exactly like the component does (useAppPassword / useWalletSessionStore /
// useWalletConnect). Mock those sources so the hook runs headless.
vi.mock("@/contexts/AppPasswordContext", () => ({
  useAppPassword: vi.fn(() => ({ getSessionToken: () => "session-token" })),
}));
vi.mock("@/stores/walletSessionStore", () => ({
  useWalletSessionStore: vi.fn(() => ({ createWalletSession: vi.fn().mockResolvedValue(undefined) })),
}));
vi.mock("@/contexts/WalletConnectContext", () => ({
  useWalletConnect: vi.fn(() => ({ setWalletContext: vi.fn() })),
}));

import tauriApi from "@/services/tauri-api";
import { useWalletData } from "@/hooks/useWalletData";

const baseParams = { wallet: { id: "w1", has_passphrase: false } as any, usbPath: "/usb" };

describe("useWalletData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-arm resolved values after clearAllMocks (which wipes implementations).
    vi.mocked(tauriApi.loadAddresses).mockResolvedValue({
      addresses: [
        { name: "Ethereum", symbol: "ETH", coin_type: 60, address: "0xabc", is_testnet: false },
      ],
    } as any);
    vi.mocked(tauriApi.getTokenBalances).mockResolvedValue({
      tokens: [],
      totalUsd: 0,
      unavailableProviders: [],
    } as any);
    vi.mocked(tauriApi.validatePassphrase).mockResolvedValue({
      valid: true,
      expectedAddress: "0xabc",
      derivedAddress: "0xabc",
    } as any);
  });

  it("unlock: 無 passphrase 錢包 → 直接載入餘額、關密碼提示", async () => {
    const { result } = renderHook(() => useWalletData(baseParams));
    act(() => result.current.actions.setTempPassword("pw"));
    await act(async () => {
      await result.current.actions.unlock();
    });
    await waitFor(() => expect(result.current.state.showPasswordPrompt).toBe(false));
    expect(result.current.state.isLoading).toBe(false);
  });

  it("unlock: 有 passphrase 錢包 → 停在 passphrase 提示，不載入餘額", async () => {
    const { result } = renderHook(() =>
      useWalletData({ ...baseParams, wallet: { id: "w1", has_passphrase: true } as any })
    );
    act(() => result.current.actions.setTempPassword("pw"));
    await act(async () => {
      await result.current.actions.unlock();
    });
    await waitFor(() => expect(result.current.state.showPassphrasePrompt).toBe(true));
  });

  it("validatePassphrase: 通過 → 設 validatedPassphrase 並載入餘額", async () => {
    const { result } = renderHook(() =>
      useWalletData({ ...baseParams, wallet: { id: "w1", has_passphrase: true } as any })
    );
    act(() => result.current.actions.setPassphrase("my-secret"));
    await act(async () => {
      await result.current.actions.validatePassphrase();
    });
    await waitFor(() => expect(result.current.state.validatedPassphrase).toBe("my-secret"));
  });

  it("refresh: 重新載入餘額（isRefreshing 收尾為 false）", async () => {
    const { result } = renderHook(() => useWalletData(baseParams));
    // refresh needs a prior password in the ref; unlock first (no-passphrase wallet).
    act(() => result.current.actions.setTempPassword("pw"));
    await act(async () => {
      await result.current.actions.unlock();
    });
    await act(async () => {
      await result.current.actions.refresh();
    });
    await waitFor(() => expect(result.current.state.isRefreshing).toBe(false));
  });
});
