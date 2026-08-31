/**
 * DeleteWalletDialog — normal and force-delete paths.
 *
 * Force delete exists for a forgotten wallet password, which would otherwise
 * leave the wallet on the USB permanently. It authorises with the app password
 * instead, so these tests cover the parts that keep it from becoming a way to
 * delete the wrong wallet by accident.
 *
 * The real gates are in Go (app password under the shared rate limiter, plus
 * an exact name match against stored data). What is asserted here is the UX
 * contract: which callback fires, with what, and that a near-miss name never
 * reaches the backend as a delete.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DeleteWalletDialog } from "@/components/DeleteWalletDialog";

const wallet = {
  id: "wallet-uuid-1",
  name: "My Savings",
  createdAt: "2026-01-01T00:00:00Z",
} as never;

function setup(overrides: Record<string, unknown> = {}) {
  const onConfirm = vi.fn().mockResolvedValue(undefined);
  const onForceConfirm = vi.fn().mockResolvedValue(undefined);
  const onClose = vi.fn();
  render(
    <DeleteWalletDialog
      wallet={wallet}
      isOpen
      onClose={onClose}
      onConfirm={onConfirm}
      onForceConfirm={onForceConfirm}
      isDeleting={false}
      error={null}
      {...overrides}
    />,
  );
  return { onConfirm, onForceConfirm, onClose };
}

const deleteButton = () =>
  screen.getByRole("button", { name: "deleteWallet.deleteButton" });
const switchLink = (key: string) => screen.getByRole("button", { name: key });

describe("DeleteWalletDialog", () => {
  beforeEach(() => vi.clearAllMocks());

  it("uses the wallet password path by default", async () => {
    const user = userEvent.setup();
    const { onConfirm, onForceConfirm } = setup();

    await user.type(
      screen.getByLabelText(/deleteWallet.enterPassword/),
      "WalletP@ssw0rd123",
    );
    await user.type(screen.getByLabelText(/deleteWallet.typeToConfirm/), "DELETE");
    await user.click(deleteButton());

    expect(onConfirm).toHaveBeenCalledWith("WalletP@ssw0rd123");
    expect(onForceConfirm).not.toHaveBeenCalled();
  });

  it("switches to the app-password path and sends the typed name", async () => {
    const user = userEvent.setup();
    const { onConfirm, onForceConfirm } = setup();

    await user.click(switchLink("deleteWallet.forgotPassword"));
    await user.type(
      screen.getByLabelText(/deleteWallet.enterAppPassword/),
      "AppP@ssw0rd456",
    );
    await user.type(screen.getByLabelText(/deleteWallet.typeToConfirm/), "My Savings");
    await user.click(deleteButton());

    expect(onForceConfirm).toHaveBeenCalledWith("AppP@ssw0rd456", "My Savings");
    expect(onConfirm).not.toHaveBeenCalled();
  });

  // The typed name is what stops a user deleting the wallet next to the one
  // they meant, so a genuinely different name must not submit.
  it.each(["My Saving", "My Savings 2", "Other Wallet"])(
    "does not submit force delete for a different name %j",
    async (typed) => {
      const user = userEvent.setup();
      const { onForceConfirm } = setup();

      await user.click(switchLink("deleteWallet.forgotPassword"));
      await user.type(
        screen.getByLabelText(/deleteWallet.enterAppPassword/),
        "AppP@ssw0rd456",
      );
      await user.type(screen.getByLabelText(/deleteWallet.typeToConfirm/), typed);

      expect(deleteButton()).toBeDisabled();
      expect(screen.getByText("deleteWallet.nameMismatch")).toBeInTheDocument();
      await user.click(deleteButton());
      expect(onForceConfirm).not.toHaveBeenCalled();
    },
  );

  // Must mirror the Go comparison. If the button stayed disabled here on input
  // the backend accepts, the user is blocked by the UI for no reason — which is
  // exactly what macOS autocapitalisation caused in live testing.
  it.each(["my savings", "MY SAVINGS", " My Savings ", "mY sAvInGs"])(
    "accepts case- and space-equivalent name %j",
    async (typed) => {
      const user = userEvent.setup();
      const { onForceConfirm } = setup();

      await user.click(switchLink("deleteWallet.forgotPassword"));
      await user.type(
        screen.getByLabelText(/deleteWallet.enterAppPassword/),
        "AppP@ssw0rd456",
      );
      await user.type(screen.getByLabelText(/deleteWallet.typeToConfirm/), typed);

      expect(deleteButton()).toBeEnabled();
      await user.click(deleteButton());
      expect(onForceConfirm).toHaveBeenCalledWith("AppP@ssw0rd456", typed);
    },
  );

  // A password typed for one mode is not the password the other wants, and
  // "DELETE" is not a wallet name. Carrying either across would let a user
  // submit credentials they did not mean for this gate.
  it("clears both fields when switching modes", async () => {
    const user = userEvent.setup();
    setup();

    await user.type(
      screen.getByLabelText(/deleteWallet.enterPassword/),
      "WalletP@ssw0rd123",
    );
    await user.type(screen.getByLabelText(/deleteWallet.typeToConfirm/), "DELETE");

    await user.click(switchLink("deleteWallet.forgotPassword"));

    expect(screen.getByLabelText(/deleteWallet.enterAppPassword/)).toHaveValue("");
    expect(screen.getByLabelText(/deleteWallet.typeToConfirm/)).toHaveValue("");
  });

  it("warns that the assets become unreachable in force mode", async () => {
    const user = userEvent.setup();
    setup();

    expect(
      screen.queryByText("deleteWallet.forceModeAssetsLost"),
    ).not.toBeInTheDocument();

    await user.click(switchLink("deleteWallet.forgotPassword"));

    expect(
      screen.getByText("deleteWallet.forceModeAssetsLost"),
    ).toBeInTheDocument();
  });

  it("renders nothing when closed or without a wallet", () => {
    const { container } = render(
      <DeleteWalletDialog
        wallet={null}
        isOpen
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        onForceConfirm={vi.fn()}
        isDeleting={false}
        error={null}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
