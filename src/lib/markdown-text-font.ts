import { importedTextFontVersion, legacyTextFontRouting } from "./legacy-text-font-routing";
import { dynamicFontState } from "./dynamic-text-font-state";
import catalog from "../../contracts/thread-font-catalog-v1.json";

export const TEXT_FONT_ATTRIBUTE = "data-wenyou-font-v1";
export const TEXT_FONT_V2_ATTRIBUTE = "data-wenyou-font-v2";
export const TEXT_FONT_SELECTOR = `[${TEXT_FONT_ATTRIBUTE}], [${TEXT_FONT_V2_ATTRIBUTE}]`;
export const TEXT_FONT_MARK = "wenyouTextFont";
export const TEXT_FONT_CATALOG = catalog.fonts;
// 退役 ID 仍解析、往返历史正文；新选择与字库加载不再使用。
const retiredIds = new Set(["xiaocheng-lafeng"]);
const activeIds = new Set(catalog.fonts.map((font) => font.id));
const ids = new Set([...activeIds, ...retiredIds]);
export function isSelectableTextFont(value: unknown): value is string {
  if (isDynamicTextFont(value)) return dynamicFontState(value)?.selectable === true;
  if (typeof value !== "string" || !activeIds.has(value) || retiredIds.has(value)) return false;
  const route = legacyTextFontRouting.route(value);
  return route === "legacy-v1" || (route === "mapped-v2" && dynamicFontState(importedTextFontVersion(value)!)?.selectable === true);
}
export function normalizeTextFontV1(value: unknown): string | null {
  return typeof value === "string" && ids.has(value) ? value : null;
}
export function isDynamicTextFont(value: unknown): value is string { return typeof value === "string" && /^tfv_[a-f0-9]{32}$/u.test(value); }
export function normalizeTextFont(value: unknown): string | null { return isDynamicTextFont(value) ? value : normalizeTextFontV1(value); }
export function textFontAttribute(id: string) { return isDynamicTextFont(id) ? TEXT_FONT_V2_ATTRIBUTE : TEXT_FONT_ATTRIBUTE; }
export function readTextFont(element: Pick<Element, "hasAttribute" | "getAttribute">): string | null {
  if (element.hasAttribute(TEXT_FONT_ATTRIBUTE) && element.hasAttribute(TEXT_FONT_V2_ATTRIBUTE)) return null;
  const dynamic = element.getAttribute(TEXT_FONT_V2_ATTRIBUTE);
  return dynamic !== null ? (isDynamicTextFont(dynamic) ? dynamic : null) : normalizeTextFontV1(element.getAttribute(TEXT_FONT_ATTRIBUTE));
}
export function isPasteAllowedTextFont(id: string) {
  if (isDynamicTextFont(id)) return dynamicFontState(id)?.pasteAllowed === true;
  const route = legacyTextFontRouting.route(id);
  return route === "legacy-v1" ? isSelectableTextFont(id) : route === "mapped-v2" && dynamicFontState(importedTextFontVersion(id)!)?.pasteAllowed === true;
}
/** 历史呈现与新选择独立：停用或未知状态仍需观察固定版本。 */
export function canObserveTextFont(id: string) { return isDynamicTextFont(id) || activeIds.has(id); }
/** 只引用目录白名单对应的运行时变量；不接受 CSS 字体名或外部 URL。 */
export function textFontFamily(value: unknown): string | undefined {
  const id = normalizeTextFont(value);
  return id && canObserveTextFont(id) ? `var(--wenyou-content-font-${id}, var(--wenyou-font-body-family, system-ui))` : undefined;
}
