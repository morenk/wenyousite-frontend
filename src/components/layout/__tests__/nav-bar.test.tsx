/** NavBar 测试：全局导航与响应式账户入口布局 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NavBar } from "@/components/layout/nav-bar";

const { mockUseAuth, mockLogoutMutate, mockToastError } = vi.hoisted(() => ({
  mockUseAuth: vi.fn(),
  mockLogoutMutate: vi.fn(),
  mockToastError: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/lib/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("@/api/hooks/use-unread-count", () => ({
  useUnreadCount: () => ({ data: 0 }),
}));

vi.mock("@/api/hooks/use-direct-conversations", () => ({
  useDirectUnreadCount: () => ({
    data: { unreadMessageCount: 0, pendingRequestCount: 0, total: 0 },
  }),
}));

vi.mock("@/api/hooks/use-auth-actions", () => ({
  useLogout: () => ({ mutateAsync: mockLogoutMutate }),
}));

vi.mock("@/api/hooks/use-economy", () => ({
  useWallet: () => ({ data: { balance: "8" } }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: mockToastError },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockLogoutMutate.mockResolvedValue(undefined);
});

afterEach(() => cleanup());

describe("NavBar", () => {
  test("登录后展示统一发布与个人导航入口", () => {
    mockUseAuth.mockReturnValue({ user: { id: "u1", username: "用户" }, logout: vi.fn() });
    render(<NavBar />);

    expect(screen.getByRole("button", { name: "打开发布菜单" })).toBeInTheDocument();
    expect(screen.getByText("发布")).toHaveClass("font-display");
    expect(screen.getByRole("link", { name: "收藏" })).toHaveClass("xl:hidden");
    expect(screen.getByRole("link", { name: "通知" })).toHaveClass("xl:hidden");
    expect(screen.getByRole("link", { name: "私聊" })).toHaveClass("xl:hidden");
    expect(screen.getByRole("link", { name: "用户" })).toHaveClass("xl:hidden");
  });

  test("未登录时显示登录和注册入口", () => {
    mockUseAuth.mockReturnValue({ user: null, logout: vi.fn() });
    render(<NavBar />);

    const login = screen.getByRole("link", { name: "登录" });
    expect(login).toHaveAttribute("href", "/login");
    expect(screen.getByRole("link", { name: "注册" })).toHaveAttribute("href", "/register");
    expect(login.parentElement).toHaveClass("xl:hidden");
    expect(screen.queryByRole("button", { name: "打开发布菜单" })).not.toBeInTheDocument();
  });

  test("工作区紧凑模式只收窄布局，不改变宽屏按钮集合", () => {
    mockUseAuth.mockReturnValue({ user: { id: "u1", username: "用户" }, logout: vi.fn() });
    render(<NavBar compact />);

    expect(screen.getByRole("complementary", { name: "全局导航" })).toHaveAttribute(
      "data-compact",
      "true",
    );
    expect(screen.getByText("温油站")).not.toHaveClass("xl:block");
    expect(screen.getByText("发现")).not.toHaveClass("xl:inline");
    expect(screen.getByText("发布")).not.toHaveClass("xl:inline");
    expect(screen.getByRole("link", { name: "通知" })).toHaveClass("xl:hidden");
    expect(screen.getByRole("link", { name: "私聊" })).toHaveClass("xl:hidden");
    expect(screen.getByRole("link", { name: "收藏" })).toHaveClass("xl:hidden");
    expect(screen.getByRole("link", { name: "用户" })).toHaveClass("xl:hidden");
  });

  test("访客紧凑模式不会在宽屏额外显示登录注册按钮", () => {
    mockUseAuth.mockReturnValue({ user: null, logout: vi.fn() });
    render(<NavBar compact />);

    expect(screen.getByRole("link", { name: "登录" }).parentElement).toHaveClass(
      "xl:hidden",
    );
  });

  test("服务端未能撤销终端时保留本地登录态并提示重试", async () => {
    const logout = vi.fn();
    mockUseAuth.mockReturnValue({ user: { id: "u1", username: "用户" }, logout });
    mockLogoutMutate.mockRejectedValue({ message: "network" });
    render(<NavBar />);

    await userEvent.click(screen.getByRole("button", { name: "退出" }));

    expect(logout).not.toHaveBeenCalled();
    expect(mockToastError).toHaveBeenCalledWith("退出失败，请检查网络后重试");
  });
});
