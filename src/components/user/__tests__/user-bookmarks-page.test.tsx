import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

vi.mock("@/components/user/user-moment-bookmarks-section", () => ({
  UserMomentBookmarksSection: () => <div>动态收藏列表</div>,
}));

vi.mock("@/components/user/create-bookmark-folder-button", () => ({
  CreateBookmarkFolderButton: ({ kind }: { kind: "threads" | "moments" }) => (
    <button type="button">
      {kind === "moments" ? "新建动态收藏夹" : "新建主题帖收藏夹"}
    </button>
  ),
}));

import { UserBookmarksPage } from "@/components/user/user-bookmarks-page";

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe("UserBookmarksPage", () => {
  test("本人收藏页显示新建收藏夹入口", () => {
    mockProfileContext.mockReturnValue({ canViewBookmarks: true, isSelf: true });
    render(<UserBookmarksPage userId="u1" />);

    expect(screen.getByRole("button", { name: "新建主题帖收藏夹" })).toBeInTheDocument();
    expect(screen.getByText("收藏列表")).toBeInTheDocument();
  });

  test("他人收藏页保持只读", () => {
    mockProfileContext.mockReturnValue({ canViewBookmarks: true, isSelf: false });
    render(<UserBookmarksPage userId="u2" />);

    expect(screen.queryByRole("button", { name: /新建.*收藏夹/ })).not.toBeInTheDocument();
    expect(screen.getByText("收藏列表")).toBeInTheDocument();
  });

  test("公开收藏页可切换到动态且不显示分类管理", async () => {
    const user = userEvent.setup();
    mockProfileContext.mockReturnValue({ canViewBookmarks: true, isSelf: false });
    render(<UserBookmarksPage userId="u2" />);

    await user.click(screen.getByRole("tab", { name: "动态" }));
    expect(screen.getByText("动态收藏列表")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /新建.*收藏夹/ })).not.toBeInTheDocument();
  });

  test("本人切换到动态后创建入口随目录类型切换", async () => {
    const user = userEvent.setup();
    mockProfileContext.mockReturnValue({ canViewBookmarks: true, isSelf: true });
    render(<UserBookmarksPage userId="u1" />);

    await user.click(screen.getByRole("tab", { name: "动态" }));
    expect(screen.getByRole("button", { name: "新建动态收藏夹" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "新建主题帖收藏夹" }),
    ).not.toBeInTheDocument();
  });

  test("无权限时不挂载主题帖和动态收藏", () => {
    mockProfileContext.mockReturnValue({ canViewBookmarks: false, isSelf: false });
    render(<UserBookmarksPage userId="u2" />);

    expect(screen.getByText("该用户未公开收藏")).toBeInTheDocument();
    expect(screen.queryByText("收藏列表")).not.toBeInTheDocument();
    expect(screen.queryByText("动态收藏列表")).not.toBeInTheDocument();
  });
});
