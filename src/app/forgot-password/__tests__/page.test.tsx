/** 忘记密码页：结果不明时进入可验证流程且保留发码冷却。 */

import { beforeEach, describe, expect, test, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";

const { mockForgot, mockPush } = vi.hoisted(() => ({
  mockForgot: { mutateAsync: vi.fn() },
  mockPush: vi.fn(),
}));

vi.mock("@/api/hooks/use-auth-actions", () => ({
  useForgotPassword: () => mockForgot,
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

import ForgotPasswordPage from "@/app/forgot-password/page";

beforeEach(() => {
  vi.clearAllMocks();
  window.sessionStorage.clear();
});

describe("ForgotPasswordPage", () => {
  test("网络结果不明时进入重置页并写入跨页冷却", async () => {
    mockForgot.mutateAsync.mockRejectedValue(new Error("network disconnected"));
    render(<ForgotPasswordPage />);

    fireEvent.change(document.getElementById("email")!, {
      target: { value: "user@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "发送重置验证码" }));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/reset-password");
    });
    expect(window.sessionStorage.getItem("wenyousite:email-code-cooldown-until")).not.toBeNull();
  });
});
