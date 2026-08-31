/**
 * WalletImport — mnemonic validation feedback.
 *
 * The textarea overrides the onChange/onBlur that `register` returns, so
 * react-hook-form only revalidates when setValue is told to. Without that, the
 * form keeps the verdict it reached for the PREVIOUS value and a corrected
 * phrase still shows "invalid checksum" — which reads as the app rejecting a
 * phrase the user can see is right.
 */

import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WalletImport } from "@/components/WalletImport";

// Published BIP39 test vectors (trezor/python-mnemonic vectors.json), used
// here only as form input. Never put a real recovery phrase in a test — it
// lands in git history, and history outlives any later rewrite.
const VALID =
  "legal winner thank year wave sausage worth useful legal winner thank yellow";
const VALID_ALT =
  "letter advice cage absurd amount doctor acoustic avoid letter advice cage above";

const textarea = () => screen.getByLabelText(/recoveryPhrase/i);
const checksumError = () =>
  screen.queryByText("validation.mnemonicInvalidChecksum");

describe("WalletImport mnemonic validation", () => {
  it("accepts a valid phrase", async () => {
    const user = userEvent.setup();
    render(<WalletImport usbPath="/tmp/usb" />);

    await user.click(textarea());
    await user.keyboard(VALID);
    await user.tab();

    await waitFor(() => expect(checksumError()).not.toBeInTheDocument());
  });

  // The regression: an error shown for an earlier value must not survive the
  // user fixing it.
  it("clears the error once the phrase is corrected", async () => {
    const user = userEvent.setup();
    render(<WalletImport usbPath="/tmp/usb" />);

    // One word swapped for another real wordlist entry -> checksum fails.
    await user.click(textarea());
    await user.keyboard(VALID.replace(/yellow$/, "yard"));
    await user.tab();
    await waitFor(() => expect(checksumError()).toBeInTheDocument());

    await user.clear(textarea());
    await user.click(textarea());
    await user.keyboard(VALID_ALT);
    await user.tab();

    await waitFor(() => expect(checksumError()).not.toBeInTheDocument());
  });
});
