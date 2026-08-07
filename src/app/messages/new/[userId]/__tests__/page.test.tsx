import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const {
  mockReplace,
  mockUseAuth,
  mockUseUserProfile,
  mockUseLookup,
  mockUseStart,
  mockMutateAsync,
  mockEntryCopy,
  mockToastSuccess,
} = vi.hoisted(() => ({
  mockReplace: vi.fn(),
  mockUseAuth: vi.fn(),
  mockUseUserProfile: vi.fn(),
  mockUseLookup: vi.fn(),
  mockUseStart: vi.fn(),
  mockMutateAsync: vi.fn(),
  mockEntryCopy: vi.fn(),
  mockToastSuccess: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ userId: "u2" }),
  useRouter: () => ({ replace: mockReplace }),
}));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("@/lib/auth", () => ({ useAuth: () => mockUseAuth() }));
vi.mock("@/api/hooks/use-user-profile", () => ({
  useUserProfile: (...args: unknown[]) => mockUseUserProfile(...args),
}));
vi.mock("@/api/hooks/use-direct-conversations", () => ({
  useDirectConversationLookup: (...args: unknown[]) => mockUseLookup(...args),
}));
vi.mock("@/api/hooks/use-direct-message-actions", () => ({
  useStartDirectConversation: (...args: unknown[]) => mockUseStart(...args),
}));
vi.mock("@/components/message/direct-conversation-entry-copy", () => ({
  getDirectConversationEntryCopy: (...args: unknown[]) => mockEntryCopy(...args),
}));
vi.mock("@/components/message/direct-message-composer", () => ({
  DirectMessageComposer: ({ onSend, submitLabel }: {
    onSend: (value: { content: string; clientRequestId: string }) => Promise<unknown>;
    submitLabel: string;
  }) => (
    <button type="button" onClick={() => void onSend({
      content: "你好",
      clientRequestId: "request-1",
    })}>
      {submitLabel}
    </button>
  ),
}));
vi.mock("@/components/shared/user-avatar", () => ({
  UserAvatar: ({ name }: { name: string }) => <div>{name}</div>,
}));
vi.mock("sonner", () => ({ toast: { success: mockToastSuccess } }));

import NewDirectConversationPage from "@/app/messages/new/[userId]/page";

const profile = {
  id: "u2",
  username: "对方用户",
  avatar: null,
  isDeactivated: false,
  isFollowing: true,
  isFollowedBy: true,
  isBlocked: false,
  isBlockedBy: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockUseAuth.mockReturnValue({ user: { id: "u1" } });
  mockUseUserProfile.mockReturnValue({ data: profile, isLoading: false, isError: false });
  mockUseLookup.mockReturnValue({ data: { conversation: null, contactState: "NONE", canInitiate: true }, isLoading: false, isError: false });
  mockUseStart.mockReturnValue({ mutateAsync: mockMutateAsync });
  mockEntryCopy.mockReturnValue({
    canInitiate: true,
    title: "可以发起私聊",
    description: "先发送一条礼貌消息",
    headerSubtitle: "互相关注",
    composerHint: "请求提示",
    submitLabel: "发送消息",
  });
});

afterEach(() => cleanup());

describe("新建私聊页", () => {
  test("资料或关系查询期间显示加载态", () => {
    mockUseUserProfile.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    const { container } = render(<NewDirectConversationPage />);
    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
  });

  test("资料异常、已注销或给自己私聊时显示不可发起", () => {
    mockUseUserProfile.mockReturnValue({ data: undefined, isLoading: false, isError: true });
    const first = render(<NewDirectConversationPage />);
    expect(screen.getByText("无法向该用户发起私聊")).toBeInTheDocument();
    first.unmount();

    mockUseAuth.mockReturnValue({ user: { id: "u2" } });
    mockUseUserProfile.mockReturnValue({ data: profile, isLoading: false, isError: false });
    render(<NewDirectConversationPage />);
    expect(screen.getByText("无法向该用户发起私聊")).toBeInTheDocument();
  });

  test.each(["ACCEPTED", "PENDING"])("已有 %s 会话时直接跳转", async (contactState) => {
    mockUseLookup.mockReturnValue({
      data: { conversation: { id: "c1" }, contactState, canInitiate: true },
      isLoading: false,
      isError: false,
    });
    render(<NewDirectConversationPage />);

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/messages/c1"));
    expect(screen.queryByRole("button", { name: "发送消息" })).not.toBeInTheDocument();
    cleanup();
    mockReplace.mockClear();
  });

  test("关系策略拒绝时显示原因和返回主页入口", () => {
    mockEntryCopy.mockReturnValue({
      canInitiate: false,
      title: "暂时不能发起私聊",
      description: "需要先互相关注",
    });
    render(<NewDirectConversationPage />);

    expect(screen.getByText("暂时不能发起私聊")).toBeInTheDocument();
    expect(screen.getByText("需要先互相关注")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "返回用户主页" })).toHaveAttribute("href", "/users/u2");
  });

  test("发送首条消息后提示并进入返回的会话", async () => {
    const user = userEvent.setup();
    mockMutateAsync.mockResolvedValue({
      conversation: { id: "c2", status: "PENDING" },
      message: { id: "m1" },
    });
    render(<NewDirectConversationPage />);

    expect(screen.getByText("给 对方用户 发私聊")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "发送消息" }));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        content: "你好",
        clientRequestId: "request-1",
        recipientId: "u2",
      });
      expect(mockToastSuccess).toHaveBeenCalledWith("消息请求已发送");
      expect(mockReplace).toHaveBeenCalledWith("/messages/c2");
    });
  });
});
