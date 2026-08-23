/** ReplyList 组件测试：楼中楼回复列表 + 回复串内对用户回复 */

import { describe, test, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThreadComposerProvider } from "@/components/thread/thread-composer-context";

const { mockUseReplies } = vi.hoisted(() => ({
  mockUseReplies: vi.fn(),
}));
const { mockUseRepliesCall, mockUseReplyAuthors } = vi.hoisted(() => ({
  mockUseRepliesCall: vi.fn(),
  mockUseReplyAuthors: vi.fn(),
}));
const { mockUseAuth, mockUseThreadPermissions } = vi.hoisted(() => ({
  mockUseAuth: vi.fn(),
  mockUseThreadPermissions: vi.fn(),
}));
const { mockUpdateMutateAsync, mockCreateMutateAsync, mockDeleteMutateAsync, mockClipboardWriteText, mockToastSuccess } = vi.hoisted(() => ({
  mockUpdateMutateAsync: vi.fn().mockResolvedValue({}),
  mockCreateMutateAsync: vi.fn().mockResolvedValue({ id: "new-reply" }),
  mockDeleteMutateAsync: vi.fn().mockResolvedValue(undefined),
  mockClipboardWriteText: vi.fn().mockResolvedValue(undefined),
  mockToastSuccess: vi.fn(),
}));

vi.mock("@/api/hooks/use-replies", () => ({
  useReplies: (...args: unknown[]) => {
    mockUseRepliesCall(...args);
    return mockUseReplies();
  },
}));

vi.mock("@/api/hooks/use-discussion-authors", () => ({
  useReplyAuthors: (...args: unknown[]) => mockUseReplyAuthors(...args),
}));

vi.mock("@/api/hooks/use-update-post", () => ({
  useUpdatePost: () => ({ mutateAsync: mockUpdateMutateAsync, isPending: false }),
}));

vi.mock("@/api/hooks/use-create-post", () => ({
  useCreatePost: () => ({ mutateAsync: mockCreateMutateAsync }),
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
vi.mock("@/components/thread/thread-permissions-context", () => ({
  useThreadPermissions: () => mockUseThreadPermissions(),
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
import type { ReplyData } from "@/api/hooks/use-floors";

// happy-dom 无 IntersectionObserver
beforeAll(() => {
  vi.stubGlobal("IntersectionObserver", class {
    observe() {}
    unobserve() {}
    disconnect() {}
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
beforeEach(() => {
  mockUseAuth.mockReturnValue({ user: null });
  mockUseThreadPermissions.mockReturnValue({ isManager: false });
  mockUpdateMutateAsync.mockClear();
  mockCreateMutateAsync.mockClear();
  mockDeleteMutateAsync.mockClear();
  mockClipboardWriteText.mockClear();
  mockToastSuccess.mockClear();
  mockUseRepliesCall.mockClear();
  mockUseReplyAuthors.mockReturnValue({
    data: [],
    isLoading: false,
    isError: false,
    isSuccess: true,
    refetch: vi.fn(),
  });
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

function baseReply(overrides: Partial<ReplyData> = {}): ReplyData {
  return {
    id: "reply-1",
    threadId: "t1",
    subthreadId: "s1",
    authorId: "u2",
    kind: "FLOOR",
    floorNumber: null,
    parentPostId: "post-1",
    replyToPostId: null,
    clientRequestId: null,
    replyToPost: null,
    content: "楼中楼回复内容",
    version: 1,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    deletedAt: null,
    author: { id: "u2", username: "replier", avatar: null, level: 1 },
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
    expect(screen.getByRole("link", { name: "查看replier的用户主页" })).toHaveAttribute(
      "href",
      "/users/u2",
    );
  });

  test("独立回复串使用当前楼层预筛选的作者候选", async () => {
    const user = userEvent.setup();
    mockUseReplies.mockReturnValue(dataWithReplies([baseReply()]));
    mockUseReplyAuthors.mockReturnValue({
      data: [
        { id: "owner", username: "楼主甲", avatar: null, level: 3, role: "OWNER", playerMarked: false },
        { id: "collab", username: "协作者乙", avatar: null, level: 2, role: "COLLABORATOR", playerMarked: false },
        { id: "player", username: "玩家丙", avatar: null, level: 2, role: "PARTICIPANT", playerMarked: true },
      ],
      isLoading: false,
      isError: false,
      isSuccess: true,
      refetch: vi.fn(),
    });

    render(<ReplyList postId="post-1" variant="discussion" />, {
      wrapper: createWrapper(),
    });
    expect(screen.getByText("#1")).toBeInTheDocument();
    await user.click(screen.getByRole("combobox", { name: "只看某人的回复" }));

    expect(screen.getByText("楼主甲")).toBeInTheDocument();
    expect(screen.getByText("协作者乙")).toBeInTheDocument();
    expect(screen.getByText("玩家丙")).toBeInTheDocument();

    await user.click(screen.getByText("玩家丙"));
    expect(mockUseRepliesCall).toHaveBeenLastCalledWith("post-1", {
      order: "OLDEST",
      authorId: "player",
    });
    expect(mockUseReplyAuthors).toHaveBeenCalledWith("post-1", undefined);
  });

  test("只看某人时不注入其他作者的定位回复", async () => {
    const user = userEvent.setup();
    mockUseReplies.mockReturnValue(dataWithReplies([]));
    mockUseReplyAuthors.mockReturnValue({
      data: [
        { id: "player", username: "玩家丙", avatar: null, level: 2, role: "PARTICIPANT", playerMarked: true },
      ],
      isLoading: false,
      isError: false,
      isSuccess: true,
      refetch: vi.fn(),
    });
    const focusedReply = baseReply({
      id: "focused-other-author",
      authorId: "other-author",
      content: "其他作者的定位回复",
    });

    render(
      <ReplyList postId="post-1" focusedReply={focusedReply} variant="discussion" />,
      { wrapper: createWrapper() },
    );
    expect(screen.getByText("其他作者的定位回复")).toBeInTheDocument();

    await user.click(screen.getByRole("combobox", { name: "只看某人的回复" }));
    await user.click(screen.getByText("玩家丙"));

    expect(screen.queryByText("其他作者的定位回复")).not.toBeInTheDocument();
    expect(screen.getByText("这位成员还没有回复")).toBeInTheDocument();
  });

  test("定位回复时立即滚动且只高亮目标回复卡片", async () => {
    const scrollIntoView = vi
      .spyOn(HTMLElement.prototype, "scrollIntoView")
      .mockImplementation(() => {});
    const targetReply = baseReply({ id: "reply-target" });
    mockUseReplies.mockReturnValue(dataWithReplies([targetReply]));

    const { container } = render(
      <ReplyList postId="post-1" focusedReply={targetReply} variant="discussion" />,
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "auto", block: "center" });
    });

    const card = container.querySelector("#post-reply-target");
    expect(card).toHaveClass("border-primary", "ring-2");
    expect(card?.parentElement).not.toHaveClass("border-primary", "ring-2");
  });

  test("回复卡片可复制楼中楼精确链接", async () => {
    const user = userEvent.setup();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: mockClipboardWriteText },
    });
    mockUseReplies.mockReturnValue(dataWithReplies([baseReply()]));

    render(<ReplyList postId="post-1" />, { wrapper: createWrapper() });
    await user.click(screen.getByRole("button", { name: "更多回复操作" }));
    await user.click(screen.getByRole("menuitem", { name: "复制链接" }));

    expect(mockClipboardWriteText).toHaveBeenCalledWith(
      "http://localhost:3000/threads/t1/posts/post-1/replies?post=reply-1",
    );
    expect(mockToastSuccess).toHaveBeenCalledWith("链接已复制");
  });

  test("回复卡片可从操作菜单复制渲染后的文本", async () => {
    const user = userEvent.setup();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: mockClipboardWriteText },
    });
    mockUseReplies.mockReturnValue(dataWithReplies([baseReply({ content: "这是**加粗**文本" })]));

    render(<ReplyList postId="post-1" />, { wrapper: createWrapper() });
    expect(screen.queryByRole("menuitem", { name: "复制文本" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "更多回复操作" }));
    await user.click(screen.getByRole("menuitem", { name: "复制文本" }));

    expect(mockClipboardWriteText).toHaveBeenCalledWith("这是加粗文本");
    expect(mockToastSuccess).toHaveBeenCalledWith("文本已复制");
  });

  test("作者有头像时渲染缩略图", () => {
    mockUseReplies.mockReturnValue(
      dataWithReplies([
        baseReply({ author: { id: "u2", username: "replier", avatar: "https://example.com/r.png", level: 1 } }),
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

  test("未登录时操作菜单不显示回复动作", async () => {
    const user = userEvent.setup();
    mockUseAuth.mockReturnValue({ user: null });
    mockUseReplies.mockReturnValue(dataWithReplies([baseReply()]));
    render(<ReplyList postId="post-1" />, { wrapper: createWrapper() });

    const replyMeta = screen.getByTestId("reply-card-meta");
    expect(replyMeta.querySelector("time")).toHaveAttribute(
      "datetime",
      "2026-01-01T00:00:00Z",
    );
    expect(replyMeta.querySelector("button")).toBeNull();

    await user.click(screen.getByRole("button", { name: "更多回复操作" }));
    expect(screen.queryByRole("menuitem", { name: "回复" })).not.toBeInTheDocument();
  });

  test("登录后点击显式回复按钮按需挂载目标编辑器", async () => {
    const user = userEvent.setup();
    mockUseAuth.mockReturnValue({ user: { id: "u1" } });
    const reply = baseReply({ id: "reply-2", author: { id: "u3", username: "小明", avatar: null, level: 1 } });
    mockUseReplies.mockReturnValue(dataWithReplies([reply]));

    render(<ReplyList postId="post-1" />, { wrapper: createWrapper() });
    expect(screen.queryByTestId("milkdown-editor")).not.toBeInTheDocument();

    const replyButton = screen.getByRole("button", { name: "回复" });
    const replyMeta = screen.getByTestId("reply-card-meta");
    const replyTime = replyMeta.querySelector("time");
    expect(replyMeta).toHaveClass("justify-between");
    expect(replyMeta).toContainElement(replyButton);
    expect(replyTime).toHaveAttribute("datetime", reply.createdAt);
    expect(replyMeta.firstElementChild).toBe(replyTime);
    expect(replyMeta.lastElementChild).toBe(replyButton);
    expect(replyButton).toHaveTextContent("回复");
    expect(replyButton.querySelector("svg")).toHaveAttribute(
      "data-icon-semantic",
      "action.reply",
    );
    await user.click(replyButton);
    expect(screen.getAllByTestId("milkdown-editor")).toHaveLength(1);
    expect(screen.getByText("回复 @小明")).toBeInTheDocument();

    await user.type(screen.getByTestId("milkdown-editor"), "回复小明");
    await user.click(screen.getAllByRole("button", { name: "回复" }).at(-1)!);
    expect(mockCreateMutateAsync).toHaveBeenCalledWith({
      subthreadId: "s1",
      content: "回复小明",
      clientRequestId: expect.any(String),
      parentPostId: "post-1",
      replyToPostId: "reply-2",
    });

    await user.click(screen.getByRole("button", { name: "更多回复操作" }));
    expect(screen.queryByRole("menuitem", { name: "回复" })).not.toBeInTheDocument();
  });

  test("点击取消收起回复编辑器", async () => {
    const user = userEvent.setup();
    mockUseAuth.mockReturnValue({ user: { id: "u1" } });
    mockUseReplies.mockReturnValue(dataWithReplies([baseReply()]));

    render(<ReplyList postId="post-1" />, { wrapper: createWrapper() });
    await user.click(screen.getByRole("button", { name: "回复" }));
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
        author: { id: "u2", username: "replier", avatar: null, level: 1 },
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
    await user.click(screen.getByRole("button", { name: "更多回复操作" }));
    await user.click(screen.getByRole("menuitem", { name: "编辑" }));
    const input = screen.getByTestId("milkdown-editor");
    expect(input).toHaveValue("楼中楼回复内容");
    expect(screen.getByTestId("reply-card-meta").querySelector("time")).toHaveAttribute(
      "datetime",
      "2026-01-01T00:00:00Z",
    );
    expect(screen.queryByRole("button", { name: "回复" })).not.toBeInTheDocument();
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
    await user.click(screen.getByRole("button", { name: "更多回复操作" }));
    await user.click(screen.getByRole("menuitem", { name: "删除" }));

    expect(mockDeleteMutateAsync).toHaveBeenCalledWith("reply-1");
  });

  test("他人的楼中楼回复操作菜单不显示编辑/删除", async () => {
    const user = userEvent.setup();
    mockUseAuth.mockReturnValue({ user: { id: "u1" } });
    mockUseReplies.mockReturnValue(dataWithReplies([baseReply()]));
    render(<ReplyList postId="post-1" />, { wrapper: createWrapper() });

    await user.click(screen.getByRole("button", { name: "更多回复操作" }));
    expect(screen.queryByRole("menuitem", { name: "编辑" })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "删除" })).not.toBeInTheDocument();
  });

  test("管理者可从操作菜单删除他人回复但不可编辑", async () => {
    const user = userEvent.setup();
    mockUseAuth.mockReturnValue({ user: { id: "manager" } });
    mockUseThreadPermissions.mockReturnValue({ isManager: true });
    mockUseReplies.mockReturnValue(dataWithReplies([baseReply()]));

    render(<ReplyList postId="post-1" />, { wrapper: createWrapper() });

    await user.click(screen.getByRole("button", { name: "更多回复操作" }));
    expect(screen.queryByRole("menuitem", { name: "编辑" })).not.toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "删除" })).toBeInTheDocument();
  });
});
