import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const {
  mockCreate,
  mockPush,
  mockLoad,
  mockSave,
  mockDeleteDraft,
  mockUpload,
  mockCompress,
  mockValidate,
  mockToastError,
  mockMarkReturn,
} = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockPush: vi.fn(),
  mockLoad: vi.fn(),
  mockSave: vi.fn(),
  mockDeleteDraft: vi.fn(),
  mockUpload: vi.fn(),
  mockCompress: vi.fn(),
  mockValidate: vi.fn(),
  mockToastError: vi.fn(),
  mockMarkReturn: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => "/moments",
}));
vi.mock("@/lib/moment-navigation", () => ({ markMomentFeedReturn: mockMarkReturn }));
vi.mock("@/api/hooks/use-moments", () => ({
  useCreateMoment: () => ({ mutateAsync: mockCreate, isPending: false }),
}));
vi.mock("@/lib/moment-draft", () => ({
  loadMomentDraft: mockLoad,
  saveMomentDraft: mockSave,
  deleteMomentDraft: mockDeleteDraft,
}));
vi.mock("@/lib/upload-image", () => ({
  validateImageFile: () => null,
  isUploadAbortError: (error: unknown) => error instanceof DOMException && error.name === "AbortError",
  uploadImageFile: mockUpload,
}));
vi.mock("@/lib/moment-image", () => ({
  validateMomentImageFile: (...args: unknown[]) => mockValidate(...args),
  compressMomentImage: mockCompress,
}));
vi.mock("sonner", () => ({
  toast: {
    error: mockToastError,
    info: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  },
}));

import { MomentComposer } from "@/components/moment/moment-composer";

function clipboardData(text: string) {
  return { getData: (type: string) => type === "text/plain" ? text : "" };
}

describe("MomentComposer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoad.mockResolvedValue(null);
    mockSave.mockResolvedValue(undefined);
    mockDeleteDraft.mockResolvedValue(undefined);
    mockCreate.mockResolvedValue({ id: "moment-new" });
    mockUpload.mockResolvedValue({ mediaId: "media-1" });
    mockCompress.mockImplementation(async () => new File(["compressed"], "compressed.webp", { type: "image/webp" }));
    mockValidate.mockReturnValue(null);
  });
  afterEach(cleanup);

  test("发布纯文字动态并清理本地草稿", async () => {
    const onClose = vi.fn();
    render(<MomentComposer open userId="user-1" onClose={onClose} />);
    fireEvent.change(screen.getByLabelText("标题"), { target: { value: "新的动态" } });
    fireEvent.paste(screen.getByRole("textbox", { name: "正文" }), {
      clipboardData: clipboardData("只有普通文字"),
    });
    fireEvent.click(screen.getByRole("button", { name: "发布动态" }));

    await waitFor(() => expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
      title: "新的动态",
      content: "只有普通文字",
      mediaIds: [],
      coverMediaId: null,
    })));
    expect(mockDeleteDraft).toHaveBeenCalledWith("user-1");
    expect(onClose).toHaveBeenCalled();
    expect(mockMarkReturn).toHaveBeenCalledWith("moment-new", "/moments");
    expect(mockPush).toHaveBeenCalledWith("/moments/moment-new");
  });

  test("可清空草稿，并在关闭时通知父组件", async () => {
    const onClose = vi.fn();
    render(<MomentComposer open userId="user-1" onClose={onClose} />);
    fireEvent.change(screen.getByLabelText("标题"), { target: { value: "临时标题" } });
    fireEvent.click(screen.getByRole("button", { name: "清空草稿" }));
    await waitFor(() => expect(mockDeleteDraft).toHaveBeenCalledWith("user-1"));
    expect(screen.getByLabelText("标题")).toHaveValue("");
    fireEvent.click(screen.getByRole("button", { name: "关闭发布器" }));
    expect(onClose).toHaveBeenCalled();
  });

  test("关闭状态不渲染发布器", () => {
    const { container } = render(<MomentComposer open={false} userId="user-1" onClose={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  test("图片直传卡住时可用关闭按钮取消，且不会继续发布", async () => {
    const onClose = vi.fn();
    let uploadSignal: AbortSignal | undefined;
    mockUpload.mockImplementation((_file: File, options?: {
      signal?: AbortSignal;
      onStage?: (stage: string) => void;
      onProgress?: (progress: Record<string, unknown>) => void;
    }) => {
      uploadSignal = options?.signal;
      options?.onStage?.("uploading");
      options?.onProgress?.({
        stage: "uploading",
        loadedBytes: 2.5 * 1024 * 1024,
        totalBytes: 5 * 1024 * 1024,
        percent: 50,
      });
      return new Promise((_resolve, reject) => {
        options?.signal?.addEventListener(
          "abort",
          () => reject(new DOMException("aborted", "AbortError")),
          { once: true },
        );
      });
    });

    render(<MomentComposer open userId="user-1" onClose={onClose} />);
    const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]');
    expect(fileInput).not.toBeNull();
    fireEvent.change(fileInput!, {
      target: { files: [new File(["photo"], "photo.jpg", { type: "image/jpeg" })] },
    });
    fireEvent.change(screen.getByLabelText("标题"), { target: { value: "带图动态" } });
    fireEvent.click(screen.getByRole("button", { name: "发布动态" }));

    expect(await screen.findByText("2.5 MB / 5.0 MB")).toBeInTheDocument();
    expect(screen.getByText("50%")).toBeInTheDocument();
    const cancelAndClose = await screen.findByRole("button", { name: "取消上传并关闭发布器" });
    expect(cancelAndClose).toBeEnabled();
    fireEvent.click(cancelAndClose);

    await waitFor(() => expect(uploadSignal?.aborted).toBe(true));
    expect(onClose).toHaveBeenCalledOnce();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  test("动态只上传前端压缩后的 WebP，不上传所选原图", async () => {
    const original = new File(["original"], "photo.jpg", { type: "image/jpeg" });
    const compressed = new File(["compressed"], "photo.webp", { type: "image/webp" });
    mockCompress.mockResolvedValueOnce(compressed);
    render(<MomentComposer open userId="user-1" onClose={vi.fn()} />);
    const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]');
    fireEvent.change(fileInput!, { target: { files: [original] } });
    fireEvent.change(screen.getByLabelText("标题"), { target: { value: "压缩图片动态" } });
    fireEvent.click(screen.getByRole("button", { name: "发布动态" }));

    await waitFor(() => expect(mockUpload).toHaveBeenCalled());
    expect(mockCompress).toHaveBeenCalledWith(original, expect.objectContaining({ signal: expect.any(AbortSignal) }));
    expect(mockUpload).toHaveBeenCalledWith(compressed, expect.anything());
    expect(mockUpload).not.toHaveBeenCalledWith(original, expect.anything());
  });

  test("多图换行时只滚动表单内容并保持底部操作栏可见", async () => {
    render(<MomentComposer open userId="user-1" onClose={vi.fn()} />);
    const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]');
    const files = Array.from(
      { length: 9 },
      (_, index) => new File([`photo-${index}`], `photo-${index}.jpg`, { type: "image/jpeg" }),
    );

    fireEvent.change(fileInput!, { target: { files } });
    await screen.findByAltText("第 9 张图片");

    const shell = document.querySelector<HTMLElement>('[data-slot="moment-composer-shell"]');
    const form = document.querySelector<HTMLElement>('[data-slot="moment-composer-form"]');
    const scroll = document.querySelector<HTMLElement>('[data-slot="moment-composer-scroll"]');
    const actions = document.querySelector<HTMLElement>('[data-slot="moment-composer-actions"]');

    expect(shell).toHaveClass("h-[min(92dvh,52rem)]", "overflow-hidden");
    expect(form).toHaveClass("grid", "grid-rows-[auto_minmax(0,1fr)_auto]", "overflow-hidden");
    expect(scroll).toHaveClass("min-h-0", "overflow-y-auto", "overscroll-contain");
    expect(scroll).not.toContainElement(actions);
    expect(actions).toContainElement(screen.getByRole("button", { name: "清空草稿" }));
    expect(actions).toContainElement(screen.getByRole("button", { name: "发布动态" }));
  });

  test("恢复当前用户的图文草稿，并在所选封面失效时回退第一张图", async () => {
    const first = new File(["first"], "first.jpg", { type: "image/jpeg" });
    const second = new File(["second"], "second.jpg", { type: "image/jpeg" });
    mockLoad.mockResolvedValue({
      userId: "user-1",
      title: "恢复的标题",
      content: "恢复的正文",
      files: [
        { id: "file-1", file: first },
        { id: "file-2", file: second },
      ],
      coverFileId: "missing-cover",
      updatedAt: Date.now(),
    });

    render(<MomentComposer open userId="user-1" onClose={vi.fn()} />);

    expect(await screen.findByDisplayValue("恢复的标题")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole("textbox", { name: "正文" })).toHaveTextContent("恢复的正文");
    });
    expect(screen.getByAltText("第 1 张图片")).toHaveAttribute("src", expect.stringMatching(/^blob:/));
    expect(screen.getByAltText("第 2 张图片")).toBeInTheDocument();
    expect(screen.getByAltText("封面预览")).toHaveAttribute(
      "src",
      screen.getByAltText("第 1 张图片").getAttribute("src"),
    );
  });

  test("发布失败重试复用已上传媒体和幂等请求 ID", async () => {
    const original = new File(["original"], "photo.jpg", { type: "image/jpeg" });
    mockCreate
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({ id: "moment-new" });
    render(
      <MomentComposer open userId="user-1" onClose={vi.fn()} />,
    );
    const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]');
    fireEvent.change(fileInput!, { target: { files: [original] } });
    fireEvent.change(screen.getByLabelText("标题"), { target: { value: "可重试动态" } });

    fireEvent.click(screen.getByRole("button", { name: "发布动态" }));
    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByRole("button", { name: "发布动态" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "发布动态" }));
    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(2));

    expect(mockCompress).toHaveBeenCalledTimes(1);
    expect(mockUpload).toHaveBeenCalledTimes(1);
    const firstBody = mockCreate.mock.calls[0][0];
    const retriedBody = mockCreate.mock.calls[1][0];
    expect(retriedBody.mediaIds).toEqual(firstBody.mediaIds);
    expect(retriedBody.clientRequestId).toBe(firstBody.clientRequestId);
    expect(firstBody.clientRequestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(mockToastError).toHaveBeenCalled();
  });

  test("多图上传中断后重试只续传失败项", async () => {
    mockUpload
      .mockResolvedValueOnce({ mediaId: "media-first" })
      .mockRejectedValueOnce(new Error("second upload failed"))
      .mockResolvedValueOnce({ mediaId: "media-second" });
    render(<MomentComposer open userId="user-1" onClose={vi.fn()} />);
    const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]');
    fireEvent.change(fileInput!, {
      target: {
        files: [
          new File(["first"], "first.jpg", { type: "image/jpeg" }),
          new File(["second"], "second.jpg", { type: "image/jpeg" }),
        ],
      },
    });
    fireEvent.change(screen.getByLabelText("标题"), { target: { value: "续传双图" } });

    fireEvent.click(screen.getByRole("button", { name: "发布动态" }));
    await waitFor(() => expect(mockToastError).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: "发布动态" }));

    await waitFor(() => expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
      mediaIds: ["media-first", "media-second"],
    })));
    expect(mockCompress).toHaveBeenCalledTimes(2);
    expect(mockUpload).toHaveBeenCalledTimes(3);
  });

  test("多图选择封面后按上传位置映射 coverMediaId", async () => {
    mockUpload
      .mockResolvedValueOnce({ mediaId: "media-first" })
      .mockResolvedValueOnce({ mediaId: "media-second" });
    render(
      <MomentComposer open userId="user-1" onClose={vi.fn()} />,
    );
    const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]');
    fireEvent.change(fileInput!, {
      target: {
        files: [
          new File(["first"], "first.jpg", { type: "image/jpeg" }),
          new File(["second"], "second.jpg", { type: "image/jpeg" }),
        ],
      },
    });
    fireEvent.click(screen.getAllByRole("button", { name: "设为封面" })[1]);
    fireEvent.change(screen.getByLabelText("标题"), { target: { value: "双图动态" } });
    fireEvent.click(screen.getByRole("button", { name: "发布动态" }));

    await waitFor(() => expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
      mediaIds: ["media-first", "media-second"],
      coverMediaId: "media-second",
    })));
  });

  test("拒绝无效图片和超过九张的追加，不污染已有选择", async () => {
    render(
      <MomentComposer open userId="user-1" onClose={vi.fn()} />,
    );
    const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]');
    mockValidate.mockReturnValueOnce("动态暂不支持动图");
    fireEvent.change(fileInput!, {
      target: { files: [new File(["gif"], "bad.gif", { type: "image/gif" })] },
    });
    expect(screen.queryByAltText("第 1 张图片")).toBeNull();
    expect(mockToastError).toHaveBeenCalledWith("bad.gif：动态暂不支持动图");

    mockValidate.mockReturnValue(null);
    const nineFiles = Array.from(
      { length: 9 },
      (_, index) => new File([String(index)], `${index}.jpg`, { type: "image/jpeg" }),
    );
    fireEvent.change(fileInput!, { target: { files: nineFiles } });
    await screen.findByAltText("第 9 张图片");
    fireEvent.change(fileInput!, {
      target: { files: [new File(["extra"], "extra.jpg", { type: "image/jpeg" })] },
    });

    expect(screen.getAllByAltText(/第 \d+ 张图片/)).toHaveLength(9);
    expect(mockToastError).toHaveBeenCalledWith("每条动态最多 9 张图片");
  });
});
