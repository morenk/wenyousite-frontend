/** 重置密码页：发码结果不明时展示冷却，避免立即重复请求。 */

import { beforeEach, describe, expect, test, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";

const { mockForgot, mockReset, mockPush } = vi.hoisted(() => ({
  mockForgot: { mutateAsync: vi.fn() },
  mockReset: { mutateAsync: vi.fn() },
  mockPush: vi.fn(),
}));

vi.mock("@/api/hooks/use-auth-actions", () => ({
  useForgotPassword: () => mockForgot,
  useResetPassword: () => mockReset,
}));

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ logout: vi.fn() }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: ReactNode; href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

import ResetPasswordPage from "@/app/reset-password/page";

beforeEach(() => {
  vi.clearAllMocks();
  window.sessionStorage.clear();
});

describe("ResetPasswordPage", () => {
  test("网络结果不明时禁用重发按钮 60 秒", async () => {
    mockForgot.mutateAsync.mockRejectedValue(new Error("network disconnected"));
    render(<ResetPasswordPage />);

    fireEvent.change(document.getElementById("email")!, {
      target: { value: "user@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "发送验证码" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /秒后重发/ })).toBeDisabled();
    });
    expect(mockForgot.mutateAsync).toHaveBeenCalledWith({ email: "user@example.com" });
  });
});
