/** NavBar 测试：登录状态导航与收藏入口布局 */

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
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/lib/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("@/api/hooks/use-unread-count", () => ({
  useUnreadCount: () => ({ data: 0 }),
}));

vi.mock("@/api/hooks/use-auth-actions", () => ({
  useLogout: () => ({ mutateAsync: mockLogoutMutate }),
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
  test("登录后不在全局导航栏展示收藏入口", () => {
    mockUseAuth.mockReturnValue({ user: { id: "u1", username: "用户" }, logout: vi.fn() });
    render(<NavBar />);

    expect(screen.queryByRole("link", { name: "收藏" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "通知" })).toHaveAttribute("href", "/notifications");
    expect(screen.getByRole("link", { name: "用户" })).toHaveAttribute("href", "/users/u1");
  });

  test("未登录时显示登录和注册入口", () => {
    mockUseAuth.mockReturnValue({ user: null, logout: vi.fn() });
    render(<NavBar />);

    expect(screen.getByRole("link", { name: "登录" })).toHaveAttribute("href", "/login");
    expect(screen.getByRole("link", { name: "注册" })).toHaveAttribute("href", "/register");
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
