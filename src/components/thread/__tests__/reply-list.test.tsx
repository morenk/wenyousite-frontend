/** ReplyList 组件测试：楼中楼回复列表 + 回复串内对用户回复 */

import { describe, test, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThreadComposerProvider } from "@/components/thread/thread-composer-context";

const { mockUseReplies } = vi.hoisted(() => ({
  mockUseReplies: vi.fn(),
}));
const { mockUseAuth } = vi.hoisted(() => ({
  mockUseAuth: vi.fn(),
}));
const { mockUpdateMutateAsync, mockDeleteMutateAsync, mockClipboardWriteText, mockToastSuccess } = vi.hoisted(() => ({
  mockUpdateMutateAsync: vi.fn().mockResolvedValue({}),
  mockDeleteMutateAsync: vi.fn().mockResolvedValue(undefined),
  mockClipboardWriteText: vi.fn().mockResolvedValue(undefined),
  mockToastSuccess: vi.fn(),
}));

vi.mock("@/api/hooks/use-replies", () => ({
  useReplies: () => mockUseReplies(),
}));

vi.mock("@/api/hooks/use-update-post", () => ({
  useUpdatePost: () => ({ mutateAsync: mockUpdateMutateAsync, isPending: false }),
}));

vi.mock("@/api/hooks/use-create-post", () => ({
  useCreatePost: () => ({ mutateAsync: vi.fn().mockResolvedValue({ id: "new-reply" }) }),
}));

vi.mock("@/api/hooks/use-upload-image", () => ({
  useUploadImage: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock("@/api/hooks/use-delete-post", () => ({
  useDeletePost: () => ({ mutateAsync: mockDeleteMutateAsync }),
}));

vi.mock("sonner", () => ({
  toast: { success: mockToastSuccess, error: vi.fn() },
}));

vi.mock("@/lib/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("@/components/editor/milkdown-editor", () => ({
  MilkdownEditor: ({ defaultValue, onChange }: { defaultValue?: string; onChange?: (value: string) => void }) => (
    <textarea
      data-testid="milkdown-editor"
      defaultValue={defaultValue}
      onChange={(event) => onChange?.(event.target.value)}
    />
  ),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => {
    return <a href={href} {...props}>{children}</a>;
  },
}));

import { ReplyList } from "@/components/thread/reply-list";

// happy-dom 无 IntersectionObserver
beforeAll(() => {
  vi.stubGlobal("IntersectionObserver", class {
    observe() {}
    unobserve() {}
    disconnect() {}
  });
});
afterEach(() => cleanup());
beforeEach(() => {
  mockUseAuth.mockReturnValue({ user: null });
  mockUpdateMutateAsync.mockClear();
  mockDeleteMutateAsync.mockClear();
  mockClipboardWriteText.mockClear();
  mockToastSuccess.mockClear();
});

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={qc}>
        <ThreadComposerProvider>{children}</ThreadComposerProvider>
      </QueryClientProvider>
    );
  }
  Wrapper.displayName = "QueryClientWrapper";
  return Wrapper;
}

function baseReply(overrides: Record<string, unknown> = {}) {
  return {
    id: "reply-1",
    threadId: "t1",
    subthreadId: "s1",
    authorId: "u2",
    floorNumber: null,
    parentPostId: "post-1",
    replyToPostId: null,
    replyToPost: null,
    content: "楼中楼回复内容",
    version: 1,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    deletedAt: null,
    author: { id: "u2", username: "replier", avatar: null },
    _count: { replies: 0 },
    replies: [],
    ...overrides,
  };
}

function dataWithReplies(replies: unknown[]) {
  return {
    data: { pages: [{ data: replies, meta: { cursor: null, hasMore: false } }] },
    hasNextPage: false,
    isFetchingNextPage: false,
    isLoading: false,
    error: undefined,
    fetchNextPage: vi.fn(),
    refetch: vi.fn(),
  };
}

describe("ReplyList", () => {
  test("加载中显示 spinner", () => {
    mockUseReplies.mockReturnValue({ isLoading: true, data: undefined, hasNextPage: false, isFetchingNextPage: false, error: undefined, fetchNextPage: vi.fn(), refetch: vi.fn() });
    render(<ReplyList postId="post-1" />, { wrapper: createWrapper() });
    expect(document.querySelector(".animate-spin")).toBeTruthy();
  });

  test("空列表提示", () => {
    mockUseReplies.mockReturnValue({ isLoading: false, data: { pages: [] }, hasNextPage: false, isFetchingNextPage: false, error: undefined, fetchNextPage: vi.fn(), refetch: vi.fn() });
    render(<ReplyList postId="post-1" />, { wrapper: createWrapper() });
    expect(screen.getByText("还没有回复")).toBeInTheDocument();
  });

  test("渲染回复内容与作者", () => {
    mockUseReplies.mockReturnValue(dataWithReplies([baseReply()]));
    render(<ReplyList postId="post-1" />, { wrapper: createWrapper() });
    expect(screen.getByText("replier")).toBeInTheDocument();
    expect(screen.getByText("楼中楼回复内容")).toBeInTheDocument();
    expect(screen.getByTestId("user-avatar-placeholder").textContent).toBe("R");
  });

  test("回复卡片可复制楼中楼精确链接", async () => {
    const user = userEvent.setup();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: mockClipboardWriteText },
    });
    mockUseReplies.mockReturnValue(dataWithReplies([baseReply()]));

    render(<ReplyList postId="post-1" />, { wrapper: createWrapper() });
    await user.click(screen.getByRole("button", { name: "复制此回复链接" }));

    expect(mockClipboardWriteText).toHaveBeenCalledWith(
      "http://localhost:3000/threads/t1/posts/post-1/replies?post=reply-1",
    );
    expect(mockToastSuccess).toHaveBeenCalledWith("链接已复制");
  });

  test("作者有头像时渲染缩略图", () => {
    mockUseReplies.mockReturnValue(
      dataWithReplies([
        baseReply({ author: { id: "u2", username: "replier", avatar: "https://example.com/r.png" } }),
      ]),
    );
    render(<ReplyList postId="post-1" />, { wrapper: createWrapper() });
    expect(screen.getByRole("img")).toHaveAttribute(
      "src",
      "https://example.com/r_thumb.webp",
    );
  });

  test("错误状态显示重试", () => {
    mockUseReplies.mockReturnValue({ isLoading: false, data: undefined, hasNextPage: false, isFetchingNextPage: false, error: new Error("网络错误"), fetchNextPage: vi.fn(), refetch: vi.fn() });
    render(<ReplyList postId="post-1" />, { wrapper: createWrapper() });
    expect(screen.getByText("回复加载失败")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "重试" })).toBeInTheDocument();
  });

  test("未登录不显示回复按钮", () => {
    mockUseAuth.mockReturnValue({ user: null });
    mockUseReplies.mockReturnValue(dataWithReplies([baseReply()]));
    render(<ReplyList postId="post-1" />, { wrapper: createWrapper() });
    expect(screen.queryByRole("button", { name: "回复" })).not.toBeInTheDocument();
  });

  test("登录后点击回复按钮才按需挂载目标编辑器", async () => {
    const user = userEvent.setup();
    mockUseAuth.mockReturnValue({ user: { id: "u1" } });
    const reply = baseReply({ id: "reply-2", author: { id: "u3", username: "小明", avatar: null } });
    mockUseReplies.mockReturnValue(dataWithReplies([reply]));

    render(<ReplyList postId="post-1" />, { wrapper: createWrapper() });
    const replyButton = screen.getByRole("button", { name: "回复" });
    expect(replyButton).toBeInTheDocument();
    expect(screen.queryByTestId("milkdown-editor")).not.toBeInTheDocument();

    await user.click(replyButton);
    expect(screen.getAllByTestId("milkdown-editor")).toHaveLength(1);
    expect(screen.getByText("回复 @小明")).toBeInTheDocument();
  });

  test("点击取消收起回复编辑器", async () => {
    const user = userEvent.setup();
    mockUseAuth.mockReturnValue({ user: { id: "u1" } });
    mockUseReplies.mockReturnValue(dataWithReplies([baseReply()]));

    render(<ReplyList postId="post-1" />, { wrapper: createWrapper() });
    const replyButton = screen.getByRole("button", { name: "回复" });

    await user.click(replyButton);
    expect(screen.getByTestId("milkdown-editor")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "取消" }));
    expect(screen.queryByTestId("milkdown-editor")).not.toBeInTheDocument();
  });

  test("回复串内回复显示「回复 @被回复者」上下文", () => {
    mockUseAuth.mockReturnValue({ user: { id: "u1" } });
    const reply = baseReply({
      id: "reply-3",
      replyToPostId: "reply-1",
      replyToPost: {
        id: "reply-1",
        authorId: "u2",
        author: { id: "u2", username: "replier", avatar: null },
      },
    });
    mockUseReplies.mockReturnValue(dataWithReplies([reply]));

    render(<ReplyList postId="post-1" />, { wrapper: createWrapper() });
    const contextLink = screen.getByRole("link", { name: "@replier" });
    expect(contextLink).toHaveAttribute("href", "/users/u2");
    expect(screen.getByText("楼中楼回复内容")).toBeInTheDocument();
  });

  test("自己的楼中楼回复显示编辑/删除并可保存修改", async () => {
    const user = userEvent.setup();
    mockUseAuth.mockReturnValue({ user: { id: "u2" } });
    mockUseReplies.mockReturnValue(dataWithReplies([baseReply()]));

    render(<ReplyList postId="post-1" />, { wrapper: createWrapper() });
    await user.click(screen.getByTitle("编辑回复"));
    const input = screen.getByTestId("milkdown-editor");
    expect(input).toHaveValue("楼中楼回复内容");
    await user.clear(input);
    await user.type(input, "修改后的回复");
    await user.click(screen.getByRole("button", { name: "保存修改" }));

    expect(mockUpdateMutateAsync).toHaveBeenCalledWith({
      postId: "reply-1",
      content: "修改后的回复",
      version: 1,
    });
  });

  test("自己的楼中楼回复确认后可删除", async () => {
    const user = userEvent.setup();
    mockUseAuth.mockReturnValue({ user: { id: "u2" } });
    mockUseReplies.mockReturnValue(dataWithReplies([baseReply()]));
    vi.stubGlobal("confirm", vi.fn(() => true));

    render(<ReplyList postId="post-1" />, { wrapper: createWrapper() });
    await user.click(screen.getByTitle("删除回复"));

    expect(mockDeleteMutateAsync).toHaveBeenCalledWith("reply-1");
  });

  test("他人的楼中楼回复不显示编辑/删除", () => {
    mockUseAuth.mockReturnValue({ user: { id: "u1" } });
    mockUseReplies.mockReturnValue(dataWithReplies([baseReply()]));
    render(<ReplyList postId="post-1" />, { wrapper: createWrapper() });

    expect(screen.queryByTitle("编辑回复")).not.toBeInTheDocument();
    expect(screen.queryByTitle("删除回复")).not.toBeInTheDocument();
  });
});
