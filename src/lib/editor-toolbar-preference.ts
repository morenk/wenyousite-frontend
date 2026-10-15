import { AUDIO_UPLOAD } from "@wenyousite/foundation/audio";
import { EDITOR_PRIMARY_WIDE, type EditorCapabilityId } from "./editor-capabilities";
import { isEditorToolbarCapabilityVisible } from "./editor-capabilities";

export const EDITOR_TOOLBAR_STORAGE_KEY = "wenyousite-web-editor-toolbar-v1";
export const EDITOR_TOOLBAR_CHANGE_EVENT = "wenyousite-editor-toolbar-change";
export const EDITOR_TOOLBAR_TOOLS = [
  "heading", "bold", "italic", "strikethrough", "inline-code", "alignment",
  "link", "image", "quote", "hr", "dice", "sticker", "draft", "audio",
] as const satisfies readonly EditorCapabilityId[];
export type EditorToolbarTool = typeof EDITOR_TOOLBAR_TOOLS[number];
export interface EditorToolbarPreference {
  version: 1;
  primary: EditorToolbarTool[];
  more: EditorToolbarTool[];
}
export function isEditorToolbarTool(value: unknown): value is EditorToolbarTool {
  return typeof value === "string" && (EDITOR_TOOLBAR_TOOLS as readonly string[]).includes(value);
}
export function defaultCustomToolbar(): EditorToolbarPreference {
  const preference: EditorToolbarPreference = {
    version: 1,
    primary: EDITOR_PRIMARY_WIDE.flatMap((id) =>
      isEditorToolbarCapabilityVisible(id) && isEditorToolbarTool(id) ? [id] : []),
    more: ["sticker"],
  };
  preference[AUDIO_UPLOAD.defaultToolbarPlacement].push("audio");
  return preference;
}
/** 缺失的新工具追加到展开栏；未知工具、列表和重复值不能恢复可见入口。 */
export function parseEditorToolbarPreference(value: string | null): EditorToolbarPreference | null {
  if (!value) return null;
  try {
    const data: unknown = JSON.parse(value);
    if (!data || typeof data !== "object" || !("version" in data) || data.version !== 1
      || !("primary" in data) || !Array.isArray(data.primary)
      || !("more" in data) || !Array.isArray(data.more)) return null;
    const seen = new Set<EditorToolbarTool>();
    const unique = (items: unknown[]): EditorToolbarTool[] => items.filter((id): id is EditorToolbarTool => {
      if (!isEditorToolbarTool(id) || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
    const primary = unique(data.primary);
    const more = unique(data.more);
    more.push(...EDITOR_TOOLBAR_TOOLS.filter((id) => !seen.has(id)));
    return { version: 1, primary, more };
  } catch { return null; }
}
export function readEditorToolbarStorage(): string | null {
  try { return window.localStorage.getItem(EDITOR_TOOLBAR_STORAGE_KEY); }
  catch { return null; }
}
export function saveEditorToolbarPreference(preference: EditorToolbarPreference | null): boolean {
  try {
    if (preference) {
      const normalized = parseEditorToolbarPreference(JSON.stringify(preference));
      if (!normalized) return false;
      window.localStorage.setItem(EDITOR_TOOLBAR_STORAGE_KEY, JSON.stringify(normalized));
    } else window.localStorage.removeItem(EDITOR_TOOLBAR_STORAGE_KEY);
    window.dispatchEvent(new Event(EDITOR_TOOLBAR_CHANGE_EVENT));
    return true;
  } catch { return false; }
}
