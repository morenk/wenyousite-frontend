import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import manifest from "../fancy-manifest.json";
import { describe, expect, test, vi } from "vitest";
import { DEFAULT_FANCY_STYLE, FANCY_STYLES, fancyText, isFancyStyle } from "../fancy";
import fixtures from "../fancy-fixtures.json";

describe("花体跨端固定向量", () => {
  test.each(fixtures.cases)("$id", ({ input, styleId, expected }) => {
    expect(fancyText(input, styleId)).toBe(expected);
  });
  test("共享文件摘要与实际内容一致，预览确为转换结果", () => {
    for (const file of manifest.files) {
      expect(createHash("sha256").update(readFileSync(resolve(file.path))).digest("hex")).toBe(file.sha256);
    }
    for (const style of FANCY_STYLES) {
      expect(fancyText(style.category === "font" ? "Abc123" : "温油 Abc", style.id)).toBe(style.preview);
    }
  });
  test("40 种稳定样式、两类各 20 种，默认花体", () => {
    expect(FANCY_STYLES).toHaveLength(40);
    expect(new Set(FANCY_STYLES.map((style) => style.id)).size).toBe(40);
    expect(FANCY_STYLES.filter((style) => style.category === "font")).toHaveLength(20);
    expect(FANCY_STYLES.filter((style) => style.category === "decoration")).toHaveLength(20);
    expect(DEFAULT_FANCY_STYLE).toBe("script");
    const samples = FANCY_STYLES.map((style) => fancyText("Abc XYZ 123 温油", style.id));
    expect(new Set(samples).size).toBe(40);
    for (const style of FANCY_STYLES) for (const value of Object.values(style.mapping ?? {})) {
      expect(value).not.toMatch(/[\p{Cn}\p{Cs}]/u);
    }
  });
  test("保留旧样式组合重音转换，跳过键帽与 emoji", () => {
    expect(fancyText("é Ä 👩🏽‍💻 1️⃣", "bold")).toBe("𝐞́ 𝐀̈ 👩🏽‍💻 1️⃣");
    expect(fancyText("中é é Ä 👩🏽‍💻 1️⃣", "underline")).toBe("中é é Ä 👩🏽‍💻 1️⃣");
    expect(fancyText("QqXx", "small-caps")).toBe("QqXx");
    expect(fancyText("Qq", "superscript")).toBe("Qq");
    expect(fancyText("BCDFGQYZ", "subscript")).toBe("BCDFGQYZ");
  });
  test("UTF-16 上限、未知样式与缺少完整字符处理显式报错", () => {
    expect(fancyText("中".repeat(10000), "stars")).toHaveLength(10004);
    expect(() => fancyText("a".repeat(10001), "bold")).toThrow("10,000");
    expect(() => fancyText("👩".repeat(5001), "stars")).toThrow("10,000");
    expect(isFancyStyle("unknown")).toBe(false);
    expect(isFancyStyle("script")).toBe(true);
    expect(() => fancyText("", "unknown")).toThrow("有效");
    const original = Intl.Segmenter;
    vi.stubGlobal("Intl", { ...Intl, Segmenter: undefined });
    try { expect(() => fancyText("a", "bold")).toThrow("升级"); }
    finally { vi.unstubAllGlobals(); }
    expect(Intl.Segmenter).toBe(original);
  });
});
