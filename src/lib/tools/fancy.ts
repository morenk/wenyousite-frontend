import { assertTextLimit } from "./catalog";
import data from "./fancy-data.json";

export type FancyCategory = "font" | "symbol" | "effect" | "decoration";
export interface FancyStyleDefinition {
  id: string;
  label: string;
  preview: string;
  previewInput: string;
  category: FancyCategory;
  kind: "map" | "mark" | "wrap";
  mapping?: Record<string, string>;
  reverse?: boolean;
  mark?: string;
  markPatterns?: string[];
  prefix?: string;
  suffix?: string;
}
export const FANCY_STYLES = data.styles as FancyStyleDefinition[];
export const FANCY_CATEGORIES = data.categories as { id: FancyCategory; label: string }[];
export const DEFAULT_FANCY_STYLE = data.defaultStyleId;
export const FANCY_OUTPUT_LIMIT = data.outputLimit;
export const FANCY_MARK_LIMIT = data.maxMarksPerCharacter;
const blankLineCodePoints = new Set(data.blankLineCodePoints);
export type FancyStyle = string;
export function isFancyStyle(id: string): boolean {
  return FANCY_STYLES.some((style) => style.id === id);
}

function limitOutput(output: string): string {
  if (output.length > FANCY_OUTPUT_LIMIT) throw new Error("生成结果超过长度上限，请缩短输入");
  return output;
}

export function fancyText(text: string, id: FancyStyle): string {
  assertTextLimit(text);
  const style = FANCY_STYLES.find((item) => item.id === id);
  if (!style) throw new Error("请选择有效的文字样式");
  if (!text) return "";
  // 每行独立装饰，空白行与原换行符保持原样。
  if (style.kind === "wrap") {
    return limitOutput(text.split(/(\r\n|\r|\n)/).map((line) =>
      Array.from(line).every((character) => blankLineCodePoints.has(character.codePointAt(0)!))
        ? line : `${style.prefix}${line}${style.suffix}`).join(""));
  }
  if (typeof Intl.Segmenter !== "function") throw new Error("当前浏览器不支持完整字符处理，请升级浏览器");
  const segmenter = new Intl.Segmenter("und", { granularity: "grapheme" });
  return limitOutput(text.split(/(\r\n|\r|\n)/).map((line) => {
    const characters = Array.from(segmenter.segment(line), ({ segment }) => segment);
    if (style.reverse) characters.reverse();
    return characters.map((character) => {
      if (style.kind === "mark") {
        // 组合标记仅用于 ASCII 字母数字，避免 CJK 字体出现分离方框。
        if (!/^[A-Za-z0-9]$/u.test(character)) return character;
        const mark = style.markPatterns?.[character.codePointAt(0)! % style.markPatterns.length] ?? style.mark ?? "";
        return character + Array.from(mark).slice(0, FANCY_MARK_LIMIT).join("");
      }
      // 拉丁基字母可保留原有组合重音；键帽、ZWJ 等复合字符不匹配。
      if (/^[A-Za-z]\p{M}+$/u.test(character)) {
        return (style.mapping?.[character[0]] ?? character[0]) + character.slice(1);
      }
      return style.mapping?.[character] ?? character;
    }).join("");
  }).join(""));
}
