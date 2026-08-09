import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import { MilkdownEditor } from "@/components/editor/milkdown-editor-core";
import type { UploadImageOptions } from "@/lib/upload-image";

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ user: null }),
}));

vi.mock("@/api/hooks/use-save-draft", () => ({
  useSaveDraft: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock("@/api/hooks/use-mention-candidates", () => ({
  useMentionCandidates: () => ({
    data: {
      users: [{ id: "user-2", username: "小明", avatar: null, relation: "FOLLOWING" }],
      canMentionAllPlayers: true,
    },
    isFetching: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));

vi.mock("@/components/sticker/sticker-picker-popover", () => ({
  StickerPickerPopover: ({
    onSelect,
  }: {
    onSelect: (sticker: { asset: { id: string; url: string } }) => unknown;
  }) => (
    <button
      type="button"
      onClick={() => onSelect({
        asset: {
          id: "c12345678901234567890",
          url: "https://cdn.example.com/stickers/test.webp",
        },
      })}
    >
      插入测试表情
    </button>
  ),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const nodeFixtures = JSON.parse(
  readFileSync(resolve(process.cwd(), "contracts/markdown-v2-nodes-fixtures.json"), "utf8"),
) as { cases: Array<{ id: string; markdown: string; serialized: string }> };

function renderEditor(props: React.ComponentProps<typeof MilkdownEditor>) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MilkdownEditor {...props} />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("MilkdownEditor 自定义内联节点", () => {
  test("表情黄金样例经编辑器解析后可序列化往返", async () => {
    const fixture = nodeFixtures.cases.find((item) => item.id === "sticker-round-trip")!;
    const onChange = vi.fn();
    const user = userEvent.setup();
    const { container } = renderEditor({ defaultValue: fixture.markdown, onChange });

    const sticker = await waitFor(() => {
      const node = container.querySelector<HTMLImageElement>('img[data-type="sticker-inline"]');
      expect(node).toBeInTheDocument();
      return node!;
    });
    expect(sticker.dataset.assetId).toBe("cm1234567890123456789012");

    await user.click(container.querySelector<HTMLElement>(".ProseMirror")!);
    await user.type(container.querySelector<HTMLElement>(".ProseMirror")!, " ");

    await waitFor(() => expect(onChange).toHaveBeenCalled());
    expect(onChange.mock.calls.at(-1)?.[0]).toContain(fixture.serialized);
  });

  test("插入收藏表情后立即同步版本化 Markdown", async () => {
    const onChange = vi.fn();
    renderEditor({ defaultValue: "正文", onChange });

    await userEvent.setup().click(await screen.findByRole("button", { name: "插入测试表情" }));

    expect(onChange).toHaveBeenCalled();
    expect(onChange.mock.calls.at(-1)?.[0]).toContain(
      '![表情](https://cdn.example.com/stickers/test.webp "wenyousite-sticker:v1:c12345678901234567890")',
    );
  });

  test("选择单人提及后立即同步稳定用户链接", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { container } = renderEditor({ defaultValue: "", onChange, threadId: "thread-1" });
    const editor = await waitFor(() => {
      const element = container.querySelector<HTMLElement>(".ProseMirror");
      expect(element).toBeInTheDocument();
      return element!;
    });

    await user.click(editor);
    await user.type(editor, "@");
    const candidate = await screen.findByRole("option", { name: /@小明/u });
    onChange.mockClear();
    await user.click(candidate);

    expect(onChange).toHaveBeenCalled();
    expect(onChange.mock.calls.at(-1)?.[0]).toContain("[@小明](/users/user-2)");
  });

  test("工具栏图片上传完成后立即同步 Markdown", async () => {
    const onChange = vi.fn();
    let finishUpload: ((url: string) => void) | undefined;
    const onUploadImage = vi.fn((_file: File, options?: UploadImageOptions) => new Promise<string>((resolve) => {
      options?.onProgress?.({
        stage: "uploading",
        loadedBytes: 1 * 1024 * 1024,
        totalBytes: 2 * 1024 * 1024,
        percent: 50,
      });
      finishUpload = resolve;
    }));
    const file = new File(["image"], "test.png", { type: "image/png" });
    vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(function (
      this: HTMLInputElement,
    ) {
      Object.defineProperty(this, "files", { configurable: true, value: [file] });
      this.onchange?.(new Event("change"));
    });
    renderEditor({ defaultValue: "正文", onChange, onUploadImage });

    fireEvent.pointerDown(await screen.findByRole("button", { name: "图片" }));
    expect(onUploadImage).toHaveBeenCalledWith(file, expect.objectContaining({
      signal: expect.any(AbortSignal),
      onProgress: expect.any(Function),
    }));
    expect(await screen.findByText("1.0 MB / 2.0 MB")).toBeInTheDocument();
    onChange.mockClear();

    await act(async () => {
      finishUpload?.("https://cdn.example.com/uploads/test.png");
      await Promise.resolve();
    });

    expect(onChange).toHaveBeenCalled();
    expect(onChange.mock.calls.at(-1)?.[0]).toContain(
      "![1.00](https://cdn.example.com/uploads/test.png)",
    );
  });
});
