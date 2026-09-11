import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { ThemeMenu } from "@/components/layout/theme-menu";
import { ThemeProvider } from "@/components/ui/theme-provider";
import { setCoverDataSaver } from "@/hooks/cover-playback";
import { THEME_STORAGE_KEY } from "@/lib/theme";

beforeEach(() => {
  localStorage.clear(); setCoverDataSaver(false);
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.removeAttribute("data-theme-preference");
  vi.stubGlobal("matchMedia", vi.fn(() => ({
    matches: false,
    media: "(prefers-color-scheme: dark)",
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })));
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("ThemeMenu", () => {
  test("localStorage配额写失败但读取仍可用时，临时省流量开关双向同步", async () => {
    const existingStorage = localStorage;
    vi.stubGlobal("localStorage", { getItem: existingStorage.getItem.bind(existingStorage),
      setItem: () => { throw new Error("quota"); } });
    render(<ThemeProvider><ThemeMenu /></ThemeProvider>);
    await userEvent.click(screen.getByRole("button", { name: "外观：跟随系统" }));
    const toggle = screen.getByRole("checkbox", { name: /省流量/ });
    expect(toggle).not.toBeChecked();
    await userEvent.click(toggle); expect(toggle).toBeChecked();
    await userEvent.click(toggle); expect(toggle).not.toBeChecked();
  });

  test("访客可发现省流量入口，切换立即持久化并在重载菜单时恢复", async () => {
    const view = render(<ThemeProvider><ThemeMenu /></ThemeProvider>);
    await userEvent.click(screen.getByRole("button", { name: "外观：跟随系统" }));
    const toggle = screen.getByRole("checkbox", { name: /省流量/ });
    expect(toggle).not.toBeChecked();
    await userEvent.click(toggle);
    expect(localStorage.getItem("wenyou:cover-data-saver")).toBe("true");
    view.unmount();
    render(<ThemeProvider><ThemeMenu /></ThemeProvider>);
    await userEvent.click(screen.getByRole("button", { name: "外观：跟随系统" }));
    expect(screen.getByRole("checkbox", { name: /省流量/ })).toBeChecked();
  });

  test("展示三种中央偏好并即时切换黑夜", async () => {
    render(<ThemeProvider><ThemeMenu /></ThemeProvider>);
    const trigger = screen.getByRole("button", { name: "外观：跟随系统" });
    await userEvent.click(trigger);

    const group = screen.getByRole("group", { name: "选择页面外观" });
    expect(within(group).getAllByRole("radio")).toHaveLength(3);
    expect(within(group).getByRole("radio", { name: "跟随系统" })).toBeChecked();

    await userEvent.click(within(group).getByRole("radio", { name: "黑夜" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "外观：黑夜" })).toBeVisible());
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(screen.queryByRole("group", { name: "选择页面外观" })).not.toBeInTheDocument();
  });

  test("触发器和选项使用 Foundation 外观语义图标", async () => {
    render(<ThemeProvider><ThemeMenu compact /></ThemeProvider>);
    const trigger = screen.getByRole("button", { name: "外观：跟随系统" });
    expect(trigger.querySelector("svg")).toHaveAttribute("data-icon-semantic", "appearance.system");

    await userEvent.click(trigger);
    const darkOption = screen.getByRole("radio", { name: "黑夜" }).nextElementSibling;
    expect(darkOption?.querySelector("svg")).toHaveAttribute("data-icon-semantic", "appearance.dark");
  });
});
