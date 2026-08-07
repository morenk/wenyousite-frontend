import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { SaveStickerButton } from "@/components/sticker/save-sticker-button";

const {
  mockGetKnownUserId,
  mockSaveStickerSource,
  mockToastSuccess,
  mockToastError,
} = vi.hoisted(() => ({
  mockGetKnownUserId: vi.fn(),
  mockSaveStickerSource: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
}));

vi.mock("@/lib/auth-store", () => ({ getKnownUserId: () => mockGetKnownUserId() }));
vi.mock("@/api/hooks/use-stickers", () => ({
  saveStickerSource: (...args: unknown[]) => mockSaveStickerSource(...args),
}));
vi.mock("sonner", () => ({
  toast: { success: mockToastSuccess, error: mockToastError },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockGetKnownUserId.mockReturnValue("u1");
});

afterEach(() => cleanup());

describe("SaveStickerButton", () => {
  test("未登录时不显示收藏入口", () => {
    mockGetKnownUserId.mockReturnValue(null);
    const { container } = render(<SaveStickerButton source={{ directMessageId: "m1" }} />);
    expect(container).toBeEmptyDOMElement();
  });

  test.each([
    ["READY", false, "已添加到表情收藏"],
    ["READY", true, "已经收藏过这个表情"],
    ["PROCESSING", false, "图片正在处理，完成后会出现在收藏中"],
  ])("status=%s alreadySaved=%s 显示对应成功反馈", async (status, alreadySaved, message) => {
    const user = userEvent.setup();
    const dispatch = vi.spyOn(window, "dispatchEvent");
    mockSaveStickerSource.mockResolvedValue({ status, alreadySaved });
    render(<SaveStickerButton source={{ directMessageId: "m1" }} />);

    await user.click(screen.getByRole("button", { name: "添加到表情收藏" }));

    await waitFor(() => expect(mockToastSuccess).toHaveBeenCalledWith(message));
    expect(mockSaveStickerSource).toHaveBeenCalledWith({ directMessageId: "m1" });
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: "stickers:changed" }));
    dispatch.mockRestore();
    cleanup();
  });

  test("请求期间禁用按钮并阻止父级点击", async () => {
    const user = userEvent.setup();
    let resolveSave!: (value: { status: string; alreadySaved: boolean }) => void;
    mockSaveStickerSource.mockReturnValue(new Promise((resolve) => { resolveSave = resolve; }));
    const parentClick = vi.fn();
    render(<div onClick={parentClick}><SaveStickerButton source={{ postId: "p1", imageUrl: "https://img/a.png" }} /></div>);
    const button = screen.getByRole("button", { name: "添加到表情收藏" });

    await user.click(button);
    expect(button).toBeDisabled();
    expect(parentClick).not.toHaveBeenCalled();

    resolveSave({ status: "READY", alreadySaved: false });
    await waitFor(() => expect(button).not.toBeDisabled());
  });

  test("失败时显示统一错误并恢复按钮", async () => {
    const user = userEvent.setup();
    mockSaveStickerSource.mockRejectedValue(new Error("network"));
    render(<SaveStickerButton source={{ directMessageId: "m1" }} />);
    const button = screen.getByRole("button", { name: "添加到表情收藏" });

    await user.click(button);

    await waitFor(() => expect(mockToastError).toHaveBeenCalledWith(expect.stringContaining("network")));
    expect(button).not.toBeDisabled();
  });
});
