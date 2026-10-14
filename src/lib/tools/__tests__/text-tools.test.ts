import { describe, expect, test, vi } from "vitest";
import { cellWidth, verticalText } from "../vertical";
import { MORSE, decodeMorse, encodeMorse } from "../morse";
import { FANCY_STYLES, fancyText } from "../fancy";
import { isToolEmbedPath, isToolId, toolHref } from "../catalog";
const options = { width: 2, height: 2, gap: 1, direction: "right" as const };
describe("竖排固定页格", () => {
  test("按列分页，左右顺序与末页空格稳定", () => {
    expect(verticalText("甲乙丙丁", options)).toBe("丙 甲\n丁 乙");
    expect(verticalText("甲乙丙丁戊己庚辛", { ...options, width: 3 })).toBe("戊 丙 甲\n己 丁 乙\n\n      庚\n      辛");
    expect(verticalText("甲乙丙丁戊", { ...options, width: 3, direction: "left" })).toBe("甲 丙 戊\n乙 丁   ");
    expect(verticalText("甲乙丙丁", { ...options, gap: 0 })).toBe("丙甲\n丁乙");
    expect(verticalText("甲乙丙丁", { ...options, gap: 3 })).toBe("丙   甲\n丁   乙");
    expect(verticalText("甲", { width: 1, height: 3, gap: 0, direction: "right" })).toBe("甲\n  \n  ");
  });
  test("换行新列、空行空列，保留首尾空行并规范化CRLF", () => {
    expect(verticalText("甲乙\r\n丙丁", options)).toBe("丙 甲\n丁 乙");
    expect(verticalText("甲乙\n丙丁\n\n戊", { ...options, width: 3 })).toBe("   丙 甲\n   丁 乙\n\n      戊\n        ");
    expect(verticalText("\n甲\n", { ...options, width: 3 })).toBe("   甲   \n        ");
    expect(verticalText("甲\r乙", options)).toBe("乙 甲\n     ");
    expect(verticalText("", options)).toBe("");
    expect(verticalText("\n", { ...options, height: 1 })).toBe("     ");
  });
  test("完整grapheme、单双宽补齐和自定义分隔符", () => {
    expect(verticalText("甲👨‍👩‍👧‍👦乙🇨🇳", options)).toBe("乙 甲\n🇨🇳 👨‍👩‍👧‍👦");
    expect(verticalText("é👍🏽", { ...options, height: 1 })).toBe("👍🏽 é ");
    expect(verticalText("A中\nB文", { ...options, separator: " | " })).toBe("B  | A \n文 | 中");
    expect(verticalText("甲乙丙丁", { ...options, separator: "🙂  " })).toBe("丙🙂  甲\n丁🙂  乙");
    expect(verticalText("甲乙丙丁", { ...options, separator: "" })).toBe("丙甲\n丁乙");
    expect(verticalText("\t甲", { ...options, width: 1, height: 5 })).toBe("  \n  \n  \n  \n甲");
  });
  test("校验范围并限制空行和分隔符导致的输出膨胀", () => {
    for (const height of [0, 101, 1.5, NaN]) expect(() => verticalText("字", { ...options, height })).toThrow();
    for (const width of [0, 101, 1.5, NaN]) expect(() => verticalText("字", { ...options, width })).toThrow();
    for (const gap of [-1, 11, 1.5, NaN]) expect(() => verticalText("字", { ...options, gap })).toThrow();
    for (const separator of ["x".repeat(21), "\n", "\t", "\u0000", "\u2028"]) expect(() => verticalText("字", { ...options, separator })).toThrow("分隔符");
    expect(() => verticalText("字", { ...options, direction: "invalid" as "right" })).toThrow("阅读顺序");
    expect(() => verticalText("字".repeat(10001), options)).toThrow("10,000");
    expect(() => verticalText("\n".repeat(10000), { ...options, width: 1, height: 100 })).toThrow("结果过大");
    expect(() => verticalText("\n".repeat(4000), { ...options, width: 100, height: 20, separator: "x".repeat(20) })).toThrow("结果过大");
    expect(verticalText("字", { ...options, width: 100, height: 100 }).split("\n")).toHaveLength(100);
  });
  test("旧浏览器明确反馈，不拆emoji", () => {
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
    for (const style of FANCY_STYLES.filter((item) => ["bold", "italic", "script", "fraktur", "double", "mono", "full"].includes(item.id))) {
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
