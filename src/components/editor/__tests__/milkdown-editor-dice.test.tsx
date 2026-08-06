import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { MilkdownEditor } from "@/components/editor/milkdown-editor";

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
});
