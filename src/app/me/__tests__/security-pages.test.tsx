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

import ChangePasswordPage from "@/app/me/password/page";
import ChangeEmailPage from "@/app/me/email/page";
import AccountSecurityPage from "@/app/me/security/page";
import MeLayout from "@/app/me/layout";

const authedUser = { id: "u1", username: "tester" };

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => cleanup());

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
