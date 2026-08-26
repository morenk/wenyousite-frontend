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
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import { NotificationItem } from "@/components/notification/notification-item";
import type { NotificationItem as NotificationItemData } from "@/api/hooks/use-notifications";

function renderWithQC(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

function baseNotification(
  overrides: Partial<NotificationItemData> = {},
): NotificationItemData {
  return {
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
    fromUser: { id: "u2", username: "morenk", avatar: null, level: 1 },
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
    expect(screen.getByRole("link")).toHaveAttribute("href", "/threads/t1?post=p1");
  });

  test("结构化 reply 保持中性动作并忽略回复目标字段", () => {
    renderWithQC(
      <NotificationItem
        notification={baseNotification({
          content: "旧版完整文案",
          payload: {
            schemaVersion: 1,
            action: "reply",
            actorName: "新用户名",
            replyTargetUserId: "target-user",
            replyTargetName: "阿忠",
            preview: "结构化预览",
          },
        })}
      />,
    );
    expect(screen.getByText("新用户名")).toBeInTheDocument();
    expect(screen.getByText("回复了")).toBeInTheDocument();
    expect(screen.getByText(/结构化预览/)).toBeInTheDocument();
    expect(screen.queryByText("阿忠")).not.toBeInTheDocument();
    expect(screen.queryByText("旧版完整文案")).not.toBeInTheDocument();
  });

  test("结构化 new_reply 显示楼中楼订阅更新文案", () => {
    renderWithQC(
      <NotificationItem
        notification={baseNotification({
          type: "new_post",
          content: "旧版完整文案",
          payload: {
            schemaVersion: 1,
            action: "new_reply",
            actorName: "楼主",
            preview: "新的楼中楼内容",
          },
        })}
      />,
    );

    expect(screen.getByText("楼主")).toBeInTheDocument();
    expect(screen.getByText("发布了楼中楼回复")).toBeInTheDocument();
    expect(screen.getByText(/新的楼中楼内容/)).toBeInTheDocument();
    expect(screen.queryByText("旧版完整文案")).not.toBeInTheDocument();
  });

  test("楼中楼通知直接进入独立阅读页", () => {
    renderWithQC(
      <NotificationItem
        notification={baseNotification({
          postId: "r1",
          target: { kind: "post", state: "ACTIVE", threadId: "t1", postId: "r1", userId: null },
          post: { id: "r1", floorNumber: null, parentPostId: "p1" },
        })}
      />,
    );
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "/threads/t1/posts/p1/replies?post=r1",
    );
  });

  test("动态主评论通知携带评论定位参数", () => {
    renderWithQC(
      <NotificationItem
        notification={baseNotification({
          postId: null,
          threadId: null,
          momentId: "moment-1",
          momentCommentId: "comment-root",
          target: {
            kind: "moment",
            state: "ACTIVE",
            threadId: null,
            postId: null,
            momentId: "moment-1",
            momentCommentId: "comment-root",
            userId: null,
          },
          post: null,
          thread: null,
          moment: { id: "moment-1", title: "测试动态" },
          momentComment: { id: "comment-root", parentCommentId: null },
        })}
      />,
    );

    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "/moments/moment-1?comment=comment-root#moment-comment-comment-root",
    );
  });

  test("动态楼中楼通知同时携带主评论与具体回复定位参数", () => {
    renderWithQC(
      <NotificationItem
        notification={baseNotification({
          postId: null,
          threadId: null,
          momentId: "moment-1",
          momentCommentId: "reply-108",
          target: {
            kind: "moment",
            state: "ACTIVE",
            threadId: null,
            postId: null,
            momentId: "moment-1",
            momentCommentId: "reply-108",
            userId: null,
          },
          post: null,
          thread: null,
          moment: { id: "moment-1", title: "测试动态" },
          momentComment: { id: "reply-108", parentCommentId: "comment-root" },
        })}
      />,
    );

    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "/moments/moment-1?comment=comment-root&reply=reply-108#moment-comment-reply-108",
    );
  });

  test("动态评论已删除时不再提供失效的定位链接", () => {
    renderWithQC(
      <NotificationItem
        notification={baseNotification({
          postId: null,
          threadId: null,
          momentId: null,
          momentCommentId: null,
          target: {
            kind: "none",
            state: "CONTENT_DELETED",
            threadId: null,
            postId: null,
            momentId: null,
            momentCommentId: null,
            userId: null,
          },
          post: null,
          thread: null,
          moment: { id: "moment-1", title: "测试动态" },
          momentComment: {
            id: "comment-deleted",
            parentCommentId: null,
            deletedAt: "2026-01-02T00:00:00Z",
          },
        })}
      />,
    );

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText("该评论已删除")).toBeInTheDocument();
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

  test("历史图片通知不展示 Milkdown 的 1.00 alt", () => {
    renderWithQC(
      <NotificationItem
        notification={baseNotification({
          content: "morenk 回复了：1.00",
          payload: { schemaVersion: 1, action: "reply", preview: "1.00" },
        })}
      />,
    );
    expect(screen.queryByText(/1\.00/)).not.toBeInTheDocument();
    expect(screen.getByText("morenk 回复了：")).toBeInTheDocument();
  });

  test("历史图文通知移除图片 Markdown 但保留正文", () => {
    renderWithQC(
      <NotificationItem
        notification={baseNotification({
          content: "morenk 回复了：![1.00]()\n\n玛～利～亚～",
          payload: { schemaVersion: 1, action: "reply", preview: "![1.00]()\n\n玛～利～亚～" },
        })}
      />,
    );
    expect(screen.queryByText(/1\.00/)).not.toBeInTheDocument();
    expect(screen.getByText(/玛～利～亚～/)).toBeInTheDocument();
  });

  test("Milkdown 转义残留的反斜杠在通知文案中被还原为标点", () => {
    renderWithQC(
      <NotificationItem
        notification={baseNotification({
          content: "玛利亚666 回复了：\\>",
          payload: { schemaVersion: 1, action: "reply", preview: "\\>" },
        })}
      />,
    );
    expect(screen.getByText("玛利亚666 回复了：>")).toBeInTheDocument();
    expect(screen.queryByText(/\\>/)).not.toBeInTheDocument();
  });

  test("Milkdown 转义残留的反斜杠在标签类文案中被清除", () => {
    renderWithQC(
      <NotificationItem
        notification={baseNotification({
          content: "morenk 回复了：\\<div>代码\\</div>",
          payload: { schemaVersion: 1, action: "reply", preview: "\\<div>代码\\</div>" },
        })}
      />,
    );
    expect(screen.getByText("morenk 回复了：<div>代码</div>")).toBeInTheDocument();
    expect(screen.queryByText(/\\</)).not.toBeInTheDocument();
  });

  test("Milkdown 硬换行反斜杠在通知文案中被清除", () => {
    renderWithQC(
      <NotificationItem
        notification={baseNotification({
          content: "玛利亚666 回复了：<看看呢>\\\n>看看呢<",
          payload: null,
        })}
      />,
    );
    expect(screen.getByText(/玛利亚666 回复了：<看看呢>/)).toBeInTheDocument();
    expect(screen.queryByText(/看看呢>\\/)).not.toBeInTheDocument();
    expect(screen.queryByText(/\\/)).not.toBeInTheDocument();
  });

  test("follow 类型无 threadId 时跳转用户主页", () => {
    renderWithQC(
      <NotificationItem
        notification={baseNotification({
          type: "follow",
          target: { kind: "user", state: "ACTIVE", threadId: null, postId: null, userId: "u2" },
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
          target: { kind: "none", state: "NO_TARGET", threadId: null, postId: null, userId: null },
          threadId: null,
          postId: null,
          fromUserId: null,
          fromUser: null,
          content: "欢迎使用温油站",
        })}
      />,
    );
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  test("主题帖已删除时不渲染跳转链接，展示已删除提示", () => {
    renderWithQC(
      <NotificationItem
        notification={baseNotification({
          target: { kind: "none", state: "CONTENT_DELETED", threadId: null, postId: null, userId: null },
          threadId: null,
          postId: null,
          isRead: false,
          thread: { id: "t1", title: "测试帖", deletedAt: "2026-01-02T00:00:00Z" },
        })}
      />,
    );
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText("该内容已删除")).toBeInTheDocument();
  });

  test("父级被管理员隐藏时即使回复关联仍存活也不渲染链接", () => {
    renderWithQC(
      <NotificationItem
        notification={baseNotification({
          target: { kind: "none", state: "CONTENT_DELETED", threadId: null, postId: null, userId: null },
          threadId: null,
          postId: null,
          isRead: true,
          post: { id: "p1", floorNumber: null, parentPostId: "root-hidden" },
        })}
      />,
    );
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText("该内容已删除")).toBeInTheDocument();
  });

  test("关注来源用户已注销时不渲染跳转链接，展示注销提示", () => {
    renderWithQC(
      <NotificationItem
        notification={baseNotification({
          type: "follow",
          target: { kind: "none", state: "USER_DEACTIVATED", threadId: null, postId: null, userId: null },
          threadId: null,
          postId: null,
          fromUserId: null,
          isRead: true,
          content: "morenk 关注了你",
          fromUser: { id: "u2", username: "morenk", avatar: null, level: 1, deletedAt: "2026-01-02T00:00:00Z" },
        })}
      />,
    );
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText("该用户已注销")).toBeInTheDocument();
  });

  test("点击已删除历史只提示且不会重复标记已读", async () => {
    const user = userEvent.setup();
    const markReadMutate = vi.fn();
    mockUseNotificationActions.mockReturnValue({
      markRead: { mutate: markReadMutate, isPending: false, mutateAsync: vi.fn() },
      remove: { mutate: vi.fn(), isPending: false, mutateAsync: vi.fn() },
      markAllRead: { mutate: vi.fn(), isPending: false },
    });
    const { toast } = await import("sonner");

    renderWithQC(
      <NotificationItem
        notification={baseNotification({
          target: { kind: "none", state: "CONTENT_DELETED", threadId: null, postId: null, userId: null },
          threadId: null,
          postId: null,
          isRead: false,
          thread: { id: "t1", title: "测试帖", deletedAt: "2026-01-02T00:00:00Z" },
        })}
      />,
    );
    await user.click(screen.getByText("该内容已删除"));

    expect(markReadMutate).not.toHaveBeenCalled();
    expect(toast.info).toHaveBeenCalledWith("该内容已删除");
  });

  test("有操作者时显示头像（无头像则首字符占位）", () => {
    renderWithQC(<NotificationItem notification={baseNotification()} />);
    expect(screen.getByTestId("user-avatar-placeholder").textContent).toBe("M");
    expect(screen.getByRole("img", { name: "morenk头像" })).toHaveAttribute(
      "data-avatar-fallback",
      "first-readable-character",
    );
  });

  test("操作者有头像时渲染接口返回的母版", () => {
    renderWithQC(
      <NotificationItem
        notification={baseNotification({
          fromUser: { id: "u2", username: "morenk", avatar: "https://example.com/uploads/a.png", level: 1 },
        })}
      />,
    );
    expect(screen.getByRole("img")).toHaveAttribute(
      "src",
      "https://example.com/uploads/a.png",
    );
    expect(screen.queryByTestId("user-avatar-placeholder")).not.toBeInTheDocument();
  });

  test("系统通知（无操作者）保留类型图标", () => {
    renderWithQC(
      <NotificationItem
        notification={baseNotification({
          type: "system",
          target: { kind: "none", state: "NO_TARGET", threadId: null, postId: null, userId: null },
          fromUserId: null,
          fromUser: null,
          content: "欢迎使用温油站",
        })}
      />,
    );
    expect(screen.queryByTestId("user-avatar-placeholder")).not.toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
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
