import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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

describe("MilkdownEditor 内联骰子", () => {
  afterEach(() => cleanup());

  test("正文滚动区使用浏览器原生光标，避免虚拟光标重复计算滚动偏移", async () => {
    const { container } = render(
      <QueryClientProvider client={new QueryClient()}>
        <MilkdownEditor defaultValue={"第一行\n\n第二行"} />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(container.querySelector(".ProseMirror")).toBeInTheDocument();
    });
    const editor = container.querySelector(".ProseMirror");
    expect(editor).not.toHaveClass("virtual-cursor-enabled");
    expect(editor?.querySelector(".prosemirror-virtual-cursor")).toBeNull();
  });

  test("点击工具栏骰子按钮会打开插入弹窗", async () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1280 });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 800 });
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MilkdownEditor defaultValue="测试正文" />
      </QueryClientProvider>,
    );

    const diceButton = await screen.findByRole("button", { name: "骰子" });
    vi.spyOn(diceButton, "getBoundingClientRect").mockReturnValue({
      x: 320,
      y: 20,
      top: 20,
      right: 352,
      bottom: 52,
      left: 320,
      width: 32,
      height: 32,
      toJSON: () => ({}),
    });
    fireEvent.pointerDown(diceButton);

    await waitFor(() => {
      const dialog = screen.getByRole("dialog", { name: "插入骰子" });
      expect(dialog).toBeInTheDocument();
      expect(dialog.parentElement).toBe(document.body);
      expect(dialog).toHaveClass("fixed", "z-[100]");
      expect(dialog).toHaveStyle({ top: "58px", left: "320px" });
    });
  });

  test("插入 d100 后向表单输出可供服务端结算的骰子节点", async () => {
    const onChange = vi.fn();
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MilkdownEditor defaultValue="玛利亚发财的概率：" onChange={onChange} />
      </QueryClientProvider>,
    );

    fireEvent.pointerDown(await screen.findByRole("button", { name: "骰子" }));
    fireEvent.click(await screen.findByRole("button", { name: "d100" }));

    await waitFor(() => {
      expect(screen.getByRole("note", { name: "骰子 1d100，待掷" })).toHaveTextContent(
        "1d100 = ?",
      );
      expect(onChange).toHaveBeenCalled();
    });

    const markdown = onChange.mock.calls.at(-1)?.[0] as string;
    expect(markdown).toContain("玛利亚发财的概率：");
    expect(markdown).toMatch(/\[\[dice:v1:[0-9a-f-]{36}:1d100\]\]/u);
    expect(markdown).not.toMatch(/\n$/u);
    expect(markdown).not.toContain("\\[\\[dice:v1:");
  });

  test("父表单重渲染后仍把骰子内容交给最新 onChange", async () => {
    const client = new QueryClient();
    const firstOnChange = vi.fn();
    const latestOnChange = vi.fn();
    const view = render(
      <QueryClientProvider client={client}>
        <MilkdownEditor defaultValue="正文" onChange={firstOnChange} />
      </QueryClientProvider>,
    );
    await screen.findByRole("button", { name: "骰子" });

    view.rerender(
      <QueryClientProvider client={client}>
        <MilkdownEditor defaultValue="正文" onChange={latestOnChange} />
      </QueryClientProvider>,
    );
    fireEvent.pointerDown(screen.getByRole("button", { name: "骰子" }));
    fireEvent.click(await screen.findByRole("button", { name: "d20" }));

    await waitFor(() => expect(latestOnChange).toHaveBeenCalled());
  });

  test("编辑已发布正文时显示多骰的逐骰结果", async () => {
    const nodeId = "550e8400-e29b-41d4-a716-446655440000";
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MilkdownEditor
          defaultValue={`结果 [[dice:v1:${nodeId}:2d50]]`}
          diceRolls={[{
            nodeId,
            notation: "2d50",
            results: [33, 48],
            modifier: 0,
            total: 81,
          }]}
        />
      </QueryClientProvider>,
    );

    expect(await screen.findByRole("note", {
      name: "骰子 2d50，逐骰结果 33、48，总计 81",
    })).toHaveTextContent("2d50 = [33, 48] = 81");
  });
});
