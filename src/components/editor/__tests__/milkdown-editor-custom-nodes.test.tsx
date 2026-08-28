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
  readFileSync(resolve(process.cwd(), "contracts/markdown-v3-nodes-fixtures.json"), "utf8"),
) as { cases: Array<{ id: string; markdown: string; serialized: string }> };
const editorRoundTripFixtures = JSON.parse(
  readFileSync(
    resolve(process.cwd(), "contracts/markdown-editor-roundtrip-v5-fixtures.json"),
    "utf8",
  ),
) as { cases: Array<{ id: string; markdown: string; serialized: string }> };

const attentionBoundarySelectors = {
  "attention-boundary-bold-live-content": "strong",
  "attention-boundary-italic": "em",
  "attention-boundary-nested-emphasis": "em strong",
  "attention-boundary-strikethrough": "del",
  "attention-boundary-underscore-italic": "em",
  "attention-boundary-underscore-bold": "strong",
  "attention-boundary-underscore-nested": "em strong",
} as const;

function editorRoundTripFixture(id: string) {
  return editorRoundTripFixtures.cases.find((item) => item.id === id)!;
}

function renderEditor(props: React.ComponentProps<typeof MilkdownEditor>) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MilkdownEditor {...props} />
    </QueryClientProvider>,
  );
}

function clipboardData(values: { text: string; html: string }) {
  return {
    getData: (type: string) => {
      if (type === "text/plain") return values.text;
      if (type === "text/html") return values.html;
      return "";
    },
  };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("MilkdownEditor 自定义内联节点", () => {
  test("规范分隔线重开为真实块节点并按 v5 原样写回", async () => {
    const fixture = editorRoundTripFixture("horizontal-rule");
    const onChange = vi.fn();
    const user = userEvent.setup();
    const { container } = renderEditor({ defaultValue: fixture.markdown, onChange });
    const editor = await waitFor(() => {
      const element = container.querySelector<HTMLElement>(".ProseMirror");
      expect(element).toBeInTheDocument();
      return element!;
    });

    expect(editor.querySelector("hr")).toBeInTheDocument();
    const trailingParagraph = editor.querySelectorAll("p").item(1);
    await user.type(trailingParagraph, "临");
    await user.keyboard("{Backspace}");

    await waitFor(() => {
      expect(onChange.mock.calls.at(-1)?.[0]).toBe(fixture.serialized);
    });
  });

  test("历史 Setext H2 重开后编辑保存为 ATX H2", async () => {
    const fixture = editorRoundTripFixture("setext-heading-2");
    const onChange = vi.fn();
    const user = userEvent.setup();
    const { container } = renderEditor({ defaultValue: fixture.markdown, onChange });
    const heading = await waitFor(() => {
      const element = container.querySelector<HTMLHeadingElement>(".ProseMirror h2");
      expect(element).toHaveTextContent("正文");
      return element!;
    });

    expect(container.querySelector(".ProseMirror hr")).toBeNull();
    await user.type(heading, "临");
    await user.keyboard("{Backspace}");

    await waitFor(() => {
      expect(onChange.mock.calls.at(-1)?.[0]).toBe(fixture.serialized);
    });
  });

  test.each(Object.entries(attentionBoundarySelectors))(
    "%s 从歧义源码恢复真实 mark 并安全写回",
    async (id, selector) => {
      const fixture = editorRoundTripFixture(id);
      const onChange = vi.fn();
      const user = userEvent.setup();
      const { container } = renderEditor({ defaultValue: fixture.markdown, onChange });
      const editor = await waitFor(() => {
        const element = container.querySelector<HTMLElement>(".ProseMirror");
        expect(element?.querySelector(selector)).toBeInTheDocument();
        return element!;
      });

      onChange.mockClear();
      await user.type(editor.querySelector("p")!, "临");
      await user.keyboard("{Backspace}");

      await waitFor(() => {
        expect(onChange.mock.calls.at(-1)?.[0]).toBe(fixture.serialized);
      });
    },
  );

  test("v5 规范粗体输出重开后保持幂等", async () => {
    const fixture = editorRoundTripFixture("attention-boundary-bold-live-content");
    const onChange = vi.fn();
    const user = userEvent.setup();
    const { container } = renderEditor({ defaultValue: fixture.serialized, onChange });
    const paragraph = await waitFor(() => {
      const element = container.querySelector<HTMLElement>(".ProseMirror p");
      expect(element?.querySelector("strong")).toHaveTextContent(
        "【注意注意！并不是真的AI！DeerSeek就是我！】",
      );
      return element!;
    });

    onChange.mockClear();
    await user.type(paragraph, "临");
    await user.keyboard("{Backspace}");
    await waitFor(() => {
      expect(onChange.mock.calls.at(-1)?.[0]).toBe(fixture.serialized);
    });
  });

  test("已保存的普通软换行重开后仍显示为编辑器换行节点", async () => {
    const { container } = renderEditor({ defaultValue: "**阿罗**\n下一行" });
    const editor = await waitFor(() => {
      const element = container.querySelector<HTMLElement>(".ProseMirror");
      expect(element).toBeInTheDocument();
      return element!;
    });

    expect(editor.querySelector('br[data-type="hardbreak"]')).toBeInTheDocument();
  });

  test("粗体末尾软换行同步为普通 LF，不泄漏星号或反斜杠", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    const { container } = renderEditor({ defaultValue: "", onChange });
    const editor = await waitFor(() => {
      const element = container.querySelector<HTMLElement>(".ProseMirror");
      expect(element).toBeInTheDocument();
      return element!;
    });

    await user.click(editor);
    fireEvent.pointerDown(await screen.findByRole("button", { name: "粗体" }));
    await user.type(editor, "阿罗");
    await user.keyboard("{Shift>}{Enter}{/Shift}下一行");

    await waitFor(() => {
      expect(onChange.mock.calls.at(-1)?.[0]).toBe("**阿罗**\n下一行");
    });
    expect(onChange.mock.calls.at(-1)?.[0]).not.toContain("\\\n");
  });

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

  test("编辑器复制保留表情节点但纯文本只写可见标签", async () => {
    const fixture = nodeFixtures.cases.find((item) => item.id === "sticker-round-trip")!;
    const { container } = renderEditor({ defaultValue: `前 ${fixture.markdown} 后` });
    const editor = await waitFor(() => {
      const element = container.querySelector<HTMLElement>(".ProseMirror");
      expect(element?.querySelector('[data-type="sticker-inline"]')).toBeInTheDocument();
      return element!;
    });
    fireEvent.keyDown(editor, { key: "a", code: "KeyA", ctrlKey: true });
    const written = new Map<string, string>();

    fireEvent.copy(editor, {
      clipboardData: {
        clearData: () => written.clear(),
        setData: (type: string, value: string) => written.set(type, value),
      },
    });

    expect(written.get("text/html")).toContain('data-type="sticker-inline"');
    expect(written.get("text/html")).toContain('data-asset-id="cm1234567890123456789012"');
    expect(written.get("text/plain")).toBe("前 [表情] 后");
    expect(written.get("text/plain")).not.toContain("cdn.example.com");
  });

  test("编辑器复制保留图片块但纯文本只写图片标签", async () => {
    const { container } = renderEditor({
      defaultValue: '![1.50](https://cdn.example.com/images/a.webp "地图")',
      onUploadImage: vi.fn(),
    });
    const editor = await waitFor(() => {
      const element = container.querySelector<HTMLElement>(".ProseMirror");
      expect(element?.querySelector('[data-type="image-block"]')).toBeInTheDocument();
      return element!;
    });
    fireEvent.keyDown(editor, { key: "a", code: "KeyA", ctrlKey: true });
    const written = new Map<string, string>();

    fireEvent.copy(editor, {
      clipboardData: {
        clearData: () => written.clear(),
        setData: (type: string, value: string) => written.set(type, value),
      },
    });

    expect(written.get("text/html")).toContain('data-type="image-block"');
    expect(written.get("text/html")).toContain('caption="地图"');
    expect(written.get("text/plain")).toBe("[图片]");
    expect(written.get("text/plain")).not.toContain("cdn.example.com");
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

  test("阅读态片段粘贴保留原子语义、媒体标签化且骰子生成新身份", async () => {
    const oldDiceId = "550e8400-e29b-41d4-a716-446655440000";
    const onChange = vi.fn();
    const { container } = renderEditor({
      defaultValue: "",
      onChange,
      threadId: "thread-1",
    });
    const editor = await waitFor(() => {
      const element = container.querySelector<HTMLElement>(".ProseMirror");
      expect(element).toBeInTheDocument();
      return element!;
    });

    fireEvent.paste(editor, {
      clipboardData: clipboardData({
        text: "传送门 @张三 @全体玩家 1d20+2 = ? [表情] [图片]",
        html: [
          '<div data-wenyou-clipboard="1" data-wenyou-clipboard-source="reader">',
          '<p><a href="/threads/cmsewdo0h000x7qv6aa77ll1v">传送门</a> ',
          '<a href="/users/user-zhang">@张三</a> @全体玩家 ',
          `<span data-type="dice_inline" data-node-id="${oldDiceId}" data-notation="1d20+2">1d20+2 = 99</span> `,
          "[表情] [图片]</p></div>",
        ].join(""),
      }),
    });

    const dice = await waitFor(() => {
      const element = editor.querySelector<HTMLElement>('[data-type="dice_inline"]');
      expect(element).toBeInTheDocument();
      return element!;
    });
    expect(editor.querySelector('[data-slot="internal-reference-link"]'))
      .toHaveTextContent("传送门");
    expect(editor.querySelector('[data-slot="mention-link"]')).toHaveTextContent("@张三");
    expect(editor).toHaveTextContent("@全体玩家");
    expect(editor).toHaveTextContent("[表情] [图片]");
    expect(editor.querySelector("img")).toBeNull();
    expect(dice.dataset.nodeId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu,
    );
    expect(dice.dataset.nodeId).not.toBe(oldDiceId);
    expect(dice).toHaveTextContent("1d20+2 = ?");

    await waitFor(() => {
      const markdown = onChange.mock.calls.at(-1)?.[0] as string | undefined;
      expect(markdown).toContain("[传送门](/threads/cmsewdo0h000x7qv6aa77ll1v)");
      expect(markdown).toContain("[@张三](/users/user-zhang)");
      expect(markdown).toContain("@全体玩家");
      expect(markdown).toContain(
        `[[dice:v1:${dice.dataset.nodeId}:1d20+2]]`,
      );
      expect(markdown).toContain("\\[表情] \\[图片]");
      expect(markdown).not.toContain(oldDiceId);
      expect(markdown).not.toContain("1d20+2 = 99");
    });
  });

  test("编辑器来源片段粘贴继续保留表情与站内图片节点", async () => {
    const onChange = vi.fn();
    const { container } = renderEditor({
      defaultValue: "",
      onChange,
      onUploadImage: vi.fn(),
    });
    const editor = await waitFor(() => {
      const element = container.querySelector<HTMLElement>(".ProseMirror");
      expect(element).toBeInTheDocument();
      return element!;
    });

    fireEvent.paste(editor, {
      clipboardData: clipboardData({
        text: "前 [表情] 后\n\n[图片]",
        html: [
          '<div data-wenyou-clipboard="1" data-wenyou-clipboard-source="editor">',
          '<p>前 <img data-type="sticker-inline" data-asset-id="cm1234567890123456789012" ',
          'src="https://cdn.example.com/stickers/a.webp" alt="表情"> 后</p>',
          '<img data-type="image-block" src="https://cdn.example.com/images/a.webp" ',
          'caption="地图" ratio="1.5"></div>',
        ].join(""),
      }),
    });

    await waitFor(() => {
      expect(editor.querySelector('img[data-type="sticker-inline"]')).toBeInTheDocument();
      expect(editor.querySelector('img[data-type="image-block"]')).toBeInTheDocument();
    });
    const markdown = await waitFor(() => {
      const markdown = onChange.mock.calls.at(-1)?.[0] as string | undefined;
      expect(markdown).toContain(
        '![表情](https://cdn.example.com/stickers/a.webp "wenyousite-sticker:v1:cm1234567890123456789012")',
      );
      expect(markdown).toContain("![1.50](https://cdn.example.com/images/a.webp \"地图\")");
      return markdown!;
    });
    expect(markdown).toBeTruthy();
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
