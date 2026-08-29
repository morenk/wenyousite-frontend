import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { afterAll, afterEach, describe, expect, test, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { MilkdownEditor } from "@/components/editor/milkdown-editor-core";
import { server } from "@/test/msw/server";

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ user: null }),
}));

vi.mock("@/api/hooks/use-save-draft", () => ({
  useSaveDraft: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock("@/api/hooks/use-mention-candidates", () => ({
  useMentionCandidates: () => ({
    data: { users: [], canMentionAllPlayers: false },
    isFetching: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));

vi.mock("@/components/sticker/sticker-picker-popover", () => ({
  StickerPickerPopover: ({ disabled }: { disabled?: boolean }) => (
    <button type="button" disabled={disabled}>测试表情</button>
  ),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

type EditorProps = ComponentProps<typeof MilkdownEditor>;

function renderEditor(props: EditorProps = {}) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MilkdownEditor {...props} />
    </QueryClientProvider>,
  );
}

function enableMarkdownVersion(version: number) {
  server.use(http.get("*/api/v1/meta", () => HttpResponse.json({
    data: { markdownContractVersion: version },
  })));
}

async function getEditor(container: HTMLElement) {
  return waitFor(() => {
    const editor = container.querySelector<HTMLElement>(".ProseMirror");
    expect(editor).toBeInTheDocument();
    return editor!;
  });
}

function selectAll(editor: HTMLElement) {
  editor.focus();
  fireEvent.keyDown(editor, {
    key: "a",
    code: "KeyA",
    ctrlKey: true,
  });
}

function setCursor(block: HTMLElement, offset = 1) {
  const editor = block.closest<HTMLElement>(".ProseMirror");
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
  const text = walker.nextNode();
  if (!editor || !text) throw new Error("目标块没有可放置光标的文字");
  editor.focus();
  const range = document.createRange();
  range.setStart(text, Math.min(offset, text.textContent?.length ?? 0));
  range.collapse(true);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
  document.dispatchEvent(new Event("selectionchange"));
}

function blockWithText(editor: HTMLElement, text: string) {
  const block = Array.from(editor.querySelectorAll<HTMLElement>(":scope > p, :scope > h2, :scope > h3"))
    .find((candidate) => candidate.textContent === text);
  if (!block) throw new Error(`找不到正文块：${text}`);
  return block;
}

function clipboardData(values: { text?: string; html?: string }) {
  return {
    files: [],
    getData: (type: string) => {
      if (type === "text/plain") return values.text ?? "";
      if (type === "text/html") return values.html ?? "";
      return "";
    },
  };
}

async function makeToolbarCompact(toolbar: HTMLElement) {
  Object.defineProperty(toolbar, "clientWidth", { configurable: true, value: 320 });
  Object.defineProperty(toolbar, "scrollWidth", {
    configurable: true,
    get: () => toolbar.dataset.editorDensity === "expanded"
      ? 800
      : toolbar.dataset.editorDensity === "with-more"
        ? 380
        : toolbar.dataset.editorDensity === "without-draft"
          ? 340
          : 300,
  });
  fireEvent.resize(window);
  await waitFor(() => expect(toolbar).toHaveAttribute("data-editor-density", "compact"));
}

function alignmentMarkerCount(markdown: string, alignment?: "center" | "right") {
  const suffix = alignment ? `-${alignment}` : "-(?:center|right)";
  return markdown.match(new RegExp(`^\\[wenyousite-align-v1${suffix}\\]: #$`, "gmu"))
    ?.length ?? 0;
}

const blockKinds = [
  { id: "P", prefix: "", blockSelector: "p" },
  { id: "H2", prefix: "## ", blockSelector: "h2" },
  { id: "H3", prefix: "### ", blockSelector: "h3" },
] as const;

const markKinds = [
  { id: "bold", markSelector: "strong", source: (label: string) => `**${label}**` },
  { id: "italic", markSelector: "em", source: (label: string) => `*${label}*` },
  { id: "strike", markSelector: "del", source: (label: string) => `~~${label}~~` },
  { id: "code", markSelector: "code", source: (label: string) => `\`${label}\`` },
  {
    id: "link",
    markSelector: "a",
    source: (label: string) => `[${label}](https://example.com/${label})`,
  },
] as const;

const styleMatrix = blockKinds.flatMap((block) => markKinds.map((mark) => {
  const label = `${block.id}-${mark.id}`;
  return {
    ...block,
    ...mark,
    label,
    markdown: `${block.prefix}${mark.source(label)}`,
  };
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

afterAll(async () => {
  // Milkdown 的 ctx Timer 在 resolve 后仍保留 3 秒原生 timeout。
  await new Promise((resolve) => setTimeout(resolve, 3_100));
});

describe("Milkdown 段落对齐兼容性", () => {
  test("v3 在宽栏和窄栏都不暴露写入入口", async () => {
    enableMarkdownVersion(3);
    const { container } = renderEditor({ defaultValue: "兼容正文" });
    await getEditor(container);
    const toolbar = await screen.findByRole("toolbar", { name: "正文格式工具栏" });

    await waitFor(() => {
      expect(within(toolbar).queryByRole("button", { name: /对齐，点击切换/u })).toBeNull();
    });

    await makeToolbarCompact(toolbar);
    fireEvent.pointerDown(within(toolbar).getByRole("button", { name: "更多" }));
    const menu = await screen.findByRole("menu", { name: "更多正文格式" });
    expect(within(menu).queryByRole("group", { name: "段落对齐" })).toBeNull();
  });

  test("v4 工具栏提供水平语义，并可用左中右循环及动态可访问名称", async () => {
    enableMarkdownVersion(4);
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { container } = renderEditor({ defaultValue: "正文", onChange });
    const editor = await getEditor(container);
    const paragraph = editor.querySelector("p")!;
    const toolbar = await screen.findByRole("toolbar", { name: "正文格式工具栏" });
    const alignment = await within(toolbar).findByRole("button", {
      name: "左对齐，点击切换",
    });

    expect(toolbar).toHaveAttribute("aria-orientation", "horizontal");
    await user.click(paragraph);
    await user.click(alignment);
    await waitFor(() => {
      expect(editor.querySelector("p")).toHaveAttribute("data-wenyou-align", "center");
      expect(alignment).toHaveAccessibleName("居中对齐，点击切换");
      expect(onChange).toHaveBeenLastCalledWith(
        "[wenyousite-align-v1-center]: #\n正文",
      );
    });

    await user.click(alignment);
    await waitFor(() => {
      expect(editor.querySelector("p")).toHaveAttribute("data-wenyou-align", "right");
      expect(alignment).toHaveAccessibleName("右对齐，点击切换");
    });

    await user.click(alignment);
    await waitFor(() => {
      expect(editor.querySelector("p")).not.toHaveAttribute("data-wenyou-align");
      expect(alignment).toHaveAccessibleName("左对齐，点击切换");
      expect(onChange).toHaveBeenLastCalledWith("正文");
    });
  });

  test("光标跟随各块状态，混合多块选择按一次循环统一为居中", async () => {
    enableMarkdownVersion(4);
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { container } = renderEditor({
      defaultValue: ["左块", "中块", "右块"].join("\n\n"),
      onChange,
    });
    const editor = await getEditor(container);
    const alignment = await screen.findByRole("button", {
      name: "左对齐，点击切换",
    });

    setCursor(blockWithText(editor, "中块"));
    await waitFor(() => expect(alignment).toHaveAccessibleName("左对齐，点击切换"));
    await user.click(alignment);
    await waitFor(() => expect(alignment).toHaveAccessibleName("居中对齐，点击切换"));

    setCursor(blockWithText(editor, "右块"));
    await waitFor(() => expect(alignment).toHaveAccessibleName("左对齐，点击切换"));
    await user.click(alignment);
    await user.click(alignment);
    await waitFor(() => expect(alignment).toHaveAccessibleName("右对齐，点击切换"));

    setCursor(blockWithText(editor, "左块"));
    await waitFor(() => expect(alignment).toHaveAccessibleName("左对齐，点击切换"));
    setCursor(blockWithText(editor, "中块"));
    await waitFor(() => expect(alignment).toHaveAccessibleName("居中对齐，点击切换"));
    setCursor(blockWithText(editor, "右块"));
    await waitFor(() => expect(alignment).toHaveAccessibleName("右对齐，点击切换"));

    selectAll(editor);
    await waitFor(() => expect(alignment).toHaveAccessibleName("左对齐，点击切换"));
    await user.click(alignment);

    await waitFor(() => {
      for (const paragraph of ["左块", "中块", "右块"].map((text) => blockWithText(editor, text))) {
        expect(paragraph).toHaveAttribute("data-wenyou-align", "center");
      }
      const saved = onChange.mock.calls.at(-1)?.[0] as string;
      expect(alignmentMarkerCount(saved, "center")).toBe(3);
      expect(saved).not.toContain("wenyousite-align-v1-right");
    });
  });

  test("P/H2/H3 × 五种内联样式在左中右切换和保存后均保持", async () => {
    enableMarkdownVersion(4);
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { container } = renderEditor({
      defaultValue: styleMatrix.map((item) => item.markdown).join("\n\n"),
      onChange,
    });
    const editor = await getEditor(container);

    for (const item of styleMatrix) {
      const block = Array.from(editor.querySelectorAll<HTMLElement>(item.blockSelector))
        .find((candidate) => candidate.textContent === item.label);
      expect(block, item.label).not.toHaveAttribute("data-wenyou-align");
      expect(block?.querySelector(item.markSelector)).toHaveTextContent(item.label);
    }

    selectAll(editor);
    const alignment = await screen.findByRole("button", {
      name: "左对齐，点击切换",
    });
    await user.click(alignment);
    await waitFor(() => {
      expect(alignmentMarkerCount(onChange.mock.calls.at(-1)?.[0] as string, "center"))
        .toBe(styleMatrix.length);
    });
    await user.click(alignment);

    const saved = await waitFor(() => {
      const markdown = onChange.mock.calls.at(-1)?.[0] as string | undefined;
      expect(markdown).toBeTruthy();
      expect(alignmentMarkerCount(markdown!, "right")).toBe(styleMatrix.length);
      return markdown!;
    });
    for (const item of styleMatrix) {
      expect(saved).toContain(item.source(item.label));
    }
    for (const block of editor.querySelectorAll<HTMLElement>(":scope > p, :scope > h2, :scope > h3")) {
      if (block.textContent) expect(block).toHaveAttribute("data-wenyou-align", "right");
    }
  });

  test.each(["format-first", "alignment-first"] as const)(
    "%s：粗体与对齐的操作顺序不改变最终结构",
    async (order) => {
      enableMarkdownVersion(4);
      const user = userEvent.setup();
      const onChange = vi.fn();
      const { container } = renderEditor({ defaultValue: "顺序正文", onChange });
      const editor = await getEditor(container);
      const paragraph = editor.querySelector("p")!;
      const bold = await screen.findByRole("button", { name: "粗体" });
      const alignment = await screen.findByRole("button", {
        name: "左对齐，点击切换",
      });

      const applyBold = () => {
        selectAll(editor);
        fireEvent.pointerDown(bold);
      };
      const applyAlignment = async () => {
        await user.click(paragraph);
        await user.click(alignment);
      };

      if (order === "format-first") {
        applyBold();
        await applyAlignment();
      } else {
        await applyAlignment();
        applyBold();
      }

      await waitFor(() => {
        const current = blockWithText(editor, "顺序正文");
        expect(current).toHaveAttribute("data-wenyou-align", "center");
        expect(current.querySelector("strong")).toHaveTextContent("顺序正文");
        expect(onChange).toHaveBeenLastCalledWith(
          "[wenyousite-align-v1-center]: #\n**顺序正文**",
        );
      });
    },
  );

  test("提及、骰子与收藏表情作为行内原子随块对齐且身份不受切换影响", async () => {
    enableMarkdownVersion(4);
    const user = userEvent.setup();
    const onChange = vi.fn();
    const diceId = "550e8400-e29b-41d4-a716-446655440000";
    const source = `[@张三](/users/user-zhang) [[dice:v1:${diceId}:1d20]] ![表情](https://cdn.example.com/stickers/a.webp \"wenyousite-sticker:v1:cm1234567890123456789012\")`;
    const { container } = renderEditor({
      defaultValue: source,
      onChange,
      threadId: "thread-1",
    });
    const editor = await getEditor(container);
    const paragraph = editor.querySelector("p")!;
    const alignment = await screen.findByRole("button", { name: "左对齐，点击切换" });

    expect(paragraph).not.toHaveAttribute("data-wenyou-align");
    await waitFor(() => {
      expect(editor.querySelector('[data-slot="mention-link"]')).toHaveTextContent("@张三");
    });
    expect(paragraph.querySelector('[data-type="dice_inline"]')).toHaveAttribute(
      "data-node-id",
      diceId,
    );
    expect(paragraph.querySelector('img[data-type="sticker-inline"]')).toHaveAttribute(
      "data-asset-id",
      "cm1234567890123456789012",
    );

    await user.click(paragraph);
    await user.click(alignment);
    await user.click(alignment);
    await waitFor(() => {
      expect(editor.querySelector("p")).toHaveAttribute("data-wenyou-align", "right");
      const saved = onChange.mock.calls.at(-1)?.[0] as string;
      expect(saved).toContain("[wenyousite-align-v1-right]: #");
      expect(saved).toContain("[@张三](/users/user-zhang)");
      expect(saved).toContain(`[[dice:v1:${diceId}:1d20]]`);
      expect(saved).toContain("wenyousite-sticker:v1:cm1234567890123456789012");
    });
  });

  test("全选只对齐合格顶层正文，列表、引用、普通图片、分隔线、空段均不泄漏属性", async () => {
    enableMarkdownVersion(4);
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { container } = renderEditor({
      defaultValue: [
        "合格正文",
        "> 引用正文",
        "- 列表正文",
        '![1.50](https://cdn.example.com/images/a.webp "地图")',
        "---",
        "<br />",
      ].join("\n\n"),
      onChange,
      onUploadImage: vi.fn(),
    });
    const editor = await getEditor(container);
    selectAll(editor);
    await user.click(await screen.findByRole("button", {
      name: "左对齐，点击切换",
    }));

    await waitFor(() => {
      const ordinary = Array.from(editor.querySelectorAll(":scope > p"))
        .find((paragraph) => paragraph.textContent === "合格正文");
      expect(ordinary).toHaveAttribute("data-wenyou-align", "center");
      expect(editor.querySelector("blockquote [data-wenyou-align]")).toBeNull();
      expect(editor.querySelector("li [data-wenyou-align]")).toBeNull();
      expect(editor.querySelector("[data-type='image-block'][data-wenyou-align]")).toBeNull();
      expect(editor.querySelector("hr[data-wenyou-align]")).toBeNull();
      for (const empty of Array.from(editor.querySelectorAll(":scope > p"))
        .filter((paragraph) => !(paragraph.textContent ?? "").trim())) {
        expect(empty).not.toHaveAttribute("data-wenyou-align");
      }
      const saved = onChange.mock.calls.at(-1)?.[0] as string;
      expect(alignmentMarkerCount(saved)).toBe(1);
    });
  });

  test("纯空段和含普通图片的段落均拒绝对齐事务", async () => {
    enableMarkdownVersion(4);
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { container } = renderEditor({
      defaultValue: "<br />\n\n图前 ![图](https://cdn.example.com/a.png) 图后",
      onChange,
    });
    const editor = await getEditor(container);
    const alignment = await screen.findByRole("button", {
      name: "左对齐，点击切换",
    });
    const paragraphs = Array.from(editor.querySelectorAll(":scope > p"));

    for (const paragraph of paragraphs) {
      await user.click(paragraph);
      await user.click(alignment);
      expect(paragraph).not.toHaveAttribute("data-wenyou-align");
    }
    expect(onChange).not.toHaveBeenCalled();
  });

  test("P/H2/H3 互转保留对齐，转列表后自动清除", async () => {
    enableMarkdownVersion(4);
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { container } = renderEditor({
      defaultValue: "转换正文",
      onChange,
    });
    const editor = await getEditor(container);
    await user.click(editor.querySelector("p")!);
    await user.click(await screen.findByRole("button", { name: "左对齐，点击切换" }));
    await waitFor(() => {
      expect(editor.querySelector(":scope > p")).toHaveAttribute("data-wenyou-align", "center");
    });

    for (const option of ["标题 2", "标题 3", "正文"]) {
      const current = editor.querySelector<HTMLElement>(":scope > p, :scope > h2, :scope > h3")!;
      await user.click(current);
      await user.click(screen.getByRole("button", { name: "切换正文样式" }));
      await user.click(await screen.findByRole("button", { name: option }));
      await waitFor(() => {
        const converted = editor.querySelector<HTMLElement>(":scope > p, :scope > h2, :scope > h3");
        expect(converted).toHaveAttribute("data-wenyou-align", "center");
      });
    }

    fireEvent.pointerDown(screen.getByRole("button", { name: "无序列表" }));
    await waitFor(() => {
      expect(editor.querySelector("li p")).not.toHaveAttribute("data-wenyou-align");
      expect(onChange.mock.calls.at(-1)?.[0]).not.toContain("wenyousite-align");
    });
  });

  test("对齐正文转引用后自动清除协议外属性", async () => {
    enableMarkdownVersion(4);
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { container } = renderEditor({ defaultValue: "引用转换正文", onChange });
    const editor = await getEditor(container);
    await user.click(editor.querySelector("p")!);
    await user.click(await screen.findByRole("button", { name: "左对齐，点击切换" }));
    fireEvent.pointerDown(screen.getByRole("button", { name: "引用" }));

    await waitFor(() => {
      expect(editor.querySelector("blockquote p")).not.toHaveAttribute("data-wenyou-align");
      expect(onChange.mock.calls.at(-1)?.[0]).not.toContain("wenyousite-align");
    });
  });

  test("对齐自身可撤销重做，且粗体 mark 在历史往返中保持", async () => {
    enableMarkdownVersion(4);
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { container } = renderEditor({ defaultValue: "**历史正文**", onChange });
    const editor = await getEditor(container);
    const paragraph = editor.querySelector("p")!;
    await user.click(paragraph);
    await user.click(await screen.findByRole("button", {
      name: "左对齐，点击切换",
    }));
    await waitFor(() => {
      expect(editor.querySelector("p")).toHaveAttribute("data-wenyou-align", "center");
    });

    fireEvent.keyDown(editor, { key: "z", code: "KeyZ", ctrlKey: true });
    await waitFor(() => {
      expect(editor.querySelector("p")).not.toHaveAttribute("data-wenyou-align");
      expect(editor.querySelector("p strong")).toHaveTextContent("历史正文");
      expect(onChange).toHaveBeenLastCalledWith("**历史正文**");
    });

    fireEvent.keyDown(editor, {
      key: "z",
      code: "KeyZ",
      ctrlKey: true,
      shiftKey: true,
    });
    await waitFor(() => {
      expect(editor.querySelector("p")).toHaveAttribute("data-wenyou-align", "center");
      expect(editor.querySelector("p strong")).toHaveTextContent("历史正文");
      expect(onChange).toHaveBeenLastCalledWith(
        "[wenyousite-align-v1-center]: #\n**历史正文**",
      );
    });
  });

  test("编辑器复制对齐块写出 v2 与样式 HTML，纯文本不泄漏协议标记", async () => {
    enableMarkdownVersion(4);
    const { container } = renderEditor({
      defaultValue: "**粗体** 和 [帮助](https://wenyou.site/help)",
    });
    const editor = await getEditor(container);
    setCursor(editor.querySelector("p")!);
    fireEvent.pointerDown(await screen.findByRole("button", { name: "左对齐，点击切换" }));
    await waitFor(() => {
      expect(editor.querySelector("p")).toHaveAttribute("data-wenyou-align", "center");
    });
    selectAll(editor);
    const written = new Map<string, string>();

    fireEvent.copy(editor, {
      clipboardData: {
        clearData: () => written.clear(),
        setData: (type: string, value: string) => written.set(type, value),
      },
    });

    expect(written.get("text/html")).toContain('data-wenyou-clipboard="2"');
    expect(written.get("text/html")).toContain('data-wenyou-clipboard-source="editor"');
    expect(written.get("text/html")).toContain('data-wenyou-align="center"');
    expect(written.get("text/html")).toContain("<strong>粗体</strong>");
    expect(written.get("text/html")).toContain("https://wenyou.site/help");
    expect(written.get("text/plain")).toBe("粗体 和 帮助");
    expect(written.get("text/plain")).not.toContain("wenyousite-align");
  });

  test("v2 粘贴仅恢复合法顶层 P/H2/H3 对齐并保留内联样式", async () => {
    const onChange = vi.fn();
    const { container } = renderEditor({ defaultValue: "", onChange });
    const editor = await getEditor(container);
    fireEvent.paste(editor, {
      clipboardData: clipboardData({
        text: "居中粗体\n居右标题\n居中代码\n嵌套引用\n[图片]",
        html: [
          '<div data-wenyou-clipboard="2" data-wenyou-clipboard-source="reader">',
          '<p data-wenyou-align="center"><strong>居中粗体</strong></p>',
          '<h2 data-wenyou-align="right"><em>居右标题</em></h2>',
          '<h3 data-wenyou-align="center"><code>居中代码</code></h3>',
          '<blockquote><p data-wenyou-align="right"><del>嵌套引用</del></p></blockquote>',
          "</div>",
        ].join(""),
      }),
    });

    await waitFor(() => {
      const centered = Array.from(editor.querySelectorAll(":scope > p"))
        .find((block) => block.textContent === "居中粗体");
      expect(centered).toHaveAttribute("data-wenyou-align", "center");
      expect(centered?.querySelector("strong")).toHaveTextContent("居中粗体");
      expect(editor.querySelector(":scope > h2")).toHaveAttribute("data-wenyou-align", "right");
      expect(editor.querySelector(":scope > h2 em")).toHaveTextContent("居右标题");
      expect(editor.querySelector(":scope > h3")).toHaveAttribute("data-wenyou-align", "center");
      expect(editor.querySelector(":scope > h3 code")).toHaveTextContent("居中代码");
      expect(editor.querySelector("blockquote p")).not.toHaveAttribute("data-wenyou-align");
      expect(editor.querySelector("blockquote del")).toHaveTextContent("嵌套引用");
      const saved = onChange.mock.calls.at(-1)?.[0] as string;
      expect(alignmentMarkerCount(saved)).toBe(3);
      expect(saved).toContain("**居中粗体**");
      expect(saved).toContain("## *居右标题*");
      expect(saved).toContain("### `居中代码`");
      expect(saved).toContain("> ~~嵌套引用~~");
    });
  });

  test.each([
    {
      label: "v1 envelope",
      html: '<div data-wenyou-clipboard="1" data-wenyou-clipboard-source="reader"><p data-wenyou-align="right">旧片段</p></div>',
      text: "旧片段",
    },
    {
      label: "外部 CSS/align",
      html: '<p style="text-align:center" align="right" data-wenyou-align="center">外部片段</p>',
      text: "外部片段",
    },
  ])("$label 不能创建对齐", async ({ html, text }) => {
    const onChange = vi.fn();
    const { container } = renderEditor({ defaultValue: "", onChange });
    const editor = await getEditor(container);
    fireEvent.paste(editor, { clipboardData: clipboardData({ html, text }) });

    await waitFor(() => expect(editor).toHaveTextContent(text));
    expect(editor.querySelector("[data-wenyou-align]")).toBeNull();
    expect(onChange.mock.calls.at(-1)?.[0]).not.toContain("wenyousite-align");
  });

  test("窄栏三枚 radio 具有完整 ARIA 状态并支持键盘选择", async () => {
    enableMarkdownVersion(4);
    const user = userEvent.setup();
    const { container } = renderEditor({ defaultValue: "键盘正文" });
    const editor = await getEditor(container);
    const toolbar = await screen.findByRole("toolbar", { name: "正文格式工具栏" });
    await user.click(editor.querySelector("p")!);
    await makeToolbarCompact(toolbar);
    fireEvent.pointerDown(within(toolbar).getByRole("button", { name: "更多" }));

    const menu = await screen.findByRole("menu", { name: "更多正文格式" });
    const group = within(menu).getByRole("group", { name: "段落对齐" });
    const left = within(group).getByRole("menuitemradio", { name: "左对齐" });
    const center = within(group).getByRole("menuitemradio", { name: "居中对齐" });
    const right = within(group).getByRole("menuitemradio", { name: "右对齐" });
    expect(left).toHaveAttribute("aria-checked", "true");
    expect(center).toHaveAttribute("aria-checked", "false");
    expect(right).toHaveAttribute("aria-checked", "false");

    center.focus();
    await user.keyboard("{Enter}");
    await waitFor(() => {
      expect(editor.querySelector("p")).toHaveAttribute("data-wenyou-align", "center");
      expect(screen.queryByRole("menu", { name: "更多正文格式" })).toBeNull();
    });
  });

  test("编辑器就绪后切换禁用态会关闭输入和格式入口", async () => {
    enableMarkdownVersion(4);
    const client = new QueryClient();
    const onChange = vi.fn();
    const view = render(
      <QueryClientProvider client={client}>
        <MilkdownEditor defaultValue="动态只读正文" onChange={onChange} />
      </QueryClientProvider>,
    );
    const { container } = view;
    const editor = await getEditor(container);
    await screen.findByRole("toolbar", { name: "正文格式工具栏" });

    view.rerender(
      <QueryClientProvider client={client}>
        <MilkdownEditor defaultValue="动态只读正文" disabled onChange={onChange} />
      </QueryClientProvider>,
    );

    await waitFor(() => expect(editor).toHaveAttribute("contenteditable", "false"));
    expect(screen.queryByRole("toolbar", { name: "正文格式工具栏" })).toBeNull();
    expect(screen.getByRole("button", { name: "测试表情" })).toBeDisabled();
    fireEvent.keyDown(editor, { key: "a", code: "KeyA" });
    expect(onChange).not.toHaveBeenCalled();
  });
});
