/**
 * i18n integrity guards.
 *
 * Two failures shipped to users before these existed:
 *
 *   1. The address book rendered raw keys on every screen, because the
 *      component said `addressBook.labelName` while the locale file said
 *      `addressBook.name`. Both were written in the same commit and never
 *      matched. A missing translation is silent at build time and silent at
 *      runtime — i18next just echoes the key back.
 *
 *   2. Components bypassed t() entirely and hardcoded English, so a
 *      Traditional Chinese user saw English strings that no locale file could
 *      ever fix.
 *
 * These tests turn both classes of bug into build failures.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import en from "@/locales/en/common.json";
import zhTW from "@/locales/zh-TW/common.json";

const SRC = join(__dirname, "../../../src");

function walkFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walkFiles(full, out);
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

/** Flatten {a:{b:"x"}} to {"a.b":"x"}. */
function flatten(obj: unknown, prefix = "", out: Record<string, string> = {}) {
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object") flatten(v, key, out);
    else out[key] = String(v);
  }
  return out;
}

const EN = flatten(en);
const ZH = flatten(zhTW);
const FILES = walkFiles(SRC);

interface KeyUse {
  key: string;
  file: string;
  /** t("k", "English fallback") degrades to English; t("k") shows "k". */
  hasDefault: boolean;
}

/** Every t("...") key referenced anywhere in src/. */
function referencedKeys(): KeyUse[] {
  const uses: KeyUse[] = [];
  for (const file of FILES) {
    const src = readFileSync(file, "utf8");
    // Only literal keys — t(someVar) cannot be checked statically.
    // i18next takes a default two ways, and both must count: the positional
    // t("k", "English") and the options-object t("k", { defaultValue }).
    for (const m of src.matchAll(
      /\bt\(\s*["'`]([a-zA-Z][\w.]*)["'`]\s*(,\s*(?:["'`]|\{[^}]*\bdefaultValue\b))?/g,
    )) {
      uses.push({
        key: m[1],
        file: relative(SRC, file),
        hasDefault: Boolean(m[2]),
      });
    }
  }
  return uses;
}

describe("locale integrity", () => {
  // The worst failure mode: the user sees "mnemonic.neverShare" where a
  // security warning belongs. Nothing in the build catches this — i18next
  // echoes the key back and carries on.
  it("defines every key called without a fallback", () => {
    const broken = referencedKeys()
      .filter((u) => !u.hasDefault && !(u.key in EN))
      .map((u) => `${u.key}  (${u.file})`);
    expect(
      broken,
      `t() called with no locale entry and no defaultValue — the raw key ` +
        `string renders to the user:\n  ${broken.join("\n  ")}`,
    ).toEqual([]);
  });

  // Less severe but still wrong: these render English to a zh-TW user.
  it("defines every key called with an English fallback", () => {
    const untranslated = referencedKeys()
      .filter((u) => u.hasDefault && !(u.key in EN))
      .map((u) => `${u.key}  (${u.file})`);
    expect(
      untranslated,
      `t(key, "English") with no locale entry — readable, but never ` +
        `translated for non-English users:\n  ${untranslated.join("\n  ")}`,
    ).toEqual([]);
  });

  it("keeps en and zh-TW structurally identical", () => {
    const enKeys = Object.keys(EN).sort();
    const zhKeys = Object.keys(ZH).sort();
    const onlyEn = enKeys.filter((k) => !(k in ZH));
    const onlyZh = zhKeys.filter((k) => !(k in EN));
    expect(
      { onlyEn, onlyZh },
      "a key present in one language but not the other falls back to the " +
        "other language's text, which reads as an untranslated string",
    ).toEqual({ onlyEn: [], onlyZh: [] });
  });

  it("has no untranslated zh-TW values left as English placeholders", () => {
    // A zh-TW value identical to its English counterpart is usually a
    // copy-paste that was never translated. Proper nouns and symbols are
    // legitimately identical, so only flag multi-word Latin-script text.
    const suspicious = Object.keys(EN).filter((k) => {
      const e = EN[k];
      const z = ZH[k];
      if (e !== z) return false;
      if (!/[a-zA-Z]/.test(z)) return false;
      // Single tokens are usually proper nouns (Alchemy, ERC-20, Gas).
      return z.trim().split(/\s+/).length > 2;
    });
    expect(
      suspicious,
      `zh-TW values identical to English:\n  ${suspicious
        .map((k) => `${k} = ${ZH[k]}`)
        .join("\n  ")}`,
    ).toEqual([]);
  });
});
