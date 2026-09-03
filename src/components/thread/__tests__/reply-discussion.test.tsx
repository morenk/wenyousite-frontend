/** ReplyDiscussion 测试：原楼层上下文与沉浸式回复列表 */

import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReplyDiscussion } from "@/components/thread/reply-discussion";
import { ThreadComposerProvider } from "@/components/thread/thread-composer-context";
import type { PostDetail } from "@/api/hooks/use-post";

const { mockUseAuth, mockUpdatePost } = vi.hoisted(() => ({
  mockUseAuth: vi.fn(),
  mockUpdatePost: vi.fn().mockResolvedValue({ id: "p1" }),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/threads/t1/posts/p1/replies",
}));

vi.mock("@/lib/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("@/api/hooks/use-update-post", () => ({
  useUpdatePost: () => ({ mutateAsync: mockUpdatePost }),
}));

vi.mock("@/api/hooks/use-pin-post", () => ({
  usePinPost: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock("@/api/hooks/use-create-post", () => ({
  useCreatePost: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock("@/api/hooks/use-upload-image", () => ({
  useUploadImage: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock("@/api/hooks/use-content-access-cache", () => ({
  useContentAccessCache: () => ({ clearThread: vi.fn() }),
}));

vi.mock("@/components/thread/thread-permissions-context", () => ({
  useThreadPermissions: () => ({ visibility: "PUBLIC" }),
}));

vi.mock("@/components/shared/use-public-invite-confirmation", () => ({
  usePublicInviteConfirmation: () => ({
    confirmPublicInvite: vi.fn().mockResolvedValue(true),
    resetPublicInviteConfirmation: vi.fn(),
  }),
}));

vi.mock("@/components/editor/milkdown-editor", () => ({
  MilkdownEditor: ({
    defaultValue,
    onChange,
    ariaLabel,
  }: {
    defaultValue?: string;
    onChange?: (value: string) => void;
    ariaLabel?: string;
  }) => (
    <textarea
      aria-label={ariaLabel}
      data-testid="milkdown-editor"
      defaultValue={defaultValue}
      onChange={(event) => onChange?.(event.target.value)}
    />
  ),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/components/thread/markdown-content", () => ({
  MarkdownContent: ({ content }: { content: string }) => <div>{content}</div>,
}));

vi.mock("@/components/thread/reply-list", () => ({
  ReplyList: ({ postId, variant }: { postId: string; variant: string }) => (
    <div data-testid="reply-list">{postId}:{variant}</div>
  ),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const rootPost: PostDetail = {
  id: "p1",
  threadId: "t1",
  subthreadId: "s1",
  authorId: "u1",
  kind: "FLOOR",
  floorNumber: 12,
  parentPostId: null,
  replyToPostId: null,
  clientRequestId: null,
  content: "原楼层长文",
  version: 1,
  createdAt: "2026-08-01T00:00:00Z",
  updatedAt: "2026-08-01T00:00:00Z",
  deletedAt: null,
  author: { id: "u1", username: "作者", avatar: null, level: 1 },
  _count: { replies: 87 },
  thread: { id: "t1", title: "主题帖" },
  subthread: { id: "s1", title: "剧情子贴" },
  parentPost: null,
};

describe("ReplyDiscussion", () => {
  test("回复入口语义上位于列表底部，但使用浮动输入坞持续可达", () => {
    mockUseAuth.mockReturnValue({ user: null, isInitialized: true });
    render(
      <ThreadComposerProvider>
        <ReplyDiscussion rootPost={rootPost} />
      </ThreadComposerProvider>,
    );

    expect(screen.getByText("原楼层长文")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "查看作者的用户主页" })).toHaveAttribute(
      "href",
      "/users/u1",
    );
    expect(screen.getByText("#12", { exact: false })).toBeInTheDocument();
    expect(screen.queryByText("楼中楼讨论主题")).toBeNull();
    expect(screen.queryByText("楼中楼讨论")).toBeNull();
    expect(screen.getByRole("region", { name: "楼层回复，共 87 条" })).toBeInTheDocument();
    const list = screen.getByTestId("reply-list");
    const anchor = document.querySelector<HTMLElement>(
      '[data-slot="floating-composer-anchor"]',
    );
    const dock = document.querySelector<HTMLElement>(
      '[data-slot="floating-composer-dock"]',
    );
    expect(list).toHaveTextContent("p1:discussion");
    expect(dock).toHaveClass("fixed", "bottom-4", "z-[var(--layer-floating)]");
    expect(dock?.parentElement).toBe(document.body);
    expect(
      list.compareDocumentPosition(anchor!) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "参与讨论" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "登录后参与讨论" })).toBeInTheDocument();
  });

  test("登录用户在浮动输入坞中看到发表回复入口", () => {
    mockUseAuth.mockReturnValue({ user: { id: "u2" }, isInitialized: true });
    render(
      <ThreadComposerProvider>
        <ReplyDiscussion rootPost={rootPost} />
      </ThreadComposerProvider>,
    );

    expect(screen.queryByRole("button", { name: "参与讨论" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "发表回复…" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /返回原楼层/ })).toHaveAttribute(
      "href",
      "/threads/t1?post=p1",
    );
  });

  test("原楼层作者可在楼中楼详情直接编辑主楼层正文", async () => {
    const user = userEvent.setup();
    mockUseAuth.mockReturnValue({ user: { id: "u1" }, isInitialized: true });
    render(
      <ThreadComposerProvider>
        <ReplyDiscussion rootPost={rootPost} />
      </ThreadComposerProvider>,
    );

    await user.click(screen.getByRole("button", { name: "更多原楼层操作" }));
    await user.click(screen.getByRole("menuitem", { name: "编辑" }));

    const editor = screen.getByRole("textbox", { name: "编辑正文" });
    expect(editor).toHaveValue("原楼层长文");
    await user.clear(editor);
    await user.type(editor, "楼中楼页修改后的主楼层");
    await user.click(screen.getByRole("button", { name: "保存修改" }));

    expect(mockUpdatePost).toHaveBeenCalledWith({
      postId: "p1",
      content: "楼中楼页修改后的主楼层",
      version: 1,
    });
  });
});
