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

function renderEditor(defaultValue = "", ariaLabel?: string) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MilkdownEditor
        defaultValue={defaultValue}
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
  test("正文输入区提供可配置的可访问名称", async () => {
    const { container } = renderEditor("正文", "主帖正文");

    expect(await getEditor(container)).toHaveAttribute("aria-label", "主帖正文");
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

  test.each([
    ["有序列表", "1. 第一项\n2. 第二项", "ol"],
    ["任务列表", "- [ ] 待办\n- [x] 完成", ".label.unchecked, .label.checked"],
    ["代码块", "```js\nconst answer = 42\n```", "pre"],
    ["表格", "| 名称 | 数量 |\n| --- | ---: |\n| 骰子 | 2 |", "table"],
  ])("粘贴 Markdown %s 时保留协议结构", async (_name, markdown, selector) => {
    const { container } = renderEditor();
    const editor = await getEditor(container);
    fireEvent.paste(editor, { clipboardData: clipboardData({ text: markdown }) });
    await waitFor(() => expect(editor.querySelector(selector)).toBeInTheDocument());
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
