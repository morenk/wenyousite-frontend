/** /me 布局统一登录守卫 + 账号安全子页面渲染 */

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";

const { mockUseAuth } = vi.hoisted(() => ({ mockUseAuth: vi.fn() }));
const { mockReplace } = vi.hoisted(() => ({ mockReplace: vi.fn() }));

vi.mock("@/lib/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace, push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/me",
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: ReactNode; href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock("@/components/user/change-password-form", () => ({
  ChangePasswordForm: () => <div data-testid="change-password-form" />,
}));

vi.mock("@/components/user/change-email-form", () => ({
  ChangeEmailForm: () => <div data-testid="change-email-form" />,
}));

vi.mock("@/components/user/account-security-panel", () => ({
  AccountSecurityPanel: () => <div data-testid="account-security-panel" />,
}));

vi.mock("@/components/user/profile-edit-form", () => ({
  ProfileEditForm: () => <div data-testid="profile-edit-form" />,
}));

import MePage from "@/app/me/page";
import ChangePasswordPage from "@/app/me/password/page";
import ChangeEmailPage from "@/app/me/email/page";
import AccountSecurityPage from "@/app/me/security/page";
import MeLayout from "@/app/me/layout";

const authedUser = { id: "u1", username: "tester" };

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => cleanup());

test.each([
  ["我的资料", MePage],
  ["修改密码", ChangePasswordPage],
  ["更换邮箱", ChangeEmailPage],
  ["账号安全", AccountSecurityPage],
] as const)("%s 页面标题使用功能字体", (title, Page) => {
  render(<Page />);
  const heading = screen.getByRole("heading", { name: title, level: 1 });
  expect(heading).toHaveClass("font-sans", "font-semibold");
  expect(heading).not.toHaveClass("font-display");
});

describe("/me 布局", () => {
  test("未登录时统一保留目标路径并跳转登录页", async () => {
    mockUseAuth.mockReturnValue({ user: null, isInitialized: true });
    render(<MeLayout><ChangePasswordPage /></MeLayout>);
    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith("/login?next=%2Fme"),
    );
    expect(screen.queryByTestId("change-password-form")).not.toBeInTheDocument();
  });
});

describe("/me/password", () => {
  test("已登录渲染修改密码表单", () => {
    mockUseAuth.mockReturnValue({ user: authedUser, isInitialized: true });
    render(<ChangePasswordPage />);
    expect(screen.getByTestId("change-password-form")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /返回资料设置/ })).toHaveAttribute("href", "/me");
  });
});

describe("/me/email", () => {
  test("已登录渲染更换邮箱表单", () => {
    mockUseAuth.mockReturnValue({ user: authedUser, isInitialized: true });
    render(<ChangeEmailPage />);
    expect(screen.getByTestId("change-email-form")).toBeInTheDocument();
  });
});

describe("/me/security", () => {
  test("已登录渲染登录终端管理", () => {
    mockUseAuth.mockReturnValue({ user: authedUser, isInitialized: true });
    render(<AccountSecurityPage />);
    expect(screen.getByTestId("account-security-panel")).toBeInTheDocument();
  });
});
