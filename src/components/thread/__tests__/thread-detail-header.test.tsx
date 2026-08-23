/** ThreadDetailHeader 组件测试 */

import { describe, test, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThreadDetailHeader } from "@/components/thread/thread-detail-header";
import { ThreadPermissionsProvider } from "@/components/thread/thread-permissions-context";
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
const { mockDeleteThreadMutate, mockRouterPush, mockClipboardWriteText } =
  vi.hoisted(() => ({
    mockDeleteThreadMutate: vi.fn().mockResolvedValue({}),
    mockRouterPush: vi.fn(),
    mockClipboardWriteText: vi.fn().mockResolvedValue(undefined),
  }));

vi.mock("@/api/client", () => ({
  apiClient: { POST: mockPOST, DELETE: mockDELETE, GET: mockGET },
}));

const mockCreateMutate = vi.fn().mockResolvedValue({});
const mockDeleteMutate = vi.fn().mockResolvedValue({});
const mockUseSubscriptions = vi.fn(() => ({ data: [], isLoading: false }));
const mockUseMembers = vi.fn(() => ({ data: [], isLoading: false }));
const mockUseThreadDetail = vi.fn(() => ({
  data: undefined,
  isLoading: false,
}));
vi.mock("@/api/hooks/use-subscriptions", () => ({
  useSubscriptions: () => mockUseSubscriptions(),
}));
vi.mock("@/api/hooks/use-members", () => ({
  useMembers: () => mockUseMembers(),
}));
vi.mock("@/api/hooks/use-thread-detail", async () => {
  const actual = await vi.importActual("@/api/hooks/use-thread-detail");
  return { ...actual, useThreadDetail: () => mockUseThreadDetail() };
});
vi.mock("@/api/hooks/use-subscription-mutations", () => ({
  useCreateSubscription: () => ({
    mutateAsync: mockCreateMutate,
    isPending: false,
  }),
  useDeleteSubscription: () => ({
    mutateAsync: mockDeleteMutate,
    isPending: false,
  }),
}));

vi.mock("@/api/hooks/use-delete-thread", () => ({
  useDeleteThread: () => ({
    mutateAsync: mockDeleteThreadMutate,
    isPending: false,
  }),
}));

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual("@tanstack/react-query");
  return {
    ...actual,
    useQueryClient: () => ({
      invalidateQueries: vi.fn().mockResolvedValue(undefined),
    }),
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockRouterPush }),
  usePathname: () => "/threads/thread-1",
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

beforeEach(() => {
  vi.clearAllMocks();
  mockPOST.mockReset();
  mockDELETE.mockReset();
  mockPOST.mockResolvedValue({ error: undefined });
  mockDELETE.mockResolvedValue({ error: undefined });
  mockUseSubscriptions.mockReturnValue({ data: [], isLoading: false });
  mockUseMembers.mockReturnValue({ data: [], isLoading: false });
  mockUseThreadDetail.mockReturnValue({ data: undefined, isLoading: false });
  mockDeleteThreadMutate.mockClear();
  mockDeleteThreadMutate.mockResolvedValue({});
  mockRouterPush.mockClear();
  mockClipboardWriteText.mockClear();
  Object.defineProperty(window.navigator, "clipboard", {
    configurable: true,
    value: { writeText: mockClipboardWriteText },
  });
});

function renderWithQC(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ThreadPermissionsProvider threadId="thread-1" ownerId="owner-1">
        {ui}
      </ThreadPermissionsProvider>
    </QueryClientProvider>,
  );
}

async function openThreadDetails(user = userEvent.setup()) {
  await user.click(screen.getByRole("button", { name: "更多帖子信息与操作" }));
  return user;
}

const baseThread: ThreadDetail = {
  id: "thread-1",
  title: "测试主题帖",
  ownerId: "owner-1",
  category: "RPG",
  categoryInfo: { slug: "RPG", name: "角色扮演", isActive: false },
  status: "RECRUITING",
  visibility: "PUBLIC",
  published: true,
  publishedAt: "2026-01-01T00:00:00Z",
  pinned: false,
  pinnedAt: null,
  viewCount: 100,
  version: 1,
  likeCount: 3,
  tipTotal: "0",
  defaultSubthreadId: "s1",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  deletedAt: null,
  owner: { id: "owner-1", username: "帖主", avatar: null, level: 1 },
  subthreads: [],
  defaultSubthread: {
    id: "s1",
    threadId: "thread-1",
    title: "主帖",
    sortOrder: 0,
    postingPolicy: "PARTICIPANTS",
    postingCapability: { canPost: true, denialReason: null },
    version: 1,
    lastPostAt: null,
    deletedAt: null,
    createdAt: "2026-01-01T00:00:00Z",
    bodyPost: null,
    _count: { posts: 5 },
  },
  topicTags: [
    {
      id: "relation-1",
      threadId: "thread-1",
      tagId: "tag-1",
      tag: { id: "tag-1", name: "测试标签", color: null, description: null, sortOrder: 10, isActive: true },
    },
  ],
  _count: { members: 10, players: 3, posts: 5 },
  isBookmarked: false,
  bookmarkId: null,
  isLiked: false,
};

describe("ThreadDetailHeader", () => {
  test("渲染标题", () => {
    mockUseAuth.mockReturnValue({ user: null, isInitialized: true });
    mockPOST.mockResolvedValue({ error: undefined });

    const { container } = renderWithQC(<ThreadDetailHeader thread={baseThread} />);
    expect(screen.getByRole("heading", { name: "测试主题帖" })).toHaveClass(
      "text-center",
    );
    expect(
      container.querySelector('[data-slot="thread-detail-identity"]'),
    ).toHaveClass("py-2.5");
    expect(
      container.querySelector('[data-slot="thread-detail-context"]'),
    ).toHaveClass("whitespace-nowrap", "justify-center");
    expect(container.querySelector('[data-slot="category-marker"]')).toBeNull();
  });

  test("排头与当前子贴正文属于同一个主题文档容器", () => {
    mockUseAuth.mockReturnValue({ user: null, isInitialized: true });
    const { container } = renderWithQC(
      <ThreadDetailHeader thread={baseThread}>
        <section>当前子贴正文</section>
      </ThreadDetailHeader>,
    );

    const documentCard = container.querySelector('[data-slot="thread-document"]');
    const header = container.querySelector('[data-slot="thread-detail-header"]');
    const body = container.querySelector('[data-slot="thread-document-body"]');
    expect(documentCard).toContainElement(header as HTMLElement);
    expect(documentCard).toContainElement(body as HTMLElement);
    expect(body).toHaveTextContent("当前子贴正文");
  });

  test("平台管理员在公开主题帖的更多面板看到站务隐藏入口", async () => {
    mockUseAuth.mockReturnValue({
      user: { id: "admin-1", role: "ADMIN" },
      isInitialized: true,
    });

    renderWithQC(<ThreadDetailHeader thread={baseThread} />);
    await openThreadDetails();

    expect(screen.getByRole("button", { name: "站务隐藏主题帖" })).toBeInTheDocument();
  });

  test("点击帖内搜索入口触发详情页搜索面板", async () => {
    const user = userEvent.setup();
    const onSearch = vi.fn();
    mockUseAuth.mockReturnValue({ user: null, isInitialized: true });
    renderWithQC(
      <ThreadDetailHeader thread={baseThread} onSearch={onSearch} />,
    );

    await user.click(screen.getByRole("button", { name: "搜索本帖楼层" }));

    expect(onSearch).toHaveBeenCalledTimes(1);
  });

  test("可复制主题帖链接", async () => {
    const user = userEvent.setup();
    mockUseAuth.mockReturnValue({ user: null, isInitialized: true });
    Object.defineProperty(window.navigator, "clipboard", {
      configurable: true,
      value: { writeText: mockClipboardWriteText },
    });
    renderWithQC(<ThreadDetailHeader thread={baseThread} />);
    await openThreadDetails(user);

    await user.click(screen.getByRole("button", { name: "复制主题帖链接" }));

    expect(mockClipboardWriteText).toHaveBeenCalledWith(
      "http://localhost:3000/threads/thread-1",
    );
    expect(toast.success).toHaveBeenCalledWith("链接已复制");
  });

  test("渲染分类和状态中文映射", () => {
    mockUseAuth.mockReturnValue({ user: null, isInitialized: true });
    renderWithQC(<ThreadDetailHeader thread={baseThread} />);
    expect(screen.getByText("角色扮演")).toBeInTheDocument();
    expect(screen.getByText("招募中")).toBeInTheDocument();
  });

  test("标签收纳在更多面板", async () => {
    mockUseAuth.mockReturnValue({ user: null, isInitialized: true });
    renderWithQC(<ThreadDetailHeader thread={baseThread} />);
    expect(screen.queryByText("#测试标签")).not.toBeInTheDocument();
    await openThreadDetails();
    expect(screen.getByText("#测试标签")).toBeInTheDocument();
    expect(screen.getByText("#测试标签").closest("a")).toHaveAttribute(
      "href",
      "/tags/tag-1",
    );
  });

  test("渲染作者名", () => {
    mockUseAuth.mockReturnValue({ user: null, isInitialized: true });
    renderWithQC(<ThreadDetailHeader thread={baseThread} />);
    expect(screen.getByText("帖主")).toBeInTheDocument();
  });

  test("统计信息收纳在更多面板", async () => {
    mockUseAuth.mockReturnValue({ user: null, isInitialized: true });
    renderWithQC(<ThreadDetailHeader thread={baseThread} />);
    expect(screen.queryByLabelText("帖子统计")).not.toBeInTheDocument();
    await openThreadDetails();
    const stats = within(screen.getByLabelText("帖子统计"));
    expect(stats.getByText("100")).toBeInTheDocument();
    expect(stats.getByText("3")).toBeInTheDocument();
    expect(stats.getByText("5")).toBeInTheDocument();
    expect(stats.getByText("0")).toBeInTheDocument();
  });

  test("子贴切换入口合并在排头卡中并通过菜单切换", async () => {
    const user = userEvent.setup();
    const onSubthreadChange = vi.fn();
    const subthreads = [
      baseThread.defaultSubthread,
      {
        ...baseThread.defaultSubthread,
        id: "s2",
        title: "设定区",
        sortOrder: 1,
        _count: { posts: 18 },
      },
    ];
    mockUseAuth.mockReturnValue({ user: null, isInitialized: true });

    const { container } = renderWithQC(
      <ThreadDetailHeader
        thread={{ ...baseThread, subthreads }}
        subthreads={subthreads}
        selectedSubthreadId="s1"
        onSubthreadChange={onSubthreadChange}
      />,
    );

    const header = container.querySelector('[data-slot="thread-detail-header"]');
    expect(header).toContainElement(
      screen.getByRole("combobox", { name: "切换子贴，当前：主帖" }),
    );
    expect(header?.querySelector(".overflow-x-auto")).toBeNull();

    await user.click(screen.getByRole("combobox", { name: "切换子贴，当前：主帖" }));
    await user.click(screen.getByRole("option", { name: "设定区 18 楼" }));
    expect(onSubthreadChange).toHaveBeenCalledWith("s2");
  });

  test("复制当前子贴只包含内容坐标，不携带阅读排序状态", async () => {
    const user = userEvent.setup();
    const subthreads = [
      baseThread.defaultSubthread,
      {
        ...baseThread.defaultSubthread,
        id: "s2",
        title: "设定区",
        sortOrder: 1,
      },
    ];
    Object.defineProperty(window.navigator, "clipboard", {
      configurable: true,
      value: { writeText: mockClipboardWriteText },
    });
    renderWithQC(
      <ThreadDetailHeader
        thread={{ ...baseThread, subthreads }}
        subthreads={subthreads}
        selectedSubthreadId="s2"
        defaultSubthreadId="s1"
        onSubthreadChange={() => {}}
      />,
    );

    await user.click(screen.getByRole("combobox", { name: "切换子贴，当前：设定区" }));
    await user.click(screen.getByRole("button", { name: "复制当前子贴链接" }));

    expect(mockClipboardWriteText).toHaveBeenCalledWith(
      "http://localhost:3000/threads/thread-1?subthread=s2",
    );
  });

  test("仅登录的非楼主用户可为已发布主题帖加油", () => {
    mockUseAuth.mockReturnValue({
      user: { id: "other-user", username: "别人" },
      isInitialized: true,
    });
    const view = renderWithQC(<ThreadDetailHeader thread={baseThread} />);
    expect(screen.getByRole("button", { name: "加油" })).toHaveTextContent(/^$/);

    view.unmount();
    mockUseAuth.mockReturnValue({
      user: { id: "owner-1", username: "帖主" },
      isInitialized: true,
    });
    renderWithQC(<ThreadDetailHeader thread={baseThread} />);
    expect(screen.queryByRole("button", { name: "加油" })).not.toBeInTheDocument();

    cleanup();
    mockUseAuth.mockReturnValue({
      user: { id: "other-user", username: "别人" },
      isInitialized: true,
    });
    renderWithQC(<ThreadDetailHeader thread={{ ...baseThread, published: false }} />);
    expect(screen.queryByRole("button", { name: "加油" })).not.toBeInTheDocument();
  });

  test("普通成员的最大互动操作集与子贴目录保持单行", () => {
    mockUseAuth.mockReturnValue({
      user: { id: "other-user", username: "别人" },
      isInitialized: true,
    });
    mockUseMembers.mockReturnValue({
      data: [{
        id: "member-player",
        threadId: "thread-1",
        userId: "player-1",
        role: "PARTICIPANT",
        playerMarked: true,
        joinedAt: "2026-01-01T00:00:00Z",
        user: { id: "player-1", username: "玩家", avatar: null },
      }],
      isLoading: false,
    } as never);
    const subthreads = [
      baseThread.defaultSubthread,
      {
        ...baseThread.defaultSubthread,
        id: "s2",
        title: "很长的设定资料与角色关系整理区",
        sortOrder: 1,
      },
    ];
    const { container } = renderWithQC(
      <ThreadDetailHeader
        thread={{ ...baseThread, subthreads }}
        onSearch={vi.fn()}
        subthreads={subthreads}
        selectedSubthreadId="s2"
        onSubthreadChange={vi.fn()}
      />,
    );

    const interactionGroup = screen.getByRole("group", { name: "互动操作" });
    const toolbar = container.querySelector('[data-slot="thread-detail-toolbar"]');
    const switcher = container.querySelector('[data-slot="subthread-switcher"]');
    expect(toolbar?.firstElementChild).not.toHaveClass("flex-wrap");
    expect(switcher).toHaveClass("min-w-0", "max-w-sm", "flex-1");
    expect(interactionGroup).toHaveClass("shrink-0", "flex-nowrap");
    expect(interactionGroup).not.toHaveClass("border");
    expect(interactionGroup).not.toHaveClass("border-border");
    expect(interactionGroup).not.toHaveClass("bg-background/70");
    expect(
      within(interactionGroup).getAllByRole("button").map(
        (button) => button.getAttribute("aria-label") ?? button.textContent,
      ),
    ).toEqual([
      "点赞",
      "收藏",
      "订阅官方更新",
      "订阅玩家发言",
      "加油",
    ]);
    const actionButtons = within(interactionGroup).getAllByRole("button");
    expect(actionButtons[0]).toHaveTextContent("3");
    actionButtons.slice(1).forEach((button) => {
      const visibleText = Array.from(button.children)
        .filter((child) => !child.classList.contains("sr-only"))
        .map((child) => child.textContent)
        .join("");
      expect(visibleText).toBe("");
    });
    expect(screen.getByRole("group", { name: "浏览工具" })).toBeInTheDocument();
  });

  test("未登录时显示带计数说明的点赞按钮", () => {
    mockUseAuth.mockReturnValue({ user: null, isInitialized: true });
    renderWithQC(<ThreadDetailHeader thread={baseThread} />);
    const likeButton = screen.getByRole("button", { name: "点赞" });
    expect(likeButton).toHaveAttribute("title", "点赞（当前 3）");
    expect(likeButton).toHaveAccessibleDescription("当前 3 个赞");
  });

  test("OWNER 只在更多面板看到统一管理入口，不再显示编辑按钮", async () => {
    mockUseAuth.mockReturnValue({
      user: { id: "owner-1", username: "帖主" },
      isInitialized: true,
    });
    mockPOST.mockResolvedValue({ error: undefined });
    renderWithQC(<ThreadDetailHeader thread={baseThread} onManage={vi.fn()} />);
    await openThreadDetails();
    expect(screen.getByRole("button", { name: "管理主题帖" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "互动操作" })).toHaveClass(
      "shrink-0",
      "flex-nowrap",
    );
    expect(screen.queryByText("编辑")).not.toBeInTheDocument();
    // OWNER 不应该看到加入/退出按钮
    expect(screen.queryByText("加入")).toBeNull();
    expect(screen.queryByText("退出")).toBeNull();
  });

  test("OWNER 在更多面板看到管理按钮", async () => {
    mockUseAuth.mockReturnValue({
      user: { id: "owner-1", username: "帖主" },
      isInitialized: true,
    });
    mockPOST.mockResolvedValue({ error: undefined });
    renderWithQC(<ThreadDetailHeader thread={baseThread} onManage={vi.fn()} />);
    await openThreadDetails();
    expect(screen.getByRole("button", { name: "管理主题帖" })).toBeInTheDocument();
  });

  test("协作者可从更多面板管理主题帖，但不可删除整帖或创建订阅", async () => {
    mockUseAuth.mockReturnValue({
      user: { id: "collaborator-1", username: "协作者" },
      isInitialized: true,
    });
    mockUseThreadDetail.mockReturnValue({
      data: {
        ownerId: "owner-1",
        currentMembership: {
          id: "member-collaborator",
          userId: "collaborator-1",
          role: "COLLABORATOR",
          playerMarked: false,
        },
        capabilities: {
          isOwner: false,
          canManageThread: true,
          canManageMembers: true,
        },
      },
      isLoading: false,
    } as never);

    renderWithQC(<ThreadDetailHeader thread={baseThread} onManage={vi.fn()} />);
    await openThreadDetails();

    expect(screen.getByRole("button", { name: "管理主题帖" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "互动操作" })).toHaveClass(
      "shrink-0",
      "flex-nowrap",
    );
    expect(screen.queryByText("编辑")).not.toBeInTheDocument();
    expect(screen.queryByTitle("删除主题帖")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "订阅官方更新" })).not.toBeInTheDocument();
  });

  test("详情更多面板不再承载删除主题帖入口", async () => {
    mockUseAuth.mockReturnValue({
      user: { id: "owner-1", username: "帖主" },
      isInitialized: true,
    });

    renderWithQC(<ThreadDetailHeader thread={baseThread} onManage={vi.fn()} />);
    await openThreadDetails();

    expect(screen.queryByRole("button", { name: "删除主题帖" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "管理主题帖" })).toBeInTheDocument();
  });

  test("非 OWNER 看不到管理按钮", () => {
    mockUseAuth.mockReturnValue({
      user: { id: "other-user", username: "别人" },
      isInitialized: true,
    });
    mockPOST.mockResolvedValue({ error: undefined });
    renderWithQC(<ThreadDetailHeader thread={baseThread} />);
    expect(screen.queryByRole("button", { name: "管理主题帖" })).toBeNull();
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
      <ThreadDetailHeader thread={baseThread} onManage={onManage} />,
    );
    await openThreadDetails(user);

    await user.click(screen.getByRole("button", { name: "管理主题帖" }));
    expect(onManage).toHaveBeenCalledTimes(1);
  });

  test("已结束状态显示'已结束'", () => {
    mockUseAuth.mockReturnValue({ user: null, isInitialized: true });
    const finished = { ...baseThread, status: "FINISHED" as const };
    renderWithQC(<ThreadDetailHeader thread={finished} />);
    expect(screen.getByText("已结束")).toBeInTheDocument();
  });

  test("私密帖显示'私密'标签", () => {
    mockUseAuth.mockReturnValue({ user: null, isInitialized: true });
    const privateThread = { ...baseThread, visibility: "PRIVATE" as const };
    renderWithQC(<ThreadDetailHeader thread={privateThread} />);
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
    const deduction = {
      ...baseThread,
      category: "DEDUCTION" as const,
      categoryInfo: { slug: "DEDUCTION", name: "演绎", isActive: true },
    };
    renderWithQC(<ThreadDetailHeader thread={deduction} />);
    expect(screen.getByText("演绎")).toBeInTheDocument();
  });

  test("likeCount 为 0 时仍提供当前计数说明", () => {
    mockUseAuth.mockReturnValue({
      user: { id: "owner-1", username: "帖主" },
      isInitialized: true,
    });
    const noLikes = { ...baseThread, likeCount: 0 };
    renderWithQC(<ThreadDetailHeader thread={noLikes} />);
    const likeButton = screen.getByRole("button", { name: "点赞" });
    expect(likeButton).toHaveAttribute("title", "点赞（当前 0）");
    expect(likeButton).toHaveAccessibleDescription("当前 0 个赞");
  });

  test("其他人已点赞但当前用户未点赞时调用点赞接口", async () => {
    const user = userEvent.setup();
    mockUseAuth.mockReturnValue({
      user: { id: "other-user", username: "别人" },
      isInitialized: true,
    });
    renderWithQC(
      <ThreadDetailHeader
        thread={{ ...baseThread, likeCount: 7, isLiked: false }}
      />,
    );

    await user.click(screen.getByRole("button", { name: "点赞" }));
    expect(mockPOST).toHaveBeenCalledWith("/api/v1/threads/{id}/like", {
      params: { path: { id: "thread-1" } },
    });
    expect(mockDELETE).not.toHaveBeenCalled();
  });

  test("当前用户已点赞时调用取消点赞接口", async () => {
    const user = userEvent.setup();
    mockUseAuth.mockReturnValue({
      user: { id: "other-user", username: "别人" },
      isInitialized: true,
    });
    renderWithQC(
      <ThreadDetailHeader
        thread={{ ...baseThread, likeCount: 1, isLiked: true }}
      />,
    );

    const likeButton = screen.getByRole("button", { name: "点赞" });
    expect(likeButton).toHaveAttribute("aria-pressed", "true");
    expect(likeButton).toHaveAccessibleDescription("当前 1 个赞");
    expect(likeButton).toHaveClass("bg-transparent", "text-foreground");
    expect(likeButton).not.toHaveClass("bg-like-soft");
    expect(likeButton).not.toHaveClass("text-destructive", "bg-destructive-soft");
    expect(likeButton.querySelector('[data-slot="interaction-toggle-icon"]'))
      .toHaveClass("text-like");
    expect(likeButton.querySelector('[data-slot="interaction-toggle-icon"]'))
      .toHaveAttribute("data-icon-variant", "filled");
    await user.click(likeButton);
    expect(mockDELETE).toHaveBeenCalledWith("/api/v1/threads/{id}/like", {
      params: { path: { id: "thread-1" } },
    });
    expect(mockPOST).not.toHaveBeenCalled();
  });

  test("登录用户显示订阅按钮，点击后订阅", async () => {
    const user = userEvent.setup();
    mockUseAuth.mockReturnValue({
      user: { id: "other-user", username: "别人" },
      isInitialized: true,
    });
    renderWithQC(<ThreadDetailHeader thread={baseThread} />);

    expect(screen.getByRole("button", { name: "订阅官方更新" })).toHaveAttribute(
      "title",
      "订阅官方更新",
    );
    expect(screen.getByRole("button", { name: "订阅官方更新" }))
      .toHaveAttribute("aria-pressed", "false");

    await user.click(screen.getByRole("button", { name: "订阅官方更新" }));

    expect(mockCreateMutate).toHaveBeenCalledWith({
      threadId: "thread-1",
      type: "THREAD",
    });
    expect(toast.success).not.toHaveBeenCalledWith("已订阅，帖子更新将通知你");
  });

  test("已订阅时按钮提供取消订阅操作", async () => {
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

    const subscriptionButton = screen.getByRole("button", { name: "订阅官方更新" });
    expect(subscriptionButton).toHaveAttribute(
      "title",
      "取消订阅官方更新",
    );
    expect(subscriptionButton).toHaveAttribute("aria-pressed", "true");
    expect(subscriptionButton).toHaveClass("bg-transparent", "text-foreground");
    expect(subscriptionButton.querySelector('[data-slot="interaction-toggle-icon"]'))
      .toHaveClass("text-brand-strong");
    expect(subscriptionButton.querySelector('[data-slot="interaction-toggle-icon"]'))
      .toHaveAttribute("data-icon-semantic", "action.subscribe");
    expect(subscriptionButton.querySelector('[data-slot="interaction-toggle-icon"]'))
      .toHaveAttribute("data-icon-variant", "filled");

    await user.click(subscriptionButton);

    expect(mockDeleteMutate).toHaveBeenCalledWith("sub1");
    expect(toast.success).not.toHaveBeenCalledWith("已取消订阅");
  });

  test("USER 订阅不会被误认为整帖订阅", () => {
    mockUseAuth.mockReturnValue({
      user: { id: "other-user", username: "别人" },
      isInitialized: true,
    });
    vi.mocked(mockUseSubscriptions).mockReturnValue({
      data: [
        {
          id: "sub-user",
          userId: "other-user",
          threadId: "thread-1",
          type: "USER",
          targetUserId: "target-user",
          createdAt: "2026-01-01T00:00:00Z",
          thread: { id: "thread-1", title: "测试主题帖" },
        },
      ],
      isLoading: false,
    } as never);

    renderWithQC(<ThreadDetailHeader thread={baseThread} />);
    expect(screen.getByRole("button", { name: "订阅官方更新" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "订阅官方更新" }))
      .toHaveAttribute("aria-pressed", "false");
  });

  test("可选择参与人并创建 USER 订阅", async () => {
    const user = userEvent.setup();
    mockUseAuth.mockReturnValue({
      user: { id: "other-user", username: "别人" },
      isInitialized: true,
    });
    mockUseMembers.mockReturnValue({
      data: [
        {
          id: "member-1",
          threadId: "thread-1",
          userId: "target-user",
          role: "PARTICIPANT",
          playerMarked: true,
          joinedAt: "2026-01-01T00:00:00Z",
          user: { id: "target-user", username: "目标用户", avatar: null },
        },
        {
          id: "member-owner",
          threadId: "thread-1",
          userId: "owner-1",
          role: "OWNER",
          playerMarked: true,
          joinedAt: "2026-01-01T00:00:00Z",
          user: { id: "owner-1", username: "帖主", avatar: null },
        },
        {
          id: "member-unmarked",
          threadId: "thread-1",
          userId: "unmarked-user",
          role: "PARTICIPANT",
          playerMarked: false,
          joinedAt: "2026-01-01T00:00:00Z",
          user: { id: "unmarked-user", username: "未标记参与人", avatar: null },
        },
      ],
      isLoading: false,
    } as never);

    renderWithQC(<ThreadDetailHeader thread={baseThread} />);
    await user.click(screen.getByRole("button", { name: "订阅玩家发言" }));
    await user.click(screen.getByRole("combobox", { name: "订阅帖内玩家" }));
    expect(await screen.findByRole("option", { name: "目标用户" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "帖主" })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "未标记参与人" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("option", { name: "目标用户" }));
    await user.click(screen.getByRole("button", { name: "订阅该玩家" }));

    expect(mockCreateMutate).toHaveBeenCalledWith({
      threadId: "thread-1",
      type: "USER",
      targetUserId: "target-user",
    });
    expect(toast.success).not.toHaveBeenCalledWith("已订阅该用户在本帖的发言");
  });

  test("订阅失败时保留错误提示", async () => {
    const user = userEvent.setup();
    mockUseAuth.mockReturnValue({
      user: { id: "other-user", username: "别人" },
      isInitialized: true,
    });
    mockCreateMutate.mockRejectedValueOnce({ message: "订阅失败" });
    renderWithQC(<ThreadDetailHeader thread={baseThread} />);

    await user.click(screen.getByRole("button", { name: "订阅官方更新" }));

    expect(toast.error).toHaveBeenCalledWith("订阅失败");
  });

  test("楼主不显示整帖订阅按钮", () => {
    mockUseAuth.mockReturnValue({
      user: { id: "owner-1", username: "帖主" },
      isInitialized: true,
    });
    renderWithQC(<ThreadDetailHeader thread={baseThread} />);
    expect(screen.queryByTitle("订阅官方更新")).toBeNull();
  });

  test("私密帖邀请入口集中到管理页，更多面板只保留管理入口", async () => {
    const onManage = vi.fn();
    mockUseAuth.mockReturnValue({
      user: { id: "owner-1", username: "帖主" },
      isInitialized: true,
    });
    renderWithQC(
      <ThreadDetailHeader
        thread={{ ...baseThread, visibility: "PRIVATE" }}
        onManage={onManage}
      />,
    );
    await openThreadDetails();

    expect(
      screen.queryByRole("button", { name: "复制主题帖链接" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /邀请链接/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "管理主题帖" })).toBeInTheDocument();
  });

  test("公开帖不提供手动加入入口", () => {
    mockUseAuth.mockReturnValue({
      user: { id: "other-user", username: "别人" },
      isInitialized: true,
    });
    renderWithQC(<ThreadDetailHeader thread={baseThread} />);

    expect(
      screen.queryByRole("button", { name: "加入主题帖" }),
    ).not.toBeInTheDocument();
  });

  test("已标记玩家可退出玩家身份", async () => {
    const user = userEvent.setup();
    mockUseAuth.mockReturnValue({
      user: { id: "other-user", username: "别人" },
      isInitialized: true,
    });
    mockUseThreadDetail.mockReturnValue({
      data: {
        ownerId: "owner-1",
        currentMembership: {
          id: "member-self",
          userId: "other-user",
          role: "PARTICIPANT",
          playerMarked: true,
        },
        capabilities: {
          isOwner: false,
          canManageThread: false,
          canManageMembers: false,
        },
      },
      isLoading: false,
    } as never);
    mockDELETE.mockResolvedValueOnce({
      data: { data: { message: "已退出主题帖" } },
      error: undefined,
    });
    vi.stubGlobal(
      "confirm",
      vi.fn(() => true),
    );
    renderWithQC(<ThreadDetailHeader thread={baseThread} />);
    await openThreadDetails(user);

    await user.click(screen.getByRole("button", { name: "退出玩家身份" }));
    expect(mockDELETE).toHaveBeenCalledWith(
      "/api/v1/threads/{threadId}/members/me",
      { params: { path: { threadId: "thread-1" } } },
    );
  });

  test("未登录不显示订阅按钮", () => {
    mockUseAuth.mockReturnValue({ user: null, isInitialized: true });
    renderWithQC(<ThreadDetailHeader thread={baseThread} />);
    expect(screen.queryByRole("button", { name: "订阅官方更新" })).toBeNull();
    expect(screen.queryByRole("button", { name: "取消订阅官方更新" })).toBeNull();
  });
});
