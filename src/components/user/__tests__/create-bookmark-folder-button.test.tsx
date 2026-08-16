import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const { mockMutateAsync, mockToastError, mockToastSuccess } = vi.hoisted(() => ({
  mockMutateAsync: vi.fn(),
  mockToastError: vi.fn(),
  mockToastSuccess: vi.fn(),
}));

vi.mock("@/api/hooks/use-bookmark-folders", () => ({
  useCreateBookmarkFolder: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  }),
}));

vi.mock("sonner", () => ({
  toast: { success: mockToastSuccess, error: mockToastError },
}));

import { CreateBookmarkFolderButton } from "@/components/user/create-bookmark-folder-button";

beforeEach(() => {
  vi.clearAllMocks();
  mockMutateAsync.mockResolvedValue({
    id: "folder-1",
    name: "跑团资料",
    isDefault: false,
    bookmarkCount: 0,
    createdAt: "2026-08-16T00:00:00Z",
  });
});

afterEach(cleanup);

describe("CreateBookmarkFolderButton", () => {
  test("从明确入口新建收藏夹并回传结果", async () => {
    const user = userEvent.setup();
    const onCreated = vi.fn();
    render(<CreateBookmarkFolderButton onCreated={onCreated} />);

    await user.click(screen.getByRole("button", { name: "新建收藏夹" }));
    expect(screen.getByRole("dialog", { name: "新建收藏夹" })).toBeInTheDocument();
    await user.type(screen.getByLabelText("收藏夹名称"), "  跑团资料  ");
    await user.click(screen.getByRole("button", { name: "新建" }));

    expect(mockMutateAsync).toHaveBeenCalledWith("跑团资料");
    expect(mockToastSuccess).toHaveBeenCalledWith("已新建“跑团资料”");
    expect(onCreated).toHaveBeenCalledWith(expect.objectContaining({ id: "folder-1" }));
  });

  test("新建失败时显示接口错误", async () => {
    const user = userEvent.setup();
    mockMutateAsync.mockRejectedValueOnce({ message: "收藏夹名称已存在" });
    render(<CreateBookmarkFolderButton />);

    await user.click(screen.getByRole("button", { name: "新建收藏夹" }));
    await user.type(screen.getByLabelText("收藏夹名称"), "跑团资料");
    await user.click(screen.getByRole("button", { name: "新建" }));

    expect(mockToastError).toHaveBeenCalledWith("收藏夹名称已存在");
  });
});
