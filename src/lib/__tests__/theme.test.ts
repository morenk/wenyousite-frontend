import { THEME_PALETTES } from "@wenyousite/foundation/theme";
import { afterEach, describe, expect, test, vi } from "vitest";

import { THEME_BOOTSTRAP_SCRIPT } from "@/lib/theme-bootstrap";
import {
  DEFAULT_THEME_PREFERENCE,
  THEME_MEDIA_QUERY,
  THEME_STORAGE_KEY,
  isThemePreference,
  readThemePreference,
  resolveThemePreference,
  syncThemeDocument,
  writeThemePreference,
} from "@/lib/theme";

afterEach(() => {
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.removeAttribute("data-theme-preference");
  document.documentElement.removeAttribute("style");
  document.head.querySelector('meta[name="theme-color"]')?.remove();
});

describe("主题偏好", () => {
  test("只接受 Foundation 公布的三种偏好", () => {
    expect(isThemePreference("system")).toBe(true);
    expect(isThemePreference("light")).toBe(true);
    expect(isThemePreference("dark")).toBe(true);
    expect(isThemePreference("auto")).toBe(false);
    expect(isThemePreference(null)).toBe(false);
  });

  test("只有跟随系统会读取系统深色状态", () => {
    expect(resolveThemePreference("system", false)).toBe("light");
    expect(resolveThemePreference("system", true)).toBe("dark");
    expect(resolveThemePreference("light", true)).toBe("light");
    expect(resolveThemePreference("dark", false)).toBe("dark");
  });

  test("存储缺失、非法或不可读时安全回退为跟随系统", () => {
    expect(readThemePreference(null)).toBe(DEFAULT_THEME_PREFERENCE);
    expect(readThemePreference({ getItem: () => "dark" })).toBe("dark");
    expect(readThemePreference({ getItem: () => "sepia" })).toBe("system");
    expect(readThemePreference({ getItem: () => { throw new Error("blocked"); } })).toBe("system");
  });

  test("写入失败不会阻止当前页面切换", () => {
    const setItem = vi.fn();
    expect(writeThemePreference({ setItem }, "dark")).toBe(true);
    expect(setItem).toHaveBeenCalledWith(THEME_STORAGE_KEY, "dark");
    expect(writeThemePreference(null, "light")).toBe(false);
    expect(writeThemePreference({ setItem: () => { throw new Error("quota"); } }, "light"))
      .toBe(false);
  });

  test("同步根属性、原生 color-scheme 与浏览器主题色", () => {
    const meta = document.createElement("meta");
    meta.name = "theme-color";
    document.head.append(meta);

    expect(syncThemeDocument(document, "system", true)).toBe("dark");
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(document.documentElement).toHaveAttribute("data-theme-preference", "system");
    expect(document.documentElement.style.colorScheme).toBe("dark");
    expect(meta.content).toBe(THEME_PALETTES.dark.background);

    meta.remove();
    expect(syncThemeDocument(document, "light", true)).toBe("light");
    expect(document.documentElement.style.colorScheme).toBe("light");
    expect(document.head.querySelectorAll('meta[name="theme-color"]')).toHaveLength(1);
    expect(document.head.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.content)
      .toBe(THEME_PALETTES.light.background);
  });

  test("首屏脚本只序列化中央偏好、媒体查询和两套画布色", () => {
    expect(THEME_BOOTSTRAP_SCRIPT).toContain(THEME_STORAGE_KEY);
    expect(THEME_BOOTSTRAP_SCRIPT).toContain(THEME_MEDIA_QUERY);
    expect(THEME_BOOTSTRAP_SCRIPT).toContain(THEME_PALETTES.light.background);
    expect(THEME_BOOTSTRAP_SCRIPT).toContain(THEME_PALETTES.dark.background);
    expect(THEME_BOOTSTRAP_SCRIPT).toContain('root.dataset.theme = mode');
    expect(THEME_BOOTSTRAP_SCRIPT).toContain('document.createElement("meta")');
  });
});
