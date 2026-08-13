/** MemberManager 桌面权限表、搜索筛选与权限边界测试。 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { toast } from "sonner";
import { MemberManager } from "@/components/thread/member-manager";

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href} {...props}>{children}</a>,
}));

const mocks = vi.hoisted(() => ({
  useMembers: vi.fn(),
  updateMember: vi.fn(),
}));

vi.mock("@/api/hooks/use-members", () => ({
  useMembers: () => mocks.useMembers(),
}));
vi.mock("@/api/hooks/use-update-member", () => ({
  useUpdateMember: () => ({ mutateAsync: mocks.updateMember, isPending: false }),
}));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const ownerMember = {
  id: "m1",
  threadId: "t1",
  userId: "u1",
  role: "OWNER" as const,
  playerMarked: true,
  joinedAt: "2026-01-01T00:00:00Z",
  user: { id: "u1", username: "站长", avatar: null },
};
const participantMember = {
  id: "m2",
  threadId: "t1",
  userId: "u2",
  role: "PARTICIPANT" as const,
  playerMarked: false,
  joinedAt: "2026-01-03T00:00:00Z",
  user: { id: "u2", username: "玩家甲", avatar: null },
};
const collaboratorMember = {
  id: "m3",
  threadId: "t1",
  userId: "u3",
  role: "COLLABORATOR" as const,
  playerMarked: false,
  joinedAt: "2026-01-02T00:00:00Z",
  user: { id: "u3", username: "协作乙", avatar: null },
};
const playerMember = {
  id: "m4",
  threadId: "t1",
  userId: "u4",
  role: "PARTICIPANT" as const,
  playerMarked: true,
  joinedAt: "2026-01-04T00:00:00Z",
  user: { id: "u4", username: "玩家丙", avatar: null },
};

function renderManager({ isOwner = true, isCollaborator = false } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemberManager
        threadId="t1"
        isOwner={isOwner}
        isCollaborator={isCollaborator}
      />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("confirm", vi.fn(() => true));
  mocks.updateMember.mockResolvedValue({});
  mocks.useMembers.mockReturnValue({
    data: [participantMember, playerMember, collaboratorMember, ownerMember],
    isLoading: false,
    error: undefined,
    refetch: vi.fn(),
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("MemberManager", () => {
  test("按楼主、协作者、玩家和其他参与人排序并展示独立权限列", () => {
    renderManager();

    const rows = screen.getAllByRole("row").slice(1);
    expect(rows.map((row) => within(row).getAllByRole("link")[0]?.textContent))
      .toEqual(expect.arrayContaining([expect.stringContaining("站长")]));
    expect(rows[0]).toHaveAccessibleName(/站长.*楼主 · 固定.*默认拥有/);
    expect(rows[1]).toHaveAccessibleName(/协作乙.*已获协作权限.*标记为玩家/);
    expect(rows[2]).toHaveAccessibleName(/玩家丙.*授予协作权限.*已标记玩家/);
    expect(rows[3]).toHaveAccessibleName(/玩家甲.*授予协作权限.*标记为玩家/);
  });

  test("搜索与角色筛选在本地组合生效并显示数量", async () => {
    const user = userEvent.setup();
    renderManager();

    expect(screen.getByRole("button", { name: "协作者 1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "玩家 1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "其他参与人 1" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "玩家 1" }));
    expect(screen.getByRole("row", { name: /玩家丙/ })).toBeInTheDocument();
    expect(screen.queryByRole("row", { name: /玩家甲/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "全部 4" }));
    await user.type(screen.getByRole("textbox", { name: "搜索成员" }), "协作");
    expect(screen.getByRole("row", { name: /协作乙/ })).toBeInTheDocument();
    expect(screen.queryByRole("row", { name: /玩家丙/ })).not.toBeInTheDocument();
  });

  test("玩家标记低风险切换无需确认并即时提交", async () => {
    const user = userEvent.setup();
    renderManager();

    await user.click(within(screen.getByRole("row", { name: /玩家甲/ }))
      .getByRole("button", { name: "标记为玩家" }));

    expect(window.confirm).not.toHaveBeenCalled();
    expect(mocks.updateMember).toHaveBeenCalledWith({
      threadId: "t1",
      userId: "u2",
      playerMarked: true,
    });
    expect(toast.success).toHaveBeenCalledWith("已标记为玩家");
  });

  test("授予协作权限前说明能力范围并在确认后提交", async () => {
    const user = userEvent.setup();
    renderManager();

    await user.click(within(screen.getByRole("row", { name: /玩家甲/ }))
      .getByRole("button", { name: "授予协作权限" }));

    expect(window.confirm).toHaveBeenCalledWith(
      "对方将可以编辑帖子内容、子贴和玩家标记，但不能修改可见性、任免协作者或删除主题帖。",
    );
    expect(mocks.updateMember).toHaveBeenCalledWith({
      threadId: "t1",
      userId: "u2",
      role: "COLLABORATOR",
    });
    expect(toast.success).toHaveBeenCalledWith("协作权限已授予");
  });

  test("取消协作权限确认时不发请求", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("confirm", vi.fn(() => false));
    renderManager();

    await user.click(within(screen.getByRole("row", { name: /玩家甲/ }))
      .getByRole("button", { name: "授予协作权限" }));
    expect(mocks.updateMember).not.toHaveBeenCalled();
  });

  test("协作者只能管理玩家标记，协作权限保持只读", () => {
    renderManager({ isOwner: false, isCollaborator: true });

    const participantRow = screen.getByRole("row", { name: /玩家甲/ });
    expect(within(participantRow).getByText("普通成员")).toBeInTheDocument();
    expect(within(participantRow).getByRole("button", { name: "标记为玩家" }))
      .toBeInTheDocument();
    expect(within(participantRow).queryByRole("button", { name: "授予协作权限" }))
      .not.toBeInTheDocument();
    expect(screen.getByText("协作者可管理玩家标记")).toBeInTheDocument();
  });

  test("普通成员只能查看权限状态", () => {
    renderManager({ isOwner: false, isCollaborator: false });

    expect(screen.queryByRole("button", { name: "标记为玩家" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "授予协作权限" })).not.toBeInTheDocument();
    expect(screen.getAllByText("普通成员").length).toBeGreaterThan(0);
  });

  test("覆盖加载、错误和空状态", async () => {
    const user = userEvent.setup();
    const refetch = vi.fn();
    mocks.useMembers.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error("network"),
      refetch,
    });
    renderManager();
    expect(screen.getByText("成员列表加载失败")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "重试" }));
    expect(refetch).toHaveBeenCalledTimes(1);

    cleanup();
    mocks.useMembers.mockReturnValue({
      data: [],
      isLoading: false,
      error: undefined,
      refetch,
    });
    renderManager();
    expect(screen.getByText("暂无参与人")).toBeInTheDocument();
  });
});
