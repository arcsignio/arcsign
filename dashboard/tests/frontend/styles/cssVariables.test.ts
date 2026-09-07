/**
 * The variable layer is the single definition point for colour in this app —
 * Tailwind, CSS Modules, inline styles and the remaining <style> blocks all
 * resolve through it.
 *
 * A variable nobody consumes is the failure mode this project already hit
 * once: src/styles/tokens.ts shipped a full token set whose `numeric`, `font`,
 * `space` and `exactInputProps` exports had zero consumers, and whose only two
 * importers were themselves imported by nothing. These tests exist so the
 * variable layer cannot rot the same way.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const css = readFileSync(resolve(__dirname, "../../../src/index.css"), "utf8");

/** Every custom property declared in :root. */
function declaredVars(): string[] {
  const root = css.match(/:root\s*\{([\s\S]*?)\}/);
  if (!root) return [];
  return [...root[1].matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]);
}

describe("CSS variable layer", () => {
  it("declares a :root block", () => {
    expect(css).toMatch(/:root\s*\{/);
  });

  it("declares the semantic colour roles the app needs", () => {
    const vars = declaredVars();
    for (const name of [
      "--brand",
      "--brand-press",
      "--brand-accent",
      "--brand-pale",
      "--danger",
      "--danger-pale",
      "--danger-text",
      "--warning",
      "--warning-pale",
      "--warning-text",
      "--success",
      "--success-pale",
      "--success-text",
      "--text-primary",
      "--text-secondary",
      "--text-tertiary",
      "--border-default",
      "--border-input",
      "--surface-base",
      "--surface-sunken",
      "--surface-strong",
    ]) {
      expect(vars).toContain(name);
    }
  });

  // Semantic names, not colour names: a variable called --red cannot be
  // reassigned when the danger colour changes without lying about itself.
  it("names variables by role, not by hue", () => {
    for (const v of declaredVars()) {
      // Match the hue as a whole dash-delimited segment anywhere in the name.
      // `\b` alone anchors word boundaries, not segment boundaries, so it lets
      // compound names like --brand-teal through.
      expect(v).not.toMatch(
        /(^--|-)(red|green|blue|teal|gray|grey|slate|amber|indigo|purple)(-|$)/,
      );
    }
  });
});
