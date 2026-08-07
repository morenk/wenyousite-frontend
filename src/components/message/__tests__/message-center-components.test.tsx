import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const { mockPathname, mockUseAuth, mockUnread, mockDirectUnread, mockConversations } = vi.hoisted(() => ({
  mockPathname: vi.fn(),
  mockUseAuth: vi.fn(),
  mockUnread: vi.fn(),
  mockDirectUnread: vi.fn(),
  mockConversations: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));
vi.mock("next/navigation", () => ({ usePathname: () => mockPathname() }));
vi.mock("@/lib/auth", () => ({ useAuth: () => mockUseAuth() }));
vi.mock("@/api/hooks/use-unread-count", () => ({ useUnreadCount: () => mockUnread() }));
vi.mock("@/api/hooks/use-direct-conversations", () => ({
  useDirectUnreadCount: () => mockDirectUnread(),
  useDirectConversations: (...args: unknown[]) => mockConversations(...args),
}));

import { MessageCenterTabs } from "@/components/message/message-center-tabs";
import { DirectConversationList } from "@/components/message/direct-conversation-list";
import { DirectMessagesFrame } from "@/components/message/direct-messages-frame";

beforeEach(() => {
  vi.clearAllMocks();
  mockPathname.mockReturnValue("/messages");
  mockUseAuth.mockReturnValue({ user: { id: "u1" } });
  mockUnread.mockReturnValue({ data: 4 });
  mockDirectUnread.mockReturnValue({ data: { total: 3 } });
});

afterEach(() => cleanup());

function query(overrides: Record<string, unknown> = {}) {
  return {
    data: { pages: [{ data: [], meta: { cursor: null, hasMore: false } }] },
    isLoading: false,
    isError: false,
    hasNextPage: false,
    isFetchingNextPage: false,
    fetchNextPage: vi.fn(),
    refetch: vi.fn(),
    ...overrides,
  };
}

describe("MessageCenterTabs", () => {
  test("展示私聊与通知各自徽标并标记当前页签", () => {
    render(<MessageCenterTabs />);
    expect(screen.getByRole("link", { name: "私聊 3" })).toHaveAttribute("href", "/messages");
    expect(screen.getByRole("link", { name: "通知 4" })).toHaveAttribute("href", "/notifications");
    expect(screen.getByRole("link", { name: "私聊 3" })).toHaveClass("border-primary");
  });

  test("通知页签激活且 99 以上显示 99+", () => {
    mockPathname.mockReturnValue("/notifications");
    mockUnread.mockReturnValue({ data: 120 });
    mockDirectUnread.mockReturnValue({ data: undefined });
    render(<MessageCenterTabs />);
    expect(screen.getByText("99+")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "通知 99+" })).toHaveClass("border-primary");
  });
});

describe("DirectConversationList", () => {
  test("合并普通会话与收到的请求，并渲染方向、未读徽标和加载更多", async () => {
    const fetchNextPage = vi.fn();
    mockConversations.mockImplementation((view: string) => view === "INBOX" ? query({
      data: { pages: [{ data: [{
        id: "c1",
        status: "PENDING",
        requestDirection: "OUTGOING",
        otherUser: { id: "u2", username: "用户二", avatar: null, isDeactivated: false },
        lastMessage: {
          id: "m1",
          senderId: "u1",
          contentPreview: null,
          hasImage: true,
          isRecalled: false,
          createdAt: "2026-08-06T20:00:00Z",
        },
        unreadCount: 105,
        archivedAt: null,
        lastMessageAt: "2026-08-06T20:00:00Z",
        createdAt: "2026-08-06T19:00:00Z",
        canSend: false,
        canAccept: false,
        canDecline: false,
        isBlocked: false,
      }], meta: { cursor: "c1", hasMore: true } }] },
      hasNextPage: true,
      fetchNextPage,
    }) : view === "REQUESTS" ? query({
      data: { pages: [{ data: [{
        id: "c2",
        status: "PENDING",
        requestDirection: "INCOMING",
        otherUser: { id: "u3", username: "请求用户", avatar: null, isDeactivated: false },
        lastMessage: {
          id: "m2",
          senderId: "u3",
          contentPreview: "你好，可以聊聊吗？",
          hasImage: false,
          isRecalled: false,
          createdAt: "2026-08-07T20:00:00Z",
        },
        unreadCount: 0,
        archivedAt: null,
        lastMessageAt: "2026-08-07T20:00:00Z",
        createdAt: "2026-08-07T20:00:00Z",
        canSend: false,
        canAccept: true,
        canDecline: true,
        isBlocked: false,
      }], meta: { cursor: null, hasMore: false } }] },
    }) : query());
    render(<DirectConversationList selectedId="c1" />);
    expect(mockConversations).toHaveBeenCalledWith("INBOX", "u1", { poll: true });
    expect(mockConversations).toHaveBeenCalledWith("REQUESTS", "u1", { poll: true });
    expect(mockConversations).toHaveBeenCalledWith("ARCHIVED", "u1", { poll: false });
    expect(screen.getByRole("link", { name: /用户二/ })).toHaveAttribute("href", "/messages/c1");
    expect(screen.getByRole("link", { name: /请求用户/ })).toHaveAttribute("href", "/messages/c2");
    expect(screen.getByText(/等待接受/)).toHaveTextContent("[图片]");
    expect(screen.getByText(/消息请求/)).toHaveTextContent("你好，可以聊聊吗？");
    expect(screen.getByText("99+")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "加载更多" }));
    expect(fetchNextPage).toHaveBeenCalled();
  });

  test("没有归档时隐藏文件夹，有归档时在顶部显示并可进入新列表", async () => {
    mockConversations.mockImplementation((view: string) => view === "ARCHIVED" ? query({
      data: { pages: [{ data: [{
        id: "archived-1",
        status: "ACCEPTED",
        requestDirection: "NONE",
        otherUser: { id: "u4", username: "归档用户", avatar: null, isDeactivated: false },
        lastMessage: null,
        unreadCount: 0,
        archivedAt: "2026-08-07T20:00:00Z",
        lastMessageAt: "2026-08-07T20:00:00Z",
        createdAt: "2026-08-07T19:00:00Z",
        canSend: true,
        canAccept: false,
        canDecline: false,
        isBlocked: false,
      }], meta: { cursor: null, hasMore: false } }] },
    }) : query());
    render(<DirectConversationList />);
    expect(screen.getByRole("button", { name: /已归档/ })).toHaveTextContent("1 个会话");
    expect(screen.queryByRole("link", { name: /归档用户/ })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /已归档/ }));
    expect(screen.getByRole("link", { name: /归档用户/ })).toHaveAttribute(
      "href",
      "/messages/archived-1",
    );
    await userEvent.click(screen.getByRole("button", { name: "返回聊天列表" }));
    expect(screen.queryByRole("link", { name: /归档用户/ })).not.toBeInTheDocument();
  });

  test("没有归档会话时不显示归档文件夹", () => {
    mockConversations.mockReturnValue(query());
    render(<DirectConversationList />);
    expect(screen.getByText("暂无私聊")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /已归档/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "请求" })).not.toBeInTheDocument();
  });

  test("错误态可重试，加载态不展示空文案", async () => {
    const refetch = vi.fn();
    mockConversations.mockImplementation((view: string) => view === "INBOX"
      ? query({ isError: true, refetch })
      : query());
    const rendered = render(<DirectConversationList />);
    await userEvent.click(screen.getByRole("button", { name: "重试" }));
    expect(refetch).toHaveBeenCalled();
    rendered.unmount();

    mockConversations.mockReturnValue(query({ isLoading: true }));
    render(<DirectConversationList />);
    expect(screen.queryByText("暂无私聊")).not.toBeInTheDocument();
  });
});

describe("DirectMessagesFrame", () => {
  test("从会话路径提取选中 ID 并展示子页面", () => {
    mockPathname.mockReturnValue("/messages/c1");
    mockConversations.mockReturnValue(query());
    render(<DirectMessagesFrame><div>会话内容</div></DirectMessagesFrame>);
    expect(screen.getByRole("heading", { name: "消息" })).toBeInTheDocument();
    expect(screen.getByText("会话内容")).toBeInTheDocument();
  });
});
