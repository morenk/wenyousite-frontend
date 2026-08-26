/** NotificationList 组件测试：三态 + 全部已读 */

import { describe, test, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const { mockUseNotifications, mockUseUnreadCounts, mockUseInfiniteScroll } = vi.hoisted(() => ({
  mockUseNotifications: vi.fn(),
  mockUseUnreadCounts: vi.fn(() => ({ notificationCount: 0, directMessageCount: 0 })),
  mockUseInfiniteScroll: vi.fn((options?: unknown) => {
    void options;
    return vi.fn();
  }),
}));
const { mockUseNotificationActions } = vi.hoisted(() => ({
  mockUseNotificationActions: vi.fn(),
}));

vi.mock("@/api/hooks/use-notifications", () => ({
  useNotifications: () => mockUseNotifications(),
}));

vi.mock("@/components/layout/unread-counts-context", () => ({
  useUnreadCounts: () => mockUseUnreadCounts(),
}));

vi.mock("@/hooks/use-infinite-scroll", () => ({
  useInfiniteScroll: (options: unknown) => mockUseInfiniteScroll(options),
}));

vi.mock("@/api/hooks/use-notification-actions", () => ({
  useNotificationActions: () => mockUseNotificationActions(),
}));

vi.mock("@/components/notification/notification-item", () => ({
  NotificationItem: ({ notification }: { notification: { content: string } }) => (
    <div data-testid="notification-item">{notification.content}</div>
  ),
}));

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ user: { id: "u1", username: "tester" } }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { toast } from "sonner";
import { NotificationList } from "@/components/notification/notification-list";

function renderList(overrides: { type?: string; onTypeChange?: (t?: string) => void } = {}) {
  const onTypeChange = overrides.onTypeChange ?? vi.fn();
  return render(<NotificationList type={overrides.type} onTypeChange={onTypeChange} />, {
    wrapper: createWrapper(),
  });
}

beforeAll(() => {
  vi.stubGlobal("IntersectionObserver", class {
    observe() {}
    unobserve() {}
    disconnect() {}
  });
});

afterEach(() => cleanup());
beforeEach(() => {
  vi.clearAllMocks();
  mockUseUnreadCounts.mockReturnValue({ notificationCount: 0, directMessageCount: 0 });
});

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  }
  Wrapper.displayName = "QueryClientWrapper";
  return Wrapper;
}

const sampleNotification = {
  id: "n1",
  type: "reply",
  content: "morenk 回复了：内容",
  payload: null,
  target: { kind: "post", state: "ACTIVE", threadId: "t1", postId: "p1", userId: null },
  postId: "p1",
  threadId: "t1",
  fromUserId: "u2",
  isRead: false,
  createdAt: "2026-01-01T00:00:00Z",
  post: { id: "p1", floorNumber: 1, parentPostId: null },
  thread: { id: "t1", title: "测试帖" },
  fromUser: { id: "u2", username: "morenk", avatar: null },
};

describe("NotificationList", () => {
  test("加载中显示 spinner", () => {
    mockUseNotifications.mockReturnValue({
      data: undefined,
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      isLoading: true,
      isError: false,
      error: undefined,
      refetch: vi.fn(),
    });
    mockUseNotificationActions.mockReturnValue({ markAllRead: { isPending: false, mutateAsync: vi.fn() } });
    renderList();
    expect(document.querySelector(".animate-spin")).toBeTruthy();
  });

  test("空列表显示空状态，且类型筛选栏仍然保留", () => {
    mockUseNotifications.mockReturnValue({
      data: { pages: [] },
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      isLoading: false,
      isError: false,
      error: undefined,
      refetch: vi.fn(),
    });
    mockUseNotificationActions.mockReturnValue({ markAllRead: { isPending: false, mutateAsync: vi.fn() } });
    renderList();
    expect(screen.getByText("暂无通知")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "全部" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "互动" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "订阅" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "系统" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "温油与等级" })).not.toBeInTheDocument();
  });

  test("点击类型筛选触发 onTypeChange", async () => {
    const user = userEvent.setup();
    const onTypeChange = vi.fn();
    mockUseNotifications.mockReturnValue({
      data: { pages: [] },
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      isLoading: false,
      isError: false,
      error: undefined,
      refetch: vi.fn(),
    });
    mockUseNotificationActions.mockReturnValue({ markAllRead: { isPending: false, mutateAsync: vi.fn() } });
    renderList({ onTypeChange });

    await user.click(screen.getByRole("button", { name: "互动" }));
    expect(onTypeChange).toHaveBeenCalledWith("reply,mention,follow,like");

    await user.click(screen.getByRole("button", { name: "系统" }));
    expect(onTypeChange).toHaveBeenCalledWith("tip,level_up,system");

    await user.click(screen.getByRole("button", { name: "全部" }));
    expect(onTypeChange).toHaveBeenCalledWith(undefined);
  });

  test("错误状态显示重试", () => {
    mockUseNotifications.mockReturnValue({
      data: undefined,
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      isLoading: false,
      isError: true,
      error: new Error("网络错误"),
      refetch: vi.fn(),
    });
    mockUseNotificationActions.mockReturnValue({ markAllRead: { isPending: false, mutateAsync: vi.fn() } });
    renderList();
    expect(screen.getByText("通知加载失败")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "重试" })).toBeInTheDocument();
  });

  test("渲染通知列表与全部已读按钮", async () => {
    const user = userEvent.setup();
    const markAllReadMutate = vi.fn().mockResolvedValue(undefined);
    mockUseUnreadCounts.mockReturnValue({ notificationCount: 2, directMessageCount: 0 });
    mockUseNotifications.mockReturnValue({
      data: { pages: [{ data: [sampleNotification], meta: { cursor: null, hasMore: false } }] },
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      isLoading: false,
      isError: false,
      error: undefined,
      refetch: vi.fn(),
    });
    mockUseNotificationActions.mockReturnValue({
      markAllRead: { isPending: false, mutateAsync: markAllReadMutate },
    });

    renderList();
    expect(screen.getAllByTestId("notification-item")).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: "全部已读" }));
    expect(markAllReadMutate).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith("已全部标记为已读");
  });

  test("当前筛选为空但全局仍有未读时保留全部已读入口", () => {
    mockUseUnreadCounts.mockReturnValue({ notificationCount: 3, directMessageCount: 0 });
    mockUseNotifications.mockReturnValue({
      data: { pages: [] },
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      isLoading: false,
      isError: false,
      error: undefined,
      refetch: vi.fn(),
    });
    mockUseNotificationActions.mockReturnValue({
      markAllRead: { isPending: false, mutateAsync: vi.fn() },
    });

    renderList({ type: "new_post,thread_created" });

    expect(screen.getByRole("button", { name: "全部已读" })).toBeInTheDocument();
    expect(mockUseUnreadCounts).toHaveBeenCalled();
  });

  test("全局未读为零时即使当前页残留未读值也隐藏全部已读入口", () => {
    mockUseNotifications.mockReturnValue({
      data: {
        pages: [{
          data: [{
            ...sampleNotification,
            target: {
              kind: "none",
              state: "CONTENT_DELETED",
              threadId: null,
              postId: null,
              userId: null,
            },
          }],
          meta: { cursor: null, hasMore: false },
        }],
      },
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      isLoading: false,
      isError: false,
      error: undefined,
      refetch: vi.fn(),
    });
    mockUseNotificationActions.mockReturnValue({
      markAllRead: { isPending: false, mutateAsync: vi.fn() },
    });

    renderList();

    expect(screen.queryByRole("button", { name: "全部已读" })).toBeNull();
  });

  test("下一页失败时暂停自动加载且只重试 fetchNextPage", async () => {
    const user = userEvent.setup();
    const fetchNextPage = vi.fn().mockResolvedValue(undefined);
    const refetch = vi.fn().mockResolvedValue(undefined);
    mockUseNotifications.mockReturnValue({
      data: { pages: [{ data: [sampleNotification], meta: { cursor: "next", hasMore: true } }] },
      fetchNextPage,
      hasNextPage: true,
      isFetchingNextPage: false,
      isFetchNextPageError: true,
      isLoading: false,
      isError: false,
      error: undefined,
      refetch,
    });
    mockUseNotificationActions.mockReturnValue({
      markAllRead: { isPending: false, mutateAsync: vi.fn() },
    });

    renderList();

    expect(screen.queryByRole("button", { name: "加载更多" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "加载失败，重试" })).toHaveLength(1);
    expect(mockUseInfiniteScroll).toHaveBeenLastCalledWith(expect.objectContaining({
      hasNextPage: false,
    }));

    await user.click(screen.getByRole("button", { name: "加载失败，重试" }));
    expect(fetchNextPage).toHaveBeenCalledTimes(1);
    expect(refetch).not.toHaveBeenCalled();
  });
});
