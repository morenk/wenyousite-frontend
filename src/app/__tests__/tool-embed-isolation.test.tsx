import { afterEach, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
const state = vi.hoisted(() => ({ path: "/tools/embed", theme: "dark", auth: vi.fn(), checkIn: vi.fn(), download: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => state.path, useSearchParams: () => new URLSearchParams({ theme: state.theme }) }));
vi.mock("@/lib/auth", () => ({ AuthProvider: () => { state.auth(); throw new Error("认证不得挂载"); }, useAuth: () => { throw new Error("认证不得读取"); } }));
vi.mock("@/components/download/app-download-provider", () => ({ AppDownloadProvider: () => { state.download(); throw new Error("下载不得挂载"); } }));
vi.mock("@/components/economy/daily-check-in-bootstrap", () => ({ DailyCheckInBootstrap: () => { state.checkIn(); throw new Error("签到不得挂载"); } }));
import { Providers } from "@/app/providers";
import { AppChrome, getAppChromeMode } from "@/components/layout/app-chrome";
afterEach(() => { cleanup(); vi.clearAllMocks(); });
test.each(["/tools/embed", "/tools/embed/names", "/tools/embed/unknown"])("%s 不挂载业务初始化或侧栏", (path) => {
  state.path = path;
  const fetch = vi.spyOn(globalThis, "fetch");
  render(<Providers><AppChrome><p>匿名工具</p></AppChrome></Providers>);
  expect(screen.getByText("匿名工具")).toBeInTheDocument();
  expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  expect(state.auth).not.toHaveBeenCalled(); expect(state.checkIn).not.toHaveBeenCalled(); expect(state.download).not.toHaveBeenCalled();
  expect(fetch).not.toHaveBeenCalled(); fetch.mockRestore();
  expect(document.documentElement.dataset.theme).toBe("dark");
});
test("普通工具页保留工作区，类似前缀不误判", () => {
  expect(getAppChromeMode("/tools")).toBe("workspace");
  expect(getAppChromeMode("/tools/names")).toBe("workspace");
  expect(getAppChromeMode("/tools/embedded")).toBe("workspace");
  expect(getAppChromeMode("/login")).toBe("auth");
});
