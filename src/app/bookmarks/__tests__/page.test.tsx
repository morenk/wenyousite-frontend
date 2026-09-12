import { cleanup, render, screen } from "@testing-library/react";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
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

vi.mock("@/components/user/bookmark-folder-management", () => ({
  BookmarkFolderManagement: ({ onRenamed, onDeleted }: { onRenamed: () => void; onDeleted: (id: string) => void }) => <div><button onClick={onRenamed}>重命名管理入口</button><button onClick={() => onDeleted("default-folder")}>删除管理入口</button></div>,
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
      { id: "default-folder", name: "默认收藏夹", isDefault: true, itemCount: 0, createdAt: "2026-08-26" },
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
  test("刷新时从 URL 恢复类型和目录", () => {
    render(<NuqsTestingAdapter searchParams="?type=moments&folder=moment-folder"><BookmarksPage /></NuqsTestingAdapter>);
    expect(screen.getByText("moments 当前目录：moment-folder")).toBeInTheDocument();
    expect(mockUseMomentBookmarks).toHaveBeenLastCalledWith("user-1", "moment-folder");
    expect(screen.queryByText(/主题帖筛选/)).not.toBeInTheDocument();
  });

  test("失效目录回到全部收藏", () => {
    render(<NuqsTestingAdapter searchParams="?folder=missing" hasMemory><BookmarksPage /></NuqsTestingAdapter>);
    expect(screen.getByText("主题帖筛选：全部")).toBeInTheDocument();
  });

  test("主题帖与动态分别保留目录筛选且不串用 folderId", async () => {
    const user = userEvent.setup();
    render(<NuqsTestingAdapter hasMemory><BookmarksPage /></NuqsTestingAdapter>);

    expect(mockUseBookmarkFolders).toHaveBeenLastCalledWith("threads");
    expect(mockUseMomentBookmarks).not.toHaveBeenCalled();
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

test.each(["threads", "moments"])("%s 只有当前自定义夹显示管理，删除以 replace 进入目标", async (kind) => {
  const user = userEvent.setup();
  const onUrlUpdate = vi.fn();
  render(<NuqsTestingAdapter searchParams={`?type=${kind}&folder=${kind === "threads" ? "thread-folder" : "moment-folder"}`} onUrlUpdate={onUrlUpdate}><BookmarksPage /></NuqsTestingAdapter>);
  expect(screen.getAllByRole("button", { name: "删除管理入口" })).toHaveLength(1);
  await user.click(screen.getByRole("button", { name: "删除管理入口" }));
  expect(onUrlUpdate).toHaveBeenLastCalledWith(expect.objectContaining({ options: expect.objectContaining({ history: "replace" }), searchParams: expect.any(URLSearchParams) }));
  expect(onUrlUpdate.mock.lastCall![0].searchParams.get("folder")).toBe("default-folder");
});

test.each(["", "?folder=default"])("全部和默认夹没有管理入口 %s", (searchParams) => {
  mockUseBookmarkFolders.mockReturnValue({ data: [{ id: "default", name: "默认收藏夹", isDefault: true, itemCount: 0 }], isError: false });
  render(<NuqsTestingAdapter searchParams={searchParams}><BookmarksPage /></NuqsTestingAdapter>);
  expect(screen.queryByRole("button", { name: "删除管理入口" })).not.toBeInTheDocument();
});
