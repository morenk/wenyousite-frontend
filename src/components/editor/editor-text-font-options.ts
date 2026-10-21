import type { components } from "@/api/types";
import { normalizeTextFont } from "@/lib/markdown-text-font";
import type { EditorFontOption } from "./editor-text-font-picker";

export function textFontGroup(language: unknown): string {
  if (language === "zh") return "中文";
  if (language === "ja") return "日文";
  if (language === "en") return "英文";
  return "未分类";
}

export function textFontPreviewSample(language: unknown): string {
  if (language === "ja") return "あいうえお アイウエオ 日本語 Aa 0123";
  if (language === "en") return "The quick brown fox Aa 0123";
  return "春风又绿江南岸 Aa 0123";
}

export function textFontOptions(fonts: readonly components["schemas"]["TextFontFamilyDto"][]): EditorFontOption[] {
  return fonts.filter(font => font.availability === "ready" && normalizeTextFont(font.id))
    .map(font => ({ value: font.id, label: font.name, group: textFontGroup(font.designLanguage) }));
}
