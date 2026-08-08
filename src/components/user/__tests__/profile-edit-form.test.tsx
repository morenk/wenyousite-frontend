/** ProfileEditForm 组件测试：账户信息（脱敏邮箱/验证状态）、Bio textarea、隐私开关、账号安全入口 */

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import type { UserMe } from "@/api/hooks/use-me";

const { mockMe } = vi.hoisted(() => ({
  mockMe: vi.fn(),
}));

vi.mock("@/api/hooks/use-me", () => ({
  useMe: () => mockMe(),
}));

vi.mock("@/api/hooks/use-update-profile", () => ({
  useUpdateProfile: () => ({ isPending: false, mutateAsync: vi.fn() }),
}));

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ user: { id: "u1" }, isInitialized: true }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }),
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

import { ProfileEditForm } from "@/components/user/profile-edit-form";

const baseMe = {
  id: "u1",
  email: "alice@example.com",
  username: "alice",
  avatar: null,
  bio: "",
  role: "USER" as const,
  level: 3,
  experience: 120,
  currentLevelExperience: 100,
  nextLevelExperience: 200,
  receivedTipTotal: "9007199254740993",
  receivedTipCount: 7,
  showRecentReplies: true,
  showPlayerBadges: true,
  showBookmarks: true,
  emailVerified: false,
  deletedAt: null,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  _count: { following: 0, followers: 0 },
} satisfies UserMe;

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

  test("展示当前等级、经验进度和精确累计收款", () => {
    render(<ProfileEditForm />, { wrapper: createWrapper() });
    expect(screen.getByText("Lv.3")).toBeInTheDocument();
    expect(screen.getByText("120 经验")).toBeInTheDocument();
    expect(screen.getByText("下一级 200")).toBeInTheDocument();
    expect(screen.getByText("累计收到 9,007,199,254,740,993 升温油，共 7 次投入")).toBeInTheDocument();
  });

  test("最高等级显示已达最高等级", () => {
    mockMe.mockReturnValue({
      data: { ...baseMe, level: 9, nextLevelExperience: null },
      isLoading: false,
      error: null,
    });
    render(<ProfileEditForm />, { wrapper: createWrapper() });
    expect(screen.getByText("Lv.9")).toBeInTheDocument();
    expect(screen.getByText("已达最高等级")).toBeInTheDocument();
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

  test("账号安全区提供修改密码与更换邮箱入口链接", () => {
    render(<ProfileEditForm />, { wrapper: createWrapper() });
    expect(screen.getByRole("link", { name: /修改密码/ })).toHaveAttribute(
      "href",
      "/me/password",
    );
    expect(screen.getByRole("link", { name: /更换邮箱/ })).toHaveAttribute(
      "href",
      "/me/email",
    );
  });
});
