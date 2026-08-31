/**
 * Mnemonic validation.
 *
 * These exist because of a shipped bug: the `bip39` package needs Node's
 * Buffer, which Tauri's WebView does not provide. validateMnemonic threw
 * ReferenceError, the throw was swallowed, and every phrase — including
 * correct ones — was reported as "invalid checksum". Import was unusable and
 * the message blamed the user's phrase.
 *
 * The unit tests below passed throughout, because vitest runs under Node where
 * Buffer exists. So the important one is `does not depend on Node globals`:
 * it removes Buffer the way the WebView does.
 */

import { describe, it, expect, afterEach } from "vitest";
import {
  validateMnemonicChecksum,
  normalizeMnemonic,
  getBIP39Wordlist,
} from "@/validation/mnemonic";

// Published BIP39 test vectors — not anyone's wallet.
const VALID_12 =
  "legal winner thank year wave sausage worth useful legal winner thank yellow";
const VALID_24 =
  "legal winner thank year wave sausage worth useful legal winner thank year wave sausage worth useful legal winner thank year wave sausage worth title";

describe("validateMnemonicChecksum", () => {
  it("accepts valid phrases", () => {
    expect(validateMnemonicChecksum(VALID_12)).toBe(true);
    expect(validateMnemonicChecksum(VALID_24)).toBe(true);
  });

  it("rejects a phrase whose checksum does not match", () => {
    // Swap the last word for another real wordlist entry.
    const wrong = VALID_12.replace(/yellow$/, "yard");
    expect(validateMnemonicChecksum(wrong)).toBe(false);
  });

  it("rejects a phrase containing a non-wordlist word", () => {
    expect(validateMnemonicChecksum(VALID_12.replace("legal", "zzzz"))).toBe(false);
  });

  it("does not throw on junk input", () => {
    expect(() => validateMnemonicChecksum("")).not.toThrow();
    expect(() => validateMnemonicChecksum("not a phrase")).not.toThrow();
  });

  // The regression. Node provides Buffer; Tauri's WebView does not. A library
  // that reaches for it works in this test suite and fails in the app, which
  // is exactly how the bug reached a user.
  describe("does not depend on Node globals", () => {
    const savedBuffer = globalThis.Buffer;
    const savedProcess = globalThis.process;

    afterEach(() => {
      globalThis.Buffer = savedBuffer;
      globalThis.process = savedProcess;
    });

    it("validates with Buffer and process removed", () => {
      // @ts-expect-error -- deliberately simulating the WebView environment
      delete globalThis.Buffer;
      // @ts-expect-error -- same
      delete globalThis.process;

      expect(validateMnemonicChecksum(VALID_12)).toBe(true);
      expect(validateMnemonicChecksum(VALID_12.replace(/yellow$/, "yard"))).toBe(false);
    });
  });
});

describe("getBIP39Wordlist", () => {
  it("returns the full English wordlist", () => {
    const list = getBIP39Wordlist();
    expect(list).toHaveLength(2048);
    expect(list[0]).toBe("abandon");
    expect(list[2047]).toBe("zoo");
  });
});

describe("normalizeMnemonic", () => {
  it("collapses case and whitespace", () => {
    expect(normalizeMnemonic("  LEGAL   winner\nthank  ")).toBe("legal winner thank");
  });

  // Copying from another wallet carries characters that are invisible on
  // screen but are not whitespace: the words look right, the checksum fails.
  it("strips zero-width and bidi characters", () => {
    const withInvisible = VALID_12.split(" ").map((w) => w + "​").join(" ");
    expect(validateMnemonicChecksum("‎" + withInvisible)).toBe(true);
  });

  // Wallets show the phrase as a numbered list and selecting it copies the
  // numbers too.
  it("strips list numbering and stray punctuation", () => {
    const numbered = VALID_12.split(" ").map((w, i) => `${i + 1}. ${w}`).join(" ");
    expect(validateMnemonicChecksum(numbered)).toBe(true);
    expect(validateMnemonicChecksum(VALID_12 + ".")).toBe(true);
  });
});
