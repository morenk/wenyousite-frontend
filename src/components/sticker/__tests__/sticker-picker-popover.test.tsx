import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const {
  mockUseStickers,
  mockUseStickerActions,
  mockGetKnownUserId,
  mockToastError,
} = vi.hoisted(() => ({
  mockUseStickers: vi.fn(),
  mockUseStickerActions: vi.fn(),
  mockGetKnownUserId: vi.fn(),
  mockToastError: vi.fn(),
}));

vi.mock("@/api/hooks/use-stickers", () => ({
  useStickers: (...args: unknown[]) => mockUseStickers(...args),
  useStickerActions: (...args: unknown[]) => mockUseStickerActions(...args),
}));
vi.mock("@/lib/auth-store", () => ({ getKnownUserId: () => mockGetKnownUserId() }));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: mockToastError },
}));
vi.mock("@dnd-kit/core", () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  KeyboardSensor: function KeyboardSensor() {},
  PointerSensor: function PointerSensor() {},
  closestCenter: vi.fn(),
  useSensor: vi.fn(() => ({})),
  useSensors: vi.fn(() => []),
}));
vi.mock("@dnd-kit/sortable", () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  arrayMove: (items: unknown[]) => items,
  rectSortingStrategy: {},
  sortableKeyboardCoordinates: vi.fn(),
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: undefined,
    isDragging: false,
  }),
}));
vi.mock("@dnd-kit/utilities", () => ({
  CSS: { Transform: { toString: () => undefined } },
}));

import { StickerPickerPopover } from "@/components/sticker/sticker-picker-popover";

const sticker = {
  id: "f1",
  asset: {
    url: "https://img.example.com/full.gif",
    thumbnailUrl: "https://img.example.com/thumb.webp",
    animated: true,
  },
};
const refresh = vi.fn();
const remove = { mutateAsync: vi.fn(), isPending: false };

beforeEach(() => {
  vi.clearAllMocks();
  mockGetKnownUserId.mockReturnValue("u1");
  mockUseStickers.mockReturnValue({
    data: { items: [sticker], recent: [], pendingImports: [], version: 1, limit: 200 },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  });
  mockUseStickerActions.mockReturnValue({
    refresh,
    remove,
    reorder: { mutateAsync: vi.fn() },
    importMedia: { mutateAsync: vi.fn() },
  });
});

afterEach(() => cleanup());

describe("StickerPickerPopover", () => {
  test("打开收藏面板并选择表情后关闭、刷新最近使用", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn().mockResolvedValue(undefined);
    render(<StickerPickerPopover onSelect={onSelect} />);

    await user.click(screen.getByRole("button", { name: "表情" }));
    expect(screen.getByRole("dialog", { name: "表情收藏" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "使用收藏表情" }));

    await waitFor(() => expect(onSelect).toHaveBeenCalledWith(sticker));
    expect(refresh).toHaveBeenCalledOnce();
    expect(screen.queryByRole("dialog", { name: "表情收藏" })).not.toBeInTheDocument();
  });

  test("选择失败时保留面板并提示错误", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn().mockRejectedValue(new Error("send failed"));
    render(<StickerPickerPopover onSelect={onSelect} />);

    await user.click(screen.getByRole("button", { name: "表情" }));
    await user.click(screen.getByRole("button", { name: "使用收藏表情" }));

    await waitFor(() => expect(mockToastError).toHaveBeenCalledWith(expect.stringContaining("send failed")));
    expect(screen.getByRole("dialog", { name: "表情收藏" })).toBeInTheDocument();
  });

  test("加载失败可重试，空收藏显示引导", async () => {
    const user = userEvent.setup();
    const refetch = vi.fn();
    mockUseStickers.mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch });
    const first = render(<StickerPickerPopover onSelect={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "表情" }));
    await user.click(screen.getByRole("button", { name: "加载失败，点击重试" }));
    expect(refetch).toHaveBeenCalledOnce();
    first.unmount();

    mockUseStickers.mockReturnValue({
      data: { items: [], recent: [], pendingImports: [], version: 1, limit: 200 },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    render(<StickerPickerPopover onSelect={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "表情" }));
    expect(screen.getByText("上传图片或收藏站内图片来添加表情")).toBeInTheDocument();
  });

  test("管理模式选择并移除收藏", async () => {
    const user = userEvent.setup();
    remove.mutateAsync.mockResolvedValue(undefined);
    render(<StickerPickerPopover onSelect={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "表情" }));
    await user.click(screen.getByTitle("管理收藏"));
    await user.click(screen.getByRole("button", { name: "选择收藏表情" }));
    expect(screen.getByText("拖动可排序，已选 1 个")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "移除" }));

    await waitFor(() => expect(remove.mutateAsync).toHaveBeenCalledWith("f1"));
  });

  test("disabled 禁用入口", () => {
    render(<StickerPickerPopover onSelect={vi.fn()} disabled />);
    expect(screen.getByRole("button", { name: "表情" })).toBeDisabled();
  });
});
