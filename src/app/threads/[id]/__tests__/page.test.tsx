import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  targetQuery: vi.fn(),
  parentQuery: vi.fn(),
  useFloors: vi.fn(),
  setCoordinate: vi.fn(),
  routerPush: vi.fn(),
  routerReplace: vi.fn(),
  routerBack: vi.fn(),
  closeComposer: vi.fn().mockResolvedValue(true),
  clearPost: vi.fn(),
  clearThread: vi.fn(),
  scrollIntoView: vi.fn(),
}));

let initialPostId: string | null = "floor-42";

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "thread-1" }),
  useRouter: () => ({
    push: mocks.routerPush,
    replace: mocks.routerReplace,
    back: mocks.routerBack,
  }),
}));

vi.mock("nuqs", () => {
  const parser = {
    withDefault: () => parser,
    withOptions: () => parser,
  };
  return {
  parseAsString: parser,
  parseAsStringLiteral: () => parser,
  useQueryStates: () => {
    const [coordinate, setCoordinate] = React.useState({
      post: initialPostId,
      subthread: null as string | null,
    });
    return [
      coordinate,
      async (next: { post?: string | null; subthread?: string | null }) => {
        mocks.setCoordinate(next);
        setCoordinate((current) => ({ ...current, ...next }));
      },
    ];
  },
  useQueryState: () => ["OLDEST", vi.fn()],
  };
});

vi.mock("@/api/hooks/use-thread-detail", () => ({
  useThreadDetail: () => ({
    data: {
      id: "thread-1",
      title: "主题标题",
      ownerId: "owner-1",
      defaultSubthreadId: "sub-1",
      published: true,
      _count: { posts: 2 },
      subthreads: [
        { id: "sub-1", title: "默认子贴", _count: { posts: 1 } },
        { id: "sub-2", title: "剧情子贴", _count: { posts: 1 } },
      ],
    },
    isLoading: false,
    isFetching: false,
    isFetchedAfterMount: true,
    error: null,
    refetch: vi.fn(),
  }),
}));

vi.mock("@/api/hooks/use-post", () => ({
  usePost: (id?: string) => {
    if (id === "floor-parent") return mocks.parentQuery();
    if (id) return mocks.targetQuery();
    return readyQuery(undefined);
  },
}));

vi.mock("@/api/hooks/use-floors", () => ({
  useFloors: (subthreadId?: string) => mocks.useFloors(subthreadId),
  usePrefetchFloors: () => vi.fn(),
}));

vi.mock("@/api/hooks/use-discussion-authors", () => ({
  useFloorAuthors: () => ({
    data: [],
    isLoading: false,
    isError: false,
    isSuccess: true,
    refetch: vi.fn(),
  }),
}));

vi.mock("@/api/hooks/use-content-access-cache", () => ({
  useContentAccessCache: () => ({
    clearPost: mocks.clearPost,
    clearThread: mocks.clearThread,
  }),
}));

vi.mock("@/api/hooks/use-latest-thread-post", () => ({
  useLatestThreadPost: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ user: null, isInitialized: true }),
}));

vi.mock("@/components/thread/thread-composer-context", () => ({
  ThreadComposerProvider: ({ children }: { children: React.ReactNode }) => children,
  useThreadComposer: () => ({ close: mocks.closeComposer }),
}));

vi.mock("@/components/thread/thread-permissions-context", () => ({
  ThreadPermissionsProvider: ({ children }: { children: React.ReactNode }) => children,
  useThreadPermissions: () => ({ isThreadManager: false }),
}));

vi.mock("@/components/thread/discussion-target-mask", () => ({
  DiscussionTargetRouteFallback: () => <div>正在定位目标楼层…</div>,
}));

vi.mock("@/components/thread/thread-reading-bar", () => ({
  ThreadReadingBar: () => null,
}));
vi.mock("@/components/thread/thread-detail-header", () => ({
  ThreadDetailHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/thread/subthread-body", () => ({
  SubthreadBody: ({ subthread }: { subthread: { title: string } }) => <div>{subthread.title}</div>,
}));
vi.mock("@/components/thread/floor-list-controls", () => ({
  FloorListControls: () => <div>楼层控制行</div>,
}));
vi.mock("@/components/thread/floor-list", () => ({
  FloorList: ({ floors, isLoading, targetFloorId }: {
    floors: Array<{ content: string }>;
    isLoading: boolean;
    targetFloorId?: string;
  }) => (
    <div data-testid="floor-list" data-loading={isLoading} data-target={targetFloorId}>
      {floors.map((floor) => floor.content).join("|")}
    </div>
  ),
}));
vi.mock("@/components/thread/thread-post-search", () => ({ ThreadPostSearch: () => null }));
vi.mock("@/components/thread/floor-form", () => ({
  FloorForm: () => null,
  getFloorComposerAnchorId: () => "floor-composer",
}));
vi.mock("@/components/thread/floating-composer-dock", () => ({
  FloatingComposerDock: ({ children }: { children: React.ReactNode }) => children,
}));

import ThreadDetailPage from "@/app/threads/[id]/page";

const targetFloor = {
  id: "floor-42",
  threadId: "thread-1",
  subthreadId: "sub-2",
  authorId: "author-1",
  kind: "FLOOR",
  floorNumber: 42,
  parentPostId: null,
  content: "不应穿透的缓存目标正文",
  author: { id: "author-1", username: "作者" },
  thread: { id: "thread-1", title: "主题标题" },
  subthread: { id: "sub-2", title: "剧情子贴" },
  _count: { replies: 0 },
};

function readyQuery(data: unknown, error: unknown = null) {
  return {
    data,
    error,
    isLoading: false,
    isFetching: false,
    isFetchedAfterMount: true,
    refetch: vi.fn(),
  };
}

function floorsResult(subthreadId?: string) {
  return {
    data: subthreadId
      ? { pages: [{ data: [{ id: "cached-floor", content: "缓存中的列表首屏" }] }] }
      : undefined,
    fetchNextPage: vi.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  };
}

describe("主题详情精确楼层阅读态", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    initialPostId = "floor-42";
    mocks.targetQuery.mockReturnValue(readyQuery(targetFloor));
    mocks.parentQuery.mockReturnValue(readyQuery(undefined));
    mocks.useFloors.mockImplementation(floorsResult);
    vi.spyOn(HTMLElement.prototype, "scrollIntoView").mockImplementation(
      mocks.scrollIntoView,
    );
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  test("慢请求复核完成前不展示缓存正文且不预取所属子贴", () => {
    mocks.targetQuery.mockReturnValue({
      ...readyQuery(targetFloor),
      isFetching: true,
      isFetchedAfterMount: false,
    });

    render(<ThreadDetailPage />);

    expect(screen.getByText("正在定位目标楼层…")).toBeInTheDocument();
    expect(screen.queryByText("不应穿透的缓存目标正文")).toBeNull();
    expect(mocks.useFloors).toHaveBeenCalledWith(undefined);
  });

  test("目标不在首屏时直接进入完整所属子贴并把目标交给分页定位层", () => {
    render(<ThreadDetailPage />);

    expect(screen.queryByText("不应穿透的缓存目标正文")).toBeNull();
    expect(screen.getByTestId("floor-list")).toHaveTextContent("缓存中的列表首屏");
    expect(screen.getByTestId("floor-list")).toHaveAttribute("data-target", "floor-42");
    expect(screen.queryByRole("button", { name: "查看完整讨论" })).toBeNull();
    expect(mocks.useFloors).toHaveBeenCalledWith("sub-2");
  });

  test("目标删除后丢弃缓存正文并显示统一不可访问态", async () => {
    mocks.targetQuery.mockReturnValue(
      readyQuery(targetFloor, { code: 40403, message: "帖子不存在" }),
    );

    render(<ThreadDetailPage />);

    expect(screen.getByText("内容不存在或已被删除")).toBeInTheDocument();
    expect(screen.queryByText("不应穿透的缓存目标正文")).toBeNull();
    await waitFor(() => {
      expect(mocks.clearPost).toHaveBeenCalledWith("floor-42", {
        preserveActive: true,
      });
    });
  });

  test("旧楼中楼链接只在目标与父楼归属复核后跳到独立讨论页", async () => {
    mocks.targetQuery.mockReturnValue(readyQuery({
      ...targetFloor,
      id: "reply-8",
      parentPostId: "floor-parent",
      floorNumber: null,
      content: "旧楼中楼链接目标",
    }));
    mocks.parentQuery.mockReturnValue(readyQuery({
      ...targetFloor,
      id: "floor-parent",
      floorNumber: 7,
    }));

    render(<ThreadDetailPage />);

    expect(screen.getByText("正在定位目标楼层…")).toBeInTheDocument();
    expect(screen.queryByText("旧楼中楼链接目标")).toBeNull();
    await waitFor(() => {
      expect(mocks.routerReplace).toHaveBeenCalledWith(
        "/threads/thread-1/posts/floor-parent/replies?post=reply-8",
      );
    });
  });
});
