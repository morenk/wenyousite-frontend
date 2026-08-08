import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  conversationQuery: vi.fn(),
  history: vi.fn(),
  actions: vi.fn(),
  blockActions: vi.fn(),
  confirm: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  virtualScrollToEnd: vi.fn(),
}));

vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getVirtualItems: () => Array.from({ length: count }, (_, index) => ({
      index,
      key: `row-${index}`,
      start: index * 100,
    })),
    getTotalSize: () => count * 100,
    measureElement: vi.fn(),
    scrollToEnd: mocks.virtualScrollToEnd,
  }),
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("@/lib/auth", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
vi.mock("@/api/hooks/use-direct-conversations", () => ({
  useDirectConversation: () => mocks.conversationQuery(),
}));
vi.mock("@/api/hooks/use-direct-messages", () => ({
  useDirectMessages: () => mocks.history(),
}));
vi.mock("@/api/hooks/use-direct-message-actions", () => ({
  useDirectMessageActions: () => mocks.actions(),
}));
vi.mock("@/api/hooks/use-block-actions", () => ({
  useBlockActions: () => mocks.blockActions(),
}));
vi.mock("@/components/ui/confirm-provider", () => ({ useConfirm: () => mocks.confirm }));
vi.mock("sonner", () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));
vi.mock("@/components/message/direct-message-composer", () => ({
  DirectMessageComposer: ({ onSend }: { onSend: (value: { content: string; clientRequestId: string }) => void }) => (
    <button
      type="button"
      onClick={() => onSend({ content: "新消息", clientRequestId: "client-id" })}
    >
      测试发送
    </button>
  ),
}));
vi.mock("@/components/message/direct-message-bubble", () => ({
  DirectMessageBubble: ({
    message,
    hideRequestImage,
    canRecall,
    onRecall,
  }: {
    message: { id: string; content: string | null };
    hideRequestImage: boolean;
    canRecall: boolean;
    onRecall: () => void;
  }) => (
    <div>
      <span>{message.content ?? message.id}</span>
      {hideRequestImage && <span>图片已隐藏</span>}
      {canRecall && <button type="button" onClick={onRecall}>撤回 {message.id}</button>}
    </div>
  ),
}));

import { DirectConversationPanel } from "@/components/message/direct-conversation-panel";

function mutation() {
  return { mutate: vi.fn(), mutateAsync: vi.fn().mockResolvedValue({}), isPending: false };
}

const baseConversation = {
  id: "c1",
  status: "ACCEPTED" as const,
  requestDirection: "NONE" as const,
  otherUser: { id: "u2", username: "用户二", avatar: null, isDeactivated: false },
  lastMessage: null,
  unreadCount: 1,
  archivedAt: null,
  lastMessageAt: "2026-08-06T20:00:00Z",
  createdAt: "2026-08-06T19:00:00Z",
  canSend: true,
  canAccept: false,
  canDecline: false,
  isBlocked: false,
};

let actionSet: ReturnType<typeof makeActions>;
let blockSet: { block: ReturnType<typeof mutation>; unblock: ReturnType<typeof mutation> };

function makeActions() {
  return {
    send: mutation(),
    handleRequest: mutation(),
    setArchived: mutation(),
    markRead: mutation(),
    recall: mutation(),
  };
}

function setConversation(overrides: Record<string, unknown> = {}) {
  mocks.conversationQuery.mockReturnValue({
    data: { ...baseConversation, ...overrides },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  actionSet = makeActions();
  blockSet = { block: mutation(), unblock: mutation() };
  mocks.actions.mockReturnValue(actionSet);
  mocks.blockActions.mockReturnValue(blockSet);
  mocks.confirm.mockResolvedValue(true);
  setConversation();
  mocks.history.mockReturnValue({
    messages: [
      {
        id: "m1",
        senderId: "u2",
        recipientId: "u1",
        content: "收到的消息",
        recalledAt: null,
        createdAt: new Date().toISOString(),
      },
      {
        id: "m2",
        senderId: "u1",
        recipientId: "u2",
        content: "我的消息",
        recalledAt: null,
        createdAt: new Date().toISOString(),
      },
    ],
    isLoading: false,
    isError: false,
    hasNextPage: true,
    isFetchingNextPage: false,
    fetchNextPage: vi.fn(),
    refetchLatest: vi.fn(),
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("DirectConversationPanel", () => {
  test("已接受会话展示历史、标记已读并支持发送、加载与归档", async () => {
    const history = mocks.history();
    mocks.history.mockReturnValue(history);
    render(<DirectConversationPanel conversationId="c1" />);

    expect(screen.getByRole("link", { name: /用户二/ })).toHaveAttribute("href", "/users/u2");
    await waitFor(() => expect(actionSet.markRead.mutate).toHaveBeenCalledWith(
      "m1",
      expect.objectContaining({ onError: expect.any(Function) }),
    ));
    await userEvent.click(screen.getByRole("button", { name: "测试发送" }));
    expect(actionSet.send.mutateAsync).toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "查看更早消息" }));
    expect(history.fetchNextPage).toHaveBeenCalled();
    await userEvent.click(screen.getByTitle("归档"));
    expect(actionSet.setArchived.mutateAsync).toHaveBeenCalledWith(true);
    expect(mocks.toastSuccess).toHaveBeenCalledWith("已归档");
  });

  test("本人十分钟内消息可撤回", async () => {
    render(<DirectConversationPanel conversationId="c1" />);
    const recall = await screen.findByRole("button", { name: "撤回 m2" });
    await userEvent.click(recall);
    expect(mocks.confirm).toHaveBeenCalledWith(expect.objectContaining({ title: "撤回消息" }));
    expect(actionSet.recall.mutateAsync).toHaveBeenCalledWith("m2");
    expect(mocks.toastSuccess).toHaveBeenCalledWith("消息已撤回");
  });

  test("首次进入自动定位底部，本人乐观消息上屏时平滑跟随", () => {
    const initialHistory = mocks.history();
    mocks.history.mockReturnValue(initialHistory);
    const view = render(<DirectConversationPanel conversationId="c1" />);
    expect(mocks.virtualScrollToEnd).toHaveBeenCalledWith({ behavior: "auto" });
    mocks.virtualScrollToEnd.mockClear();

    mocks.history.mockReturnValue({
      ...initialHistory,
      messages: [
        ...initialHistory.messages,
        {
          id: "optimistic:client-id",
          senderId: "u1",
          recipientId: "u2",
          content: "立即显示",
          recalledAt: null,
          createdAt: new Date().toISOString(),
          deliveryState: "sending",
        },
      ],
    });
    view.rerender(<DirectConversationPanel conversationId="c1" />);

    expect(mocks.virtualScrollToEnd).toHaveBeenCalledWith({ behavior: "smooth" });
  });

  test("离开底部时返回入口会刷新并一次定位到最新消息", async () => {
    const history = mocks.history();
    mocks.history.mockReturnValue(history);
    render(<DirectConversationPanel conversationId="c1" />);
    mocks.virtualScrollToEnd.mockClear();

    const messageLog = screen.getByRole("log", { name: "消息记录" });
    Object.defineProperties(messageLog, {
      scrollHeight: { configurable: true, value: 1_000 },
      clientHeight: { configurable: true, value: 400 },
      scrollTop: { configurable: true, writable: true, value: 100 },
    });
    messageLog.dispatchEvent(new Event("scroll", {
      bubbles: true,
    }));

    const jumpButton = await screen.findByRole("button", { name: "回到最新消息" });
    await userEvent.click(jumpButton);
    expect(mocks.virtualScrollToEnd).toHaveBeenCalledWith({ behavior: "auto" });
    expect(history.refetchLatest).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: "回到最新消息" })).not.toBeInTheDocument();

    messageLog.scrollTop = 600;
    messageLog.dispatchEvent(new Event("scroll", { bubbles: true }));
    expect(screen.queryByRole("button", { name: "回到最新消息" })).not.toBeInTheDocument();
  });

  test("切换会话时重新按首次进入定位到底部", () => {
    const history = mocks.history();
    mocks.history.mockReturnValue(history);
    const view = render(<DirectConversationPanel conversationId="c1" />);
    expect(mocks.virtualScrollToEnd).toHaveBeenCalledWith({ behavior: "auto" });
    mocks.virtualScrollToEnd.mockClear();

    view.rerender(<DirectConversationPanel conversationId="c2" />);

    expect(mocks.virtualScrollToEnd).toHaveBeenCalledWith({ behavior: "auto" });
  });

  test("连续消息按五分钟间隔合并为居中时间线节点", async () => {
    vi.spyOn(Date, "now").mockReturnValue(new Date("2026-08-07T15:00:00Z").getTime());
    const history = mocks.history();
    mocks.history.mockReturnValue({
      ...history,
      messages: [
        { ...history.messages[0], id: "timeline-1", createdAt: "2026-08-07T14:00:00Z" },
        { ...history.messages[1], id: "timeline-2", createdAt: "2026-08-07T14:02:00Z" },
        { ...history.messages[0], id: "timeline-3", createdAt: "2026-08-07T14:07:00Z" },
      ],
    });
    const { container } = render(<DirectConversationPanel conversationId="c1" />);

    await waitFor(() => expect(container.querySelectorAll("time")).toHaveLength(2));
    expect(container.querySelectorAll("time")[0]).toHaveTextContent("14:00");
    expect(container.querySelectorAll("time")[1]).toHaveTextContent("14:07");
  });

  test("收到的待处理请求可接受、拒绝且隐藏陌生图片", async () => {
    setConversation({
      status: "PENDING",
      requestDirection: "INCOMING",
      canSend: false,
      canAccept: true,
      canDecline: true,
    });
    render(<DirectConversationPanel conversationId="c1" />);
    expect(screen.getByText("发来的消息请求")).toBeInTheDocument();
    expect(screen.getByText("图片已隐藏")).toBeInTheDocument();
    expect(screen.getByText("请先接受或拒绝这条消息请求。")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "接受" }));
    expect(actionSet.handleRequest.mutateAsync).toHaveBeenCalledWith("ACCEPT");
    await userEvent.click(screen.getByRole("button", { name: "拒绝" }));
    expect(mocks.confirm).toHaveBeenCalledWith(expect.objectContaining({ title: "拒绝消息请求" }));
    expect(actionSet.handleRequest.mutateAsync).toHaveBeenCalledWith("DECLINE");
  });

  test("拉黑需确认，已存在任一方向拉黑时保持历史只读且不误导为可解除", async () => {
    const first = render(<DirectConversationPanel conversationId="c1" />);
    await userEvent.click(screen.getByRole("button", { name: "拉黑" }));
    expect(blockSet.block.mutateAsync).toHaveBeenCalled();
    expect(mocks.confirm).toHaveBeenCalledWith(expect.objectContaining({ title: "拉黑用户" }));
    first.unmount();

    setConversation({ isBlocked: true, canSend: false });
    render(<DirectConversationPanel conversationId="c1" />);
    expect(screen.getByText(/历史消息仅供查看/)).toBeInTheDocument();
    expect(screen.getByText("联系已被阻止")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "取消拉黑" })).not.toBeInTheDocument();
  });

  test("归档会话可恢复，注销/等待/拒绝/取消均展示对应只读原因", async () => {
    setConversation({ archivedAt: "2026-08-06T20:00:00Z" });
    const archived = render(<DirectConversationPanel conversationId="c1" />);
    await userEvent.click(screen.getByTitle("取消归档"));
    expect(actionSet.setArchived.mutateAsync).toHaveBeenCalledWith(false);
    archived.unmount();

    for (const [overrides, text] of [
      [{ canSend: false, otherUser: { ...baseConversation.otherUser, isDeactivated: true } }, "该用户已注销"],
      [{ status: "PENDING", requestDirection: "OUTGOING", canSend: false }, "对方接受消息请求后"],
      [{ status: "DECLINED", canSend: false }, "该消息请求已被拒绝"],
      [{ status: "CANCELED", canSend: false }, "该消息请求已取消"],
    ] as const) {
      setConversation(overrides);
      const view = render(<DirectConversationPanel conversationId="c1" />);
      expect(screen.getByText(new RegExp(text))).toBeInTheDocument();
      view.unmount();
    }
  });

  test("加载、详情错误、历史错误与空历史状态可见", async () => {
    mocks.conversationQuery.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    const loading = render(<DirectConversationPanel conversationId="c1" />);
    expect(screen.queryByText("用户二")).not.toBeInTheDocument();
    loading.unmount();

    const refetch = vi.fn();
    mocks.conversationQuery.mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch });
    const error = render(<DirectConversationPanel conversationId="c1" />);
    await userEvent.click(screen.getByRole("button", { name: "重试" }));
    expect(refetch).toHaveBeenCalled();
    error.unmount();

    setConversation();
    mocks.history.mockReturnValue({
      messages: [], isLoading: false, isError: true, hasNextPage: false,
    });
    const historyError = render(<DirectConversationPanel conversationId="c1" />);
    expect(screen.getByText("消息加载失败")).toBeInTheDocument();
    historyError.unmount();

    mocks.history.mockReturnValue({
      messages: [], isLoading: false, isError: false, hasNextPage: false,
    });
    render(<DirectConversationPanel conversationId="c1" />);
    expect(screen.getByText("暂无可显示的消息")).toBeInTheDocument();
  });

  test("取消确认或 mutation 失败不会误报成功", async () => {
    mocks.confirm.mockResolvedValueOnce(false);
    const first = render(<DirectConversationPanel conversationId="c1" />);
    await userEvent.click(screen.getByRole("button", { name: "拉黑" }));
    expect(blockSet.block.mutateAsync).not.toHaveBeenCalled();
    first.unmount();

    actionSet.setArchived.mutateAsync.mockRejectedValueOnce({ message: "archive failed" });
    render(<DirectConversationPanel conversationId="c1" />);
    await userEvent.click(screen.getByTitle("归档"));
    expect(mocks.toastError).toHaveBeenCalledWith("archive failed");
  });

  test("已读失败后允许重试，不会把本地失败误当成已读", async () => {
    const history = mocks.history();
    mocks.history.mockReturnValue(history);
    const view = render(<DirectConversationPanel conversationId="c1" />);

    await waitFor(() => expect(actionSet.markRead.mutate).toHaveBeenCalledTimes(1));
    const options = actionSet.markRead.mutate.mock.calls[0][1] as { onError: () => void };
    options.onError();
    mocks.history.mockReturnValue({ ...history, messages: [...history.messages] });
    view.rerender(<DirectConversationPanel conversationId="c1" />);

    await waitFor(() => expect(actionSet.markRead.mutate).toHaveBeenCalledTimes(2));
  });

  test("接受、拉黑和撤回失败时展示后端错误且不提示成功", async () => {
    setConversation({
      status: "PENDING",
      requestDirection: "INCOMING",
      canSend: false,
      canAccept: true,
      canDecline: true,
    });
    actionSet.handleRequest.mutateAsync.mockRejectedValueOnce({ message: "accept failed" });
    const pending = render(<DirectConversationPanel conversationId="c1" />);
    await userEvent.click(screen.getByRole("button", { name: "接受" }));
    expect(mocks.toastError).toHaveBeenCalledWith("accept failed");
    expect(mocks.toastSuccess).not.toHaveBeenCalledWith("已接受消息请求");
    pending.unmount();

    setConversation();
    blockSet.block.mutateAsync.mockRejectedValueOnce({ message: "block failed" });
    const accepted = render(<DirectConversationPanel conversationId="c1" />);
    await userEvent.click(screen.getByRole("button", { name: "拉黑" }));
    expect(mocks.toastError).toHaveBeenCalledWith("block failed");

    actionSet.recall.mutateAsync.mockRejectedValueOnce({ message: "recall failed" });
    await userEvent.click(await screen.findByRole("button", { name: "撤回 m2" }));
    expect(mocks.toastError).toHaveBeenCalledWith("recall failed");
    expect(mocks.toastSuccess).not.toHaveBeenCalledWith("消息已撤回");
    accepted.unmount();
  });
});
