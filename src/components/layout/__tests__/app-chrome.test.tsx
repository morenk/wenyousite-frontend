import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { AppChrome, getAppChromeMode } from "@/components/layout/app-chrome";

describe("AppChrome 路由模式", () => {
  test.each(["/", "/search", "/threads/t1", "/users/u1", "/wallet", "/moments", "/moments/m1"])(
    "%s 使用社区三栏",
    (pathname) => {
      expect(getAppChromeMode(pathname)).toBe("community");
    },
  );

  test.each(["/me", "/me/appearance", "/me/privacy", "/me/security", "/me/password", "/me/email", "/bookmarks", "/messages", "/messages/c1", "/threads/create", "/threads/t1/edit"])(
    "%s 使用宽工作区",
    (pathname) => {
      expect(getAppChromeMode(pathname)).toBe("workspace");
    },
  );

  test.each(["/login", "/register", "/forgot-password", "/reset-password"])(
    "%s 使用认证页骨架",
    (pathname) => {
      expect(getAppChromeMode(pathname)).toBe("auth");
    },
  );
});


const { mockPathname, mockAuth } = vi.hoisted(() => ({ mockPathname: vi.fn(), mockAuth: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => mockPathname() }));
vi.mock("@/lib/auth", () => ({ useAuth: () => mockAuth() }));
vi.mock("@/api/hooks/use-unread-count", () => ({ useUnreadCount: () => ({ data: 0 }) }));
vi.mock("@/api/hooks/use-direct-conversations", () => ({ useDirectUnreadCount: () => ({ data: { total: 0 } }) }));
vi.mock("@/components/layout/nav-bar", () => ({ NavBar: () => <aside aria-label="全局导航" /> }));
vi.mock("@/components/layout/app-context-rail", () => ({ AppContextRail: () => <aside aria-label="快捷信息" /> }));
vi.mock("@/components/layout/theme-menu", () => ({ ThemeMenu: () => <button aria-label="外观" /> }));

beforeEach(() => { vi.clearAllMocks(); mockAuth.mockReturnValue({ user: null }); });
afterEach(cleanup);

test("社区与工作区切换持续保留同一右栏与网格", () => {
  mockPathname.mockReturnValue("/");
  const { container, rerender } = render(<AppChrome>内容</AppChrome>);
  const rail = screen.getByRole("complementary", { name: "快捷信息" });
  const grid = container.querySelector('[data-slot="app-chrome"]')?.className;
  for (const path of ["/bookmarks", "/me", "/messages", "/threads/create", "/tools", "/moments"]) {
    mockPathname.mockReturnValue(path);
    rerender(<AppChrome>内容</AppChrome>);
    expect(screen.getByRole("complementary", { name: "快捷信息" })).toBe(rail);
    expect(container.querySelector('[data-slot="app-chrome"]')?.className).toBe(grid);
  }
});

test.each(["/login", "/station", "/tools/embed", "/tools/embed/vertical"])("%s 不挂主站账户栏或查询", (path) => {
  mockPathname.mockReturnValue(path);
  render(<AppChrome>内容</AppChrome>);
  expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
  expect(mockAuth).not.toHaveBeenCalled();
});
