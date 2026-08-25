import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, afterEach, describe, expect, test, vi } from "vitest";
import { MilkdownEditor } from "@/components/editor/milkdown-editor-core";

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ user: null }),
}));

vi.mock("@/api/hooks/use-save-draft", () => ({
  useSaveDraft: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

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

  test("标准内容栏保留链接、引用、分隔线和骰子直达", async () => {
    renderEditor("正文");
    const toolbar = await screen.findByRole("toolbar", { name: "正文格式工具栏" });
    await makeToolbarStandard(toolbar);

    for (const label of ["链接", "引用", "分隔线", "骰子"]) {
      expect(within(toolbar).getByRole("button", { name: label })).toBeInTheDocument();
    }
    for (const label of ["行内代码", "无序列表", "有序列表"]) {
      expect(within(toolbar).queryByRole("button", { name: label })).toBeNull();
    }

    fireEvent.pointerDown(within(toolbar).getByRole("button", { name: "更多" }));
    const menu = await screen.findByRole("menu", { name: "更多正文格式" });
    for (const label of ["行内代码", "无序列表", "有序列表"]) {
      expect(within(menu).getByRole("menuitem", { name: label })).toBeInTheDocument();
    }
    for (const label of ["链接", "引用", "分隔线", "骰子"]) {
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

  test.each(["- ", "+ ", "* "])("Markdown 快捷输入 %s 创建无序列表", async (marker) => {
    const user = userEvent.setup();
    const { container } = renderEditor();
    const editor = await getEditor(container);

    await user.click(editor);
    await user.type(editor, marker);

    expect(editor.querySelector("ul")).toBeInTheDocument();
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

  test("粘贴 Markdown 无序列表时保留列表结构", async () => {
    const { container } = renderEditor();
    const editor = await getEditor(container);

    fireEvent.paste(editor, {
      clipboardData: clipboardData({ text: "- 第一项\n- 第二项" }),
    });

    await waitFor(() => {
      expect(editor.querySelector("ul")).toBeInTheDocument();
      expect(editor.querySelectorAll("li")).toHaveLength(2);
    });
  });

  test("粘贴 HTML 无序列表时保留结构和行内格式", async () => {
    const { container } = renderEditor();
    const editor = await getEditor(container);

    fireEvent.paste(editor, {
      clipboardData: clipboardData({
        text: "第一项\n第二项",
        html: "<ul><li><strong>第一项</strong></li><li>第二项</li></ul>",
      }),
    });

    await waitFor(() => {
      expect(editor.querySelector("ul")).toBeInTheDocument();
      expect(editor.querySelectorAll("li")).toHaveLength(2);
      expect(editor.querySelector("strong")).toHaveTextContent("第一项");
    });
  });

  test("粘贴 Markdown 有序列表时保留工具栏内结构", async () => {
    const { container } = renderEditor();
    const editor = await getEditor(container);
    fireEvent.paste(editor, { clipboardData: clipboardData({ text: "1. 第一项\n2. 第二项" }) });
    await waitFor(() => expect(editor.querySelector("ol")).toBeInTheDocument());
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

  test("手动输入 H1 和围栏语法不会创建白名单外节点", async () => {
    const user = userEvent.setup();
    const { container } = renderEditor();
    const editor = await getEditor(container);
    await user.click(editor);
    await user.type(editor, "# 一级标题{Enter}```js ");
    expect(editor).toHaveTextContent("# 一级标题");
    expect(editor.querySelector("h1, pre")).toBeNull();
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
