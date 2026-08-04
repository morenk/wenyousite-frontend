/** MemberManager 组件测试 */

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemberManager } from "@/components/thread/member-manager";

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => {
    return <a href={href} {...props}>{children}</a>;
  },
}));

const { mockUseMembers } = vi.hoisted(() => ({
  mockUseMembers: vi.fn(),
}));
vi.mock("@/api/hooks/use-members", () => ({
  useMembers: () => mockUseMembers(),
}));

const mockUpdateMutate = vi.fn().mockResolvedValue({});
vi.mock("@/api/hooks/use-update-member", () => ({
  useUpdateMember: () => ({ mutateAsync: mockUpdateMutate, isPending: false }),
}));

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual("@tanstack/react-query");
  return { ...actual, useQueryClient: () => ({ invalidateQueries: vi.fn().mockResolvedValue(undefined) }) };
});

import { toast } from "sonner";
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  }
  Wrapper.displayName = "QueryClientWrapper";
  return Wrapper;
}

const ownerMember = {
  id: "m1",
  threadId: "t1",
  userId: "u1",
  role: "OWNER",
  playerMarked: true,
  joinedAt: "2026-01-01T00:00:00Z",
  user: { id: "u1", username: "站长", avatar: null },
};

const participantMember = {
  id: "m2",
  threadId: "t1",
  userId: "u2",
  role: "PARTICIPANT",
  playerMarked: false,
  joinedAt: "2026-01-01T00:00:00Z",
  user: { id: "u2", username: "玩家甲", avatar: null },
};

describe("MemberManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseMembers.mockReturnValue({
      data: [ownerMember, participantMember],
      isLoading: false,
      error: undefined,
      refetch: vi.fn(),
    });
  });

  afterEach(() => cleanup());

  test("渲染参与人列表与角色徽章", () => {
    render(
      <MemberManager threadId="t1" isOwner={true} isCollaborator={false} onRefetch={vi.fn()} />,
      { wrapper: createWrapper() },
    );
    expect(screen.getByText("楼主")).toBeInTheDocument();
    expect(screen.getByText("参与人")).toBeInTheDocument();
  });

  test("帖主授予/收回玩家标记", async () => {
    const user = userEvent.setup();
    render(
      <MemberManager threadId="t1" isOwner={true} isCollaborator={false} onRefetch={vi.fn()} />,
      { wrapper: createWrapper() },
    );

    await user.click(screen.getByRole("button", { name: "授予玩家" }));

    expect(mockUpdateMutate).toHaveBeenCalledWith({
      threadId: "t1",
      userId: "u2",
      playerMarked: true,
    });
    expect(toast.success).toHaveBeenCalledWith("已授予玩家身份");
  });

  test("帖主升级协作者", async () => {
    const user = userEvent.setup();
    render(
      <MemberManager threadId="t1" isOwner={true} isCollaborator={false} onRefetch={vi.fn()} />,
      { wrapper: createWrapper() },
    );

    await user.click(screen.getByRole("button", { name: "授予协作者" }));

    expect(mockUpdateMutate).toHaveBeenCalledWith({
      threadId: "t1",
      userId: "u2",
      role: "COLLABORATOR",
    });
    expect(toast.success).toHaveBeenCalledWith("已升级为协作者");
  });

  test("不显示移除参与人操作", () => {
    render(
      <MemberManager threadId="t1" isOwner={true} isCollaborator={false} onRefetch={vi.fn()} />,
      { wrapper: createWrapper() },
    );

    expect(screen.queryByTitle("移除参与人")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "移除参与人" })).not.toBeInTheDocument();
  });

  test("非帖主不显示管理按钮", () => {
    render(
      <MemberManager threadId="t1" isOwner={false} isCollaborator={false} onRefetch={vi.fn()} />,
      { wrapper: createWrapper() },
    );
    expect(screen.queryByRole("button", { name: "授予玩家" })).toBeNull();
    expect(screen.queryByRole("button", { name: "协作者" })).toBeNull();
  });

  test("协作者只能修改玩家标记", () => {
    render(
      <MemberManager threadId="t1" isOwner={false} isCollaborator={true} onRefetch={vi.fn()} />,
      { wrapper: createWrapper() },
    );

    expect(screen.getByRole("button", { name: "授予玩家" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "授予协作者" })).not.toBeInTheDocument();
  });
});
