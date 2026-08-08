/** ThreadCard 组件测试 */

import { describe, test, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThreadCard } from "@/components/thread/thread-card";
import type { ThreadCardData } from "@/api/hooks/use-threads";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
  }) => {
    return (
      <a href={href} {...props}>
        {children}
      </a>
    );
  },
}));

afterEach(() => cleanup());

function renderThreadCard(
  thread: ThreadCardData,
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  }),
) {
  return {
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <ThreadCard thread={thread} />
      </QueryClientProvider>,
    ),
  };
}

const baseThread: ThreadCardData = {
  id: "thread-1",
  title: "测试帖子标题",
  category: "RPG",
  status: "RECRUITING",
  visibility: "PUBLIC",
  published: true,
  pinned: false,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  deletedAt: null,
  tipTotal: "0",
  owner: { id: "u1", username: "测试作者", avatar: null, level: 1 },
  defaultSubthread: { id: "s1", title: "主帖", lastPostAt: null },
  topicTags: [
    {
      id: "relation-1",
      threadId: "thread-1",
      tagId: "tag-1",
      tag: { id: "tag-1", name: "测试标签", color: null, description: null, sortOrder: 10, isActive: true },
    },
    {
      id: "relation-2",
      threadId: "thread-1",
      tagId: "tag-2",
      tag: { id: "tag-2", name: "RPG", color: null, description: null, sortOrder: 20, isActive: true },
    },
  ],
  _count: { members: 5, players: 2, posts: 12 },
  preview: "这是帖子摘要预览...",
};

describe("ThreadCard", () => {
  test("渲染标题", () => {
    renderThreadCard(baseThread);
    expect(screen.getByText("测试帖子标题")).toBeInTheDocument();
  });

  test("渲染分类（中文映射）", () => {
    renderThreadCard(baseThread);
    expect(screen.getByText("RPG")).toBeInTheDocument();
  });

  test("渲染状态（中文映射）", () => {
    renderThreadCard(baseThread);
    expect(screen.getByText("招募中")).toBeInTheDocument();
  });

  test("渲染作者名", () => {
    renderThreadCard(baseThread);
    expect(screen.getByText("测试作者")).toBeInTheDocument();
  });

  test("作者无头像时显示首字符占位", () => {
    renderThreadCard(baseThread);
    expect(screen.getByTestId("user-avatar-placeholder").textContent).toBe(
      "测",
    );
  });

  test("作者有头像时渲染缩略图", () => {
    const withAvatar = {
      ...baseThread,
      owner: {
        id: "u1",
        username: "测试作者",
        avatar: "https://example.com/u.png",
        level: 1,
      },
    };
    renderThreadCard(withAvatar);
    expect(screen.getByRole("img")).toHaveAttribute(
      "src",
      "https://example.com/u_thumb.webp",
    );
  });

  test("渲染标签", () => {
    renderThreadCard(baseThread);
    expect(screen.getByText("#测试标签")).toBeInTheDocument();
    expect(screen.getByText("#RPG")).toBeInTheDocument();
    expect(screen.getByText("#测试标签").closest("a")).toHaveAttribute(
      "href",
      "/tags/tag-1",
    );
  });

  test("渲染玩家数和楼层数", () => {
    renderThreadCard(baseThread);
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
  });

  test("以大整数精度展示累计获得温油", () => {
    renderThreadCard({ ...baseThread, tipTotal: "9007199254740993" });
    expect(screen.getByText("9,007,199,254,740,993 升")).toBeInTheDocument();
  });

  test("渲染预览摘要", () => {
    renderThreadCard(baseThread);
    expect(screen.getByText("这是帖子摘要预览...")).toBeInTheDocument();
  });

  test("预览摘要隐藏骰子协议和链接地址", () => {
    const protocolPreview = {
      ...baseThread,
      preview:
        "概率 [[dice:v1:0f16151d-6e9e-415d-b9ae-c91829a52888:2d50]] [规则](https://example.com)",
    };
    renderThreadCard(protocolPreview);

    expect(screen.getByText("概率 [2d50] [规则]")).toBeInTheDocument();
  });

  test("已停招状态显示'已停招'", () => {
    const closed = { ...baseThread, status: "CLOSED" as const };
    renderThreadCard(closed);
    expect(screen.getByText("已停招")).toBeInTheDocument();
  });

  test("已结束状态显示'已结束'", () => {
    const finished = { ...baseThread, status: "FINISHED" as const };
    renderThreadCard(finished);
    expect(screen.getByText("已结束")).toBeInTheDocument();
  });

  test("国策分类显示'国策'", () => {
    const nation = { ...baseThread, category: "NATION" as const };
    renderThreadCard(nation);
    expect(screen.getByText("国策")).toBeInTheDocument();
  });

  test("置顶帖显示'置顶'", () => {
    const pinned = { ...baseThread, pinned: true };
    renderThreadCard(pinned);
    expect(screen.getByText("置顶")).toBeInTheDocument();
  });

  test("无预览时不在文档中", () => {
    const noPreview = { ...baseThread, preview: "" };
    renderThreadCard(noPreview);
    expect(screen.queryByText("这是帖子摘要预览...")).toBeNull();
  });

  test("无标签时不渲染标签区", () => {
    const noTags = { ...baseThread, topicTags: [] };
    renderThreadCard(noTags);
    expect(screen.queryByText("#测试标签")).toBeNull();
  });

  test("链接指向正确地址", () => {
    renderThreadCard(baseThread);
    const link = screen.getByText("测试帖子标题").closest("a");
    expect(link).toHaveAttribute("href", "/threads/thread-1");
  });

  test("悬停时仅预取无副作用的首屏楼层", () => {
    const queryClient = new QueryClient();
    const detailPrefetch = vi
      .spyOn(queryClient, "prefetchQuery")
      .mockResolvedValue(undefined);
    const floorPrefetch = vi
      .spyOn(queryClient, "prefetchInfiniteQuery")
      .mockResolvedValue(undefined);

    renderThreadCard(baseThread, queryClient);
    fireEvent.mouseEnter(
      screen.getByRole("link", { name: "查看主题帖：测试帖子标题" }),
    );

    expect(detailPrefetch).not.toHaveBeenCalled();
    expect(floorPrefetch).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ["floors", "s1"] }),
    );
  });

  test("按下主题链接时也只预取无副作用的首屏楼层", () => {
    const queryClient = new QueryClient();
    const detailPrefetch = vi
      .spyOn(queryClient, "prefetchQuery")
      .mockResolvedValue(undefined);
    const floorPrefetch = vi
      .spyOn(queryClient, "prefetchInfiniteQuery")
      .mockResolvedValue(undefined);

    renderThreadCard(baseThread, queryClient);
    fireEvent.pointerDown(
      screen.getByRole("link", { name: "查看主题帖：测试帖子标题" }),
    );

    expect(detailPrefetch).not.toHaveBeenCalled();
    expect(floorPrefetch).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ["floors", "s1"] }),
    );
  });
});
