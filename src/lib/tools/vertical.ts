import { assertTextLimit } from "./catalog";

export interface VerticalOptions { width: number; height: number; gap: number; direction: "right" | "left"; separator?: string }
export const VERTICAL_CELL_LIMIT = 100_000;
export const VERTICAL_OUTPUT_LIMIT = 500_000;

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
  const { width, height, gap, direction } = options;
  if (!Number.isInteger(width) || width < 1 || width > 100) throw new Error("页宽须为 1–100 的整数");
  if (!Number.isInteger(height) || height < 1 || height > 100) throw new Error("页高须为 1–100 的整数");
  if (!Number.isInteger(gap) || gap < 0 || gap > 10) throw new Error("列间空格须为 0–10 的整数");
  if (direction !== "right" && direction !== "left") throw new Error("请选择有效的阅读顺序");
  const separator = options.separator ?? " ".repeat(gap);
  if (separator.length > 20 || /[\x00-\x1f\x7f-\x9f\u2028\u2029]/u.test(separator)) throw new Error("分隔符最多 20 个字符，不能包含换行或控制字符");
  if (!text) return "";
  if (typeof Intl.Segmenter !== "function") throw new Error("当前浏览器不支持完整字符分段，请升级浏览器或系统 WebView 后重试");
  const segmenter = new Intl.Segmenter("zh", { granularity: "grapheme" });
  const columns: string[][] = [];
  let characterUnits = 0;
  for (const line of text.replace(/\r\n?/g, "\n").split("\n")) {
    const chars = Array.from(segmenter.segment(line.replace(/\t/g, "    ")), (part) => part.segment);
    for (const char of chars) characterUnits += char.length - cellWidth(char);
    if (!chars.length) columns.push([]);
    else for (let i = 0; i < chars.length; i += height) columns.push(chars.slice(i, i + height));
  }
  const pageCount = Math.ceil(columns.length / width);
  const cells = pageCount * width * height;
  const outputUnits = cells * 2 + characterUnits + pageCount * height * (width - 1) * separator.length + pageCount * (height - 1) + (pageCount - 1) * 2;
  if (cells > VERTICAL_CELL_LIMIT || outputUnits > VERTICAL_OUTPUT_LIMIT) throw new Error("排版结果过大（最多 100,000 格、500,000 个字符），请减少输入空行、页宽或页高");
  const pages: string[] = [];
  for (let start = 0; start < columns.length; start += width) {
    const page = Array.from({ length: width }, (_, column) => columns[start + column] ?? []);
    if (direction === "right") page.reverse();
    pages.push(Array.from({ length: height }, (_, row) => page.map((column) => {
      const char = column[row] ?? "";
      return char + " ".repeat(char ? 2 - cellWidth(char) : 2);
    }).join(separator)).join("\n"));
  }
  return pages.join("\n\n");
}
