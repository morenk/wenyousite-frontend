/** FloorCard 组件测试：Markdown 渲染 + 作者编辑/删除 */

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { FloorCard } from "@/components/thread/floor-card";
import { ThreadComposerProvider } from "@/components/thread/thread-composer-context";
import type { PostData } from "@/api/hooks/use-floors";

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => {
    return <a href={href} {...props}>{children}</a>;
  },
}));

const { mockUseAuth, mockClipboardWriteText } = vi.hoisted(() => ({
  mockUseAuth: vi.fn(),
  mockClipboardWriteText: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

const mockUpdateMutateAsync = vi.fn().mockResolvedValue({ id: "post-1" });
const mockDeleteMutateAsync = vi.fn().mockResolvedValue(undefined);
vi.mock("@/api/hooks/use-update-post", () => ({
  useUpdatePost: () => ({ mutateAsync: mockUpdateMutateAsync, isPending: false }),
}));
vi.mock("@/api/hooks/use-create-post", () => ({
  useCreatePost: () => ({ mutateAsync: vi.fn().mockResolvedValue({ id: "reply-1" }) }),
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

afterEach(() => cleanup());

const baseFloor: PostData = {
  id: "post-1",
  threadId: "t1",
  subthreadId: "s1",
  authorId: "u1",
  floorNumber: 1,
  parentPostId: null,
  replyToPostId: null,
  content: "这是**加粗**的正文",
  version: 1,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  deletedAt: null,
  author: { id: "u1", username: "测试用户", avatar: null },
  _count: { replies: 0 },
  replies: [],
};

function inlineReply(id: string, content = `回复 ${id}`): PostData {
  return {
    ...baseFloor,
    id,
    authorId: `author-${id}`,
    floorNumber: null,
    parentPostId: "post-1",
    content,
    author: { id: `author-${id}`, username: `用户${id}`, avatar: null },
    replies: [],
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
  });

  test("渲染作者名和楼层号", () => {
    renderWithQC(<FloorCard floor={baseFloor} isEven={false} />);
    expect(screen.getByText("测试用户")).toBeInTheDocument();
    expect(screen.getByText("#1")).toBeInTheDocument();
    expect(screen.getByTestId("user-avatar-placeholder").textContent).toBe("测");
  });

  test("作者有头像时渲染缩略图", () => {
    const withAvatar = {
      ...baseFloor,
      author: { id: "u1", username: "测试用户", avatar: "https://example.com/a.png" },
    };
    renderWithQC(<FloorCard floor={withAvatar} isEven={false} />);
    expect(screen.getByRole("img")).toHaveAttribute(
      "src",
      "https://example.com/a_thumb.webp",
    );
  });

  test("渲染 Markdown 加粗", () => {
    renderWithQC(<FloorCard floor={baseFloor} isEven={false} />);
    const strong = screen.getByText("加粗");
    expect(strong.tagName).toBe("STRONG");
  });

  test("渲染纯文本内容", () => {
    const plain = { ...baseFloor, content: "纯文本正文" };
    renderWithQC(<FloorCard floor={plain} isEven={false} />);
    expect(screen.getByText("纯文本正文")).toBeInTheDocument();
  });

  test("不显示回复数（replies 为 0）", () => {
    renderWithQC(<FloorCard floor={baseFloor} isEven={false} />);
    expect(screen.queryByText("条回复")).toBeNull();
  });

  test("显示回复数（replies > 0）", () => {
    const withReplies = {
      ...baseFloor,
      _count: { replies: 3 },
    };
    renderWithQC(<FloorCard floor={withReplies} isEven={false} />);
    expect(screen.getByText("3 条回复")).toBeInTheDocument();
  });

  test("楼层卡片可复制楼层精确链接", async () => {
    const user = userEvent.setup();
    Object.defineProperty(window.navigator, "clipboard", {
      configurable: true,
      value: { writeText: mockClipboardWriteText },
    });
    renderWithQC(<FloorCard floor={baseFloor} isEven={false} />);

    await user.click(screen.getByRole("button", { name: "复制楼层链接" }));

    expect(mockClipboardWriteText).toHaveBeenCalledWith(
      "http://localhost:3000/threads/t1?post=post-1",
    );
    expect(screen.getByRole("button", { name: "复制楼层链接" })).toBeInTheDocument();
  });

  test("有简短回复时默认展示前五条内联预览", () => {
    const replies = Array.from({ length: 6 }, (_, index) => inlineReply(`reply-${index + 1}`));
    const withReplies = { ...baseFloor, _count: { replies: 6 }, replies };
    renderWithQC(<FloorCard floor={withReplies} isEven={false} />);

    expect(screen.getAllByTestId("inline-reply")).toHaveLength(5);
    expect(screen.getByText("回复 reply-1")).toBeInTheDocument();
    expect(screen.queryByText("回复 reply-6")).not.toBeInTheDocument();
  });

  test("内联回复正文合计超过限制时显示截断预览、渐变遮罩和展开入口", () => {
    const withReplies = {
      ...baseFloor,
      _count: { replies: 1 },
      replies: [inlineReply("reply-long", "长".repeat(501))],
    };
    renderWithQC(<FloorCard floor={withReplies} isEven={false} />);

    expect(screen.getByTestId("inline-reply")).toBeInTheDocument();
    expect(screen.getByTestId("inline-replies")).toHaveClass("overflow-hidden");
    expect(screen.getByRole("link", { name: /展开回复/ })).toHaveAttribute(
      "href",
      "/threads/t1/posts/post-1/replies",
    );
  });

  test("偶数索引有 bg-muted 样式", () => {
    const { container } = renderWithQC(
      <FloorCard floor={baseFloor} isEven={true} />,
    );
    expect(container.firstChild as HTMLElement).toHaveClass("bg-muted/30");
  });

  test("未登录不显示编辑/删除按钮", () => {
    mockUseAuth.mockReturnValue({ user: null, isInitialized: true });
    renderWithQC(<FloorCard floor={baseFloor} isEven={false} />);
    expect(screen.queryByTitle("编辑楼层")).toBeNull();
    expect(screen.queryByTitle("删除楼层")).toBeNull();
  });

  test("非作者不显示编辑/删除按钮", () => {
    mockUseAuth.mockReturnValue({
      user: { id: "other", username: "别人", emailVerified: true },
      isInitialized: true,
    });
    renderWithQC(<FloorCard floor={baseFloor} isEven={false} />);
    expect(screen.queryByTitle("编辑楼层")).toBeNull();
    expect(screen.queryByTitle("删除楼层")).toBeNull();
  });

  test("作者显示编辑/删除按钮", () => {
    mockUseAuth.mockReturnValue({
      user: { id: "u1", username: "测试用户", emailVerified: true },
      isInitialized: true,
    });
    renderWithQC(<FloorCard floor={baseFloor} isEven={false} />);
    expect(screen.getByTitle("编辑楼层")).toBeInTheDocument();
    expect(screen.getByTitle("删除楼层")).toBeInTheDocument();
  });

  test("楼层 #1 删除按钮也可点（楼层均可删除，子贴正文由后端拦截）", () => {
    mockUseAuth.mockReturnValue({
      user: { id: "u1", username: "测试用户", emailVerified: true },
      isInitialized: true,
    });
    renderWithQC(<FloorCard floor={baseFloor} isEven={false} />);
    const del = screen.getByTitle("删除楼层");
    expect(del).not.toBeDisabled();
  });

  test("编辑保存：调用 useUpdatePost 并提示成功", async () => {
    const user = userEvent.setup();
    mockUseAuth.mockReturnValue({
      user: { id: "u1", username: "测试用户", emailVerified: true },
      isInitialized: true,
    });
    renderWithQC(<FloorCard floor={baseFloor} isEven={false} />);

    await user.click(screen.getByTitle("编辑楼层"));
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

  test("编辑保存乐观锁冲突提示 40900", async () => {
    const user = userEvent.setup();
    mockUseAuth.mockReturnValue({
      user: { id: "u1", username: "测试用户", emailVerified: true },
      isInitialized: true,
    });
    mockUpdateMutateAsync.mockRejectedValueOnce({ code: 40900, message: "内容已被修改" });
    renderWithQC(<FloorCard floor={baseFloor} isEven={false} />);

    await user.click(screen.getByTitle("编辑楼层"));
    await user.click(screen.getByRole("button", { name: "保存修改" }));

    expect(toast.error).toHaveBeenCalledWith("内容已被修改，请刷新后重试");
  });

  test("取消编辑不调用保存", async () => {
    const user = userEvent.setup();
    mockUseAuth.mockReturnValue({
      user: { id: "u1", username: "测试用户", emailVerified: true },
      isInitialized: true,
    });
    renderWithQC(<FloorCard floor={baseFloor} isEven={false} />);

    await user.click(screen.getByTitle("编辑楼层"));
    await user.click(screen.getByRole("button", { name: "取消" }));

    expect(mockUpdateMutateAsync).not.toHaveBeenCalled();
    expect(screen.queryByTestId("milkdown-editor")).toBeNull();
    expect(screen.getByText("加粗")).toBeInTheDocument();
  });

  test("删除确认后调用 useDeletePost 并提示成功", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("confirm", vi.fn(() => true));
    mockUseAuth.mockReturnValue({
      user: { id: "u1", username: "测试用户", emailVerified: true },
      isInitialized: true,
    });
    renderWithQC(<FloorCard floor={baseFloor} isEven={false} />);

    await user.click(screen.getByTitle("删除楼层"));

    expect(window.confirm).toHaveBeenCalled();
    expect(mockDeleteMutateAsync).toHaveBeenCalledWith("post-1");
    expect(toast.success).toHaveBeenCalledWith("楼层已删除");
    vi.unstubAllGlobals();
  });

  test("删除取消不调用 useDeletePost", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("confirm", vi.fn(() => false));
    mockUseAuth.mockReturnValue({
      user: { id: "u1", username: "测试用户", emailVerified: true },
      isInitialized: true,
    });
    renderWithQC(<FloorCard floor={baseFloor} isEven={false} />);

    await user.click(screen.getByTitle("删除楼层"));

    expect(window.confirm).toHaveBeenCalled();
    expect(mockDeleteMutateAsync).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  test("有回复时回复数链接进入独立楼中楼阅读页", () => {
    const withReplies = { ...baseFloor, _count: { replies: 3 } };
    mockUseAuth.mockReturnValue({
      user: { id: "u1", username: "测试用户", emailVerified: true },
      isInitialized: true,
    });
    renderWithQC(<FloorCard floor={withReplies} isEven={false} />);

    expect(screen.getByRole("link", { name: /3 条回复/ })).toHaveAttribute(
      "href",
      "/threads/t1/posts/post-1/replies",
    );
  });

  test("回复按钮进入独立楼中楼阅读页", () => {
    mockUseAuth.mockReturnValue({
      user: { id: "u1", username: "测试用户", emailVerified: true },
      isInitialized: true,
    });
    renderWithQC(<FloorCard floor={baseFloor} isEven={false} />);

    expect(screen.getByRole("link", { name: "回复" })).toHaveAttribute(
      "href",
      "/threads/t1/posts/post-1/replies",
    );
  });

  test("未登录不显示回复按钮", () => {
    mockUseAuth.mockReturnValue({ user: null, isInitialized: true });
    renderWithQC(<FloorCard floor={baseFloor} isEven={false} />);
    expect(screen.queryByRole("link", { name: "回复" })).toBeNull();
  });
});
