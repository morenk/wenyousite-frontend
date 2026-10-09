import { describe, expect, test, vi } from "vitest";
import { cellWidth, verticalText } from "../vertical";
import { MORSE, decodeMorse, encodeMorse } from "../morse";
import { FANCY_STYLES, fancyText } from "../fancy";
import { isToolEmbedPath, isToolId, toolHref } from "../catalog";
const options = { height: 2, gap: 1, direction: "right" as const };
describe("竖排纯文本", () => {
  test("右起从上到下，空列双宽填充，左起不倒转列内字", () => {
    expect(verticalText("甲乙丙丁", options)).toBe("丙 甲\n丁 乙");
    expect(verticalText("甲乙丙丁戊", options)).toBe("戊 丙 甲\n   丁 乙");
    expect(verticalText("甲乙丙丁戊", { ...options, direction: "left" })).toBe("甲 丙 戊\n乙 丁");
    expect(verticalText("甲乙丙丁", { ...options, gap: 0 })).toBe("丙甲\n丁乙");
    expect(verticalText("甲乙丙丁", { ...options, gap: 3 })).toBe("丙   甲\n丁   乙");
  });
  test("完整grapheme、半角补齐和换行分段", () => {
    expect(verticalText("甲👨‍👩‍👧‍👦乙🇨🇳", options)).toBe("乙 甲\n🇨🇳 👨‍👩‍👧‍👦");
    expect(verticalText("é👍🏽", { ...options, height: 1 })).toBe("👍🏽 é");
    expect(verticalText("A中B文", options)).toBe("B  A\n文 中");
    expect(verticalText("甲乙\r\n丙丁", options)).toBe("甲\n乙\n\n丙\n丁");
    expect(verticalText("甲\n\n乙", options)).toBe("甲\n\n\n\n乙");
    expect(verticalText("", options)).toBe("");
    expect(verticalText("\t甲", { ...options, height: 100 })).toBe("\n\n\n\n甲");
  });
  test("限制工作量，不静默拆分旧浏览器中的emoji", () => {
    for (const height of [0, 101, 1.5, NaN]) expect(() => verticalText("字", { ...options, height })).toThrow();
    for (const gap of [-1, 11, 1.5, NaN]) expect(() => verticalText("字", { ...options, gap })).toThrow();
    expect(() => verticalText("字".repeat(10001), options)).toThrow("10,000");
    const original = Intl.Segmenter;
    Object.defineProperty(Intl, "Segmenter", { configurable: true, value: undefined });
    try { expect(() => verticalText("字", options)).toThrow("升级"); }
    finally { Object.defineProperty(Intl, "Segmenter", { configurable: true, value: original }); }
  });
  test.each(["가", "Ａ", "￥", "豈", "︰", "𠀀", "〈", "〉", "ᄀ", "💫", "🇨🇳", "1️⃣"])("%s 占双格", (char) => expect(cellWidth(char)).toBe(2));
  test("空字符与窄字符", () => { expect(cellWidth("")).toBe(1); expect(cellWidth("a")).toBe(1); expect(cellWidth("ｦ")).toBe(1); });
});
describe("国际摩斯", () => {
  test("已知向量、原文斜线、换行与é", () => {
    expect(encodeMorse("SOS 2026")).toBe("... --- ... / ..--- ----- ..--- -....");
    expect(encodeMorse("a/b")).toBe(".- -..-. -...");
    expect(encodeMorse("a\r\nb")).toBe(".-\n-...");
    expect(encodeMorse("é")).toBe("..-..");
    expect(encodeMorse("  a   b  ")).toBe(".- / -...");
    expect(encodeMorse("")).toBe("");
    expect(decodeMorse("... --- ... / ..--- ----- ..--- -....")).toBe("SOS 2026");
    expect(decodeMorse(".-\r\n-...")).toBe("A\nB");
    expect(decodeMorse("")).toBe("");
    for (const char of Object.keys(MORSE)) expect(decodeMorse(encodeMorse(char))).toBe(char);
  });
  test("拒绝未知字符、非ASCII大小写映射与原型码组", () => {
    expect(() => encodeMorse("中文A")).toThrow("中 文");
    expect(() => encodeMorse("ß")).toThrow("ß");
    expect(() => encodeMorse("甲乙丙丁戊己庚辛壬癸子丑寅卯")).toThrow("…");
    for (const value of ["......", "constructor", "__proto__", "toString"]) expect(() => decodeMorse(value)).toThrow("无法识别");
  });
});
describe("花体码点", () => {
  test("补齐Unicode非连续字母", () => {
    expect(fancyText("h", "italic")).toBe("ℎ");
    expect(fancyText("BEFHILMRego", "script")).toBe("ℬℰℱℋℐℒℳℛℯℊℴ");
    expect(fancyText("CHIRZ", "fraktur")).toBe("ℭℌℑℜℨ");
    expect(fancyText("CHNPQRZ", "double")).toBe("ℂℍℕℙℚℝℤ");
    expect(fancyText("Az09中文👨‍👩‍👧‍👦\n", "bold")).toBe("𝐀𝐳𝟎𝟗中文👨‍👩‍👧‍👦\n");
    expect(fancyText("Az09", "mono")).toBe("𝙰𝚣𝟶𝟿");
    expect(fancyText("Az09", "full")).toBe("Ａｚ０９");
    expect(fancyText("09", "script")).toBe("09");
  });
  test("全部字母映射到已分配字母，保留其他字符", () => {
    for (const style of FANCY_STYLES) {
      const result = fancyText("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz", style.id);
      expect(Array.from(result)).toHaveLength(52);
      expect(/^\p{L}+$/u.test(result)).toBe(true);
      expect(fancyText("中文🙂\n!", style.id)).toBe("中文🙂\n!");
    }
  });
});
test("路由只匹配边界，保留合法主题", () => {
  expect(isToolId("names")).toBe(true); expect(isToolId("unknown")).toBe(false);
  expect(isToolEmbedPath("/tools/embed")).toBe(true); expect(isToolEmbedPath("/tools/embed/names")).toBe(true);
  expect(isToolEmbedPath("/tools/embedded")).toBe(false);
  expect(toolHref()).toBe("/tools"); expect(toolHref("morse", true, "dark")).toBe("/tools/embed/morse?theme=dark");
  expect(toolHref(undefined, true, "invalid")).toBe("/tools/embed");
  expect(toolHref("vertical", false, "light")).toBe("/tools/vertical");
  vi.restoreAllMocks();
});
