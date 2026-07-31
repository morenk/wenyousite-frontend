/** ThreadDetailHeader 组件测试 */

import { describe, test, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThreadDetailHeader } from "@/components/thread/thread-detail-header";
import type { ThreadDetail } from "@/api/hooks/use-thread-detail";
import React from "react";

const mockUseAuth = vi.fn();
vi.mock("@/lib/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

const { mockPOST, mockDELETE } = vi.hoisted(() => ({
  mockPOST: vi.fn(),
  mockDELETE: vi.fn(),
}));

vi.mock("@/api/client", () => ({
  apiClient: { POST: mockPOST, DELETE: mockDELETE },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

afterEach(() => cleanup());

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
    bodyPostId: null,
    deletedAt: null,
    createdAt: "2026-01-01T00:00:00Z",
    bodyPost: null,
    _count: { posts: 5 },
    tags: [],
  },
  topicTags: [{ tag: { id: "tag-1", name: "测试标签", color: null } }],
  _count: { members: 10, posts: 5 },
};

describe("ThreadDetailHeader", () => {
  test("渲染标题", () => {
    mockUseAuth.mockReturnValue({ user: null, isInitialized: true });
    mockPOST.mockResolvedValue({ error: undefined });

    renderWithQC(
      <ThreadDetailHeader thread={baseThread} isMember={false} />,
    );
    expect(screen.getByText("测试主题帖")).toBeInTheDocument();
  });

  test("渲染分类和状态中文映射", () => {
    mockUseAuth.mockReturnValue({ user: null, isInitialized: true });
    renderWithQC(
      <ThreadDetailHeader thread={baseThread} isMember={false} />,
    );
    expect(screen.getByText("RPG")).toBeInTheDocument();
    expect(screen.getByText("招募中")).toBeInTheDocument();
  });

  test("渲染标签", () => {
    mockUseAuth.mockReturnValue({ user: null, isInitialized: true });
    renderWithQC(
      <ThreadDetailHeader thread={baseThread} isMember={false} />,
    );
    expect(screen.getByText("#测试标签")).toBeInTheDocument();
  });

  test("渲染作者名", () => {
    mockUseAuth.mockReturnValue({ user: null, isInitialized: true });
    renderWithQC(
      <ThreadDetailHeader thread={baseThread} isMember={false} />,
    );
    expect(screen.getByText("帖主")).toBeInTheDocument();
  });

  test("渲染统计信息", () => {
    mockUseAuth.mockReturnValue({ user: null, isInitialized: true });
    renderWithQC(
      <ThreadDetailHeader thread={baseThread} isMember={false} />,
    );
    expect(screen.getByText("100 次浏览")).toBeInTheDocument();
    expect(screen.getByText("10 人参与")).toBeInTheDocument();
    expect(screen.getByText("5 楼")).toBeInTheDocument();
  });

  test("未登录时显示点赞按钮（不可交互）", () => {
    mockUseAuth.mockReturnValue({ user: null, isInitialized: true });
    renderWithQC(
      <ThreadDetailHeader thread={baseThread} isMember={false} />,
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
      <ThreadDetailHeader thread={baseThread} isMember={true} />,
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
      <ThreadDetailHeader thread={baseThread} isMember={true} />,
    );
    expect(screen.getByText("管理")).toBeInTheDocument();
  });

  test("非 OWNER 看不到管理按钮", () => {
    mockUseAuth.mockReturnValue({
      user: { id: "other-user", username: "别人" },
      isInitialized: true,
    });
    mockPOST.mockResolvedValue({ error: undefined });
    renderWithQC(
      <ThreadDetailHeader thread={baseThread} isMember={false} />,
    );
    expect(screen.queryByText("管理")).toBeNull();
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
        isMember={true}
        onManage={onManage}
      />,
    );

    await user.click(screen.getByText("管理"));
    expect(onManage).toHaveBeenCalledTimes(1);
  });

  test("非 OWNER 看到加入按钮", () => {
    mockUseAuth.mockReturnValue({
      user: { id: "other-user", username: "别人" },
      isInitialized: true,
    });
    mockPOST.mockResolvedValue({ error: undefined });
    renderWithQC(
      <ThreadDetailHeader thread={baseThread} isMember={false} />,
    );
    expect(screen.getByText("加入")).toBeInTheDocument();
  });

  test("非 OWNER 已加入时看到退出按钮", () => {
    mockUseAuth.mockReturnValue({
      user: { id: "other-user", username: "别人" },
      isInitialized: true,
    });
    renderWithQC(
      <ThreadDetailHeader thread={baseThread} isMember={true} />,
    );
    expect(screen.getByText("退出")).toBeInTheDocument();
  });

  test("已完结状态显示'已完结'", () => {
    mockUseAuth.mockReturnValue({ user: null, isInitialized: true });
    const finished = { ...baseThread, status: "FINISHED" as const };
    renderWithQC(<ThreadDetailHeader thread={finished} isMember={false} />);
    expect(screen.getByText("已完结")).toBeInTheDocument();
  });

  test("私密帖显示'私密'标签", () => {
    mockUseAuth.mockReturnValue({ user: null, isInitialized: true });
    const privateThread = { ...baseThread, visibility: "PRIVATE" as const };
    renderWithQC(
      <ThreadDetailHeader thread={privateThread} isMember={false} />,
    );
    expect(screen.getByText("私密")).toBeInTheDocument();
  });

  test("置顶帖显示'置顶'标签", () => {
    mockUseAuth.mockReturnValue({ user: null, isInitialized: true });
    const pinned = { ...baseThread, pinned: true };
    renderWithQC(<ThreadDetailHeader thread={pinned} isMember={false} />);
    expect(screen.getByText("置顶")).toBeInTheDocument();
  });

  test("演绎分类显示'演绎'", () => {
    mockUseAuth.mockReturnValue({ user: null, isInitialized: true });
    const deduction = { ...baseThread, category: "DEDUCTION" as const };
    renderWithQC(<ThreadDetailHeader thread={deduction} isMember={false} />);
    expect(screen.getByText("演绎")).toBeInTheDocument();
  });

  test("likeCount 为 0 时显示'点赞'文字", () => {
    mockUseAuth.mockReturnValue({
      user: { id: "owner-1", username: "帖主" },
      isInitialized: true,
    });
    const noLikes = { ...baseThread, likeCount: 0 };
    renderWithQC(<ThreadDetailHeader thread={noLikes} isMember={true} />);
    expect(screen.getByText("点赞")).toBeInTheDocument();
  });
});
