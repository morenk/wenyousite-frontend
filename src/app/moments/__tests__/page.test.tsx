import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const {
  mockUseAuth,
  mockUseMoments,
  mockPush,
  mockMasonry,
  mockFetchNextPage,
  mockRefetch,
} = vi.hoisted(() => ({
  mockUseAuth: vi.fn(),
  mockUseMoments: vi.fn(),
  mockPush: vi.fn(),
  mockMasonry: vi.fn(),
  mockFetchNextPage: vi.fn(),
  mockRefetch: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => "/moments",
}));
vi.mock("@/lib/auth", () => ({ useAuth: () => mockUseAuth() }));
vi.mock("@/api/hooks/use-moments", () => ({ useMoments: (...args: unknown[]) => mockUseMoments(...args) }));
vi.mock("@/components/moment/moment-masonry", () => ({
  MomentMasonry: (props: Record<string, unknown>) => {
    mockMasonry(props);
    return <div>瀑布流</div>;
  },
}));
vi.mock("@/components/layout/page-shell", () => ({ PageShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }));

import MomentsPage from "@/app/moments/page";

describe("MomentsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    fireEvent.click(screen.getByRole("tab", { name: "关注" }));
    expect(mockUseMoments).toHaveBeenLastCalledWith("FOLLOWING", "user-1");
    expect(screen.queryByRole("button", { name: "发布动态" })).toBeNull();
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
