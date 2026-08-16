/** 注册页测试：发送验证码进入第二步、可「换个邮箱」返回第一步 */

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";

const { mockSendCode, mockRegisterComplete } = vi.hoisted(() => ({
  mockSendCode: { mutateAsync: vi.fn() },
  mockRegisterComplete: { mutateAsync: vi.fn() },
}));

vi.mock("@/api/hooks/use-register", () => ({
  useSendRegisterCode: () => mockSendCode,
  useRegisterComplete: () => mockRegisterComplete,
}));

const { mockReplace } = vi.hoisted(() => ({ mockReplace: vi.fn() }));

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ user: null, isInitialized: true, setAuth: vi.fn() }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace, push: vi.fn() }),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: ReactNode; href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

import RegisterPage from "@/app/register/page";

beforeEach(() => {
  vi.clearAllMocks();
  window.sessionStorage.clear();
  mockSendCode.mutateAsync.mockResolvedValue({
    code: 0,
    data: { emailSent: true, codeExpiresIn: 900 },
  });
  mockRegisterComplete.mutateAsync.mockResolvedValue({});
});

afterEach(() => cleanup());

describe("RegisterPage", () => {
  test("发送验证码后进入第二步，可换邮箱返回第一步", async () => {
    render(<RegisterPage />);

    // 第一步：输入邮箱发送验证码
    fireEvent.change(document.getElementById("email")!, { target: { value: "a@b.com" } });
    fireEvent.click(screen.getByRole("button", { name: "获取验证码" }));

    await waitFor(() => {
      expect(mockSendCode.mutateAsync).toHaveBeenCalledWith("a@b.com");
    });
    // 进入第二步，显示邮箱与「换个邮箱」
    expect(screen.getByText("a@b.com")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "换个邮箱" })).toBeInTheDocument();

    // 换个邮箱 → 返回第一步
    fireEvent.click(screen.getByRole("button", { name: "换个邮箱" }));
    expect(screen.getByRole("button", { name: "获取验证码" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "换个邮箱" })).not.toBeInTheDocument();
  });

  test("已注册邮箱发送验证码提示错误，不进入第二步", async () => {
    mockSendCode.mutateAsync.mockRejectedValue({ code: 40900, message: "该邮箱已注册" });
    render(<RegisterPage />);

    fireEvent.change(document.getElementById("email")!, { target: { value: "taken@b.com" } });
    fireEvent.click(screen.getByRole("button", { name: "获取验证码" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "获取验证码" })).toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: "换个邮箱" })).not.toBeInTheDocument();
  });

  test("请求结果不明时进入验证码步骤并阻止立即重发", async () => {
    mockSendCode.mutateAsync.mockRejectedValue(new Error("network disconnected"));
    render(<RegisterPage />);

    fireEvent.change(document.getElementById("email")!, { target: { value: "maybe@b.com" } });
    fireEvent.click(screen.getByRole("button", { name: "获取验证码" }));

    await waitFor(() => {
      expect(screen.getByText("maybe@b.com")).toBeInTheDocument();
    });
    expect(screen.getByText(/秒后可重新发送/)).toBeInTheDocument();
  });

  test("仅有 HTTP 429 状态时也进入验证码步骤和冷却", async () => {
    mockSendCode.mutateAsync.mockRejectedValue({ status: 429, message: "Too Many Requests" });
    render(<RegisterPage />);

    fireEvent.change(document.getElementById("email")!, { target: { value: "rate@b.com" } });
    fireEvent.click(screen.getByRole("button", { name: "获取验证码" }));

    await waitFor(() => {
      expect(screen.getByText("rate@b.com")).toBeInTheDocument();
    });
    expect(screen.getByText(/秒后可重新发送/)).toBeInTheDocument();
  });
});
