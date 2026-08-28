/** FloorCard 组件测试：Markdown 渲染 + 作者编辑/删除 */

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen, cleanup, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { FloorCard } from "@/components/thread/floor-card";
import { ThreadComposerProvider } from "@/components/thread/thread-composer-context";
import type { PostData, ReplyData } from "@/api/hooks/use-floors";

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => {
    return <a href={href} {...props}>{children}</a>;
  },
}));

const { mockUseAuth, mockClipboardWriteText, mockUseThreadPermissions } = vi.hoisted(() => ({
  mockUseAuth: vi.fn(),
  mockClipboardWriteText: vi.fn().mockResolvedValue(undefined),
  mockUseThreadPermissions: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({
  useAuth: () => mockUseAuth(),
}));
vi.mock("@/components/thread/thread-permissions-context", () => ({
  useThreadPermissions: () => mockUseThreadPermissions(),
}));

const mockUpdateMutateAsync = vi.fn().mockResolvedValue({ id: "post-1" });
const mockCreateMutateAsync = vi.fn().mockResolvedValue({ id: "reply-1" });
const mockDeleteMutateAsync = vi.fn().mockResolvedValue(undefined);
vi.mock("@/api/hooks/use-update-post", () => ({
  useUpdatePost: () => ({ mutateAsync: mockUpdateMutateAsync, isPending: false }),
}));
vi.mock("@/api/hooks/use-create-post", () => ({
  useCreatePost: () => ({ mutateAsync: mockCreateMutateAsync }),
}));
vi.mock("@/api/hooks/use-delete-post", () => ({
  useDeletePost: () => ({ mutateAsync: mockDeleteMutateAsync }),
}));
vi.mock("@/api/hooks/use-upload-image", () => ({
  useUploadImage: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock("@/components/editor/milkdown-editor", () => ({
  MilkdownEditor: ({
    defaultValue,
    onChange,
  }: {
    defaultValue?: string;
    onChange?: (v: string) => void;
  }) => (
    <textarea
      data-testid="milkdown-editor"
      defaultValue={defaultValue}
      onChange={(e) => onChange?.(e.target.value)}
    />
  ),
}));

vi.mock("@/components/thread/reply-list", () => ({
  ReplyList: () => <div data-testid="reply-list">回复列表</div>,
}));

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual("@tanstack/react-query");
  return { ...actual, useQueryClient: () => ({ invalidateQueries: vi.fn().mockResolvedValue(undefined) }) };
});

import { toast } from "sonner";
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const baseFloor: PostData = {
  id: "post-1",
  threadId: "t1",
  subthreadId: "s1",
  authorId: "u1",
  kind: "FLOOR",
  floorNumber: 1,
  parentPostId: null,
  replyToPostId: null,
  clientRequestId: null,
  content: "这是**加粗**的正文",
  version: 1,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  deletedAt: null,
  author: { id: "u1", username: "测试用户", avatar: null, level: 1 },
  _count: { replies: 0 },
  replies: [],
};

function inlineReply(id: string, content = `回复 ${id}`): ReplyData {
  return {
    id,
    threadId: baseFloor.threadId,
    subthreadId: baseFloor.subthreadId,
    authorId: `author-${id}`,
    kind: "FLOOR",
    floorNumber: null,
    parentPostId: "post-1",
    replyToPostId: null,
    clientRequestId: null,
    content,
    version: baseFloor.version,
    createdAt: baseFloor.createdAt,
    updatedAt: baseFloor.updatedAt,
    deletedAt: null,
    author: { id: `author-${id}`, username: `用户${id}`, avatar: null, level: 1 },
    replyToPost: null,
  };
}

function renderWithQC(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ThreadComposerProvider>{ui}</ThreadComposerProvider>
    </QueryClientProvider>,
  );
}

describe("FloorCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: mockClipboardWriteText },
    });
    mockUseAuth.mockReturnValue({ user: null, isInitialized: true });
    mockUseThreadPermissions.mockReturnValue({ isManager: false });
  });

  test("渲染作者名和楼层号", () => {
    renderWithQC(<FloorCard floor={baseFloor} />);
    expect(screen.getByText("测试用户")).toBeInTheDocument();
    expect(screen.getByText("#1")).toBeInTheDocument();
    expect(screen.getByTestId("user-avatar-placeholder").textContent).toBe("测");
    expect(screen.getByRole("link", { name: "查看测试用户的用户主页" })).toHaveAttribute(
      "href",
      "/users/u1",
    );
  });

  test("管理员可从楼层菜单进入站务隐藏", async () => {
    const user = userEvent.setup();
    mockUseAuth.mockReturnValue({ user: { id: "admin-1", role: "ADMIN" }, isInitialized: true });
    renderWithQC(<FloorCard floor={baseFloor} />);

    await user.click(screen.getByRole("button", { name: "更多楼层操作" }));
    expect(await screen.findByRole("menuitem", { name: "站务隐藏" })).toBeInTheDocument();
  });

  test("定位楼层时立即滚动，淡粉边框停留 1.2 秒后开始淡出", async () => {
    vi.useFakeTimers();
    const scrollIntoView = vi
      .spyOn(HTMLElement.prototype, "scrollIntoView")
      .mockImplementation(() => {});
    const { container } = renderWithQC(
      <FloorCard floor={baseFloor} focused />,
    );

    const card = container.querySelector("#post-post-1");
    expect(card).toHaveClass("border-primary", "duration-[var(--motion-slow)]");
    expect(card).not.toHaveClass("bg-accent/30", "ring-2");

    await act(async () => {
      vi.advanceTimersByTime(100);
    });
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "auto", block: "center" });

    await act(async () => {
      vi.advanceTimersByTime(1_100);
    });
    expect(card).not.toHaveClass("border-primary");
    expect(card?.parentElement).not.toHaveClass("border-primary");
  });

  test("作者有头像时渲染接口返回的母版", () => {
    const withAvatar = {
      ...baseFloor,
      author: { id: "u1", username: "测试用户", avatar: "https://example.com/a.png", level: 1 },
    };
    renderWithQC(<FloorCard floor={withAvatar} />);
    expect(screen.getByRole("img")).toHaveAttribute(
      "src",
      "https://example.com/a.png",
    );
  });

  test("渲染 Markdown 加粗", () => {
    renderWithQC(<FloorCard floor={baseFloor} />);
    const strong = screen.getByText("加粗");
    expect(strong.tagName).toBe("STRONG");
  });

  test("渲染纯文本内容", () => {
    const plain = { ...baseFloor, content: "纯文本正文" };
    renderWithQC(<FloorCard floor={plain} />);
    expect(screen.getByText("纯文本正文")).toBeInTheDocument();
  });

  test("没有回复时不显示完整回复入口", () => {
    renderWithQC(<FloorCard floor={baseFloor} />);
    expect(screen.queryByText("条回复")).toBeNull();
  });

  test("主楼层不再显示回复数链接", () => {
    const withReplies = {
      ...baseFloor,
      _count: { replies: 3 },
      replies: Array.from({ length: 3 }, (_, index) => inlineReply(`reply-${index + 1}`)),
    };
    mockUseAuth.mockReturnValue({
      user: { id: "u1", username: "测试用户" },
      isInitialized: true,
    });
    renderWithQC(<FloorCard floor={withReplies} />);

    expect(screen.queryByText("3 条回复")).not.toBeInTheDocument();
    const floorActions = screen.getByTestId("floor-card-actions");
    expect(floorActions).toContainElement(
      within(floorActions).getByRole("button", { name: "回复" }),
    );
  });

  test("楼层卡片可复制楼层精确链接", async () => {
    const user = userEvent.setup();
    Object.defineProperty(window.navigator, "clipboard", {
      configurable: true,
      value: { writeText: mockClipboardWriteText },
    });
    renderWithQC(<FloorCard floor={baseFloor} />);

    await user.click(screen.getByRole("button", { name: "更多楼层操作" }));
    await user.click(screen.getByRole("menuitem", { name: "复制链接" }));

    expect(mockClipboardWriteText).toHaveBeenCalledWith(
      "http://localhost:3000/threads/t1?post=post-1",
    );
    expect(screen.getByRole("button", { name: "更多楼层操作" })).toBeInTheDocument();
  });

  test("楼层卡片可从操作菜单复制渲染后的文本", async () => {
    const user = userEvent.setup();
    Object.defineProperty(window.navigator, "clipboard", {
      configurable: true,
      value: { writeText: mockClipboardWriteText },
    });
    renderWithQC(<FloorCard floor={baseFloor} />);

    expect(screen.queryByRole("menuitem", { name: "复制内容" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "更多楼层操作" }));
    await user.click(screen.getByRole("menuitem", { name: "复制内容" }));

    await waitFor(() => {
      expect(mockClipboardWriteText).toHaveBeenCalledWith("这是加粗的正文");
      expect(toast.success).toHaveBeenCalledWith("内容已复制");
    });
  });

  test("楼中楼最多预览三条并始终显示带总数的展开入口", () => {
    const replies = Array.from({ length: 6 }, (_, index) => inlineReply(`reply-${index + 1}`));
    const withReplies = { ...baseFloor, _count: { replies: 6 }, replies };
    renderWithQC(<FloorCard floor={withReplies} />);

    expect(screen.getAllByTestId("inline-reply")).toHaveLength(3);
    expect(screen.getByText("回复 reply-1")).toBeInTheDocument();
    expect(screen.queryByText("回复 reply-4")).not.toBeInTheDocument();
    expect(screen.getByTestId("inline-replies")).not.toHaveClass("overflow-hidden");
    const viewAll = screen.getByRole("link", { name: "展开楼中楼（6 条）" });
    expect(viewAll).toHaveAttribute("href", "/threads/t1/posts/post-1/replies");
    expect(viewAll).toHaveClass("font-medium");
    expect(screen.queryByRole("link", { name: "6 条回复" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "查看用户reply-1的用户主页" })).toHaveAttribute(
      "href",
      "/users/author-reply-1",
    );
  });

  test("内联回复显示三点菜单，未登录时只提供复制操作", async () => {
    const user = userEvent.setup();
    Object.defineProperty(window.navigator, "clipboard", {
      configurable: true,
      value: { writeText: mockClipboardWriteText },
    });
    const withReplies = {
      ...baseFloor,
      _count: { replies: 1 },
      replies: [inlineReply("reply-1", "这是**加粗**回复")],
    };
    renderWithQC(<FloorCard floor={withReplies} />);

    const inline = screen.getByTestId("inline-reply");
    expect(within(inline).getByRole("button", { name: "更多回复操作" })).toBeInTheDocument();
    expect(within(inline).queryByRole("button", { name: "回复" })).not.toBeInTheDocument();

    await user.click(within(inline).getByRole("button", { name: "更多回复操作" }));
    expect(screen.getByRole("menuitem", { name: "复制内容" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "复制链接" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "编辑" })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "删除" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("menuitem", { name: "复制链接" }));
    await waitFor(() => {
      expect(mockClipboardWriteText).toHaveBeenCalledWith(
        "http://localhost:3000/threads/t1/posts/post-1/replies?post=reply-1",
      );
    });
  });

  test("登录用户可在内联回复下方原位回复目标用户", async () => {
    const user = userEvent.setup();
    const reply = inlineReply("reply-1");
    const withReplies = {
      ...baseFloor,
      _count: { replies: 1 },
      replies: [reply],
    };
    mockUseAuth.mockReturnValue({
      user: { id: "u1", username: "测试用户" },
      isInitialized: true,
    });
    renderWithQC(<FloorCard floor={withReplies} />);

    const inline = screen.getByTestId("inline-reply");
    await user.click(within(inline).getByRole("button", { name: "回复" }));
    expect(within(inline).getByText("回复 @用户reply-1")).toBeInTheDocument();

    await user.type(within(inline).getByTestId("milkdown-editor"), "回复预览用户");
    await user.click(within(inline).getAllByRole("button", { name: "回复" }).at(-1)!);
    expect(mockCreateMutateAsync).toHaveBeenCalledWith({
      subthreadId: "s1",
      content: "回复预览用户",
      clientRequestId: expect.any(String),
      parentPostId: "post-1",
      replyToPostId: "reply-1",
    });
  });

  test("内联回复作者可从三点菜单编辑和删除", async () => {
    const user = userEvent.setup();
    const withReplies = {
      ...baseFloor,
      _count: { replies: 1 },
      replies: [inlineReply("reply-1")],
    };
    mockUseAuth.mockReturnValue({
      user: { id: "author-reply-1", username: "用户reply-1" },
      isInitialized: true,
    });
    renderWithQC(<FloorCard floor={withReplies} />);

    const inline = screen.getByTestId("inline-reply");
    await user.click(within(inline).getByRole("button", { name: "更多回复操作" }));
    expect(screen.getByRole("menuitem", { name: "编辑" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "删除" })).toBeInTheDocument();

    await user.click(screen.getByRole("menuitem", { name: "编辑" }));
    expect(within(inline).getByTestId("milkdown-editor")).toHaveValue("回复 reply-1");
    expect(within(inline).queryByRole("button", { name: "更多回复操作" })).not.toBeInTheDocument();
  });

  test("发布时间与主楼层回复按钮位于预览上方且没有回复数链接", () => {
    const withReplies = {
      ...baseFloor,
      _count: { replies: 1 },
      replies: [inlineReply("reply-1")],
    };
    mockUseAuth.mockReturnValue({
      user: { id: "u1", username: "测试用户" },
      isInitialized: true,
    });
    renderWithQC(<FloorCard floor={withReplies} />);

    const meta = screen.getByTestId("floor-card-meta");
    const preview = screen.getByTestId("inline-replies");
    const publishedAt = meta.querySelector("time");

    expect(publishedAt).toHaveAttribute("dateTime", baseFloor.createdAt);
    expect(meta).toContainElement(within(meta).getByRole("button", { name: "回复" }));
    expect(within(meta).queryByRole("link")).not.toBeInTheDocument();
    expect(meta.nextElementSibling).toBe(preview);
    expect(meta).not.toHaveClass("border-t");
  });

  test("超长内联回复始终完整显示，原位回复期间保留楼中楼入口", async () => {
    const user = userEvent.setup();
    const withReplies = {
      ...baseFloor,
      _count: { replies: 1 },
      replies: [inlineReply("reply-long", "长".repeat(501))],
    };
    mockUseAuth.mockReturnValue({
      user: { id: "u1", username: "测试用户" },
      isInitialized: true,
    });
    renderWithQC(<FloorCard floor={withReplies} />);

    const inline = screen.getByTestId("inline-reply");
    const preview = screen.getByTestId("inline-replies");
    expect(preview).not.toHaveClass("overflow-hidden", "max-h-96");
    expect(screen.getByRole("link", { name: "展开楼中楼（1 条）" })).toHaveAttribute(
      "href",
      "/threads/t1/posts/post-1/replies",
    );

    await user.click(within(inline).getByRole("button", { name: "回复" }));
    expect(preview).not.toHaveClass("overflow-hidden");
    expect(screen.getByRole("link", { name: "展开楼中楼（1 条）" })).toBeInTheDocument();

    await user.click(within(inline).getByRole("button", { name: "取消" }));
    expect(preview).not.toHaveClass("overflow-hidden");
    expect(screen.getByRole("link", { name: "展开楼中楼（1 条）" })).toBeInTheDocument();
  });

  test("楼层使用弱于主题文档的紧凑圆角且不交替着色", () => {
    const { container } = renderWithQC(<FloorCard floor={baseFloor} />);
    expect(container.firstChild as HTMLElement).toHaveClass("rounded-xl", "bg-card");
    expect(container.firstChild as HTMLElement).not.toHaveClass("bg-muted/20", "rounded-2xl");
  });

  test("未登录时操作菜单不显示编辑/删除", async () => {
    const user = userEvent.setup();
    mockUseAuth.mockReturnValue({ user: null, isInitialized: true });
    renderWithQC(<FloorCard floor={baseFloor} />);

    await user.click(screen.getByRole("button", { name: "更多楼层操作" }));
    expect(screen.queryByRole("menuitem", { name: "编辑" })).toBeNull();
    expect(screen.queryByRole("menuitem", { name: "删除" })).toBeNull();
  });

  test("非作者的操作菜单不显示编辑/删除", async () => {
    const user = userEvent.setup();
    mockUseAuth.mockReturnValue({
      user: { id: "other", username: "别人" },
      isInitialized: true,
    });
    renderWithQC(<FloorCard floor={baseFloor} />);

    await user.click(screen.getByRole("button", { name: "更多楼层操作" }));
    expect(screen.queryByRole("menuitem", { name: "编辑" })).toBeNull();
    expect(screen.queryByRole("menuitem", { name: "删除" })).toBeNull();
  });

  test("管理者可从操作菜单删除他人楼层但不可编辑", async () => {
    const user = userEvent.setup();
    mockUseAuth.mockReturnValue({
      user: { id: "manager", username: "管理者" },
      isInitialized: true,
    });
    mockUseThreadPermissions.mockReturnValue({ isManager: true });

    renderWithQC(<FloorCard floor={baseFloor} />);

    await user.click(screen.getByRole("button", { name: "更多楼层操作" }));
    expect(screen.queryByRole("menuitem", { name: "编辑" })).not.toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "删除" })).toBeInTheDocument();
  });

  test("作者的操作菜单显示编辑/删除", async () => {
    const user = userEvent.setup();
    mockUseAuth.mockReturnValue({
      user: { id: "u1", username: "测试用户" },
      isInitialized: true,
    });
    renderWithQC(<FloorCard floor={baseFloor} />);

    await user.click(screen.getByRole("button", { name: "更多楼层操作" }));
    expect(screen.getByRole("menuitem", { name: "编辑" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "删除" })).toBeInTheDocument();
  });

  test("楼层 #1 删除菜单项也可点（楼层均可删除，子贴正文由后端拦截）", async () => {
    const user = userEvent.setup();
    mockUseAuth.mockReturnValue({
      user: { id: "u1", username: "测试用户" },
      isInitialized: true,
    });
    renderWithQC(<FloorCard floor={baseFloor} />);

    await user.click(screen.getByRole("button", { name: "更多楼层操作" }));
    const del = screen.getByRole("menuitem", { name: "删除" });
    expect(del).not.toBeDisabled();
  });

  test("编辑保存：调用 useUpdatePost 并提示成功", async () => {
    const user = userEvent.setup();
    mockUseAuth.mockReturnValue({
      user: { id: "u1", username: "测试用户" },
      isInitialized: true,
    });
    renderWithQC(<FloorCard floor={baseFloor} />);

    await user.click(screen.getByRole("button", { name: "更多楼层操作" }));
    await user.click(screen.getByRole("menuitem", { name: "编辑" }));
    const textarea = screen.getByTestId("milkdown-editor");
    await user.clear(textarea);
    await user.type(textarea, "编辑后的正文");
    await user.click(screen.getByRole("button", { name: "保存修改" }));

    expect(mockUpdateMutateAsync).toHaveBeenCalledWith({
      postId: "post-1",
      content: "编辑后的正文",
      version: 1,
    });
    expect(toast.success).toHaveBeenCalledWith("已保存");
  });

  test("编辑保存乐观锁冲突提示 40002", async () => {
    const user = userEvent.setup();
    mockUseAuth.mockReturnValue({
      user: { id: "u1", username: "测试用户" },
      isInitialized: true,
    });
    mockUpdateMutateAsync.mockRejectedValueOnce({ code: 40002, message: "内容已被修改" });
    renderWithQC(<FloorCard floor={baseFloor} />);

    await user.click(screen.getByRole("button", { name: "更多楼层操作" }));
    await user.click(screen.getByRole("menuitem", { name: "编辑" }));
    await user.click(screen.getByRole("button", { name: "保存修改" }));

    expect(toast.error).toHaveBeenCalledWith("内容已被修改，请刷新后重试");
  });

  test("取消编辑不调用保存", async () => {
    const user = userEvent.setup();
    mockUseAuth.mockReturnValue({
      user: { id: "u1", username: "测试用户" },
      isInitialized: true,
    });
    renderWithQC(<FloorCard floor={baseFloor} />);

    await user.click(screen.getByRole("button", { name: "更多楼层操作" }));
    await user.click(screen.getByRole("menuitem", { name: "编辑" }));
    await user.click(screen.getByRole("button", { name: "取消" }));

    expect(mockUpdateMutateAsync).not.toHaveBeenCalled();
    expect(screen.queryByTestId("milkdown-editor")).toBeNull();
    expect(screen.getByText("加粗")).toBeInTheDocument();
  });

  test("删除确认后调用 useDeletePost 并提示成功", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("confirm", vi.fn(() => true));
    mockUseAuth.mockReturnValue({
      user: { id: "u1", username: "测试用户" },
      isInitialized: true,
    });
    renderWithQC(<FloorCard floor={baseFloor} />);

    await user.click(screen.getByRole("button", { name: "更多楼层操作" }));
    await user.click(screen.getByRole("menuitem", { name: "删除" }));

    expect(window.confirm).toHaveBeenCalled();
    expect(mockDeleteMutateAsync).toHaveBeenCalledWith("post-1");
    expect(toast.success).toHaveBeenCalledWith("楼层已删除");
    vi.unstubAllGlobals();
  });

  test("删除取消不调用 useDeletePost", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("confirm", vi.fn(() => false));
    mockUseAuth.mockReturnValue({
      user: { id: "u1", username: "测试用户" },
      isInitialized: true,
    });
    renderWithQC(<FloorCard floor={baseFloor} />);

    await user.click(screen.getByRole("button", { name: "更多楼层操作" }));
    await user.click(screen.getByRole("menuitem", { name: "删除" }));

    expect(window.confirm).toHaveBeenCalled();
    expect(mockDeleteMutateAsync).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  test("五条以内也只预览前三条并提供独立楼中楼入口", () => {
    const withReplies = {
      ...baseFloor,
      _count: { replies: 5 },
      replies: Array.from({ length: 5 }, (_, index) => inlineReply(`reply-${index + 1}`)),
    };
    mockUseAuth.mockReturnValue({
      user: { id: "u1", username: "测试用户" },
      isInitialized: true,
    });
    const { container } = renderWithQC(<FloorCard floor={withReplies} />);

    expect(screen.getAllByTestId("inline-reply")).toHaveLength(3);
    expect(screen.getByRole("link", { name: "展开楼中楼（5 条）" })).toHaveAttribute(
      "href",
      "/threads/t1/posts/post-1/replies",
    );
    expect(container.querySelectorAll('a[href="/threads/t1/posts/post-1/replies"]')).toHaveLength(1);
  });

  test("无楼中楼回复时不显示占位，未登录不保留空操作栏", () => {
    mockUseAuth.mockReturnValue({ user: null, isInitialized: true });
    renderWithQC(<FloorCard floor={baseFloor} />);

    expect(screen.queryByText("暂无回复")).toBeNull();
    expect(screen.getByTestId("floor-card-meta").querySelector("time")).toBeInTheDocument();
    expect(screen.queryByTestId("floor-card-actions")).toBeNull();
  });

  test("登录用户可从零回复楼层直接原位打开回复编辑器", async () => {
    const user = userEvent.setup();
    mockUseAuth.mockReturnValue({
      user: { id: "u1", username: "测试用户" },
      isInitialized: true,
    });
    renderWithQC(<FloorCard floor={baseFloor} />);

    expect(screen.queryByText("暂无回复")).toBeNull();
    expect(screen.getByTestId("floor-card-actions")).toBeInTheDocument();
    const replyButton = screen.getByRole("button", { name: "回复" });
    expect(screen.getByTestId("floor-card-actions")).toContainElement(replyButton);
    expect(replyButton).toHaveTextContent("回复");
    expect(replyButton.querySelector("svg")).toHaveAttribute(
      "data-icon-semantic",
      "action.reply",
    );

    await user.click(replyButton);
    expect(screen.getByTestId("milkdown-editor")).toBeInTheDocument();
    expect(screen.getByText("回复 #1 测试用户")).toBeInTheDocument();

    await user.type(screen.getByTestId("milkdown-editor"), "原位回复内容");
    await user.click(screen.getAllByRole("button", { name: "回复" }).at(-1)!);
    expect(mockCreateMutateAsync).toHaveBeenCalledWith({
      subthreadId: "s1",
      content: "原位回复内容",
      clientRequestId: expect.any(String),
      parentPostId: "post-1",
      replyToPostId: "post-1",
    });

    await user.click(screen.getByRole("button", { name: "更多楼层操作" }));
    expect(screen.queryByRole("menuitem", { name: "回复" })).not.toBeInTheDocument();
  });

  test("未登录时操作菜单不显示回复动作", async () => {
    const user = userEvent.setup();
    mockUseAuth.mockReturnValue({ user: null, isInitialized: true });
    renderWithQC(<FloorCard floor={baseFloor} />);

    await user.click(screen.getByRole("button", { name: "更多楼层操作" }));
    expect(screen.queryByRole("menuitem", { name: "回复" })).toBeNull();
  });
});
