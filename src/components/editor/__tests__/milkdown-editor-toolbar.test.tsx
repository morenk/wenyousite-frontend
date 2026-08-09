import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
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

function renderEditor(defaultValue = "") {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MilkdownEditor defaultValue={defaultValue} />
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

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("MilkdownEditor 顶栏与无序列表策略", () => {
  test("使用统一工具栏语义，恢复删除线并显示明确的五点骰面", async () => {
    const { container } = renderEditor("正文");
    const toolbar = await screen.findByRole("toolbar", { name: "正文格式工具栏" });

    expect(within(toolbar).getByRole("button", { name: "删除线" })).toBeInTheDocument();
    expect(within(toolbar).queryByRole("button", { name: "无序列表" })).toBeNull();

    const dice = within(toolbar).getByRole("button", { name: "骰子" });
    expect(dice.querySelector("rect[rx='4']")).toBeInTheDocument();
    expect(dice.querySelectorAll("circle")).toHaveLength(5);
    expect(container.querySelector(".top-bar-divider + .top-bar-divider")).toBeNull();
  });

  test.each(["- ", "+ ", "* "])("Markdown 快捷输入 %s 不会创建新的无序列表", async (marker) => {
    const user = userEvent.setup();
    const { container } = renderEditor();
    const editor = await waitFor(() => {
      const element = container.querySelector<HTMLElement>(".ProseMirror");
      expect(element).toBeInTheDocument();
      return element!;
    });

    await user.click(editor);
    await user.type(editor, marker);

    expect(editor.querySelector("ul")).toBeNull();
    expect(editor).toHaveTextContent(marker.trim());
  });

  test("无序列表键盘命令不再创建列表", async () => {
    const { container } = renderEditor("普通正文");
    const editor = await waitFor(() => {
      const element = container.querySelector<HTMLElement>(".ProseMirror");
      expect(element).toBeInTheDocument();
      return element!;
    });

    fireEvent.keyDown(editor, {
      key: "8",
      code: "Digit8",
      ctrlKey: true,
      altKey: true,
    });

    expect(editor.querySelector("ul")).toBeNull();
  });

  test("粘贴 Markdown 无序列表时转成普通段落", async () => {
    const { container } = renderEditor();
    const editor = await waitFor(() => {
      const element = container.querySelector<HTMLElement>(".ProseMirror");
      expect(element).toBeInTheDocument();
      return element!;
    });

    fireEvent.paste(editor, {
      clipboardData: clipboardData({ text: "- 第一项\n- 第二项" }),
    });

    await waitFor(() => {
      expect(editor.querySelector("ul")).toBeNull();
      expect(editor.querySelectorAll("p")).toHaveLength(2);
      expect(editor).toHaveTextContent("第一项");
      expect(editor).toHaveTextContent("第二项");
    });
  });

  test("粘贴 HTML 无序列表时转成普通段落", async () => {
    const { container } = renderEditor();
    const editor = await waitFor(() => {
      const element = container.querySelector<HTMLElement>(".ProseMirror");
      expect(element).toBeInTheDocument();
      return element!;
    });

    fireEvent.paste(editor, {
      clipboardData: clipboardData({
        text: "第一项\n第二项",
        html: "<ul><li><strong>第一项</strong></li><li>第二项</li></ul>",
      }),
    });

    await waitFor(() => {
      expect(editor.querySelector("ul")).toBeNull();
      expect(editor.querySelectorAll("p")).toHaveLength(2);
      expect(editor.querySelector("strong")).toHaveTextContent("第一项");
    });
  });

  test("有序列表粘贴维持现有结构", async () => {
    const { container } = renderEditor();
    const editor = await waitFor(() => {
      const element = container.querySelector<HTMLElement>(".ProseMirror");
      expect(element).toBeInTheDocument();
      return element!;
    });

    fireEvent.paste(editor, {
      clipboardData: clipboardData({ text: "1. 第一项\n2. 第二项" }),
    });

    await waitFor(() => {
      expect(editor.querySelector("ol")).toBeInTheDocument();
      expect(editor.querySelectorAll("li")).toHaveLength(2);
    });
  });

  test("历史无序列表仍可解析和编辑", async () => {
    const user = userEvent.setup();
    const { container } = renderEditor("- 历史第一项\n- 历史第二项");
    const editor = await waitFor(() => {
      const element = container.querySelector<HTMLElement>(".ProseMirror");
      expect(element?.querySelectorAll("li")).toHaveLength(2);
      return element!;
    });

    await user.click(editor.querySelector("li")!);
    await user.type(editor, "补充");

    expect(editor.querySelectorAll("li")).toHaveLength(2);
    expect(editor).toHaveTextContent("补充");
  });
});
