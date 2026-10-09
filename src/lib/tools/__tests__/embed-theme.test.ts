import { afterEach, expect, test, vi } from "vitest";
import { THEME_BOOTSTRAP_SCRIPT } from "@/lib/theme-bootstrap";
import { THEME_STORAGE_KEY } from "@/lib/theme";
afterEach(() => { localStorage.clear(); window.history.replaceState({}, "", "/"); vi.restoreAllMocks(); });
test.each(["light", "dark", "invalid", ""])("嵌入首屏theme=%s不读取社区偏好", (theme) => {
  localStorage.setItem(THEME_STORAGE_KEY, "dark");
  window.history.replaceState({}, "", `/tools/embed/names?theme=${theme}`);
  const read = vi.spyOn(Storage.prototype, "getItem");
  const write = vi.spyOn(Storage.prototype, "setItem");
  const match = vi.spyOn(window, "matchMedia").mockReturnValue({ matches: false } as MediaQueryList);
  new Function("window", "document", THEME_BOOTSTRAP_SCRIPT)(window, document);
  expect(document.documentElement.dataset.theme).toBe(theme === "dark" ? "dark" : "light");
  expect(document.documentElement.dataset.themePreference).toBe(theme === "light" || theme === "dark" ? theme : "system");
  expect(read).not.toHaveBeenCalled(); expect(write).not.toHaveBeenCalled(); match.mockRestore();
});
test("普通页面仍尊重持久化偏好", () => {
  window.history.replaceState({}, "", "/tools?theme=light");
  localStorage.setItem(THEME_STORAGE_KEY, "dark");
  new Function("window", "document", THEME_BOOTSTRAP_SCRIPT)(window, document);
  expect(document.documentElement.dataset.theme).toBe("dark");
});
