import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import manifest from "../fancy-manifest.json";
import { describe, expect, test, vi } from "vitest";
import { DEFAULT_FANCY_STYLE, FANCY_CATEGORIES, FANCY_MARK_LIMIT, FANCY_OUTPUT_LIMIT, FANCY_STYLES, fancyText, isFancyStyle } from "../fancy";
import fixtures from "../fancy-fixtures.json";

describe("花体跨端固定向量", () => {
  test.each(fixtures.cases)("$id", ({ input, styleId, expected }) => {
    expect(fancyText(input, styleId)).toBe(expected);
  });
  test("共享文件摘要与实际内容一致，预览确为转换结果", () => {
    for (const file of manifest.files) {
      expect(createHash("sha256").update(readFileSync(resolve(file.path))).digest("hex")).toBe(file.sha256);
    }
    expect(new Set(FANCY_STYLES.map((style) => style.previewInput))).toEqual(new Set(["Hello Wenyou"]));
    for (const style of FANCY_STYLES) {
      expect(fancyText(style.previewInput, style.id)).toBe(style.preview);
    }
  });
  test("保留原样式并按实际字体、符号字形、特效和边饰分组", () => {
    expect(FANCY_STYLES).toHaveLength(49);
    expect(new Set(FANCY_STYLES.map((style) => style.id)).size).toBe(FANCY_STYLES.length);
    expect(FANCY_CATEGORIES.map((item) => item.id)).toEqual(["font", "symbol", "effect", "decoration"]);
    expect(FANCY_STYLES.filter((style) => style.category === "symbol").map((style) => style.id)).toEqual(["pseudo-script", "pseudo-fraktur", "glitch", "bubble-pseudo", "radicals", "cursed"]);
    expect(FANCY_STYLES.filter((style) => style.category === "decoration")).toHaveLength(16);
    expect(DEFAULT_FANCY_STYLE).toBe("script");
    const samples = FANCY_STYLES.map((style) => fancyText("Abc XYZ 123 温油", style.id));
    expect(new Set(samples).size).toBe(FANCY_STYLES.length);
    for (const style of FANCY_STYLES) for (const value of Object.values(style.mapping ?? {})) {
      expect(value).not.toMatch(/[\p{Cn}\p{Cs}]/u);
    }
  });
  test.each([
    ["pseudo-script", "Нєℓℓσ Ѕумвσℓ∂в"],
    ["pseudo-fraktur", "ꑛꏂ꒒꒒ꄲ ꇙꌩꂵᏰꄲ꒒ᎴᏰ"],
    ["glitch", "ⱧɆⱠⱠØ ₴Ɏ₥฿ØⱠĐ฿"],
    ["bubble-pseudo", "ᕼᗴᒪᒪO ᔕYᗰᗷOᒪᗪᗷ"],
    ["radicals", "卄乇乚乚口 丂丫从乃口乚刀乃"],
    ["cursed", "ĦɛƖƖơ ŞყɱɓơƖɗɓ"],
  ])("参考字形逐项匹配：%s", (styleId, expected) => {
    expect(fancyText("Hello Symboldb", styleId)).toBe(expected);
  });
  test("单点上下方向、Zalgo多方向变化与基字上限", () => {
    expect(fancyText("Az09", "dot-above")).toBe("Ȧż0̇9̇");
    expect(fancyText("Az09", "dot-below")).toBe("Ạẓ0̣9̣");
    expect(fancyText("A中é👩🏽‍💻🇨🇳1️⃣", "zalgo")).toBe("Ȧ̸̱中é👩🏽‍💻🇨🇳1️⃣");
    expect(fancyText("Hello Symboldb", "zalgo")).toBe(fancyText("Hello Symboldb", "zalgo"));
    const patterns = FANCY_STYLES.find((style) => style.id === "zalgo")!.markPatterns!;
    expect(new Set(patterns).size).toBeGreaterThan(1);
    for (const marks of patterns) {
      expect(Array.from(marks).length).toBeLessThanOrEqual(FANCY_MARK_LIMIT);
      expect(marks).toMatch(/^\p{M}+$/u);
    }
    expect(fancyText("A".repeat(10000), "zalgo")).toHaveLength(40000);
    expect(fancyText("A".repeat(10000), "zalgo").length).toBeLessThan(FANCY_OUTPUT_LIMIT);
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
