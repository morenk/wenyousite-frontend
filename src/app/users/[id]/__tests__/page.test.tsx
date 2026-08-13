import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const {
  mockUseUserRecentReplies,
  mockUserActivitySummaryCard,
  mockShellContext,
} = vi.hoisted(() => ({
  mockUseUserRecentReplies: vi.fn(),
  mockUserActivitySummaryCard: vi.fn(),
  mockShellContext: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useParams: () => ({ id: "target-user" }) }));

vi.mock("@/api/hooks/use-user-recent-replies", () => ({
  useUserRecentReplies: (...args: unknown[]) => mockUseUserRecentReplies(...args),
}));

vi.mock("@/components/user/user-recent-replies", () => ({
  UserRecentReplies: () => <div>最近回复内容</div>,
}));

vi.mock("@/components/user/user-activity-summary", () => ({
  UserActivitySummaryCard: (props: unknown) => {
    mockUserActivitySummaryCard(props);
    return <div>创作概览数据</div>;
  },
}));

vi.mock("@/components/user/user-profile-shell", () => ({
  useUserProfilePageContext: () => mockShellContext(),
}));

import UserProfilePage from "@/app/users/[id]/(profile)/page";

describe("用户资料概览页", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockShellContext.mockReturnValue({
      canViewRecentReplies: false,
      canViewPlayedThreads: false,
      canViewBookmarks: false,
      isSelf: false,
    });
    mockUseUserRecentReplies.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    });
  });

  afterEach(cleanup);

  test("概览挂载创作汇总，不再重复动态预览或堆叠内容列表", () => {
    render(<UserProfilePage />);

    expect(screen.getByText("创作概览数据")).toBeInTheDocument();
    expect(mockUserActivitySummaryCard).toHaveBeenCalledWith({ userId: "target-user" });
    expect(screen.queryByText("两条动态预览")).not.toBeInTheDocument();
    expect(screen.queryByText("创建的帖子")).not.toBeInTheDocument();
    expect(screen.queryByText("收藏")).not.toBeInTheDocument();
    expect(screen.queryByText("参与的帖子")).not.toBeInTheDocument();
    expect(mockUseUserRecentReplies).not.toHaveBeenCalled();
  });

  test("最近回复可见时作为概览摘要按需挂载", () => {
    mockShellContext.mockReturnValue({
      canViewRecentReplies: true,
      canViewPlayedThreads: true,
      canViewBookmarks: true,
      isSelf: true,
    });

    render(<UserProfilePage />);

    expect(screen.getByText("最近回复")).toBeInTheDocument();
    expect(screen.getByText("最近回复内容")).toBeInTheDocument();
    expect(mockUseUserRecentReplies).toHaveBeenCalledWith("target-user");
  });
});
