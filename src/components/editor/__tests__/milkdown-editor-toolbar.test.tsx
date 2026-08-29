import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { toast } from "sonner";
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

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

interface ClipboardGoldenCase {
  id: string;
  kind: string;
  plainText?: string;
  html?: string;
  expectedText?: string;
  expectedHref?: string;
  expectedLabel?: string;
}

const clipboardGoldenCases = (JSON.parse(
  readFileSync(
    resolve(process.cwd(), "contracts/editor-clipboard-v2-fixtures.json"),
    "utf8",
  ),
) as { goldenCases: ClipboardGoldenCase[] }).goldenCases;

function clipboardGoldenCase(id: string) {
  const fixture = clipboardGoldenCases.find((item) => item.id === id);
  if (!fixture) throw new Error(`缺少剪贴板黄金用例：${id}`);
  return fixture;
}

function renderEditor(defaultValue = "", ariaLabel?: string, onChange?: (value: string) => void) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MilkdownEditor
        defaultValue={defaultValue}
        onChange={onChange}
        onUploadImage={vi.fn()}
        ariaLabel={ariaLabel}
      />
    </QueryClientProvider>,
  );
}

function enableMarkdownV4() {
  server.use(http.get("*/api/v1/meta", () => HttpResponse.json({
    data: { markdownContractVersion: 4 },
  })));
}

function clipboardData(values: { text?: string; html?: string }) {
  return {
    getData: (type: string) => {
      if (type === "text/plain") return values.text ?? "";
      if (type === "text/html") return values.html ?? "";
      return "";
    },
  };
}

async function getEditor(container: HTMLElement) {
  return waitFor(() => {
    const element = container.querySelector<HTMLElement>(".ProseMirror");
    expect(element).toBeInTheDocument();
    return element!;
  });
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

async function makeToolbarStandard(toolbar: HTMLElement) {
  Object.defineProperty(toolbar, "clientWidth", { configurable: true, value: 400 });
  Object.defineProperty(toolbar, "scrollWidth", {
    configurable: true,
    get: () => toolbar.dataset.editorDensity === "expanded" ? 800 : 380,
  });
  fireEvent.resize(window);
  await waitFor(() => expect(toolbar).toHaveAttribute("data-editor-density", "with-more"));
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

afterAll(async () => {
  // Milkdown 7 的 ctx Timer 在 resolve 后仍保留 3 秒原生 timeout；让它在
  // happy-dom 移除全局事件 API 前完成，避免第三方清理回调越过测试环境生命周期。
  await new Promise((resolve) => setTimeout(resolve, 3_100));
});

describe("MilkdownEditor 能力分层", () => {
  test("重开时逐个恢复连续空段，编辑后仍按相同数量序列化", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { container } = renderEditor(
      "第一段\n\n<br />\n<br />\n<br />\n\n第二段",
      "楼层正文",
      onChange,
    );
    const editor = await getEditor(container);
    const paragraphs = editor.querySelectorAll(":scope > p");

    expect(paragraphs).toHaveLength(5);
    expect([...paragraphs].map((paragraph) => paragraph.textContent)).toEqual([
      "第一段",
      "",
      "",
      "",
      "第二段",
    ]);

    await user.click(paragraphs[4]!);
    await user.type(paragraphs[4]!, "补充");
    await waitFor(() => {
      const value = onChange.mock.calls.at(-1)?.[0] as string | undefined;
      expect(value?.match(/^<br \/>$/gmu)).toHaveLength(3);
      expect(value).toContain("第二段补充");
    });
  });

  test("重开历史正文时把原始多余空行恢复为可编辑空段", async () => {
    const { container } = renderEditor("第一段\n\n\n\n第二段", "历史楼层正文");
    const editor = await getEditor(container);
    const paragraphs = editor.querySelectorAll(":scope > p");

    expect(paragraphs).toHaveLength(4);
    expect([...paragraphs].map((paragraph) => paragraph.textContent)).toEqual([
      "第一段",
      "",
      "",
      "第二段",
    ]);
  });

  test("正文输入区提供可配置的可访问名称", async () => {
    const { container } = renderEditor("正文", "主帖正文");

    expect(await getEditor(container)).toHaveAttribute("aria-label", "主帖正文");
    expect(screen.queryByText("仅工具栏中的格式会作为正文结构")).toBeNull();
  });

  test("表情入口位于正文滚动区外的编辑器底栏", async () => {
    const { container } = renderEditor("正文");
    const editor = await getEditor(container);
    const stickerButton = await screen.findByRole("button", { name: "表情" });
    const editorHost = container.querySelector<HTMLElement>(".milkdown-editor");
    const footer = container.querySelector<HTMLElement>(
      '[data-slot="milkdown-editor-footer"]',
    );

    expect(footer).toContainElement(stickerButton);
    expect(editorHost).not.toContainElement(stickerButton);
    expect(editor).not.toContainElement(stickerButton);
  });

  test("宽栏直接展示全部常用能力，不显示多余的更多按钮", async () => {
    renderEditor("正文");
    const toolbar = await screen.findByRole("toolbar", { name: "正文格式工具栏" });

    for (const label of [
      "切换正文样式",
      "粗体",
      "斜体",
      "删除线",
      "行内代码",
      "无序列表",
      "有序列表",
      "链接",
      "图片",
      "引用",
      "分隔线",
      "骰子",
    ]) {
      expect(within(toolbar).getByRole("button", { name: label })).toBeInTheDocument();
    }
    expect(within(toolbar).queryByRole("button", { name: "更多" })).toBeNull();
    for (const label of ["任务列表", "代码块", "表格"]) {
      expect(within(toolbar).queryByRole("button", { name: label })).toBeNull();
    }
    expect(
      within(toolbar).queryByRole("button", { name: "左对齐，点击切换" }),
    ).toBeNull();

  });

  test("服务端启用 v4 后对齐按钮循环左中右并规范写出标记", async () => {
    enableMarkdownV4();
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { container } = renderEditor("正文", "对齐正文", onChange);
    const editor = await getEditor(container);
    const button = await screen.findByRole("button", {
      name: "左对齐，点击切换",
    });

    await user.click(editor.querySelector("p")!);
    await user.click(button);
    await waitFor(() => {
      expect(editor.querySelector("p")).toHaveAttribute(
        "data-wenyou-align",
        "center",
      );
      expect(onChange).toHaveBeenLastCalledWith(
        "[wenyousite-align-v1-center]: #\n正文",
      );
      expect(button).toHaveAccessibleName("居中对齐，点击切换");
    });

    await user.click(button);
    await waitFor(() => {
      expect(editor.querySelector("p")).toHaveAttribute(
        "data-wenyou-align",
        "right",
      );
      expect(onChange).toHaveBeenLastCalledWith(
        "[wenyousite-align-v1-right]: #\n正文",
      );
    });

    await user.click(button);
    await waitFor(() => {
      expect(editor.querySelector("p")).not.toHaveAttribute(
        "data-wenyou-align",
      );
      expect(onChange).toHaveBeenLastCalledWith("正文");
    });
  });

  test("空白段落不能创建对齐标记", async () => {
    enableMarkdownV4();
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { container } = renderEditor("", undefined, onChange);
    const editor = await getEditor(container);
    const paragraph = editor.querySelector("p")!;
    const button = await screen.findByRole("button", {
      name: "左对齐，点击切换",
    });

    await user.click(paragraph);
    await user.type(paragraph, "   ");
    await user.click(button);

    await waitFor(() => {
      expect(editor.querySelector("p")).not.toHaveAttribute(
        "data-wenyou-align",
      );
      expect(onChange.mock.calls.flat()).not.toContainEqual(
        expect.stringContaining("wenyousite-align"),
      );
    });
  });

  test("对齐在标题转换中保留，进入列表时自动清除", async () => {
    enableMarkdownV4();
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { container } = renderEditor("正文", undefined, onChange);
    const editor = await getEditor(container);
    await user.click(editor.querySelector("p")!);
    await user.click(await screen.findByRole("button", { name: "左对齐，点击切换" }));

    await user.click(screen.getByRole("button", { name: "切换正文样式" }));
    await user.click(await screen.findByRole("button", { name: "标题 2" }));
    const heading = await waitFor(() => {
      const node = editor.querySelector("h2");
      expect(node).toHaveAttribute("data-wenyou-align", "center");
      return node!;
    });
    expect(onChange.mock.calls.at(-1)?.[0]).toBe(
      "[wenyousite-align-v1-center]: #\n## 正文",
    );

    await user.click(heading);
    await user.click(screen.getByRole("button", { name: "切换正文样式" }));
    await user.click(await screen.findByRole("button", { name: "正文" }));
    const paragraph = await waitFor(() => {
      const node = editor.querySelector("p");
      expect(node).toHaveAttribute("data-wenyou-align", "center");
      return node!;
    });

    await user.click(paragraph);
    await user.click(screen.getByRole("button", { name: "无序列表" }));
    await waitFor(() => {
      expect(editor.querySelector("li p")).not.toHaveAttribute(
        "data-wenyou-align",
      );
      expect(onChange.mock.calls.at(-1)?.[0]).not.toContain("wenyousite-align");
    });
  });

  test("clipboard v2 恢复合法块对齐，v1 只恢复原有结构", async () => {
    const v2Change = vi.fn();
    const v2 = renderEditor("", undefined, v2Change);
    const v2Editor = await getEditor(v2.container);
    fireEvent.paste(v2Editor, {
      clipboardData: clipboardData({
        text: "居中",
        html: '<div data-wenyou-clipboard="2" data-wenyou-clipboard-source="reader"><p data-wenyou-align="center">居中</p></div>',
      }),
    });
    await waitFor(() => {
      expect(
        Array.from(v2Editor.querySelectorAll("p")).find(
          (paragraph) => paragraph.textContent === "居中",
        ),
      ).toHaveAttribute("data-wenyou-align", "center");
      expect(v2Change.mock.calls.at(-1)?.[0]).toContain(
        "[wenyousite-align-v1-center]: #\n居中",
      );
    });
    v2.unmount();

    const v1Change = vi.fn();
    const v1 = renderEditor("", undefined, v1Change);
    const v1Editor = await getEditor(v1.container);
    fireEvent.paste(v1Editor, {
      clipboardData: clipboardData({
        text: "旧片段",
        html: '<div data-wenyou-clipboard="1" data-wenyou-clipboard-source="reader"><p data-wenyou-align="right">旧片段</p></div>',
      }),
    });
    await waitFor(() => {
      expect(v1Editor.querySelector("p")).not.toHaveAttribute("data-wenyou-align");
      expect(v1Change.mock.calls.at(-1)?.[0]).not.toContain("wenyousite-align");
    });
  });

  test("窄栏把低频能力收入更多菜单", async () => {
    renderEditor("正文");
    const toolbar = await screen.findByRole("toolbar", { name: "正文格式工具栏" });
    await makeToolbarCompact(toolbar);

    for (const label of ["链接", "行内代码", "引用", "无序列表", "有序列表", "分隔线", "骰子"]) {
      expect(within(toolbar).queryByRole("button", { name: label })).toBeNull();
    }

    const more = within(toolbar).getByRole("button", { name: "更多" });
    fireEvent.pointerDown(more);
    const menu = await screen.findByRole("menu", { name: "更多正文格式" });
    for (const label of ["链接", "行内代码", "引用", "无序列表", "有序列表", "分隔线", "骰子"]) {
      expect(within(menu).getByRole("menuitem", { name: label })).toBeInTheDocument();
    }
    for (const label of ["任务列表", "代码块", "表格"]) {
      expect(within(menu).queryByRole("menuitem", { name: label })).toBeNull();
    }
    expect(more).toHaveAttribute("aria-expanded", "true");
  });

  test("v4 窄栏托盘用段落内三图标显式设置对齐", async () => {
    enableMarkdownV4();
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { container } = renderEditor("正文", "托盘对齐正文", onChange);
    const editor = await getEditor(container);
    const toolbar = await screen.findByRole("toolbar", { name: "正文格式工具栏" });
    await user.click(editor.querySelector("p")!);
    await makeToolbarCompact(toolbar);

    fireEvent.pointerDown(within(toolbar).getByRole("button", { name: "更多" }));
    let menu = await screen.findByRole("menu", { name: "更多正文格式" });
    const alignment = within(menu).getByRole("group", { name: "段落对齐" });
    expect(within(alignment).getByRole("menuitemradio", { name: "左对齐" }))
      .toHaveAttribute("aria-checked", "true");
    expect(within(menu).queryByText(/对齐/u)).toBeNull();

    await user.click(within(alignment).getByRole("menuitemradio", { name: "居中对齐" }));
    await waitFor(() => {
      expect(editor.querySelector("p")).toHaveAttribute("data-wenyou-align", "center");
      expect(onChange).toHaveBeenLastCalledWith(
        "[wenyousite-align-v1-center]: #\n正文",
      );
      expect(screen.queryByRole("menu", { name: "更多正文格式" })).toBeNull();
    });

    fireEvent.pointerDown(within(toolbar).getByRole("button", { name: "更多" }));
    menu = await screen.findByRole("menu", { name: "更多正文格式" });
    expect(
      within(menu).getByRole("menuitemradio", { name: "居中对齐" }),
    ).toHaveAttribute("aria-checked", "true");
  });

  test("标准内容栏保留行内代码、引用、分隔线和骰子直达", async () => {
    renderEditor("正文");
    const toolbar = await screen.findByRole("toolbar", { name: "正文格式工具栏" });
    await makeToolbarStandard(toolbar);

    for (const label of ["行内代码", "引用", "分隔线", "骰子"]) {
      expect(within(toolbar).getByRole("button", { name: label })).toBeInTheDocument();
    }
    for (const label of ["链接", "无序列表", "有序列表"]) {
      expect(within(toolbar).queryByRole("button", { name: label })).toBeNull();
    }

    fireEvent.pointerDown(within(toolbar).getByRole("button", { name: "更多" }));
    const menu = await screen.findByRole("menu", { name: "更多正文格式" });
    for (const label of ["链接", "无序列表", "有序列表"]) {
      expect(within(menu).getByRole("menuitem", { name: label })).toBeInTheDocument();
    }
    for (const label of ["行内代码", "引用", "分隔线", "骰子"]) {
      expect(within(menu).queryByRole("menuitem", { name: label })).toBeNull();
    }
  });

  test("正文样式只开放正文、二级和三级标题", async () => {
    renderEditor("正文");
    const heading = await screen.findByRole("button", { name: "切换正文样式" });

    await userEvent.setup().click(heading);

    expect(screen.getByRole("button", { name: "正文" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "标题 2" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "标题 3" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "标题 1" })).toBeNull();
    expect(screen.queryByRole("button", { name: "标题 4" })).toBeNull();
  });

  test("空正文可先切换为引用且不会报告格式同步失败", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { container } = renderEditor("", "回复正文", onChange);
    const editor = await getEditor(container);
    vi.mocked(toast.error).mockClear();

    fireEvent.pointerDown(await screen.findByRole("button", { name: "引用" }));

    await waitFor(() => expect(editor.querySelector("blockquote")).toBeInTheDocument());
    expect(toast.error).not.toHaveBeenCalled();
    expect(onChange).toHaveBeenLastCalledWith(">\n\n<br />");

    await user.type(editor.querySelector("blockquote p")!, "引用正文");
    await waitFor(() => {
      expect(onChange).toHaveBeenLastCalledWith("> 引用正文\n\n<br />");
    });
    expect(toast.error).not.toHaveBeenCalled();
  });

  test("空引用 Markdown 可重开为引用块", async () => {
    const { container } = renderEditor(">");
    const editor = await getEditor(container);

    expect(editor.querySelector("blockquote")).toBeInTheDocument();
  });

  test.each(["- ", "+ ", "* "])("Markdown 快捷输入 %s 保持字面文本", async (marker) => {
    const user = userEvent.setup();
    const { container } = renderEditor();
    const editor = await getEditor(container);

    await user.click(editor);
    await user.type(editor, marker);

    expect(editor).toHaveTextContent(marker.trim());
    expect(editor.querySelector("ul")).toBeNull();
  });

  test("无序列表键盘命令继续作为专家入口", async () => {
    const { container } = renderEditor("普通正文");
    const editor = await getEditor(container);

    fireEvent.keyDown(editor, {
      key: "8",
      code: "Digit8",
      ctrlKey: true,
      altKey: true,
    });

    expect(editor.querySelector("ul")).toBeInTheDocument();
  });

  test("粘贴外部 Markdown 无序列表时保持字面文本", async () => {
    const fixture = clipboardGoldenCase("external-markdown-is-literal");
    const { container } = renderEditor();
    const editor = await getEditor(container);

    fireEvent.paste(editor, {
      clipboardData: clipboardData({
        text: fixture.plainText,
        html: fixture.html,
      }),
    });

    await waitFor(() => {
      expect(editor).toHaveTextContent("## 标题");
      expect(editor).toHaveTextContent("- **项目**");
      expect(editor.querySelector("h2, ul, li, strong, table")).toBeNull();
    });
  });

  test("粘贴外部 HTML 无序列表时优先使用纯文本且不保留格式", async () => {
    const fixture = clipboardGoldenCase("external-html-prefers-visible-text");
    const { container } = renderEditor();
    const editor = await getEditor(container);

    fireEvent.paste(editor, {
      clipboardData: clipboardData({
        text: fixture.plainText,
        html: fixture.html,
      }),
    });

    await waitFor(() => {
      for (const line of fixture.expectedText!.split("\n")) {
        expect(editor).toHaveTextContent(line);
      }
      expect(editor.querySelector("h2, ul, li, strong")).toBeNull();
    });
  });

  test("外部 HTML 缺少纯文本时只提取可见内容", async () => {
    const { container } = renderEditor();
    const editor = await getEditor(container);
    fireEvent.paste(editor, {
      clipboardData: clipboardData({
        html: [
          "<style>.secret{display:none}</style>",
          "<script>window.hidden = true</script>",
          "<h2>可见标题</h2>",
        ].join(""),
      }),
    });

    await waitFor(() => expect(editor).toHaveTextContent("可见标题"));
    expect(editor).not.toHaveTextContent("display:none");
    expect(editor).not.toHaveTextContent("window.hidden");
    expect(editor.querySelector("h2")).toBeNull();
  });

  test("粘贴外部 Markdown 有序列表时保持字面文本", async () => {
    const { container } = renderEditor();
    const editor = await getEditor(container);
    fireEvent.paste(editor, { clipboardData: clipboardData({ text: "1. 第一项\n2. 第二项" }) });
    await waitFor(() => expect(editor).toHaveTextContent("1. 第一项"));
    expect(editor.querySelector("ol, li")).toBeNull();
  });

  test("粘贴本站 v1 片段时向后兼容恢复工具栏白名单结构", async () => {
    const onChange = vi.fn();
    const first = renderEditor("", undefined, onChange);
    const { container } = first;
    const editor = await getEditor(container);
    fireEvent.paste(editor, {
      clipboardData: clipboardData({
        text: "标题\n粗体\n第一项\n第二项",
        html: [
          '<div data-wenyou-clipboard="1" data-wenyou-clipboard-source="reader">',
          "<h2>标题</h2><p><strong>粗体</strong></p>",
          "<ul><li><p>第一项</p></li><li><p>第二项</p></li></ul>",
          "</div>",
        ].join(""),
      }),
    });

    await waitFor(() => {
      expect(editor.querySelector("h2")).toHaveTextContent("标题");
      expect(editor.querySelector("strong")).toHaveTextContent("粗体");
      expect(editor.querySelectorAll("li")).toHaveLength(2);
    });

    const saved = await waitFor(() => {
      const value = onChange.mock.calls.at(-1)?.[0] as string | undefined;
      expect(value).toContain("## 标题");
      expect(value).toContain("**粗体**");
      expect(value).toMatch(/^[*-] 第一项$/mu);
      return value!;
    });
    first.unmount();

    const reopened = renderEditor(saved);
    const reopenedEditor = await getEditor(reopened.container);
    expect(reopenedEditor.querySelector("h2")).toHaveTextContent("标题");
    expect(reopenedEditor.querySelector("strong")).toHaveTextContent("粗体");
    expect(reopenedEditor.querySelectorAll("li")).toHaveLength(2);
  });

  test("编辑器原生复制写出 v2 结构片段且纯文本不泄漏 Markdown 定界符", async () => {
    const { container } = renderEditor("**站内粗体**");
    const editor = await getEditor(container);
    fireEvent.keyDown(editor, { key: "a", code: "KeyA", ctrlKey: true });
    const written = new Map<string, string>();

    fireEvent.copy(editor, {
      clipboardData: {
        clearData: () => written.clear(),
        setData: (type: string, value: string) => written.set(type, value),
      },
    });

    expect(written.get("text/html")).toContain('data-wenyou-clipboard="2"');
    expect(written.get("text/html")).toContain('data-wenyou-clipboard-source="editor"');
    expect(written.get("text/html")).toContain("<strong>站内粗体</strong>");
    expect(written.get("text/plain")).toBe("站内粗体");
  });

  test("外部 Markdown 保存重开后仍是可见字面文本", async () => {
    const fixture = clipboardGoldenCase("external-markdown-is-literal");
    const onChange = vi.fn();
    const first = renderEditor("", undefined, onChange);
    const editor = await getEditor(first.container);

    fireEvent.paste(editor, {
      clipboardData: clipboardData({ text: fixture.plainText }),
    });
    const saved = await waitFor(() => {
      const value = onChange.mock.calls.at(-1)?.[0] as string | undefined;
      expect(value).toBeTruthy();
      return value!;
    });
    first.unmount();

    const reopened = renderEditor(saved);
    const reopenedEditor = await getEditor(reopened.container);
    expect(reopenedEditor).toHaveTextContent("## 标题");
    expect(reopenedEditor).toHaveTextContent("- **项目**");
    expect(reopenedEditor).toHaveTextContent("| A | B |");
    expect(reopenedEditor.querySelector("h2, ul, li, strong, table")).toBeNull();
  });

  test("未知本站 envelope 版本静默退回可见纯文本", async () => {
    const fixture = clipboardGoldenCase("invalid-envelope-falls-back-silently");
    const { container } = renderEditor();
    const editor = await getEditor(container);
    fireEvent.paste(editor, {
      clipboardData: clipboardData({
        text: fixture.plainText,
        html: fixture.html,
      }),
    });
    await waitFor(() => expect(editor).toHaveTextContent(fixture.expectedText!));
    expect(editor.querySelector("strong")).toBeNull();
  });

  test("共享黄金用例中的单一站内链接继续生成传送门", async () => {
    const fixture = clipboardGoldenCase("single-internal-url-keeps-portal-exception");
    const onChange = vi.fn();
    const { container } = renderEditor("", "正文编辑器", onChange);
    const editor = await getEditor(container);

    fireEvent.paste(editor, {
      clipboardData: clipboardData({ text: fixture.plainText }),
    });

    const portal = await waitFor(() => {
      const element = editor.querySelector<HTMLAnchorElement>('[data-slot="internal-reference-link"]');
      expect(element).toBeInTheDocument();
      return element!;
    });
    expect(portal).toHaveAttribute("href", fixture.expectedHref);
    expect(portal).toHaveTextContent(fixture.expectedLabel!);
    expect(onChange).toHaveBeenCalledWith(
      `[${fixture.expectedLabel}](${fixture.expectedHref})`,
    );
  });

  test("单独粘贴邀请链接时立即显示并序列化为传送门", async () => {
    const onChange = vi.fn();
    const { container } = renderEditor("", "正文编辑器", onChange);
    const editor = await getEditor(container);

    fireEvent.paste(editor, {
      clipboardData: clipboardData({
        text: "https://wenyou.site/join/AbCdEfGh_123-XYZ",
      }),
    });

    const portal = await waitFor(() => {
      const element = editor.querySelector<HTMLAnchorElement>('[data-slot="internal-reference-link"]');
      expect(element).toBeInTheDocument();
      return element!;
    });
    expect(portal).toHaveAttribute("href", "/join/AbCdEfGh_123-XYZ");
    expect(portal).toHaveTextContent("传送门");
    expect(onChange).toHaveBeenCalledWith("[传送门](/join/AbCdEfGh_123-XYZ)");
  });

  test("编辑器重开时命名邀请链接仍以传送门显示", async () => {
    const { container } = renderEditor("[私密入口](/join/AbCdEfGh_123-XYZ)");
    const editor = await getEditor(container);
    const portal = await waitFor(() => {
      const element = editor.querySelector<HTMLAnchorElement>('[data-slot="internal-reference-link"]');
      expect(element).toBeInTheDocument();
      return element!;
    });

    expect(portal).toHaveAttribute("href", "/join/AbCdEfGh_123-XYZ");
    expect(portal).toHaveTextContent("私密入口");
  });

  test.each([
    ["任务列表", "- [ ] 待办\n- [x] 完成"],
    ["代码块", "```js\nconst answer = 42\n```"],
    ["表格", "| 名称 | 数量 |\n| --- | ---: |\n| 骰子 | 2 |"],
    ["额外标题", "# 一级标题\n#### 四级标题"],
  ])("粘贴 Markdown %s 时只插入字面段落", async (_name, markdown) => {
    const { container } = renderEditor();
    const editor = await getEditor(container);
    fireEvent.paste(editor, { clipboardData: clipboardData({ text: markdown }) });
    await waitFor(() => expect(editor).toHaveTextContent(markdown.split("\n")[0]!));
    expect(editor.querySelector("table, pre, h1, h4, input[type='checkbox']")).toBeNull();
  });

  test("粘贴 HTML 表格优先使用 text/plain 并保持无提示字面文本", async () => {
    const { container } = renderEditor();
    const editor = await getEditor(container);
    fireEvent.paste(editor, {
      clipboardData: clipboardData({
        text: "名称\t数量\n骰子\t2",
        html: "<table><tr><th>名称</th><th>数量</th></tr><tr><td>骰子</td><td>2</td></tr></table>",
      }),
    });
    await waitFor(() => expect(editor).toHaveTextContent("名称 数量"));
    expect(editor.querySelector("table")).toBeNull();
  });

  test("外部拖放的 HTML 和站内 URL 都只按可见文字插入", async () => {
    const { container } = renderEditor();
    const editor = await getEditor(container);
    fireEvent.drop(editor, {
      clientX: 0,
      clientY: 0,
      dataTransfer: {
        files: [],
        getData: (type: string) => {
          if (type === "text/plain") {
            return "https://wenyou.site/threads/cmsewdo0h000x7qv6aa77ll1v";
          }
          if (type === "text/html") return "<strong>站内地址</strong>";
          return "";
        },
      },
    });

    await waitFor(() => {
      expect(editor).toHaveTextContent(
        "https://wenyou.site/threads/cmsewdo0h000x7qv6aa77ll1v",
      );
    });
    expect(editor.querySelector("strong, [data-slot='internal-reference-link']")).toBeNull();
  });

  test("本地文件拖放被消费且不会绕过图片工具栏", async () => {
    const { container } = renderEditor("原文");
    const editor = await getEditor(container);
    fireEvent.drop(editor, {
      dataTransfer: {
        files: [new File(["image"], "test.png", { type: "image/png" })],
        getData: () => "不应插入",
      },
    });

    await waitFor(() => expect(editor).toHaveTextContent("原文"));
    expect(editor).not.toHaveTextContent("不应插入");
    expect(editor.querySelector("img")).toBeNull();
  });

  test.each(["paste", "drop"] as const)(
    "仅含外部图片 HTML 的 %s 被消费且不会绕过图片工具栏",
    async (eventName) => {
      const { container } = renderEditor("原文");
      const editor = await getEditor(container);
      const transfer = {
        files: [],
        getData: (type: string) => type === "text/html"
          ? '<img src="https://external.example.com/image.png" alt="外部图片">'
          : "",
      };

      if (eventName === "paste") {
        fireEvent.paste(editor, { clipboardData: transfer });
      } else {
        fireEvent.drop(editor, { dataTransfer: transfer });
      }

      await waitFor(() => expect(editor).toHaveTextContent("原文"));
      expect(editor).not.toHaveTextContent("外部图片");
      expect(editor.querySelector("img")).toBeNull();
    },
  );

  test("带站内 URL 文本的文件粘贴仍被忽略", async () => {
    const { container } = renderEditor("原文");
    const editor = await getEditor(container);
    fireEvent.paste(editor, {
      clipboardData: {
        files: [new File(["image"], "test.png", { type: "image/png" })],
        getData: (type: string) => type === "text/plain"
          ? "https://wenyou.site/threads/cmsewdo0h000x7qv6aa77ll1v"
          : "",
      },
    });

    await waitFor(() => expect(editor).toHaveTextContent("原文"));
    expect(editor.querySelector("img, [data-slot='internal-reference-link']")).toBeNull();
  });

  test("手动输入所有 Markdown 定界符都不会自动创建结构", async () => {
    const user = userEvent.setup();
    const { container } = renderEditor();
    const editor = await getEditor(container);
    await user.click(editor);
    await user.type(editor, "## 二级标题{Enter}> 引用{Enter}**粗体** `代码` ~~删除~~ ");
    expect(editor).toHaveTextContent("## 二级标题");
    expect(editor).toHaveTextContent("> 引用");
    expect(editor).toHaveTextContent("**粗体** `代码` ~~删除~~");
    expect(editor.querySelector("h2, blockquote, strong, code, del")).toBeNull();
  });

  test("手动输入图片 Markdown 不会绕过工具栏上传", async () => {
    const user = userEvent.setup();
    const { container } = renderEditor();
    const editor = await getEditor(container);
    await user.click(editor);
    await user.keyboard("![[外部图片](https://cdn.example.com/not-allowed.png)");

    expect(editor).toHaveTextContent(
      "![外部图片](https://cdn.example.com/not-allowed.png)",
    );
    expect(editor.querySelector("img")).toBeNull();
  });

  test("标题快捷键只保留工具栏开放的 H2/H3", async () => {
    const { container } = renderEditor("普通正文");
    const editor = await getEditor(container);

    fireEvent.keyDown(editor, {
      key: "1",
      code: "Digit1",
      ctrlKey: true,
      altKey: true,
    });
    expect(editor.querySelector("h1")).toBeNull();

    fireEvent.keyDown(editor, {
      key: "2",
      code: "Digit2",
      ctrlKey: true,
      altKey: true,
    });
    expect(editor.querySelector("h2")).toHaveTextContent("普通正文");
  });

  test("更多菜单可创建无序列表并保持原选区", async () => {
    const { container } = renderEditor("普通正文");
    const editor = await getEditor(container);
    await userEvent.setup().click(editor);
    const toolbar = await screen.findByRole("toolbar", { name: "正文格式工具栏" });
    await makeToolbarCompact(toolbar);
    fireEvent.pointerDown(within(toolbar).getByRole("button", { name: "更多" }));

    await userEvent.setup().click(
      await screen.findByRole("menuitem", { name: "无序列表" }),
    );

    await waitFor(() => expect(editor.querySelector("ul")).toBeInTheDocument());
    expect(document.activeElement).toBe(editor);
  });

  test("更多菜单可在空选区开启行内代码并继续输入", async () => {
    const user = userEvent.setup();
    const { container } = renderEditor();
    const editor = await getEditor(container);
    await user.click(editor);
    const toolbar = await screen.findByRole("toolbar", { name: "正文格式工具栏" });
    await makeToolbarCompact(toolbar);
    fireEvent.pointerDown(within(toolbar).getByRole("button", { name: "更多" }));
    await user.click(await screen.findByRole("menuitem", { name: "行内代码" }));
    await user.type(editor, "代码");

    expect(editor.querySelector("code")).toHaveTextContent("代码");
    expect(document.activeElement).toBe(editor);
  });

  test("历史无序列表仍可解析和编辑", async () => {
    const user = userEvent.setup();
    const { container } = renderEditor("- 历史第一项\n- 历史第二项");
    const editor = await getEditor(container);
    await waitFor(() => expect(editor.querySelectorAll("li")).toHaveLength(2));

    await user.click(editor.querySelector("li")!);
    await user.type(editor, "补充");

    expect(editor.querySelectorAll("li")).toHaveLength(2);
    expect(editor).toHaveTextContent("补充");
  });
});
