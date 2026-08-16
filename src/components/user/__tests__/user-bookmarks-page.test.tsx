import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const { mockProfileContext } = vi.hoisted(() => ({
  mockProfileContext: vi.fn(),
}));

vi.mock("@/components/user/user-profile-shell", () => ({
  useUserProfilePageContext: () => mockProfileContext(),
}));

vi.mock("@/components/user/user-bookmarks-section", () => ({
  UserBookmarksSection: () => <div>收藏列表</div>,
}));

vi.mock("@/components/user/create-bookmark-folder-button", () => ({
  CreateBookmarkFolderButton: () => <button type="button">新建收藏夹</button>,
}));

import { UserBookmarksPage } from "@/components/user/user-bookmarks-page";

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe("UserBookmarksPage", () => {
  test("本人收藏页显示新建收藏夹入口", () => {
    mockProfileContext.mockReturnValue({ canViewBookmarks: true, isSelf: true });
    render(<UserBookmarksPage userId="u1" />);

    expect(screen.getByRole("button", { name: "新建收藏夹" })).toBeInTheDocument();
    expect(screen.getByText("收藏列表")).toBeInTheDocument();
  });

  test("他人收藏页保持只读", () => {
    mockProfileContext.mockReturnValue({ canViewBookmarks: true, isSelf: false });
    render(<UserBookmarksPage userId="u2" />);

    expect(screen.queryByRole("button", { name: "新建收藏夹" })).not.toBeInTheDocument();
    expect(screen.getByText("收藏列表")).toBeInTheDocument();
  });
});
