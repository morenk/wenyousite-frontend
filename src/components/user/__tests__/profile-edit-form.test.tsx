/** ProfileEditForm 组件测试：账户信息（脱敏邮箱/验证状态）、Bio textarea、隐私开关 */

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const { mockMe } = vi.hoisted(() => ({
  mockMe: vi.fn(),
}));

const { mockChangePassword } = vi.hoisted(() => ({
  mockChangePassword: { mutateAsync: vi.fn() },
}));

vi.mock("@/api/hooks/use-me", () => ({
  useMe: () => mockMe(),
}));

vi.mock("@/api/hooks/use-update-profile", () => ({
  useUpdateProfile: () => ({ isPending: false, mutateAsync: vi.fn() }),
}));

vi.mock("@/api/hooks/use-auth-actions", () => ({
  useChangePassword: () => mockChangePassword,
  useChangeEmailRequest: () => mockChangeEmailRequest,
  useChangeEmailVerify: () => mockChangeEmailVerify,
}));

const { mockChangeEmailRequest } = vi.hoisted(() => ({
  mockChangeEmailRequest: { mutateAsync: vi.fn() },
}));

const { mockChangeEmailVerify } = vi.hoisted(() => ({
  mockChangeEmailVerify: { mutateAsync: vi.fn() },
}));

const { mockLogout } = vi.hoisted(() => ({ mockLogout: vi.fn() }));

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ user: { id: "u1" }, isInitialized: true, logout: mockLogout }),
}));

const { mockReplace } = vi.hoisted(() => ({ mockReplace: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace, push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: ReactNode; href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock("@/components/user/username-edit", () => ({
  UsernameEdit: () => <div data-testid="username-edit" />,
}));

vi.mock("@/components/user/avatar-uploader", () => ({
  AvatarUploader: () => <div data-testid="avatar-uploader" />,
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { toast } from "sonner";
import { ProfileEditForm } from "@/components/user/profile-edit-form";

const baseMe = {
  id: "u1",
  email: "alice@example.com",
  username: "alice",
  avatar: null,
  bio: "",
  role: "USER",
  showRecentReplies: true,
  showPlayerBadges: true,
  showBookmarks: true,
  emailVerified: false,
  deletedAt: null,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  _count: { following: 0, followers: 0 },
};

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
  mockMe.mockReturnValue({ data: baseMe, isLoading: false, error: null });
  mockChangePassword.mutateAsync.mockResolvedValue(undefined);
  mockChangeEmailRequest.mutateAsync.mockResolvedValue({ message: "验证码已发送，请查收新邮箱" });
  mockChangeEmailVerify.mutateAsync.mockResolvedValue({ message: "邮箱已成功更换" });
});

afterEach(() => cleanup());

describe("ProfileEditForm", () => {
  test("加载中显示 spinner", () => {
    mockMe.mockReturnValue({ data: undefined, isLoading: true, error: null });
    render(<ProfileEditForm />, { wrapper: createWrapper() });
    expect(document.querySelector(".animate-spin")).toBeTruthy();
  });

  test("展示脱敏邮箱与未认证徽章，并跳转验证页链接", () => {
    render(<ProfileEditForm />, { wrapper: createWrapper() });
    expect(screen.getByText("a***@example.com")).toBeInTheDocument();
    expect(screen.getByText("未认证")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "去验证" })).toHaveAttribute(
      "href",
      "/verify-email",
    );
  });

  test("已认证时显示已认证徽章，无去验证链接", () => {
    mockMe.mockReturnValue({
      data: { ...baseMe, emailVerified: true },
      isLoading: false,
      error: null,
    });
    render(<ProfileEditForm />, { wrapper: createWrapper() });
    expect(screen.getByText("已认证")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "去验证" })).not.toBeInTheDocument();
  });

  test("个人简介为 textarea 并显示字数统计", () => {
    render(<ProfileEditForm />, { wrapper: createWrapper() });
    const textarea = document.getElementById("bio");
    expect(textarea?.tagName).toBe("TEXTAREA");
    expect(screen.getByText("0/255")).toBeInTheDocument();
  });

  test("渲染隐私设置开关", () => {
    render(<ProfileEditForm />, { wrapper: createWrapper() });
    expect(screen.getByText("公开最近动态")).toBeInTheDocument();
    expect(screen.getByText("公开玩家标记")).toBeInTheDocument();
    expect(screen.getByText("公开收藏")).toBeInTheDocument();
  });

  test("修改密码成功后登出并跳转登录页", async () => {
    render(<ProfileEditForm />, { wrapper: createWrapper() });
    fireEvent.change(document.getElementById("old-password")!, { target: { value: "OldPass123" } });
    fireEvent.change(document.getElementById("new-password")!, { target: { value: "NewPass456" } });
    fireEvent.change(document.getElementById("confirm-password")!, { target: { value: "NewPass456" } });
    fireEvent.click(screen.getByRole("button", { name: "修改密码" }));

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
    render(<ProfileEditForm />, { wrapper: createWrapper() });
    fireEvent.change(document.getElementById("old-password")!, { target: { value: "OldPass123" } });
    fireEvent.change(document.getElementById("new-password")!, { target: { value: "NewPass456" } });
    fireEvent.change(document.getElementById("confirm-password")!, { target: { value: "Wrong456" } });
    fireEvent.click(screen.getByRole("button", { name: "修改密码" }));

    await waitFor(() => {
      expect(screen.getByText("两次输入的新密码不一致")).toBeInTheDocument();
    });
    expect(mockChangePassword.mutateAsync).not.toHaveBeenCalled();
  });

  test("发送换邮箱验证码后确认更换成功", async () => {
    render(<ProfileEditForm />, { wrapper: createWrapper() });
    fireEvent.change(document.getElementById("new-email")!, { target: { value: "new@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "发送验证码" }));

    await waitFor(() => {
      expect(mockChangeEmailRequest.mutateAsync).toHaveBeenCalledWith("new@example.com");
    });

    fireEvent.change(document.getElementById("email-code")!, { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "确认更换" }));

    await waitFor(() => {
      expect(mockChangeEmailVerify.mutateAsync).toHaveBeenCalledWith({
        newEmail: "new@example.com",
        code: "123456",
      });
    });
    expect(toast.success).toHaveBeenCalledWith("邮箱已更换");
  });

  test("换邮箱验证码未发送时确认按钮禁用", () => {
    render(<ProfileEditForm />, { wrapper: createWrapper() });
    expect(screen.getByRole("button", { name: "确认更换" })).toBeDisabled();
  });
});
