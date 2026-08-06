/** ThreadList 组件测试：loading/error/empty/data 四态 + 回调 */

import { describe, test, expect, vi, afterEach } from "vitest";
import {
  render as testingLibraryRender,
  screen,
  fireEvent,
  cleanup,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";
import { ThreadList } from "@/components/thread/thread-list";
import type { ThreadCardData } from "@/api/hooks/use-threads";

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

afterEach(() => cleanup());

function render(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return testingLibraryRender(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

const sampleThread: ThreadCardData = {
  id: "t1",
  title: "测试帖",
  category: "RPG",
  status: "RECRUITING",
  visibility: "PUBLIC",
  published: true,
  pinned: false,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  deletedAt: null,
  owner: { id: "u1", username: "author", avatar: null },
  defaultSubthread: { id: "s1", title: "主帖" },
  topicTags: [],
  _count: { members: 1, players: 1, posts: 1 },
  preview: "预览内容",
};

describe("ThreadList", () => {
  test("loading 状态显示 spinner", () => {
    render(
      <ThreadList
        threads={[]}
        hasNextPage={false}
        isFetchingNextPage={false}
        isLoading={true}
        error={null}
        onLoadMore={() => {}}
        onRetry={() => {}}
      />,
    );
    expect(
      document.querySelector(".lucide-loader-circle"),
    ).toBeInTheDocument();
  });

  test("空列表显示 EmptyState", () => {
    render(
      <ThreadList
        threads={[]}
        hasNextPage={false}
        isFetchingNextPage={false}
        isLoading={false}
        error={null}
        onLoadMore={() => {}}
        onRetry={() => {}}
      />,
    );
    expect(screen.getByText("还没有主题帖")).toBeInTheDocument();
  });

  test("错误状态显示重试按钮", () => {
    const onRetry = vi.fn();
    render(
      <ThreadList
        threads={[]}
        hasNextPage={false}
        isFetchingNextPage={false}
        isLoading={false}
        error={new Error("网络错误")}
        onLoadMore={() => {}}
        onRetry={onRetry}
      />,
    );
    expect(screen.getByText("加载失败")).toBeInTheDocument();
    expect(screen.getByText("重试")).toBeInTheDocument();
  });

  test("数据列表渲染 ThreadCard", () => {
    render(
      <ThreadList
        threads={[sampleThread]}
        hasNextPage={false}
        isFetchingNextPage={false}
        isLoading={false}
        error={null}
        onLoadMore={() => {}}
        onRetry={() => {}}
      />,
    );
    expect(screen.getByText("测试帖")).toBeInTheDocument();
    expect(screen.getByText("author")).toBeInTheDocument();
  });

  test("无更多数据时显示'没有更多了'", () => {
    render(
      <ThreadList
        threads={[sampleThread]}
        hasNextPage={false}
        isFetchingNextPage={false}
        isLoading={false}
        error={null}
        onLoadMore={() => {}}
        onRetry={() => {}}
      />,
    );
    expect(screen.getByText("没有更多了")).toBeInTheDocument();
  });

  test("加载更多时显示 spinner", () => {
    render(
      <ThreadList
        threads={[sampleThread]}
        hasNextPage={true}
        isFetchingNextPage={true}
        isLoading={false}
        error={null}
        onLoadMore={() => {}}
        onRetry={() => {}}
      />,
    );
    const spinners = document.querySelectorAll(".lucide-loader-circle");
    expect(spinners.length).toBeGreaterThanOrEqual(1);
  });

  test("点击重试按钮调用 onRetry", () => {
    const onRetry = vi.fn();
    render(
      <ThreadList
        threads={[]}
        hasNextPage={false}
        isFetchingNextPage={false}
        isLoading={false}
        error={new Error("err")}
        onLoadMore={() => {}}
        onRetry={onRetry}
      />,
    );
    fireEvent.click(screen.getByText("重试"));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  test("多条数据正确渲染", () => {
    const threads = [
      { ...sampleThread, id: "t1", title: "帖1" },
      { ...sampleThread, id: "t2", title: "帖2" },
      { ...sampleThread, id: "t3", title: "帖3" },
    ];
    render(
      <ThreadList
        threads={threads}
        hasNextPage={false}
        isFetchingNextPage={false}
        isLoading={false}
        error={null}
        onLoadMore={() => {}}
        onRetry={() => {}}
      />,
    );
    expect(screen.getByText("帖1")).toBeInTheDocument();
    expect(screen.getByText("帖2")).toBeInTheDocument();
    expect(screen.getByText("帖3")).toBeInTheDocument();
  });

  test("重复 id 兜底去重：同一帖只渲染一次", () => {
    const threads = [
      { ...sampleThread, id: "t1", title: "重复帖" },
      { ...sampleThread, id: "t1", title: "重复帖" },
      { ...sampleThread, id: "t2", title: "正常帖" },
    ];
    const { container } = render(
      <ThreadList
        threads={threads}
        hasNextPage={false}
        isFetchingNextPage={false}
        isLoading={false}
        error={null}
        onLoadMore={() => {}}
        onRetry={() => {}}
      />,
    );
    // 同一 id 只渲染一次（按标题出现次数断言）
    expect(screen.getAllByText("重复帖").length).toBe(1);
    expect(screen.getAllByText("正常帖").length).toBe(1);
    expect(container.querySelectorAll("a[href*='/threads/t1']").length).toBe(1);
  });
});
