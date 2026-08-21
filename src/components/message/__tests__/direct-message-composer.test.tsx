import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { DirectMessageComposer } from "@/components/message/direct-message-composer";

const { mockUpload, mockValidate, mockToastError, mockRandomUUID } = vi.hoisted(() => ({
  mockUpload: vi.fn(),
  mockValidate: vi.fn(),
  mockToastError: vi.fn(),
  mockRandomUUID: vi.fn(),
}));

vi.mock("@/lib/upload-image", () => ({
  uploadImageFile: mockUpload,
  validateImageFile: mockValidate,
  isUploadAbortError: (error: unknown) => error instanceof DOMException && error.name === "AbortError",
}));
vi.mock("sonner", () => ({ toast: { error: mockToastError } }));
vi.mock("@/components/sticker/sticker-picker-popover", () => ({
  StickerPickerPopover: ({
    disabled,
    onSelect,
  }: {
    disabled: boolean;
    onSelect: (sticker: Record<string, unknown>) => Promise<unknown>;
  }) => (
    <button
      type="button"
      disabled={disabled}
      onClick={() => void onSelect({
        id: "favorite1",
        asset: {
          id: "sticker1",
          url: "https://cdn.example.com/sticker.webp",
          thumbnailUrl: "https://cdn.example.com/sticker-thumb.webp",
          animated: false,
          frameCount: 1,
          durationMs: null,
          width: 256,
          height: 256,
        },
      })}
    >
      测试表情
    </button>
  ),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockRandomUUID.mockReset();
  mockValidate.mockReturnValue(null);
  mockUpload.mockResolvedValue({ url: "https://cdn.example.com/a.jpg", mediaId: "media1" });
  mockRandomUUID
    .mockReturnValueOnce("99454040-6a52-4bf3-8bad-42683c4d09be")
    .mockReturnValueOnce("3af69fe1-826e-4777-83fb-5ecec0b3a2ed")
    .mockReturnValue("a65761f4-e966-43b4-8cbd-12f0beee185b");
  vi.stubGlobal("crypto", { randomUUID: mockRandomUUID });
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:preview");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("DirectMessageComposer", () => {
  test("纯文本发送会清理正文与每一行的尾部空白并在成功后清空", async () => {
    const onSend = vi.fn().mockResolvedValue(undefined);
    render(<DirectMessageComposer onSend={onSend} requestHint />);
    expect(screen.getByText(/这是首条消息/)).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText("输入消息…"), {
      target: { value: "  第一行  \r\n第二行\t  " },
    });
    await userEvent.click(screen.getByRole("button", { name: "发送" }));

    await waitFor(() => expect(onSend).toHaveBeenCalledWith({
      content: "第一行\n第二行",
      clientRequestId: "99454040-6a52-4bf3-8bad-42683c4d09be",
    }));
    expect(screen.getByPlaceholderText("输入消息…")).toHaveValue("");
  });

  test("发送完成后输入框恢复焦点，可直接继续输入", async () => {
    const onSend = vi.fn().mockResolvedValue(undefined);
    render(<DirectMessageComposer onSend={onSend} />);
    const textarea = screen.getByPlaceholderText("输入消息…");
    await userEvent.type(textarea, "第一条消息");
    await userEvent.click(screen.getByRole("button", { name: "发送" }));

    await waitFor(() => expect(textarea).toHaveFocus());
    await userEvent.type(textarea, "第二条消息");
    expect(textarea).toHaveValue("第二条消息");
  });

  test("请求仍在进行时就清空输入框，让乐观消息先行展示", async () => {
    let resolveSend!: () => void;
    const onSend = vi.fn().mockReturnValue(new Promise<void>((resolve) => {
      resolveSend = resolve;
    }));
    render(<DirectMessageComposer onSend={onSend} />);
    const textarea = screen.getByPlaceholderText("输入消息…");
    await userEvent.type(textarea, "立即显示");
    await userEvent.click(screen.getByRole("button", { name: "发送" }));

    expect(onSend).toHaveBeenCalled();
    expect(textarea).toHaveValue("");
    resolveSend();
    await waitFor(() => expect(screen.getByRole("button", { name: "发送" })).toBeEnabled());
  });

  test("空消息提示错误，Enter 发送且 Shift+Enter 不发送", async () => {
    const onSend = vi.fn().mockResolvedValue(undefined);
    render(<DirectMessageComposer onSend={onSend} />);
    await userEvent.click(screen.getByRole("button", { name: "发送" }));
    expect(mockToastError).toHaveBeenCalledWith("请输入消息或选择一张图片");

    const textarea = screen.getByPlaceholderText("输入消息…");
    fireEvent.change(textarea, { target: { value: "hello" } });
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: true });
    expect(onSend).not.toHaveBeenCalled();
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: false });
    await waitFor(() => expect(onSend).toHaveBeenCalledTimes(1));
  });

  test("整段粘贴站内地址会用选区名称写入规范化传送门", async () => {
    const onSend = vi.fn().mockResolvedValue(undefined);
    render(<DirectMessageComposer onSend={onSend} />);
    const textarea = screen.getByPlaceholderText("输入消息…") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "A [x] \\ path" } });
    textarea.setSelectionRange(0, textarea.value.length);

    fireEvent.paste(textarea, {
      clipboardData: {
        getData: () => "https://www.wenyou.site/threads/cmsewdo0h000x7qv6aa77ll1v",
      },
    });

    expect(textarea).toHaveValue(
      "[A \\[x\\] \\\\ path](/threads/cmsewdo0h000x7qv6aa77ll1v)",
    );
    await userEvent.click(screen.getByRole("button", { name: "发送" }));
    await waitFor(() => expect(onSend).toHaveBeenCalledWith({
      content: "[A \\[x\\] \\\\ path](/threads/cmsewdo0h000x7qv6aa77ll1v)",
      clientRequestId: "99454040-6a52-4bf3-8bad-42683c4d09be",
    }));
  });

  test("混合文本中的站内地址沿用普通粘贴", () => {
    render(<DirectMessageComposer onSend={vi.fn()} />);
    const textarea = screen.getByPlaceholderText("输入消息…");
    fireEvent.paste(textarea, {
      clipboardData: {
        getData: () => "入口 https://wenyou.site/join/AbCdEfGh_123-XYZ",
      },
    });
    expect(textarea).toHaveValue("");
  });

  test("选择单图后展示公开链接警告并上传 mediaId", async () => {
    const onSend = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<DirectMessageComposer onSend={onSend} submitLabel="发送首条消息" />);
    const file = new File(["image"], "photo.jpg", { type: "image/jpeg" });
    fireEvent.change(container.querySelector("input[type=file]")!, { target: { files: [file] } });

    expect(screen.getByRole("img", { name: "待发送图片预览" })).toHaveAttribute("src", "blob:preview");
    expect(screen.getByText(/公开访问的链接/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "发送首条消息" }));
    await waitFor(() => expect(onSend).toHaveBeenCalledWith({
      mediaId: "media1",
      clientRequestId: "99454040-6a52-4bf3-8bad-42683c4d09be",
      optimisticMedia: {
        id: "media1",
        url: "https://cdn.example.com/a.jpg",
        thumbnailUrl: null,
        mediumUrl: null,
        contentType: "image/jpeg",
        width: null,
        height: null,
      },
    }));
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:preview");
  });

  test("图片直传期间展示真实字节和百分比", async () => {
    let resolveUpload!: (value: { url: string; mediaId: string }) => void;
    mockUpload.mockImplementationOnce((_file: File, options: {
      onProgress?: (progress: Record<string, unknown>) => void;
    }) => {
      options.onProgress?.({
        stage: "uploading",
        loadedBytes: 2.5 * 1024 * 1024,
        totalBytes: 5 * 1024 * 1024,
        percent: 50,
      });
      return new Promise((resolve) => { resolveUpload = resolve; });
    });
    const onSend = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<DirectMessageComposer onSend={onSend} />);
    fireEvent.change(container.querySelector("input[type=file]")!, {
      target: { files: [new File(["image"], "photo.jpg", { type: "image/jpeg" })] },
    });

    await userEvent.click(screen.getByRole("button", { name: "发送" }));

    expect(await screen.findByText("2.5 MB / 5.0 MB")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "上传 50%" })).toBeDisabled();
    resolveUpload({ url: "https://cdn.example.com/a.jpg", mediaId: "media1" });
    await waitFor(() => expect(onSend).toHaveBeenCalled());
  });

  test("选择 GIF 时明确提示会保留动画效果", () => {
    const { container } = render(<DirectMessageComposer onSend={vi.fn()} />);
    const file = new File(["gif"], "animated.gif", { type: "image/gif" });
    fireEvent.change(container.querySelector("input[type=file]")!, { target: { files: [file] } });

    expect(screen.getByText(/GIF 动图会保留动画效果/)).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "待发送图片预览" })).toHaveAttribute(
      "src",
      "blob:preview",
    );
  });

  test("图片消息发送失败时恢复待发图片并保留重试入口", async () => {
    const onSend = vi.fn().mockRejectedValue(new Error("图片发送失败"));
    const { container } = render(<DirectMessageComposer onSend={onSend} />);
    const file = new File(["image"], "photo.jpg", { type: "image/jpeg" });
    fireEvent.change(container.querySelector("input[type=file]")!, { target: { files: [file] } });

    await userEvent.click(screen.getByRole("button", { name: "发送" }));

    await waitFor(() => expect(onSend).toHaveBeenCalled());
    await waitFor(() =>
      expect(screen.getByRole("img", { name: "待发送图片预览" })).toHaveAttribute(
        "src",
        "blob:preview",
      ),
    );
    expect(URL.createObjectURL).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("button", { name: "发送" })).toBeEnabled();
    expect(mockToastError).toHaveBeenCalledWith("图片发送失败");
  });

  test("无效图片提示错误，已选图片可移除", async () => {
    const { container } = render(<DirectMessageComposer onSend={vi.fn()} />);
    const input = container.querySelector("input[type=file]")!;
    mockValidate.mockReturnValueOnce("格式错误");
    fireEvent.change(input, {
      target: { files: [new File(["bad"], "bad.txt", { type: "text/plain" })] },
    });
    expect(mockToastError).toHaveBeenCalledWith("格式错误");

    fireEvent.change(input, {
      target: { files: [new File(["ok"], "ok.png", { type: "image/png" })] },
    });
    await userEvent.click(screen.getByRole("button", { name: "移除图片" }));
    expect(screen.queryByRole("img", { name: "待发送图片预览" })).not.toBeInTheDocument();
  });

  test("失败后未改输入复用幂等键，修改正文后生成新键", async () => {
    const onSend = vi.fn().mockRejectedValue(new Error("网络错误"));
    render(<DirectMessageComposer onSend={onSend} />);
    const textarea = screen.getByPlaceholderText("输入消息…");
    fireEvent.change(textarea, { target: { value: "第一次" } });
    await userEvent.click(screen.getByRole("button", { name: "发送" }));
    await waitFor(() => expect(onSend).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(textarea).toHaveValue("第一次"));
    await userEvent.click(screen.getByRole("button", { name: "发送" }));
    await waitFor(() => expect(onSend).toHaveBeenCalledTimes(2));
    expect(onSend.mock.calls[0][0].clientRequestId).toBe(onSend.mock.calls[1][0].clientRequestId);

    fireEvent.change(textarea, { target: { value: "第二次" } });
    await userEvent.click(screen.getByRole("button", { name: "发送" }));
    await waitFor(() => expect(onSend).toHaveBeenCalledTimes(3));
    expect(onSend.mock.calls[2][0].clientRequestId).not.toBe(onSend.mock.calls[1][0].clientRequestId);
  });

  test("收藏表情作为独立消息发送，并在请求期间锁定编辑器", async () => {
    let resolveSend!: () => void;
    const onSend = vi.fn().mockReturnValue(new Promise<void>((resolve) => {
      resolveSend = resolve;
    }));
    render(<DirectMessageComposer onSend={onSend} />);

    await userEvent.click(screen.getByRole("button", { name: "测试表情" }));
    expect(onSend).toHaveBeenCalledWith({
      stickerAssetId: "sticker1",
      clientRequestId: "99454040-6a52-4bf3-8bad-42683c4d09be",
      optimisticSticker: expect.objectContaining({
        id: "sticker1",
        mediumUrl: null,
        contentType: null,
      }),
    });
    expect(screen.getByPlaceholderText("输入消息…")).toBeDisabled();
    expect(screen.getByRole("button", { name: "测试表情" })).toBeDisabled();

    resolveSend();
    await waitFor(() => expect(screen.getByPlaceholderText("输入消息…")).toBeEnabled());
  });

  test("disabled 状态禁用输入和发送", () => {
    render(<DirectMessageComposer onSend={vi.fn()} disabled />);
    expect(screen.getByPlaceholderText("输入消息…")).toBeDisabled();
    expect(screen.getByRole("button", { name: "发送" })).toBeDisabled();
  });
});
