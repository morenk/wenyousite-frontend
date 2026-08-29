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
  categoryInfo: { slug: "RPG", name: "角色扮演", isActive: false },
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
  coverImages: [],
};

describe("ThreadCard", () => {
  test("渲染标题", () => {
    renderThreadCard(baseThread);
    expect(screen.getByText("测试帖子标题")).toBeInTheDocument();
    expect(screen.getByRole("listitem")).toBeInTheDocument();
  });

  test("直接渲染后端分类读模型名称", () => {
    renderThreadCard(baseThread);
    expect(screen.getByText("角色扮演")).toBeInTheDocument();
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

  test("作者有头像时渲染接口返回的母版", () => {
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
      "https://example.com/u.png",
    );
  });

  test("渲染标签", () => {
    renderThreadCard(baseThread);
    expect(screen.getByText("#测试标签")).toBeInTheDocument();
    expect(screen.getByText("#RPG")).toBeInTheDocument();
    const tag = screen.getByText("#测试标签").closest("a");
    expect(tag).toHaveAttribute("href", "/tags/tag-1");
    expect(tag).toHaveClass(
      "bg-[var(--element-topic-tag-surface)]",
      "border-[var(--element-topic-tag-border)]",
      "text-[var(--element-topic-tag-foreground)]",
      "font-[number:var(--element-topic-tag-font-weight)]",
      "hover:bg-[var(--element-topic-tag-hover-surface)]",
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

  test("只取主贴第一张图作为标题下封面，并清理摘要中的图片占位", () => {
    const { container } = renderThreadCard({
      ...baseThread,
      coverImages: [
        "https://cdn.example.com/uploads/one.jpg",
        "https://cdn.example.com/uploads/two.jpg",
      ],
      preview: "正文 [图片] 后续",
    });
    const title = screen.getByText("测试帖子标题").closest("h3");
    const cover = container.querySelector("[data-thread-cover='true']");

    expect(cover).toBeInTheDocument();
    expect(title?.nextElementSibling).toBe(cover);
    expect(cover?.querySelectorAll("img")).toHaveLength(1);
    expect(cover?.querySelector("img")).toHaveAttribute(
      "src",
      "https://cdn.example.com/uploads/one_feed.webp",
    );
    expect(cover?.querySelector("img")).not.toHaveAttribute(
      "src",
      expect.stringContaining("two"),
    );
    expect(screen.getByText("正文 后续")).toBeInTheDocument();
    expect(screen.queryByText(/\[图片\]/u)).not.toBeInTheDocument();
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
    const nation = {
      ...baseThread,
      category: "NATION" as const,
      categoryInfo: { slug: "NATION", name: "国策", isActive: true },
    };
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
      expect.objectContaining({ queryKey: ["floors", "s1", { order: "OLDEST" }] }),
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
      expect.objectContaining({ queryKey: ["floors", "s1", { order: "OLDEST" }] }),
    );
  });
});
