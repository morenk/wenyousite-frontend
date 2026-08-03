/** ChangePasswordForm 组件测试：校验/提交/成功后登出跳转 */

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const { mockChangePassword } = vi.hoisted(() => ({
  mockChangePassword: { mutateAsync: vi.fn() },
}));

vi.mock("@/api/hooks/use-auth-actions", () => ({
  useChangePassword: () => mockChangePassword,
}));

const { mockLogout } = vi.hoisted(() => ({ mockLogout: vi.fn() }));
const { mockReplace } = vi.hoisted(() => ({ mockReplace: vi.fn() }));

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ user: { id: "u1" }, isInitialized: true, logout: mockLogout }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace, push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { toast } from "sonner";
import { ChangePasswordForm } from "@/components/user/change-password-form";

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  }
  Wrapper.displayName = "QueryClientWrapper";
  return Wrapper;
}

function fillForm() {
  fireEvent.change(document.getElementById("old-password")!, { target: { value: "OldPass123" } });
  fireEvent.change(document.getElementById("new-password")!, { target: { value: "NewPass456" } });
  fireEvent.change(document.getElementById("confirm-password")!, { target: { value: "NewPass456" } });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockChangePassword.mutateAsync.mockResolvedValue(undefined);
});

afterEach(() => cleanup());

describe("ChangePasswordForm", () => {
  test("提交成功后调用接口并登出跳登录", async () => {
    render(<ChangePasswordForm />, { wrapper: createWrapper() });
    fillForm();
    fireEvent.click(screen.getByRole("button", { name: "保存新密码" }));

    await waitFor(() => {
      expect(mockChangePassword.mutateAsync).toHaveBeenCalledWith({
        oldPassword: "OldPass123",
        newPassword: "NewPass456",
      });
    });
    expect(mockLogout).toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith("/login");
  });

  test("两次新密码不一致时不提交", async () => {
    render(<ChangePasswordForm />, { wrapper: createWrapper() });
    fireEvent.change(document.getElementById("old-password")!, { target: { value: "OldPass123" } });
    fireEvent.change(document.getElementById("new-password")!, { target: { value: "NewPass456" } });
    fireEvent.change(document.getElementById("confirm-password")!, { target: { value: "Wrong456" } });
    fireEvent.click(screen.getByRole("button", { name: "保存新密码" }));

    await waitFor(() => {
      expect(screen.getByText("两次输入的新密码不一致")).toBeInTheDocument();
    });
    expect(mockChangePassword.mutateAsync).not.toHaveBeenCalled();
  });

  test("新密码不合规时提示需求", async () => {
    render(<ChangePasswordForm />, { wrapper: createWrapper() });
    fireEvent.change(document.getElementById("old-password")!, { target: { value: "OldPass123" } });
    fireEvent.change(document.getElementById("new-password")!, { target: { value: "short" } });
    fireEvent.change(document.getElementById("confirm-password")!, { target: { value: "short" } });
    fireEvent.click(screen.getByRole("button", { name: "保存新密码" }));

    await waitFor(() => {
      expect(screen.getByText("密码至少 8 位")).toBeInTheDocument();
    });
    expect(mockChangePassword.mutateAsync).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });
});
