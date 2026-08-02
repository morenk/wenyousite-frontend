/** ThreadDetailHeader 组件测试 */

import { describe, test, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThreadDetailHeader } from "@/components/thread/thread-detail-header";
import type { ThreadDetail } from "@/api/hooks/use-thread-detail";
import React from "react";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));
import { toast } from "sonner";

const mockUseAuth = vi.fn();
vi.mock("@/lib/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

const { mockPOST, mockDELETE, mockGET } = vi.hoisted(() => ({
  mockPOST: vi.fn(),
  mockDELETE: vi.fn(),
  mockGET: vi.fn(),
}));
const { mockDeleteThreadMutate, mockRouterPush } = vi.hoisted(() => ({
  mockDeleteThreadMutate: vi.fn().mockResolvedValue({}),
  mockRouterPush: vi.fn(),
}));

vi.mock("@/api/client", () => ({
  apiClient: { POST: mockPOST, DELETE: mockDELETE, GET: mockGET },
}));

const mockCreateMutate = vi.fn().mockResolvedValue({});
const mockDeleteMutate = vi.fn().mockResolvedValue({});
const mockUseSubscriptions = vi.fn(() => ({ data: [], isLoading: false }));
vi.mock("@/api/hooks/use-subscriptions", () => ({
  useSubscriptions: () => mockUseSubscriptions(),
}));
vi.mock("@/api/hooks/use-subscription-mutations", () => ({
  useCreateSubscription: () => ({ mutateAsync: mockCreateMutate, isPending: false }),
  useDeleteSubscription: () => ({ mutateAsync: mockDeleteMutate, isPending: false }),
}));

vi.mock("@/api/hooks/use-delete-thread", () => ({
  useDeleteThread: () => ({ mutateAsync: mockDeleteThreadMutate, isPending: false }),
}));

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual("@tanstack/react-query");
  return { ...actual, useQueryClient: () => ({ invalidateQueries: vi.fn().mockResolvedValue(undefined) }) };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockRouterPush }),
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

beforeEach(() => {
  mockUseSubscriptions.mockReturnValue({ data: [], isLoading: false });
  mockDeleteThreadMutate.mockClear();
  mockDeleteThreadMutate.mockResolvedValue({});
  mockRouterPush.mockClear();
});

function renderWithQC(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

const baseThread: ThreadDetail = {
  id: "thread-1",
  title: "测试主题帖",
  ownerId: "owner-1",
  category: "RPG",
  status: "RECRUITING",
  visibility: "PUBLIC",
  published: true,
  publishedAt: "2026-01-01T00:00:00Z",
  pinned: false,
  pinnedAt: null,
  viewCount: 100,
  version: 1,
  likeCount: 3,
  defaultSubthreadId: "s1",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  deletedAt: null,
  owner: { id: "owner-1", username: "帖主", avatar: null },
  subthreads: [],
  defaultSubthread: {
    id: "s1",
    threadId: "thread-1",
    title: "主帖",
    sortOrder: 0,
    postingPolicy: "PARTICIPANTS",
    version: 1,
    lastPostAt: null,
    deletedAt: null,
    createdAt: "2026-01-01T00:00:00Z",
    bodyPost: null,
    _count: { posts: 5 },
    tags: [],
  },
  topicTags: [{ tag: { id: "tag-1", name: "测试标签", color: null } }],
  _count: { members: 10, players: 3, posts: 5 },
  isBookmarked: false,
  bookmarkId: null,
};

describe("ThreadDetailHeader", () => {
  test("渲染标题", () => {
    mockUseAuth.mockReturnValue({ user: null, isInitialized: true });
    mockPOST.mockResolvedValue({ error: undefined });

    renderWithQC(
      <ThreadDetailHeader thread={baseThread} />,
    );
    expect(screen.getByText("测试主题帖")).toBeInTheDocument();
  });

  test("渲染分类和状态中文映射", () => {
    mockUseAuth.mockReturnValue({ user: null, isInitialized: true });
    renderWithQC(
      <ThreadDetailHeader thread={baseThread} />,
    );
    expect(screen.getByText("RPG")).toBeInTheDocument();
    expect(screen.getByText("招募中")).toBeInTheDocument();
  });

  test("渲染标签", () => {
    mockUseAuth.mockReturnValue({ user: null, isInitialized: true });
    renderWithQC(
      <ThreadDetailHeader thread={baseThread} />,
    );
    expect(screen.getByText("#测试标签")).toBeInTheDocument();
  });

  test("渲染作者名", () => {
    mockUseAuth.mockReturnValue({ user: null, isInitialized: true });
    renderWithQC(
      <ThreadDetailHeader thread={baseThread} />,
    );
    expect(screen.getByText("帖主")).toBeInTheDocument();
  });

  test("渲染统计信息", () => {
    mockUseAuth.mockReturnValue({ user: null, isInitialized: true });
    renderWithQC(
      <ThreadDetailHeader thread={baseThread} />,
    );
    expect(screen.getByText("100 次浏览")).toBeInTheDocument();
    expect(screen.getByText("3 位玩家")).toBeInTheDocument();
    expect(screen.getByText("5 楼")).toBeInTheDocument();
  });

  test("未登录时显示点赞按钮（不可交互）", () => {
    mockUseAuth.mockReturnValue({ user: null, isInitialized: true });
    renderWithQC(
      <ThreadDetailHeader thread={baseThread} />,
    );
    expect(screen.getByText("3")).toBeInTheDocument(); // likeCount
  });

  test("OWNER 看到编辑按钮", () => {
    mockUseAuth.mockReturnValue({
      user: { id: "owner-1", username: "帖主" },
      isInitialized: true,
    });
    mockPOST.mockResolvedValue({ error: undefined });
    renderWithQC(
      <ThreadDetailHeader thread={baseThread} />,
    );
    expect(screen.getByText("编辑")).toBeInTheDocument();
    // OWNER 不应该看到加入/退出按钮
    expect(screen.queryByText("加入")).toBeNull();
    expect(screen.queryByText("退出")).toBeNull();
  });

  test("OWNER 看到管理按钮", () => {
    mockUseAuth.mockReturnValue({
      user: { id: "owner-1", username: "帖主" },
      isInitialized: true,
    });
    mockPOST.mockResolvedValue({ error: undefined });
    renderWithQC(
      <ThreadDetailHeader thread={baseThread} />,
    );
    expect(screen.getByText("管理")).toBeInTheDocument();
  });

  test("OWNER 看到删除主题帖按钮，确认后删除并返回首页", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("confirm", vi.fn(() => true));
    mockUseAuth.mockReturnValue({
      user: { id: "owner-1", username: "帖主" },
      isInitialized: true,
    });

    renderWithQC(<ThreadDetailHeader thread={baseThread} />);

    await user.click(screen.getByTitle("删除主题帖"));

    expect(window.confirm).toHaveBeenCalledWith(
      "确定要删除该主题帖吗？已发布主题帖删除后将无法恢复。",
    );
    expect(mockDeleteThreadMutate).toHaveBeenCalledWith("thread-1");
    expect(mockRouterPush).toHaveBeenCalledWith("/");
  });

  test("取消删除主题帖时不调用删除接口", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("confirm", vi.fn(() => false));
    mockUseAuth.mockReturnValue({
      user: { id: "owner-1", username: "帖主" },
      isInitialized: true,
    });

    renderWithQC(<ThreadDetailHeader thread={baseThread} />);

    await user.click(screen.getByTitle("删除主题帖"));

    expect(mockDeleteThreadMutate).not.toHaveBeenCalled();
    expect(mockRouterPush).not.toHaveBeenCalled();
  });

  test("非 OWNER 看不到删除主题帖按钮", () => {
    mockUseAuth.mockReturnValue({
      user: { id: "other-user", username: "别人" },
      isInitialized: true,
    });

    renderWithQC(<ThreadDetailHeader thread={baseThread} />);

    expect(screen.queryByTitle("删除主题帖")).toBeNull();
  });

  test("删除失败显示后端错误", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("confirm", vi.fn(() => true));
    mockDeleteThreadMutate.mockRejectedValueOnce({
      code: 40301,
      message: "仅楼主可删除主题帖",
    });
    mockUseAuth.mockReturnValue({
      user: { id: "owner-1", username: "帖主" },
      isInitialized: true,
    });

    renderWithQC(<ThreadDetailHeader thread={baseThread} />);
    await user.click(screen.getByTitle("删除主题帖"));

    expect(toast.error).toHaveBeenCalledWith("仅楼主可删除主题帖");
    expect(mockRouterPush).not.toHaveBeenCalled();
  });

  test("非 OWNER 看不到管理按钮", () => {
    mockUseAuth.mockReturnValue({
      user: { id: "other-user", username: "别人" },
      isInitialized: true,
    });
    mockPOST.mockResolvedValue({ error: undefined });
    renderWithQC(
      <ThreadDetailHeader thread={baseThread} />,
    );
    expect(screen.queryByText("管理")).toBeNull();
    // 无加入/退出按钮（发帖自动入候选池，无需手动参与）
    expect(screen.queryByText("加入")).toBeNull();
    expect(screen.queryByText("退出")).toBeNull();
  });

  test("点击管理按钮调用 onManage", async () => {
    const user = userEvent.setup();
    const onManage = vi.fn();
    mockUseAuth.mockReturnValue({
      user: { id: "owner-1", username: "帖主" },
      isInitialized: true,
    });
    mockPOST.mockResolvedValue({ error: undefined });
    renderWithQC(
      <ThreadDetailHeader
        thread={baseThread}
        onManage={onManage}
      />,
    );

    await user.click(screen.getByText("管理"));
    expect(onManage).toHaveBeenCalledTimes(1);
  });

  test("已完结状态显示'已完结'", () => {
    mockUseAuth.mockReturnValue({ user: null, isInitialized: true });
    const finished = { ...baseThread, status: "FINISHED" as const };
    renderWithQC(<ThreadDetailHeader thread={finished} />);
    expect(screen.getByText("已完结")).toBeInTheDocument();
  });

  test("私密帖显示'私密'标签", () => {
    mockUseAuth.mockReturnValue({ user: null, isInitialized: true });
    const privateThread = { ...baseThread, visibility: "PRIVATE" as const };
    renderWithQC(
      <ThreadDetailHeader thread={privateThread} />,
    );
    expect(screen.getByText("私密")).toBeInTheDocument();
  });

  test("置顶帖显示'置顶'标签", () => {
    mockUseAuth.mockReturnValue({ user: null, isInitialized: true });
    const pinned = { ...baseThread, pinned: true };
    renderWithQC(<ThreadDetailHeader thread={pinned} />);
    expect(screen.getByText("置顶")).toBeInTheDocument();
  });

  test("演绎分类显示'演绎'", () => {
    mockUseAuth.mockReturnValue({ user: null, isInitialized: true });
    const deduction = { ...baseThread, category: "DEDUCTION" as const };
    renderWithQC(<ThreadDetailHeader thread={deduction} />);
    expect(screen.getByText("演绎")).toBeInTheDocument();
  });

  test("likeCount 为 0 时显示'点赞'文字", () => {
    mockUseAuth.mockReturnValue({
      user: { id: "owner-1", username: "帖主" },
      isInitialized: true,
    });
    const noLikes = { ...baseThread, likeCount: 0 };
    renderWithQC(<ThreadDetailHeader thread={noLikes} />);
    expect(screen.getByText("点赞")).toBeInTheDocument();
  });

  test("登录用户显示订阅按钮，点击后订阅", async () => {
    const user = userEvent.setup();
    mockUseAuth.mockReturnValue({
      user: { id: "other-user", username: "别人" },
      isInitialized: true,
    });
    renderWithQC(<ThreadDetailHeader thread={baseThread} />);

    expect(screen.getByText("订阅")).toBeInTheDocument();

    await user.click(screen.getByText("订阅"));

    expect(mockCreateMutate).toHaveBeenCalledWith({
      threadId: "thread-1",
      type: "THREAD",
    });
  });

  test("已订阅显示'已订阅'，点击取消订阅", async () => {
    const user = userEvent.setup();
    mockUseAuth.mockReturnValue({
      user: { id: "other-user", username: "别人" },
      isInitialized: true,
    });
    vi.mocked(mockUseSubscriptions).mockReturnValue({
      data: [
        {
          id: "sub1",
          userId: "other-user",
          threadId: "thread-1",
          type: "THREAD",
          targetUserId: null,
          createdAt: "2026-01-01T00:00:00Z",
          thread: { id: "thread-1", title: "测试主题帖" },
        },
      ],
      isLoading: false,
    } as never);

    renderWithQC(<ThreadDetailHeader thread={baseThread} />);

    expect(screen.getByText("已订阅")).toBeInTheDocument();

    await user.click(screen.getByText("已订阅"));

    expect(mockDeleteMutate).toHaveBeenCalledWith("sub1");
  });

  test("未登录不显示订阅按钮", () => {
    mockUseAuth.mockReturnValue({ user: null, isInitialized: true });
    renderWithQC(<ThreadDetailHeader thread={baseThread} />);
    expect(screen.queryByText("订阅")).toBeNull();
    expect(screen.queryByText("已订阅")).toBeNull();
  });
});
