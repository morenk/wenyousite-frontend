/** ChangeEmailForm 组件测试：当前密码认证、发码、确认更换、成功态 */

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const { mockChangeEmailRequest } = vi.hoisted(() => ({
  mockChangeEmailRequest: { mutateAsync: vi.fn() },
}));
const { mockChangeEmailVerify } = vi.hoisted(() => ({
  mockChangeEmailVerify: { mutateAsync: vi.fn() },
}));
const { mockReplace } = vi.hoisted(() => ({
  mockReplace: vi.fn(),
}));

vi.mock("@/api/hooks/use-auth-actions", () => ({
  useChangeEmailRequest: () => mockChangeEmailRequest,
  useChangeEmailVerify: () => mockChangeEmailVerify,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { toast } from "sonner";
import { ChangeEmailForm } from "@/components/user/change-email-form";

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  }
  Wrapper.displayName = "QueryClientWrapper";
  return Wrapper;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockChangeEmailRequest.mutateAsync.mockResolvedValue({ message: "验证码已发送，请查收新邮箱" });
  mockChangeEmailVerify.mutateAsync.mockResolvedValue({ message: "邮箱已成功更换" });
});

afterEach(() => cleanup());

describe("ChangeEmailForm", () => {
  test("发送验证码时携带当前密码与新邮箱", async () => {
    render(<ChangeEmailForm />, { wrapper: createWrapper() });
    fireEvent.change(document.getElementById("change-old-password")!, { target: { value: "CurrentPass123" } });
    fireEvent.change(document.getElementById("new-email")!, { target: { value: "new@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "发送验证码" }));

    await waitFor(() => {
      expect(mockChangeEmailRequest.mutateAsync).toHaveBeenCalledWith({
        newEmail: "new@example.com",
        oldPassword: "CurrentPass123",
      });
    });
    expect(toast.success).toHaveBeenCalledWith("验证码已发送至新邮箱");
  });

  test("确认更换成功后跳转回资料页", async () => {
    render(<ChangeEmailForm />, { wrapper: createWrapper() });
    fireEvent.change(document.getElementById("change-old-password")!, { target: { value: "CurrentPass123" } });
    fireEvent.change(document.getElementById("new-email")!, { target: { value: "new@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "发送验证码" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "确认更换" })).toBeEnabled());

    fireEvent.change(document.getElementById("email-code")!, { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "确认更换" }));

    await waitFor(() => {
      expect(mockChangeEmailVerify.mutateAsync).toHaveBeenCalledWith({
        newEmail: "new@example.com",
        code: "123456",
      });
    });
    expect(toast.success).toHaveBeenCalledWith("邮箱已更换");
    expect(mockReplace).toHaveBeenCalledWith("/me");
    expect(screen.queryByText("邮箱已更换")).not.toBeInTheDocument();
  });

  test("验证码未发送时确认按钮禁用", () => {
    render(<ChangeEmailForm />, { wrapper: createWrapper() });
    expect(screen.getByRole("button", { name: "确认更换" })).toBeDisabled();
  });
});
