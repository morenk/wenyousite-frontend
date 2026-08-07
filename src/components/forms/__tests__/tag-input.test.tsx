import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TagInput } from "@/components/forms/tag-input";

const { mockUseTags } = vi.hoisted(() => ({ mockUseTags: vi.fn() }));

vi.mock("@/api/hooks/use-tags", () => ({
  useTags: (...args: unknown[]) => mockUseTags(...args),
}));

beforeEach(() => {
  mockUseTags.mockReturnValue({ data: [], isLoading: false });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("TagInput", () => {
  test("回车添加标签并移除内部空白", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TagInput value={[]} onChange={onChange} />);

    await user.type(screen.getByPlaceholderText("输入标签，按回车添加"), " 剧 情 {enter}");

    expect(onChange).toHaveBeenCalledWith(["剧情"]);
  });

  test("拒绝重复标签，并用空输入退格删除最后一个", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TagInput value={["剧情", "招募"]} onChange={onChange} />);
    const input = screen.getByPlaceholderText("输入标签，按回车添加");

    await user.type(input, "剧情{enter}");
    expect(onChange).not.toHaveBeenCalled();

    await user.clear(input);
    await user.type(input, "{backspace}");
    expect(onChange).toHaveBeenCalledWith(["剧情"]);
  });

  test("点击容器会聚焦真实输入框", async () => {
    const user = userEvent.setup();
    render(<TagInput value={[]} onChange={vi.fn()} />);
    const input = screen.getByPlaceholderText("输入标签，按回车添加");

    await user.click(input.parentElement!);

    expect(input).toHaveFocus();
  });

  test("候选列表过滤已选项并可点击添加", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    mockUseTags.mockReturnValue({
      data: [
        { id: "tag-1", name: "剧情" },
        { id: "tag-2", name: "推理" },
      ],
      isLoading: false,
    });
    render(<TagInput value={["剧情"]} onChange={onChange} />);

    await user.type(screen.getByPlaceholderText("输入标签，按回车添加"), "推");

    expect(screen.queryByRole("button", { name: "剧情" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "推理" }));
    expect(onChange).toHaveBeenCalledWith(["剧情", "推理"]);
  });

  test("无候选时允许创建输入标签，达到上限后禁用输入", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(<TagInput value={[]} onChange={onChange} max={2} />);

    await user.type(screen.getByPlaceholderText("输入标签，按回车添加"), "新标签");
    await user.click(screen.getByRole("button", { name: "按回车创建 “新标签”" }));
    expect(onChange).toHaveBeenCalledWith(["新标签"]);

    rerender(<TagInput value={["剧情", "招募"]} onChange={onChange} max={2} />);
    expect(screen.getByPlaceholderText("标签已满")).toBeDisabled();
  });

  test("候选查询期间显示加载态", async () => {
    const user = userEvent.setup();
    mockUseTags.mockReturnValue({ data: undefined, isLoading: true });
    render(<TagInput value={[]} onChange={vi.fn()} />);

    await user.type(screen.getByPlaceholderText("输入标签，按回车添加"), "剧");

    expect(screen.getByText("搜索中…")).toBeInTheDocument();
  });
});
