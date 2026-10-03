import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { RequireAuth } from "@/components/auth/require-auth";

const { mockReplace, mockUseAuth } = vi.hoisted(() => ({
  mockReplace: vi.fn(),
  mockUseAuth: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/bookmarks",
  useRouter: () => ({ replace: mockReplace }),
}));

vi.mock("@/lib/auth", () => ({ useAuth: () => mockUseAuth() }));

const loggedInUser = {
  id: "u1",
  email: "user@example.com",
  username: "用户",
  avatar: null,
  role: "USER",
};

beforeEach(() => {
  mockReplace.mockReset();
});

afterEach(cleanup);

describe("RequireAuth", () => {
  test("认证状态尚未初始化时只显示状态提示", () => {
    mockUseAuth.mockReturnValue({ user: null, isInitialized: false });

    render(<RequireAuth>私有内容</RequireAuth>);

    expect(screen.getByRole("status", { name: "正在验证登录状态" })).toBeVisible();
    expect(screen.queryByText("私有内容")).not.toBeInTheDocument();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  test("未登录时保留当前路径并跳转登录页", async () => {
    mockUseAuth.mockReturnValue({ user: null, isInitialized: true });

    render(<RequireAuth>私有内容</RequireAuth>);

    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith("/login?next=%2Fbookmarks"),
    );
    expect(screen.queryByText("私有内容")).not.toBeInTheDocument();
  });

  test("已登录用户渲染受保护内容", () => {
    mockUseAuth.mockReturnValue({ user: loggedInUser, isInitialized: true });

    render(<RequireAuth>私有内容</RequireAuth>);

    expect(screen.getByText("私有内容")).toBeVisible();
    expect(mockReplace).not.toHaveBeenCalled();
  });
});


test("主动退出使用业务成功落点，不覆盖为原表单的登录地址", async () => {
  mockUseAuth.mockReturnValue({ user: loggedInUser, isInitialized: true, logoutDestination: null });
  const view = render(<RequireAuth>换绑表单</RequireAuth>);
  mockUseAuth.mockReturnValue({ user: null, isInitialized: true, logoutDestination: "/login?next=%2Fme%23security" });
  view.rerender(<RequireAuth>换绑表单</RequireAuth>);
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/login?next=%2Fme%23security"));
  expect(mockReplace.mock.calls.every(([href]) => href === "/login?next=%2Fme%23security")).toBe(true);
  expect(screen.queryByText("换绑表单")).not.toBeInTheDocument();
  view.unmount();
  mockReplace.mockClear();
  mockUseAuth.mockReturnValue({ user: null, isInitialized: true, logoutDestination: null });
  render(<RequireAuth>后续访问</RequireAuth>);
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/login?next=%2Fbookmarks"));
});
