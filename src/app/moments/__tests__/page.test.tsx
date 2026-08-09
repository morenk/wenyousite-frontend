import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const {
  mockUseAuth,
  mockUseMoments,
  mockPush,
  mockMasonry,
  mockFetchNextPage,
  mockRefetch,
  mockClearReturn,
  mockTakeRestore,
  mockRememberFeed,
} = vi.hoisted(() => ({
  mockUseAuth: vi.fn(),
  mockUseMoments: vi.fn(),
  mockPush: vi.fn(),
  mockMasonry: vi.fn(),
  mockFetchNextPage: vi.fn(),
  mockRefetch: vi.fn(),
  mockClearReturn: vi.fn(),
  mockTakeRestore: vi.fn(),
  mockRememberFeed: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => "/moments",
}));
vi.mock("@/lib/auth", () => ({ useAuth: () => mockUseAuth() }));
vi.mock("@/lib/moment-navigation", () => ({
  clearMomentFeedReturn: mockClearReturn,
  takeMomentFeedRestore: mockTakeRestore,
  rememberMomentFeed: mockRememberFeed,
}));
vi.mock("@/api/hooks/use-moments", () => ({ useMoments: (...args: unknown[]) => mockUseMoments(...args) }));
vi.mock("@/components/moment/moment-masonry", () => ({
  MomentMasonry: (props: Record<string, unknown>) => {
    mockMasonry(props);
    return <div>瀑布流</div>;
  },
}));
vi.mock("@/components/layout/page-shell", () => ({
  PageShell: ({ children, width }: { children: React.ReactNode; width?: string }) => (
    <main data-width={width}>{children}</main>
  ),
}));

import MomentsPage from "@/app/moments/page";

describe("MomentsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTakeRestore.mockReturnValue(null);
    mockUseMoments.mockReturnValue({
      data: { pages: [{ data: [] }] },
      isLoading: false,
      error: null,
      hasNextPage: false,
      isFetchingNextPage: false,
      fetchNextPage: mockFetchNextPage,
      refetch: mockRefetch,
    });
  });
  afterEach(cleanup);

  test("登录用户切换关注流，页面头部不再重复发布入口", () => {
    mockUseAuth.mockReturnValue({ user: { id: "user-1" } });
    render(<MomentsPage />);
    expect(screen.getByRole("main")).toHaveAttribute("data-width", "feed");
    expect(mockClearReturn).toHaveBeenCalledOnce();
    expect(mockRememberFeed).toHaveBeenCalledWith("DISCOVER");
    fireEvent.click(screen.getByRole("tab", { name: "关注" }));
    expect(mockUseMoments).toHaveBeenLastCalledWith("FOLLOWING", "user-1");
    expect(mockRememberFeed).toHaveBeenLastCalledWith("FOLLOWING");
    expect(screen.queryByRole("button", { name: "发布动态" })).toBeNull();
  });

  test("返回动态列表时恢复原 Feed", async () => {
    mockUseAuth.mockReturnValue({ user: { id: "user-1" } });
    mockTakeRestore
      .mockReturnValueOnce({ feed: "FOLLOWING", scrollY: 0 })
      .mockReturnValue(null);

    render(<StrictMode><MomentsPage /></StrictMode>);

    await waitFor(() => expect(screen.getByRole("tab", { name: "关注" })).toHaveAttribute("aria-selected", "true"));
    expect(mockTakeRestore).toHaveBeenCalledOnce();
    expect(mockUseMoments).toHaveBeenLastCalledWith("FOLLOWING", "user-1");
  });

  test("访客切到关注流时显示登录提示", () => {
    mockUseAuth.mockReturnValue({ user: null });
    render(<MomentsPage />);
    fireEvent.click(screen.getByRole("tab", { name: "关注" }));
    expect(screen.getByText("登录后查看关注动态")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "登录" }));
    expect(mockPush).toHaveBeenCalledWith("/login?next=%2Fmoments");
  });

  test("发现流透传分页、失败恢复状态并合并多页数据", () => {
    mockUseAuth.mockReturnValue({ user: { id: "user-1" } });
    mockUseMoments.mockReturnValue({
      data: { pages: [{ data: [{ id: "moment-1" }] }, { data: [{ id: "moment-2" }] }] },
      isLoading: false,
      error: new Error("offline"),
      hasNextPage: true,
      isFetchingNextPage: true,
      fetchNextPage: mockFetchNextPage,
      refetch: mockRefetch,
    });
    render(<MomentsPage />);

    expect(mockUseMoments).toHaveBeenCalledWith("DISCOVER", "user-1");
    const props = mockMasonry.mock.calls.at(-1)?.[0] as {
      moments: { id: string }[];
      error: Error;
      hasNextPage: boolean;
      isFetchingNextPage: boolean;
      onLoadMore: () => void;
      onRetry: () => void;
    };
    expect(props.moments.map((moment) => moment.id)).toEqual(["moment-1", "moment-2"]);
    expect(props).toMatchObject({
      error: expect.any(Error),
      hasNextPage: true,
      isFetchingNextPage: true,
    });
    props.onLoadMore();
    props.onRetry();
    expect(mockFetchNextPage).toHaveBeenCalledOnce();
    expect(mockRefetch).toHaveBeenCalledOnce();
  });
});
