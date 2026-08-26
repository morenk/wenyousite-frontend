import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const { mockFolders, mockRefetch, mockUseBookmarkFolders } = vi.hoisted(() => ({
  mockFolders: vi.fn(),
  mockRefetch: vi.fn(),
  mockUseBookmarkFolders: vi.fn(),
}));

vi.mock("@/api/hooks/use-bookmark-folders", () => ({
  useBookmarkFolders: (...args: unknown[]) => mockUseBookmarkFolders(...args),
}));

vi.mock("@/components/user/bookmark-folder-form", () => ({
  BookmarkFolderForm: ({
    kind,
    onCreated,
  }: {
    kind: string;
    onCreated: (folder: unknown) => void;
  }) => (
    <button
      type="button"
      data-kind={kind}
      onClick={() => onCreated({
        id: "folder-new",
        name: "新收藏夹",
        isDefault: false,
        itemCount: 0,
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
    itemCount: 2,
    createdAt: "2026-08-18T00:00:00Z",
  },
  {
    id: "folder-custom",
    name: "跑团资料",
    isDefault: false,
    itemCount: 1,
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
  mockUseBookmarkFolders.mockImplementation(() => mockFolders());
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
    expect(mockUseBookmarkFolders).toHaveBeenCalledWith("threads", true);
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
        kind="moments"
        isPending={false}
        onConfirm={onConfirm}
      />,
    );

    expect(mockUseBookmarkFolders).toHaveBeenCalledWith("moments", true);
    await user.click(screen.getByRole("button", { name: "新建动态收藏夹" }));
    expect(screen.getByRole("button", { name: "完成新建" })).toHaveAttribute(
      "data-kind",
      "moments",
    );
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
