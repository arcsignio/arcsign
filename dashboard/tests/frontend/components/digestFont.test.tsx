/**
 * The ERC-8213 digest is compared character by character against a second
 * device. Bare `monospace` resolves to a face that does not reliably
 * disambiguate 0/O or 1/l — the same class of problem as truncating the hash,
 * which CLAUDE.md already forbids for exactly this reason.
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DigestPanel } from "@/components/DigestPanel";

// digest is an object, not a string — see DecodedIntent["digest"] in
// src/services/clearsign/types.ts: { kind, primary, detail? }.
const DIGEST = {
  kind: "calldata" as const,
  primary: "0x" + "a1b2c3d4".repeat(8),
};

describe("digest typography", () => {
  it("uses the disambiguating mono stack, not bare monospace", () => {
    const { container } = render(<DigestPanel digest={DIGEST} raw="0xdeadbeef" />);

    // formatDigest regroups the 64 characters into space-separated quads, so
    // query the node by its style rather than by an exact string.
    const mono = [...container.querySelectorAll<HTMLElement>("[style*='font-family']")];
    expect(mono.length).toBeGreaterThan(0);

    for (const node of mono) {
      expect(node.style.fontFamily).not.toBe("monospace");
    }
    expect(mono.some((n) => n.style.fontFamily.includes("var(--font-mono)"))).toBe(true);
  });
});
