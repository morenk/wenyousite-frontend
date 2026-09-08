/** ProfileEditForm 组件测试：分区保存、草稿保留、内联错误与撤销 */

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import type { UserMe } from "@/api/hooks/use-me";

const { mockMe, mutateAsync } = vi.hoisted(() => ({
  mockMe: vi.fn(), mutateAsync: vi.fn(),
}));

vi.mock("@/api/hooks/use-me", () => ({
  useMe: () => mockMe(),
}));

vi.mock("@/api/hooks/use-update-profile", () => ({
  useUpdateProfile: () => ({ isPending: false, mutateAsync }),
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

vi.mock("@/components/user/profile-cover-uploader", () => ({
  ProfileCoverUploader: () => <div data-testid="profile-cover-uploader" />,
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
  profileCover: null,
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
  mutateAsync.mockReset().mockResolvedValue(undefined);
  mockMe.mockReturnValue({ data: baseMe, isLoading: false, error: null });
});

afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/");
});

describe("ProfileEditForm", () => {
  test("加载中显示骨架", () => {
    mockMe.mockReturnValue({ data: undefined, isLoading: true, error: null });
    render(<ProfileEditForm />, { wrapper: createWrapper() });
    expect(screen.getByRole("status", { name: "正在加载资料" })).toBeInTheDocument();
  });

  test("公开资料合并头像、用户名和简介，并在其后展示主页背景", () => {
    render(<ProfileEditForm />, { wrapper: createWrapper() });
    const avatar = screen.getByTestId("avatar-uploader");
    const username = screen.getByTestId("username-edit");
    const bio = screen.getByLabelText("个人简介");
    const cover = screen.getByTestId("profile-cover-uploader");
    expect(avatar.compareDocumentPosition(username) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole("region", { name: "公开资料" })).toContainElement(bio);
    expect(avatar.compareDocumentPosition(cover) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  test("资料后台刷新失败时保留已挂载的上传器", () => {
    const { rerender } = render(<ProfileEditForm />, { wrapper: createWrapper() });
    const uploader = screen.getByTestId("profile-cover-uploader");
    mockMe.mockReturnValue({ data: baseMe, isLoading: false, error: new Error("offline") });
    rerender(<ProfileEditForm />);
    expect(screen.getByTestId("profile-cover-uploader")).toBe(uploader);
    expect(screen.getByRole("alert")).toHaveTextContent("资料刷新失败，当前输入已保留。");
  });

  test("同页进入旧外观锚点时规范化地址", async () => {
    render(<ProfileEditForm />, { wrapper: createWrapper() });
    window.history.replaceState(null, "", "/me#profile-appearance");
    fireEvent(window, new HashChangeEvent("hashchange"));
    await waitFor(() => expect(window.location.hash).toBe("#appearance"));
  });

  test("只有业务码的简介校验错误也映射到字段", async () => {
    mutateAsync.mockRejectedValueOnce({ code: 40000, message: "简介校验失败" });
    const { rerender } = render(<ProfileEditForm />, { wrapper: createWrapper() });
    fireEvent.change(screen.getByLabelText("个人简介"), { target: { value: "草稿" } });
    fireEvent.click(screen.getByRole("button", { name: "保存简介" }));
    expect(await screen.findByText("简介校验失败")).toBeInTheDocument();
    expect(screen.getByLabelText("个人简介")).toHaveAttribute("aria-invalid", "true");
    mockMe.mockReturnValue({ data: { ...baseMe, username: "newname" }, isLoading: false });
    rerender(<ProfileEditForm />);
    expect(screen.getByText("简介校验失败")).toBeInTheDocument();
    expect(screen.getByLabelText("个人简介")).toHaveValue("草稿");
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

  test("个人简介为 textarea 并显示字数统计", () => {
    render(<ProfileEditForm />, { wrapper: createWrapper() });
    const textarea = document.getElementById("bio");
    expect(textarea?.tagName).toBe("TEXTAREA");
    expect(screen.getByText("0/255")).toBeInTheDocument();
    expect(textarea).toHaveAttribute("rows", "3");
  });

  test("隐私标签准确说明回复与收藏目录范围，修改后才可保存", async () => {
    render(<ProfileEditForm />, { wrapper: createWrapper() });
    expect(screen.getByRole("button", { name: "保存隐私设置" })).toBeDisabled();
    expect(screen.getByLabelText("个人简介")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "公开最近回复" })).not.toHaveAttribute("aria-describedby");
    expect(screen.getByRole("checkbox", { name: "公开参与的主题帖" })).not.toHaveAttribute("aria-describedby");
    expect(screen.getByRole("checkbox", { name: "公开收藏" })).toHaveAccessibleDescription("收藏夹名称与归类仅自己可见。");
    fireEvent.click(screen.getByRole("checkbox", { name: "公开最近回复" }));
    fireEvent.click(screen.getByRole("button", { name: "保存隐私设置" }));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith({ showRecentReplies: false, showPlayerBadges: true, showBookmarks: true }));
    expect(await screen.findByText("已保存")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "保存隐私设置" })).toBeDisabled();
  });

  test("简介与隐私草稿同时存在时可分别保存", async () => {
    render(<ProfileEditForm />, { wrapper: createWrapper() });
    fireEvent.change(screen.getByLabelText("个人简介"), { target: { value: "新的简介" } });
    fireEvent.click(screen.getByRole("checkbox", { name: "公开收藏" }));

    fireEvent.click(screen.getByRole("button", { name: "保存简介" }));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith({ bio: "新的简介" }));
    expect(screen.getByRole("button", { name: "保存简介" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "保存隐私设置" })).toBeEnabled();
    expect(screen.getByRole("checkbox", { name: "公开收藏" })).not.toBeChecked();

    fireEvent.click(screen.getByRole("button", { name: "保存隐私设置" }));
    await waitFor(() => expect(mutateAsync).toHaveBeenLastCalledWith({
      showRecentReplies: true,
      showPlayerBadges: true,
      showBookmarks: false,
    }));
  });

  test("用户名变更触发资料刷新时保留简介草稿，撤销回到服务器资料", () => {
    mockMe.mockReturnValue({ data: { ...baseMe, bio: "原简介" }, isLoading: false });
    const { rerender } = render(<ProfileEditForm />, { wrapper: createWrapper() });
    fireEvent.change(screen.getByLabelText("个人简介"), { target: { value: "尚未保存的草稿" } });
    mockMe.mockReturnValue({ data: { ...baseMe, username: "newname", bio: "原简介" }, isLoading: false });
    rerender(<ProfileEditForm />);
    expect(screen.getByLabelText("个人简介")).toHaveValue("尚未保存的草稿");
    expect(screen.getByText("未保存修改")).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole("region", { name: "公开资料" })).getByRole("button", { name: "撤销" }));
    expect(screen.getByLabelText("个人简介")).toHaveValue("原简介");
    expect(screen.getByRole("button", { name: "保存简介" })).toBeDisabled();
  });

  test("简介仅提交自身字段，去除首尾空白并显示保存结果", async () => {
    render(<ProfileEditForm />, { wrapper: createWrapper() });
    fireEvent.change(screen.getByLabelText("个人简介"), { target: { value: " 新简介 " } });
    fireEvent.click(screen.getByRole("button", { name: "保存简介" }));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith({ bio: "新简介" }));
    expect(await screen.findByText("已保存")).toBeInTheDocument();
    expect(screen.getByLabelText("个人简介")).toHaveValue("新简介");
    expect(screen.getByRole("button", { name: "保存简介" })).toBeDisabled();
  });

  test("清空已有简介显示字段错误，不提交无效请求", async () => {
    mockMe.mockReturnValue({ data: { ...baseMe, bio: "原简介" }, isLoading: false });
    render(<ProfileEditForm />, { wrapper: createWrapper() });
    fireEvent.change(screen.getByLabelText("个人简介"), { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "保存简介" }));
    expect(await screen.findByText("简介不能为空；暂不支持清空已填写的简介。")).toBeInTheDocument();
    expect(screen.getByLabelText("个人简介")).toHaveAttribute("aria-invalid", "true");
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  test("保存失败保留输入并可重试，后台刷新失败也不丢失草稿", async () => {
    mutateAsync.mockRejectedValueOnce({ code: 42900, message: "Too many requests" });
    const { rerender } = render(<ProfileEditForm />, { wrapper: createWrapper() });
    fireEvent.change(screen.getByLabelText("个人简介"), { target: { value: "草稿" } });
    fireEvent.click(screen.getByRole("button", { name: "保存简介" }));
    expect(await screen.findByText("操作太频繁，请稍后再试")).toBeInTheDocument();
    expect(screen.getByLabelText("个人简介")).toHaveValue("草稿");
    mockMe.mockReturnValue({ data: baseMe, isLoading: false, error: new Error("offline") });
    rerender(<ProfileEditForm />);
    expect(screen.getByText(/资料刷新失败/)).toBeInTheDocument();
    expect(screen.getByLabelText("个人简介")).toHaveValue("草稿");
    fireEvent.click(screen.getByRole("button", { name: "保存简介" }));
    expect(await screen.findByText("已保存")).toBeInTheDocument();
  });
});
