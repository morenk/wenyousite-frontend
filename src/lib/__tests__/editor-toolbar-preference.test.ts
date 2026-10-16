import { afterEach, describe, expect, test, vi } from "vitest";
import {
  EDITOR_TOOLBAR_STORAGE_KEY, EDITOR_TOOLBAR_TOOLS, defaultCustomToolbar,
  parseEditorToolbarPreference, readEditorToolbarStorage, saveEditorToolbarPreference,
} from "../editor-toolbar-preference";

afterEach(() => { localStorage.clear(); vi.restoreAllMocks(); });
describe("本机编辑器工具栏偏好", () => {
  test.each([null, "{", "{}", '{"version":2,"primary":[],"more":[]}', '{"version":1,"primary":null,"more":[]}'])("坏值 %s 回退原布局", (raw) => {
    expect(parseEditorToolbarPreference(raw)).toBeNull();
  });
  test("旧列表、未知动作与重复值被过滤，缺失动作只在展开栏补齐", () => {
    const parsed = parseEditorToolbarPreference(JSON.stringify({ version: 1,
      primary: ["dice", "bullet-list", "audio", "dice", "ordered-list", 3],
      more: ["bold", "dice", "sticker"],
    }))!;
    expect(parsed.primary).toEqual(["dice"]);
    expect(parsed.more.slice(0, 2)).toEqual(["bold", "sticker"]);
    expect(new Set([...parsed.primary, ...parsed.more])).toEqual(new Set(EDITOR_TOOLBAR_TOOLS));
    expect(parsed.primary.length + parsed.more.length).toBe(EDITOR_TOOLBAR_TOOLS.length);
  });
  test("允许主栏为空且所有工具仍能从展开栏访问", () => {
    const parsed = parseEditorToolbarPreference('{"version":1,"primary":[],"more":[]}')!;
    expect(parsed.primary).toEqual([]);
    expect(parsed.more).toEqual(EDITOR_TOOLBAR_TOOLS);
  });
  test("设置顺序可保存重读，恢复默认移除键", () => {
    const next = defaultCustomToolbar();
    next.primary.reverse();
    expect(saveEditorToolbarPreference(next)).toBe(true);
    expect(parseEditorToolbarPreference(readEditorToolbarStorage())).toEqual(next);
    expect(saveEditorToolbarPreference(null)).toBe(true);
    expect(localStorage.getItem(EDITOR_TOOLBAR_STORAGE_KEY)).toBeNull();
  });
  test("存储拒绝时不宣称保存成功", () => {
    vi.spyOn(window.localStorage, "setItem").mockImplementation(() => { throw new Error("denied"); });
    expect(saveEditorToolbarPreference(defaultCustomToolbar())).toBe(false);
  });
});
