import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const { mockShellContext, mockUserBookmarksSection } = vi.hoisted(() => ({
  mockShellContext: vi.fn(),
  mockUserBookmarksSection: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useParams: () => ({ id: "author-1" }) }));
vi.mock("@/components/user/user-profile-shell", () => ({
  useUserProfilePageContext: () => mockShellContext(),
}));
vi.mock("@/components/user/user-bookmarks-section", () => ({
  UserBookmarksSection: (props: unknown) => {
    mockUserBookmarksSection(props);
    return <div>收藏列表</div>;
  },
}));

import UserBookmarksRoute from "@/app/users/[id]/(profile)/bookmarks/page";

describe("用户收藏 Tab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockShellContext.mockReturnValue({ canViewBookmarks: true });
  });
  afterEach(cleanup);

  test("有权限时按需挂载收藏列表", () => {
    render(<UserBookmarksRoute />);
    expect(screen.getByText("收藏列表")).toBeInTheDocument();
    expect(mockUserBookmarksSection).toHaveBeenCalledWith({ userId: "author-1" });
  });

  test("无权限时显示说明且不发起收藏查询", () => {
    mockShellContext.mockReturnValue({ canViewBookmarks: false });
    render(<UserBookmarksRoute />);
    expect(screen.getByText("该用户未公开收藏")).toBeInTheDocument();
    expect(mockUserBookmarksSection).not.toHaveBeenCalled();
  });
});
