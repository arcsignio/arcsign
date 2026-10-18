import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// speed-${speed} 這種字串拼接在 CSS Modules 下會拼出對不到任何規則的類名，
// 三種速度的指示點會變成同一個顏色——而且沒有任何既有斷言會失敗。
//
// 這裡直接讀 CSS 檔，不 import module：vitest 對 CSS Modules 的任何鍵都會
// 合成一個雜湊字串回傳（連 styles.totallyBogusName 都有值），所以
// 「import 後斷言不為空」永遠會過，測不到規則是否存在。
describe("SendTransaction 手續費速度指示點", () => {
  const css = readFileSync(
    resolve(__dirname, "../../../src/components/SendTransaction.module.css"),
    "utf-8",
  );

  it.each(["speedSlow", "speedNormal", "speedFast"])(
    ".%s 有定義背景色",
    (name) => {
      const rule = css.match(new RegExp(`\\.${name}\\s*\\{([^}]*)\\}`));
      expect(rule, `.${name} 規則不存在`).not.toBeNull();
      expect(rule![1]).toMatch(/background/);
    },
  );

  it("三種速度用不同顏色", () => {
    const colors = ["speedSlow", "speedNormal", "speedFast"].map(
      (n) => css.match(new RegExp(`\\.${n}\\s*\\{([^}]*)\\}`))![1].trim(),
    );
    expect(new Set(colors).size).toBe(3);
  });
});
