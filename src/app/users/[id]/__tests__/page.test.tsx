import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const {
  mockUseAuth,
  mockUseUserProfile,
  mockUseUserRecentReplies,
  mockUserBookmarksSection,
  mockUserPlayedThreads,
} = vi.hoisted(() => ({
  mockUseAuth: vi.fn(),
  mockUseUserProfile: vi.fn(),
  mockUseUserRecentReplies: vi.fn(),
  mockUserBookmarksSection: vi.fn(),
  mockUserPlayedThreads: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "target-user" }),
}));

vi.mock("@/lib/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("@/api/hooks/use-user-profile", () => ({
  useUserProfile: (...args: unknown[]) => mockUseUserProfile(...args),
}));

vi.mock("@/api/hooks/use-user-recent-replies", () => ({
  useUserRecentReplies: (...args: unknown[]) => mockUseUserRecentReplies(...args),
}));

vi.mock("@/components/user/user-profile-card", () => ({
  UserProfileCard: () => <div>资料卡</div>,
}));

vi.mock("@/components/user/user-recent-replies", () => ({
  UserRecentReplies: () => <div>最近动态内容</div>,
}));

vi.mock("@/components/user/user-created-threads", () => ({
  UserCreatedThreads: () => <div>创建内容</div>,
}));

vi.mock("@/components/user/user-bookmarks-section", () => ({
  UserBookmarksSection: (props: unknown) => {
    mockUserBookmarksSection(props);
    return <div>收藏内容</div>;
  },
}));

vi.mock("@/components/user/user-played-threads", () => ({
  UserPlayedThreads: (props: unknown) => {
    mockUserPlayedThreads(props);
    return <div>参与内容</div>;
  },
}));

vi.mock("@/components/moment/user-moments-section", () => ({
  UserMomentsSection: () => <div>动态内容</div>,
}));

vi.mock("@/components/layout/page-shell", () => ({
  PageShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}));

vi.mock("@/components/layout/page-route-fallback", () => ({
  PageRouteFallback: () => <div>加载中</div>,
}));

import UserProfilePage from "@/app/users/[id]/page";

const privateProfile = {
  id: "target-user",
  username: "隐私用户",
  avatar: null,
  bio: null,
  role: "USER",
  level: 1,
  receivedTipTotal: "0",
  receivedTipCount: 0,
  showRecentReplies: false,
  showPlayerBadges: false,
  showBookmarks: false,
  createdAt: "2026-01-01T00:00:00Z",
  _count: { following: 0, followers: 0 },
  isDeactivated: false as const,
};

describe("用户资料页隐私板块", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({
      user: { id: "viewer-user", username: "访问者" },
      isInitialized: true,
    });
    mockUseUserProfile.mockReturnValue({
      data: privateProfile,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    mockUseUserRecentReplies.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    });
  });

  afterEach(() => cleanup());

  test("查看他人未公开资料时不挂载三个隐私卡片及其查询", () => {
    render(<UserProfilePage />);

    expect(screen.getByText("动态")).toBeInTheDocument();
    expect(screen.queryByText("最近回复")).toBeNull();
    expect(screen.queryByText("收藏")).toBeNull();
    expect(screen.queryByText("参与的帖子")).toBeNull();
    expect(mockUseUserRecentReplies).not.toHaveBeenCalled();
    expect(mockUserBookmarksSection).not.toHaveBeenCalled();
    expect(mockUserPlayedThreads).not.toHaveBeenCalled();
    expect(screen.getByText("创建的帖子")).toBeInTheDocument();
  });

  test("本人查看时仍挂载三个隐私卡片", () => {
    mockUseAuth.mockReturnValue({
      user: { id: "target-user", username: "隐私用户" },
      isInitialized: true,
    });

    render(<UserProfilePage />);

    expect(screen.getByText("动态")).toBeInTheDocument();
    expect(screen.getByText("最近回复")).toBeInTheDocument();
    expect(screen.getByText("收藏")).toBeInTheDocument();
    expect(screen.getByText("参与的帖子")).toBeInTheDocument();
    expect(mockUseUserRecentReplies).toHaveBeenCalledWith("target-user");
    expect(mockUserBookmarksSection).toHaveBeenCalledWith({ userId: "target-user" });
    expect(mockUserPlayedThreads).toHaveBeenCalledWith({
      userId: "target-user",
      isSelf: true,
    });
  });
});
