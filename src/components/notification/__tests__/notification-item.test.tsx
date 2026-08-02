/** NotificationItem 组件测试：类型图标/未读高亮/跳转/标记已读/删除 */

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const { mockUseNotificationActions } = vi.hoisted(() => ({
  mockUseNotificationActions: vi.fn(),
}));

vi.mock("@/api/hooks/use-notification-actions", () => ({
  useNotificationActions: () => mockUseNotificationActions(),
}));

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual("@tanstack/react-query");
  return {
    ...actual,
    useQueryClient: () => ({ invalidateQueries: vi.fn().mockResolvedValue(undefined) }),
  };
});

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { NotificationItem } from "@/components/notification/notification-item";

function renderWithQC(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

function baseNotification(overrides: Record<string, unknown> = {}) {
  return {
    id: "n1",
    type: "reply",
    content: "morenk 回复了：内容",
    payload: null,
    postId: "p1",
    threadId: "t1",
    fromUserId: "u2",
    isRead: false,
    createdAt: "2026-01-01T00:00:00Z",
    post: { id: "p1", floorNumber: 1, parentPostId: null },
    thread: { id: "t1", title: "测试帖" },
    fromUser: { id: "u2", username: "morenk", avatar: null },
    ...overrides,
  };
}

describe("NotificationItem", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseNotificationActions.mockReturnValue({
      markRead: { mutate: vi.fn(), isPending: false, mutateAsync: vi.fn().mockResolvedValue(undefined) },
      remove: { mutate: vi.fn(), isPending: false, mutateAsync: vi.fn().mockResolvedValue(undefined) },
      markAllRead: { mutate: vi.fn(), isPending: false },
    });
  });

  afterEach(() => cleanup());

  test("渲染文案与时间，未读时有跳转链接", () => {
    renderWithQC(<NotificationItem notification={baseNotification()} />);
    expect(screen.getByText("morenk 回复了：内容")).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/threads/t1");
  });

  test("未读点击触发标记已读", async () => {
    const user = userEvent.setup();
    const markReadMutate = vi.fn();
    mockUseNotificationActions.mockReturnValue({
      markRead: { mutate: markReadMutate, isPending: false, mutateAsync: vi.fn() },
      remove: { mutate: vi.fn(), isPending: false, mutateAsync: vi.fn() },
      markAllRead: { mutate: vi.fn(), isPending: false },
    });

    renderWithQC(<NotificationItem notification={baseNotification()} />);
    await user.click(screen.getByRole("link"));

    expect(markReadMutate).toHaveBeenCalledWith("n1");
  });

  test("已读不触发标记已读", async () => {
    const user = userEvent.setup();
    const markReadMutate = vi.fn();
    mockUseNotificationActions.mockReturnValue({
      markRead: { mutate: markReadMutate, isPending: false, mutateAsync: vi.fn() },
      remove: { mutate: vi.fn(), isPending: false, mutateAsync: vi.fn() },
      markAllRead: { mutate: vi.fn(), isPending: false },
    });

    renderWithQC(<NotificationItem notification={baseNotification({ isRead: true })} />);
    await user.click(screen.getByRole("link"));

    expect(markReadMutate).not.toHaveBeenCalled();
  });

  test("follow 类型无 threadId 时跳转用户主页", () => {
    renderWithQC(
      <NotificationItem
        notification={baseNotification({
          type: "follow",
          threadId: null,
          postId: null,
          content: "morenk 关注了你",
        })}
      />,
    );
    expect(screen.getByRole("link")).toHaveAttribute("href", "/users/u2");
  });

  test("system 通知无可点目标", () => {
    renderWithQC(
      <NotificationItem
        notification={baseNotification({
          type: "system",
          threadId: null,
          postId: null,
          fromUserId: null,
          content: "欢迎使用温油站",
        })}
      />,
    );
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  test("删除按钮触发删除", async () => {
    const user = userEvent.setup();
    const removeMutate = vi.fn().mockResolvedValue(undefined);
    mockUseNotificationActions.mockReturnValue({
      markRead: { mutate: vi.fn(), isPending: false, mutateAsync: vi.fn() },
      remove: { mutate: removeMutate, isPending: false, mutateAsync: removeMutate },
      markAllRead: { mutate: vi.fn(), isPending: false },
    });

    renderWithQC(<NotificationItem notification={baseNotification()} />);
    await user.click(screen.getByTitle("删除通知"));

    expect(removeMutate).toHaveBeenCalledWith("n1");
  });
});
