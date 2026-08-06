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

const verifiedUser = {
  id: "u1",
  email: "user@example.com",
  username: "用户",
  avatar: null,
  role: "USER",
  emailVerified: true,
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

  test("需要已验证邮箱时拦截未验证用户", async () => {
    mockUseAuth.mockReturnValue({
      user: { ...verifiedUser, emailVerified: false },
      isInitialized: true,
    });

    render(<RequireAuth requireVerifiedEmail>私有内容</RequireAuth>);

    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith("/verify-email"),
    );
    expect(screen.queryByText("私有内容")).not.toBeInTheDocument();
  });

  test("符合要求时渲染受保护内容", () => {
    mockUseAuth.mockReturnValue({ user: verifiedUser, isInitialized: true });

    render(<RequireAuth requireVerifiedEmail>私有内容</RequireAuth>);

    expect(screen.getByText("私有内容")).toBeVisible();
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
