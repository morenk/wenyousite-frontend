import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { ThemeProvider, useTheme } from "@/components/ui/theme-provider";
import { THEME_STORAGE_KEY } from "@/lib/theme";

function createThemeMedia(initial: boolean) {
  let matches = initial;
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  const query = {
    media: "(prefers-color-scheme: dark)",
    get matches() {
      return matches;
    },
    addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
      listeners.add(listener);
    },
    removeEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
      listeners.delete(listener);
    },
  } as MediaQueryList;
  return {
    query,
    emit(next: boolean) {
      matches = next;
      const event = { matches: next, media: query.media } as MediaQueryListEvent;
      for (const listener of listeners) listener(event);
    },
  };
}

function ThemeProbe() {
  const { preference, resolvedTheme, setPreference } = useTheme();
  return (
    <div>
      <output data-testid="preference">{preference}</output>
      <output data-testid="resolved-theme">{resolvedTheme}</output>
      <button type="button" onClick={() => setPreference("light")}>亮色</button>
      <button type="button" onClick={() => setPreference("dark")}>黑夜</button>
      <button type="button" onClick={() => setPreference("system")}>跟随系统</button>
    </div>
  );
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.removeAttribute("data-theme-preference");
  document.documentElement.removeAttribute("style");
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("ThemeProvider", () => {
  test("恢复已保存偏好并在显式选择后写回当前浏览器", async () => {
    localStorage.setItem(THEME_STORAGE_KEY, "dark");
    const media = createThemeMedia(false);
    vi.stubGlobal("matchMedia", vi.fn(() => media.query));

    render(<ThemeProvider><ThemeProbe /></ThemeProvider>);
    await waitFor(() => expect(screen.getByTestId("resolved-theme")).toHaveTextContent("dark"));
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");

    await userEvent.click(screen.getByRole("button", { name: "亮色" }));
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
    expect(screen.getByTestId("resolved-theme")).toHaveTextContent("light");
    expect(document.documentElement).toHaveAttribute("data-theme-preference", "light");
  });

  test("跟随系统时响应系统变化，显式模式不被系统覆盖", async () => {
    const media = createThemeMedia(false);
    vi.stubGlobal("matchMedia", vi.fn(() => media.query));
    render(<ThemeProvider><ThemeProbe /></ThemeProvider>);
    await waitFor(() => expect(screen.getByTestId("preference")).toHaveTextContent("system"));

    act(() => media.emit(true));
    expect(screen.getByTestId("resolved-theme")).toHaveTextContent("dark");

    await userEvent.click(screen.getByRole("button", { name: "亮色" }));
    act(() => media.emit(false));
    act(() => media.emit(true));
    expect(screen.getByTestId("resolved-theme")).toHaveTextContent("light");
  });

  test("接收其他标签页偏好，删除或非法值回到跟随系统", async () => {
    const media = createThemeMedia(true);
    vi.stubGlobal("matchMedia", vi.fn(() => media.query));
    render(<ThemeProvider><ThemeProbe /></ThemeProvider>);
    await waitFor(() => expect(screen.getByTestId("resolved-theme")).toHaveTextContent("dark"));

    act(() => window.dispatchEvent(new StorageEvent("storage", {
      key: THEME_STORAGE_KEY,
      newValue: "light",
    })));
    expect(screen.getByTestId("preference")).toHaveTextContent("light");

    act(() => window.dispatchEvent(new StorageEvent("storage", {
      key: THEME_STORAGE_KEY,
      newValue: "sepia",
    })));
    expect(screen.getByTestId("preference")).toHaveTextContent("system");
    expect(screen.getByTestId("resolved-theme")).toHaveTextContent("dark");

    act(() => window.dispatchEvent(new StorageEvent("storage", {
      key: "unrelated",
      newValue: "light",
    })));
    expect(screen.getByTestId("preference")).toHaveTextContent("system");
  });

  test("浏览器没有 matchMedia 时仍可显式切换", async () => {
    vi.stubGlobal("matchMedia", undefined);
    render(<ThemeProvider><ThemeProbe /></ThemeProvider>);
    await userEvent.click(screen.getByRole("button", { name: "黑夜" }));
    expect(screen.getByTestId("resolved-theme")).toHaveTextContent("dark");
  });

  test("Provider 外使用 hook 会报告组件边界错误", () => {
    expect(() => render(<ThemeProbe />)).toThrow("useTheme 必须在 ThemeProvider 内使用");
  });
});
