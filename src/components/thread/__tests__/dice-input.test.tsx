import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { DiceInput } from "@/components/thread/dice-input";

const mocks = vi.hoisted(() => ({ error: vi.fn() }));

vi.mock("sonner", () => ({ toast: { error: mocks.error } }));

describe("DiceInput", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => cleanup());

  test("快捷骰子只加入待掷表达式，不在客户端生成结果", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DiceInput value={[]} onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "d20" }));

    expect(onChange).toHaveBeenCalledWith(["1d20"]);
    expect(screen.getByText("提交成功后才由服务器掷骰；结果生成后不可修改。")).toBeInTheDocument();
  });

  test("自定义表达式会规范化，待掷项可移除", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(<DiceInput value={[]} onChange={onChange} />);
    const input = screen.getByLabelText("自定义骰子表达式");
    await user.clear(input);
    await user.type(input, "2D6 + 3");
    await user.click(screen.getByRole("button", { name: "添加骰子" }));
    expect(onChange).toHaveBeenCalledWith(["2d6+3"]);

    rerender(<DiceInput value={["2d6+3"]} onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: "移除待掷骰子 2d6+3" }));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  test("达到每帖 20 次上限后禁用新增", () => {
    render(<DiceInput value={[]} existingCount={20} onChange={vi.fn()} />);
    expect(screen.getByText("20/20")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "d6" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "添加骰子" })).toBeDisabled();
  });
});
