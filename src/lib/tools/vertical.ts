import { assertTextLimit } from "./catalog";

export interface VerticalOptions { height: number; gap: number; direction: "right" | "left" }

/** 中文和 emoji 占两格，拉丁字符占一格；实际字形仍取决于目标字体。 */
export function cellWidth(grapheme: string): number {
  if (/\p{Extended_Pictographic}|\p{Regional_Indicator}|\u20e3/u.test(grapheme)) return 2;
  const code = grapheme.codePointAt(0) ?? 0;
  return (code >= 0x1100 && (code <= 0x115f || code === 0x2329 || code === 0x232a ||
    (code >= 0x2e80 && code <= 0xa4cf) || (code >= 0xac00 && code <= 0xd7a3) ||
    (code >= 0xf900 && code <= 0xfaff) || (code >= 0xfe10 && code <= 0xfe6f) ||
    (code >= 0xff01 && code <= 0xff60) || (code >= 0xffe0 && code <= 0xffe6) ||
    (code >= 0x20000 && code <= 0x3fffd))) ? 2 : 1;
}

export function verticalText(text: string, options: VerticalOptions): string {
  assertTextLimit(text);
  const { height, gap, direction } = options;
  if (!Number.isInteger(height) || height < 1 || height > 100) throw new Error("每列字数须为 1–100 的整数");
  if (!Number.isInteger(gap) || gap < 0 || gap > 10) throw new Error("列间空格须为 0–10 的整数");
  if (typeof Intl.Segmenter !== "function") throw new Error("当前浏览器不支持完整字符分段，请升级浏览器或系统 WebView 后重试");
  const segmenter = new Intl.Segmenter("zh", { granularity: "grapheme" });
  return text.replace(/\r\n?/g, "\n").split("\n").map((paragraph) => {
    const chars = Array.from(segmenter.segment(paragraph.replace(/\t/g, "    ")), (part) => part.segment);
    if (!chars.length) return "";
    const columns: string[][] = [];
    for (let i = 0; i < chars.length; i += height) columns.push(chars.slice(i, i + height));
    if (direction === "right") columns.reverse();
    return Array.from({ length: Math.min(height, chars.length) }, (_, row) => columns.map((column) => {
      const char = column[row] ?? "";
      return char + " ".repeat(char ? 2 - cellWidth(char) : 2);
    }).join(" ".repeat(gap)).trimEnd()).join("\n");
  }).join("\n\n");
}
