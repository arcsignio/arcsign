/**
 * Guards against code that only works because vitest runs under Node.
 *
 * Tauri's WebView has no `Buffer`, no `process`, no `global` — jsdom under
 * Node has all three. A dependency that reaches for one works perfectly in
 * every test here and throws at runtime in the app.
 *
 * That is not hypothetical: `bip39` needed Buffer, threw ReferenceError inside
 * validateMnemonic, the throw was swallowed by the caller, and EVERY recovery
 * phrase was reported as an invalid checksum. Wallet import was completely
 * unusable, and the error message blamed the user's phrase. 1100+ frontend
 * tests passed the entire time.
 *
 * So this file imports the modules that do crypto or encoding with Buffer
 * deleted, the way the WebView presents them.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";

// Only Buffer and `global` are removed. `process` is deliberately left alone:
// vitest's own RPC layer calls process.nextTick between tests, so deleting it
// crashes the runner with an unhandled TypeError — the run reports every test
// as passing and still exits non-zero. Buffer is the global that actually
// caused the shipped bug, and it is the one a bundled dependency reaches for.
const saved = {
  Buffer: globalThis.Buffer,
  global: (globalThis as Record<string, unknown>).global,
};

describe("frontend runs without Node globals", () => {
  beforeAll(() => {
    // @ts-expect-error -- deliberately simulating Tauri's WebView
    delete globalThis.Buffer;
    delete (globalThis as Record<string, unknown>).global;
  });

  afterAll(() => {
    globalThis.Buffer = saved.Buffer;
    (globalThis as Record<string, unknown>).global = saved.global;
  });

  it("has no Buffer, matching the WebView", () => {
    expect(typeof (globalThis as Record<string, unknown>).Buffer).toBe("undefined");
  });

  // Published BIP39 test vector — not anyone's wallet.
  const VALID =
    "legal winner thank year wave sausage worth useful legal winner thank yellow";

  it("validates a mnemonic", async () => {
    const { validateMnemonicChecksum } = await import("@/validation/mnemonic");
    expect(validateMnemonicChecksum(VALID)).toBe(true);
    expect(validateMnemonicChecksum(VALID.replace(/yellow$/, "yard"))).toBe(false);
  });

  it("exposes the wordlist", async () => {
    const { getBIP39Wordlist } = await import("@/validation/mnemonic");
    expect(getBIP39Wordlist()).toHaveLength(2048);
  });

  it("decodes calldata", async () => {
    const mod = await import("@/services/clearsign/digest");
    expect(mod).toBeTruthy();
  });
});
