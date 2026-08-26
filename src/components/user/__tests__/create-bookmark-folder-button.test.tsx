import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const {
  mockMutateAsync,
  mockToastError,
  mockToastSuccess,
  mockUseCreateBookmarkFolder,
} = vi.hoisted(() => ({
  mockMutateAsync: vi.fn(),
  mockToastError: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockUseCreateBookmarkFolder: vi.fn(),
}));

vi.mock("@/api/hooks/use-bookmark-folders", () => ({
  useCreateBookmarkFolder: (...args: unknown[]) => mockUseCreateBookmarkFolder(...args),
}));

vi.mock("sonner", () => ({
  toast: { success: mockToastSuccess, error: mockToastError },
}));

import { CreateBookmarkFolderButton } from "@/components/user/create-bookmark-folder-button";

beforeEach(() => {
  vi.clearAllMocks();
  mockUseCreateBookmarkFolder.mockReturnValue({
    mutateAsync: mockMutateAsync,
    isPending: false,
  });
  mockMutateAsync.mockResolvedValue({
    id: "folder-1",
    name: "跑团资料",
    isDefault: false,
    itemCount: 0,
    createdAt: "2026-08-16T00:00:00Z",
  });
});

afterEach(cleanup);

describe("CreateBookmarkFolderButton", () => {
  test("从明确入口新建收藏夹并回传结果", async () => {
    const user = userEvent.setup();
    const onCreated = vi.fn();
    render(<CreateBookmarkFolderButton onCreated={onCreated} />);

    await user.click(screen.getByRole("button", { name: "新建主题帖收藏夹" }));
    expect(screen.getByRole("dialog", { name: "新建主题帖收藏夹" })).toBeInTheDocument();
    expect(mockUseCreateBookmarkFolder).toHaveBeenCalledWith("threads");
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

    await user.click(screen.getByRole("button", { name: "新建主题帖收藏夹" }));
    await user.type(screen.getByLabelText("收藏夹名称"), "跑团资料");
    await user.click(screen.getByRole("button", { name: "新建" }));

    expect(mockToastError).toHaveBeenCalledWith("收藏夹名称已存在");
  });

  test("动态入口只新建动态收藏夹", async () => {
    const user = userEvent.setup();
    render(<CreateBookmarkFolderButton kind="moments" />);

    await user.click(screen.getByRole("button", { name: "新建动态收藏夹" }));
    expect(screen.getByRole("dialog", { name: "新建动态收藏夹" })).toBeInTheDocument();
    expect(mockUseCreateBookmarkFolder).toHaveBeenCalledWith("moments");
  });
});
