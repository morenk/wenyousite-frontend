import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const { mockUseBookmarkFolders, mockUseMomentBookmarks } = vi.hoisted(() => ({
  mockUseBookmarkFolders: vi.fn(),
  mockUseMomentBookmarks: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ useAuth: () => ({ user: { id: "user-1" } }) }));

vi.mock("@/api/hooks/use-bookmark-folders", () => ({
  useBookmarkFolders: (...args: unknown[]) => mockUseBookmarkFolders(...args),
}));

vi.mock("@/api/hooks/use-moments", () => ({
  useMomentBookmarks: (...args: unknown[]) => mockUseMomentBookmarks(...args),
}));

vi.mock("@/components/user/bookmark-folder-bar", () => ({
  BookmarkFolderBar: ({
    kind,
    selectedFolderId,
    onSelect,
  }: {
    kind: "threads" | "moments";
    selectedFolderId?: string;
    onSelect: (folderId?: string) => void;
  }) => (
    <div>
      <span>{kind} 当前目录：{selectedFolderId ?? "全部"}</span>
      <button
        type="button"
        onClick={() => onSelect(kind === "threads" ? "thread-folder" : "moment-folder")}
      >
        选择{kind === "threads" ? "主题帖" : "动态"}目录
      </button>
    </div>
  ),
}));

vi.mock("@/components/user/bookmark-list", () => ({
  BookmarkList: ({ folderId }: { folderId?: string }) => (
    <div>主题帖筛选：{folderId ?? "全部"}</div>
  ),
}));

vi.mock("@/components/moment/moment-masonry", () => ({
  MomentMasonry: () => <div>动态收藏列表</div>,
}));

vi.mock("@/components/user/bookmark-moment-card", () => ({
  BookmarkMomentCard: () => null,
}));

import BookmarksPage from "@/app/bookmarks/page";

beforeEach(() => {
  vi.clearAllMocks();
  mockUseBookmarkFolders.mockImplementation((kind: "threads" | "moments") => ({
    data: [
      {
        id: kind === "threads" ? "thread-folder" : "moment-folder",
        name: "同名目录",
        isDefault: false,
        itemCount: 1,
        createdAt: "2026-08-26T00:00:00.000Z",
      },
    ],
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }));
  mockUseMomentBookmarks.mockReturnValue({
    data: { pages: [{ data: [] }] },
    isLoading: false,
    error: null,
    hasNextPage: false,
    isFetchingNextPage: false,
    fetchNextPage: vi.fn(),
    refetch: vi.fn(),
  });
});

afterEach(cleanup);

describe("BookmarksPage", () => {
  test("主题帖与动态分别保留目录筛选且不串用 folderId", async () => {
    const user = userEvent.setup();
    render(<BookmarksPage />);

    expect(mockUseBookmarkFolders).toHaveBeenLastCalledWith("threads");
    await user.click(screen.getByRole("button", { name: "选择主题帖目录" }));
    expect(screen.getByText("主题帖筛选：thread-folder")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "动态" }));
    expect(mockUseBookmarkFolders).toHaveBeenLastCalledWith("moments");
    expect(screen.getByText("moments 当前目录：全部")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "选择动态目录" }));
    expect(screen.getByText("moments 当前目录：moment-folder")).toBeInTheDocument();
    expect(mockUseMomentBookmarks).toHaveBeenLastCalledWith("user-1", "moment-folder");

    await user.click(screen.getByRole("tab", { name: "主题帖" }));
    expect(screen.getByText("threads 当前目录：thread-folder")).toBeInTheDocument();
    expect(mockUseMomentBookmarks).not.toHaveBeenCalledWith("user-1", "thread-folder");
  });
});
