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

import { ConfirmProvider } from "@/components/ui/confirm-provider";
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
    return <QueryClientProvider client={qc}><ConfirmProvider>{children}</ConfirmProvider></QueryClientProvider>;
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

describe("设置首页", () => {
  test("加载中显示骨架，失败可重试", () => {
    mockMe.mockReturnValue({ data: undefined, isLoading: true, error: null });
    const view = render(<ProfileEditForm />, { wrapper: createWrapper() });
    expect(screen.getByRole("status", { name: "正在加载设置" })).toBeInTheDocument();
    const refetch = vi.fn();
    mockMe.mockReturnValue({ data: undefined, isLoading: false, error: new Error("offline"), refetch });
    view.rerender(<ProfileEditForm />);
    expect(screen.getByText("设置加载失败")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /重试/ }));
    expect(refetch).toHaveBeenCalled();
  });

  test("首页只显示分组摘要，编辑器与危险表单按需挂载", () => {
    render(<ProfileEditForm />, { wrapper: createWrapper() });
    expect(screen.getByRole("region", { name: "个人资料" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "隐私与关系" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "账号与安全" })).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "个人资料" })).getByRole("button", { name: "主页背景" })).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "隐私与关系" })).getByRole("button", { name: "黑名单" })).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "账号与安全" })).getByRole("link", { name: "密码" })).toHaveAttribute("href", "/me/password");
    expect(screen.queryByRole("heading", { name: "其他" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "主页公开范围" })).toHaveAccessibleDescription("最近回复、参与主题帖、收藏");
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.queryByTestId("avatar-uploader")).not.toBeInTheDocument();
    expect(screen.queryByTestId("profile-cover-uploader")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /保存|永久注销/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "邮箱" })).toHaveAttribute("href", "/me/email");
    expect(screen.getByText("a***@example.com")).toBeInTheDocument();
    expect(screen.queryByText(baseMe.email)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "头像" }));
    expect(screen.getByTestId("avatar-uploader")).toBeInTheDocument();
    expect(screen.queryByTestId("profile-cover-uploader")).not.toBeInTheDocument();
  });

  test("简介回填并按 Unicode 字符计数，未修改时不能保存", () => {
    mockMe.mockReturnValue({ data: { ...baseMe, bio: "你好😀" } });
    render(<ProfileEditForm />, { wrapper: createWrapper() });
    fireEvent.click(screen.getByRole("button", { name: "个人简介" }));
    expect(screen.getByRole("textbox", { name: "个人简介" })).toHaveValue("你好😀");
    expect(screen.getByText("3/255")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "保存" })).toBeDisabled();
  });

  test("简介只提交自身字段，保存后关闭并回到原入口", async () => {
    render(<ProfileEditForm />, { wrapper: createWrapper() });
    const trigger = screen.getByRole("button", { name: "个人简介" });
    fireEvent.click(trigger);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "  新的简介  " } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith({ bio: "新的简介" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  test("简介完整保留 255 个 Emoji，超过上限不提交", async () => {
    render(<ProfileEditForm />, { wrapper: createWrapper() });
    fireEvent.click(screen.getByRole("button", { name: "个人简介" }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "😀".repeat(256) } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    expect(await screen.findByText("简介最多 255 个字符")).toBeInTheDocument();
    expect(mutateAsync).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "😀".repeat(255) } });
    expect(screen.getByText("255/255")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith({ bio: "😀".repeat(255) }));
  });

  test("清空已有简介显示字段错误，不提交无效请求", async () => {
    mockMe.mockReturnValue({ data: { ...baseMe, bio: "原来的简介" } });
    render(<ProfileEditForm />, { wrapper: createWrapper() });
    fireEvent.click(screen.getByRole("button", { name: "个人简介" }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    expect(await screen.findByText("简介不能为空；暂不支持清空已填写的简介。")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("textbox", { name: "个人简介" })).toHaveFocus());
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  test("只有业务码的简介校验错误映射到字段", async () => {
    mutateAsync.mockRejectedValueOnce({ code: 40001, message: "简介含有不允许的内容" });
    render(<ProfileEditForm />, { wrapper: createWrapper() });
    fireEvent.click(screen.getByRole("button", { name: "个人简介" }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "简介草稿" } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    expect(await screen.findByText("简介含有不允许的内容")).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toHaveAttribute("aria-invalid", "true");
  });

  test("保存失败保留输入和错误，后台更新不覆盖草稿，可重试", async () => {
    mutateAsync.mockRejectedValueOnce({ code: 42900 });
    const view = render(<ProfileEditForm />, { wrapper: createWrapper() });
    fireEvent.click(screen.getByRole("button", { name: "个人简介" }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "待保存草稿" } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    expect(await screen.findByText("操作太频繁，请稍后再试")).toBeInTheDocument();
    mockMe.mockReturnValue({ data: { ...baseMe, bio: "后台新值" }, error: new Error("refresh failed"), refetch: vi.fn() });
    view.rerender(<ProfileEditForm />);
    expect(screen.getByRole("textbox")).toHaveValue("待保存草稿");
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  test("关闭脏表单先确认，继续编辑保留草稿，放弃后重新打开回填服务器值", async () => {
    render(<ProfileEditForm />, { wrapper: createWrapper() });
    fireEvent.click(screen.getByRole("button", { name: "个人简介" }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "待保存草稿" } });
    fireEvent.click(screen.getByRole("button", { name: "取消" }));
    let confirm = await screen.findByRole("alertdialog", { name: "放弃未保存修改" });
    fireEvent.click(within(confirm).getByRole("button", { name: "继续编辑" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(screen.getByRole("textbox")).toHaveValue("待保存草稿");
    fireEvent.click(screen.getByRole("button", { name: "关闭个人简介" }));
    confirm = await screen.findByRole("alertdialog");
    fireEvent.click(within(confirm).getByRole("button", { name: "放弃修改" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "个人简介" }));
    expect(screen.getByRole("textbox")).toHaveValue("");
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  test("保存期间禁止关闭和重复提交", async () => {
    let finish!: () => void;
    mutateAsync.mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve; }));
    render(<ProfileEditForm />, { wrapper: createWrapper() });
    fireEvent.click(screen.getByRole("button", { name: "个人简介" }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "待保存草稿" } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "保存中" })).toBeDisabled());
    expect(screen.getByRole("button", { name: "取消" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "关闭个人简介" })).toBeDisabled();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(mutateAsync).toHaveBeenCalledTimes(1);
    finish();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  test("公开范围只提交三个布尔字段，失败保留选择", async () => {
    mutateAsync.mockRejectedValueOnce({ code: 42900 });
    render(<ProfileEditForm />, { wrapper: createWrapper() });
    fireEvent.click(screen.getByRole("button", { name: "主页公开范围" }));
    expect(screen.getByRole("button", { name: "保存" })).toBeDisabled();
    expect(screen.getByText("收藏夹名称与归类仅自己可见。")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: "公开收藏" }));
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    expect(await screen.findByText("操作太频繁，请稍后再试")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "公开收藏" })).not.toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() => expect(mutateAsync).toHaveBeenLastCalledWith({ showRecentReplies: true, showPlayerBadges: true, showBookmarks: false }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  test("等级详情保持精确累计收款与最高等级状态", () => {
    mockMe.mockReturnValue({ data: { ...baseMe, nextLevelExperience: null } });
    render(<ProfileEditForm />, { wrapper: createWrapper() });
    fireEvent.click(screen.getByRole("button", { name: "等级与创作激励" }));
    expect(screen.getByText("已达最高等级")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
    expect(screen.getByText("累计收到 9,007,199,254,740,993 升温油，共 7 次投入")).toBeInTheDocument();
  });

  test("同页进入旧外观锚点时规范化地址", async () => {
    render(<ProfileEditForm />, { wrapper: createWrapper() });
    window.history.replaceState(null, "", "/me#profile-appearance");
    window.dispatchEvent(new Event("hashchange"));
    await waitFor(() => expect(window.location.hash).toBe("#appearance"));
  });
});
