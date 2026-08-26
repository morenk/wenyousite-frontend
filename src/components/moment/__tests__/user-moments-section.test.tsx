import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const {
  mockUseAuth,
  mockUseUserMoments,
  mockMasonry,
  mockFetchNextPage,
  mockRefetch,
} = vi.hoisted(() => ({
  mockUseAuth: vi.fn(),
  mockUseUserMoments: vi.fn(),
  mockMasonry: vi.fn(),
  mockFetchNextPage: vi.fn(),
  mockRefetch: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ useAuth: () => mockUseAuth() }));
vi.mock("@/api/hooks/use-moments", () => ({
  useUserMoments: (...args: unknown[]) => mockUseUserMoments(...args),
}));
vi.mock("@/components/moment/moment-masonry", () => ({
  MomentMasonry: (props: Record<string, unknown>) => {
    mockMasonry(props);
    return <div>用户动态瀑布流</div>;
  },
}));

import { UserMomentsSection } from "@/components/moment/user-moments-section";

describe("UserMomentsSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: { id: "viewer-1" } });
    mockUseUserMoments.mockReturnValue({
      data: {
        pages: [
          { data: [{ id: "moment-1" }], meta: { cursor: "next", hasMore: true } },
          { data: [{ id: "moment-2" }], meta: { cursor: null, hasMore: false } },
        ],
      },
      isLoading: false,
      error: null,
      hasNextPage: true,
      isFetchingNextPage: false,
      fetchNextPage: mockFetchNextPage,
      refetch: mockRefetch,
    });
  });

  afterEach(cleanup);

  test("按查看者隔离用户动态缓存并透传分页操作", () => {
    render(<UserMomentsSection userId="author-1" />);

    expect(mockUseUserMoments).toHaveBeenCalledWith("author-1", "viewer-1");
    const props = mockMasonry.mock.calls.at(-1)?.[0] as {
      moments: { id: string }[];
      onLoadMore: () => void;
      onRetry: () => void;
    };
    expect(props.moments.map((moment) => moment.id)).toEqual(["moment-1", "moment-2"]);
    expect(props).toMatchObject({
      maxLanes: 3,
      hasNextPage: true,
      emptyTitle: "还没有发布动态",
    });
    props.onLoadMore();
    props.onRetry();
    expect(mockFetchNextPage).toHaveBeenCalledOnce();
    expect(mockRefetch).toHaveBeenCalledOnce();
    expect(screen.getByText("用户动态瀑布流")).toBeInTheDocument();
  });

  test("匿名访问使用匿名查看者作用域", () => {
    mockUseAuth.mockReturnValue({ user: null });
    render(<UserMomentsSection userId="author-1" />);
    expect(mockUseUserMoments).toHaveBeenCalledWith("author-1", undefined);
  });
});
