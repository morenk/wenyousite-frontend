import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const { mockFolders, mockRefetch } = vi.hoisted(() => ({
  mockFolders: vi.fn(),
  mockRefetch: vi.fn(),
}));

vi.mock("@/api/hooks/use-bookmark-folders", () => ({
  useBookmarkFolders: () => mockFolders(),
}));

vi.mock("@/components/user/bookmark-folder-form", () => ({
  BookmarkFolderForm: ({ onCreated }: { onCreated: (folder: unknown) => void }) => (
    <button
      type="button"
      onClick={() => onCreated({
        id: "folder-new",
        name: "新收藏夹",
        isDefault: false,
        bookmarkCount: 0,
        momentBookmarkCount: 0,
        createdAt: "2026-08-18T00:00:00Z",
      })}
    >
      完成新建
    </button>
  ),
}));

import { BookmarkFolderPickerDialog } from "@/components/user/bookmark-folder-picker-dialog";

const folders = [
  {
    id: "folder-default",
    name: "默认收藏夹",
    isDefault: true,
    bookmarkCount: 2,
    momentBookmarkCount: 1,
    createdAt: "2026-08-18T00:00:00Z",
  },
  {
    id: "folder-custom",
    name: "跑团资料",
    isDefault: false,
    bookmarkCount: 1,
    momentBookmarkCount: 3,
    createdAt: "2026-08-18T00:00:00Z",
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockFolders.mockReturnValue({
    data: folders,
    isLoading: false,
    isError: false,
    refetch: mockRefetch,
  });
});

afterEach(cleanup);

describe("BookmarkFolderPickerDialog", () => {
  test("预选默认收藏夹，选择其他分类后确认", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    const onOpenChange = vi.fn();
    render(
      <BookmarkFolderPickerDialog
        open
        onOpenChange={onOpenChange}
        contentLabel="测试主题"
        isPending={false}
        onConfirm={onConfirm}
      />,
    );

    expect(screen.getByRole("dialog", { name: "收藏到" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /默认收藏夹/ })).toBeChecked();
    await user.click(screen.getByRole("radio", { name: /跑团资料/ }));
    await user.click(screen.getByRole("button", { name: "收藏" }));

    expect(onConfirm).toHaveBeenCalledWith("folder-custom");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  test("弹窗内新建收藏夹后将它作为确认目标", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(
      <BookmarkFolderPickerDialog
        open
        onOpenChange={vi.fn()}
        contentLabel="测试动态"
        isPending={false}
        onConfirm={onConfirm}
      />,
    );

    await user.click(screen.getByRole("button", { name: "新建收藏夹" }));
    await user.click(screen.getByRole("button", { name: "完成新建" }));
    await user.click(screen.getByRole("button", { name: "收藏" }));
    expect(onConfirm).toHaveBeenCalledWith("folder-new");
  });

  test("加载失败时提供重试且禁用确认", async () => {
    const user = userEvent.setup();
    mockFolders.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: mockRefetch,
    });
    render(
      <BookmarkFolderPickerDialog
        open
        onOpenChange={vi.fn()}
        contentLabel="测试动态"
        isPending={false}
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "收藏" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "重试" }));
    expect(mockRefetch).toHaveBeenCalledOnce();
  });
});
