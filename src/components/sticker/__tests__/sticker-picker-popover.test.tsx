import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const {
  mockUseStickers,
  mockUseStickerActions,
  mockGetKnownUserId,
  mockToastError,
  mockUpload,
  mockValidate,
} = vi.hoisted(() => ({
  mockUseStickers: vi.fn(),
  mockUseStickerActions: vi.fn(),
  mockGetKnownUserId: vi.fn(),
  mockToastError: vi.fn(),
  mockUpload: vi.fn(),
  mockValidate: vi.fn(),
}));

vi.mock("@/api/hooks/use-stickers", () => ({
  useStickers: (...args: unknown[]) => mockUseStickers(...args),
  useStickerActions: (...args: unknown[]) => mockUseStickerActions(...args),
}));
vi.mock("@/lib/auth-store", () => ({ getKnownUserId: () => mockGetKnownUserId() }));
vi.mock("@/lib/upload-image", () => ({
  uploadImageFile: (...args: unknown[]) => mockUpload(...args),
  validateImageFile: (...args: unknown[]) => mockValidate(...args),
}));
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
  mockValidate.mockReturnValue(null);
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
  test("面板通过 Portal 脱离会裁切内容的编辑器外壳", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <div data-testid="editor-shell" className="overflow-hidden">
        <StickerPickerPopover onSelect={vi.fn()} />
      </div>,
    );

    await user.click(screen.getByRole("button", { name: "表情" }));
    const panel = screen.getByRole("dialog", { name: "表情收藏" });

    expect(document.body).toContainElement(panel);
    expect(container).not.toContainElement(panel);
  });

  test("表情较多时只滚动弹窗内列表并阻断页面滚动链", async () => {
    const user = userEvent.setup();
    mockUseStickers.mockReturnValue({
      data: {
        items: Array.from({ length: 50 }, (_, index) => ({
          ...sticker,
          id: `f${index}`,
        })),
        recent: [],
        pendingImports: [],
        version: 1,
        limit: 200,
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    render(<StickerPickerPopover onSelect={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "表情" }));
    const panel = screen.getByRole("dialog", { name: "表情收藏" });
    const stickerScroll = document.querySelector<HTMLElement>('[data-slot="sticker-picker-scroll"]');

    expect(panel).toHaveClass("overscroll-contain");
    expect(stickerScroll).toHaveClass(
      "max-h-72",
      "overflow-y-auto",
      "overscroll-contain",
      "touch-pan-y",
    );
  });

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

  test("批量添加图片时展示总上传进度", async () => {
    let resolveUpload!: (value: { mediaId: string }) => void;
    mockUpload.mockImplementationOnce((_file: File, options: {
      onProgress?: (progress: Record<string, unknown>) => void;
    }) => {
      options.onProgress?.({
        stage: "uploading",
        loadedBytes: 2 * 1024 * 1024,
        totalBytes: 4 * 1024 * 1024,
        percent: 50,
      });
      return new Promise((resolve) => { resolveUpload = resolve; });
    });
    const user = userEvent.setup();
    render(<StickerPickerPopover onSelect={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "表情" }));
    const input = document.querySelector<HTMLInputElement>('input[type="file"]');
    fireEvent.change(input!, {
      target: { files: [new File([new Uint8Array(4 * 1024 * 1024)], "sticker.png", { type: "image/png" })] },
    });

    expect(await screen.findByText("2.0 MB / 4.0 MB")).toBeInTheDocument();
    expect(screen.getByText("50%")).toBeInTheDocument();
    resolveUpload({ mediaId: "media-1" });
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });
});
