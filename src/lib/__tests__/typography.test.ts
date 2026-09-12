import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { TYPOGRAPHY_FAMILIES, TYPOGRAPHY_USAGE } from "@wenyousite/foundation/typography";
import { FOUNDATION_FONT_VARIABLES } from "../typography";

describe("Foundation 系统字体映射", () => {
  test("三个角色都消费未加引号的通用家族并保留角色字重", () => {
    expect(FOUNDATION_FONT_VARIABLES).toEqual({
      "--wenyou-font-body-family": "system-ui, sans-serif",
      "--wenyou-font-display-family": "system-ui, sans-serif",
      "--wenyou-font-utility-family": "system-ui, sans-serif",
    });
    expect(Object.keys(TYPOGRAPHY_FAMILIES)).toEqual(["body", "display", "utility"]);
    expect(TYPOGRAPHY_USAGE.displayWeight).toBe(500);
    expect(TYPOGRAPHY_USAGE.listTitleWeight).toBe(600);
  });
  test("四个 Tailwind 字体入口映射同源角色，utility 保留等宽数字", () => {
    const css = readFileSync("src/app/globals.css", "utf8");
    expect(css).toContain(`--default-font-family: ${[TYPOGRAPHY_FAMILIES.body.family, ...TYPOGRAPHY_FAMILIES.body.fallback].join(", ")};`);
    for (const [token, role] of [["sans", "body"], ["display", "display"], ["rounded", "utility"], ["utility", "utility"]]) {
      expect(css).toContain(`--font-${token}: var(--wenyou-font-${role}-family)`);
    }
    expect(css.match(/\.font-utility\s*\{[^}]+\}/)?.[0]).toContain("font-variant-numeric: tabular-nums");
  });
});
