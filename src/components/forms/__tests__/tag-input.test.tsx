import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TagInput } from "@/components/forms/tag-input";
import { TAG_NAME_MESSAGE } from "@/lib/tag-name";

const { mockUseTags, mockToastError } = vi.hoisted(() => ({
  mockUseTags: vi.fn(), mockToastError: vi.fn(),
}));

vi.mock("sonner", () => ({ toast: { error: mockToastError } }));

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

function ControlledTagInput({ onChange = vi.fn(), max = 5 }: {
  onChange?: (tags: string[]) => void;
  max?: number;
}) {
  const [tags, setTags] = useState<string[]>([]);
  return <TagInput value={tags} max={max} onChange={(next) => {
    setTags(next);
    onChange(next);
  }} />;
}

describe("TagInput", () => {
  test("输入框提示分隔方式并保留可访问名称，不显示框外教学说明", () => {
    render(<TagInput id="tags" value={[]} onChange={vi.fn()} />);
    expect(screen.getByRole("textbox", { name: "标签" })).toHaveAttribute("placeholder", "标签由空格或回车分隔");
    expect(screen.queryByText(/最多.*个标签/)).not.toBeInTheDocument();
    expect(screen.queryByText(/支持中文/)).not.toBeInTheDocument();
  });

  test("空格、回车、逗号连续确认保留前项，重复及连续空格不重复添加", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ControlledTagInput onChange={onChange} />);
    await user.type(screen.getByRole("textbox"), "剧情  招募{enter}推理,推理{enter}");
    expect(onChange.mock.calls).toEqual([
      [["剧情"]], [["剧情", "招募"]], [["剧情", "招募", "推理"]],
    ]);
    expect(screen.getAllByRole("button", { name: /^删除标签 / })).toHaveLength(3);
  });

  test.each([" ", "　"])("20字标签以%s确认，21字保留输入且提示错误", (key) => {
    const onChange = vi.fn();
    render(<TagInput value={[]} onChange={onChange} />);
    const input = screen.getByRole("textbox", { name: "标签" });
    const valid = "字".repeat(20);
    fireEvent.change(input, { target: { value: valid } });
    fireEvent.keyDown(input, { key });
    expect(onChange).toHaveBeenCalledExactlyOnceWith([valid]);
    expect(input).toHaveValue("");
    onChange.mockClear();
    const invalid = "字".repeat(21);
    fireEvent.change(input, { target: { value: invalid } });
    fireEvent.keyDown(input, { key });
    expect(onChange).not.toHaveBeenCalled();
    expect(input).toHaveValue(invalid);
    expect(mockToastError).toHaveBeenCalledExactlyOnceWith(TAG_NAME_MESSAGE);
  });

  test.each([" ", "　", "Enter", ",", "Backspace"])("组合输入期间%s不确认或删除，结束后才可确认", (key) => {
    const onChange = vi.fn();
    render(<TagInput value={["已有"]} onChange={onChange} />);
    const input = screen.getByRole("textbox", { name: "标签" });
    fireEvent.compositionStart(input);
    fireEvent.change(input, { target: { value: key === "Backspace" ? "" : "中文" } });
    fireEvent.keyDown(input, { key });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.compositionEnd(input);
    fireEvent.change(input, { target: { value: "中文" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).toHaveBeenCalledExactlyOnceWith(["已有", "中文"]);
  });

  test.each([
    { key: " ", isComposing: true },
    { key: "Enter", isComposing: true },
    { key: "Enter", keyCode: 229 },
  ])("原生组合事件%s不确认", (event) => {
    const onChange = vi.fn();
    render(<TagInput value={[]} onChange={onChange} />);
    const input = screen.getByRole("textbox", { name: "标签" });
    fireEvent.change(input, { target: { value: "中文" } });
    fireEvent.keyDown(input, event);
    expect(onChange).not.toHaveBeenCalled();
  });

  test("连续确认在上限处停止，删除后恢复输入", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ControlledTagInput max={2} onChange={onChange} />);
    const input = screen.getByRole("textbox", { name: "标签" });
    await user.type(input, "一 二 三 ");
    expect(onChange.mock.calls).toEqual([[["一"]], [["一", "二"]]]);
    expect(input).toBeDisabled();
    expect(input).toHaveAttribute("placeholder", "标签已满");
    await user.click(screen.getByRole("button", { name: "删除标签 一" }));
    expect(input).toBeEnabled();
    await user.type(input, "三 ");
    expect(onChange).toHaveBeenLastCalledWith(["二", "三"]);
  });

  test.each(["😀", "bad/tag", "a".repeat(21)])("非法标签%s不进入待提交列表", (name) => {
    const onChange = vi.fn();
    render(<TagInput value={[]} onChange={onChange} />);
    const input = screen.getByRole("textbox", { name: "标签" });
    fireEvent.change(input, { target: { value: name } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).not.toHaveBeenCalled();
  });

  test("回车添加标签并移除内部空白", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TagInput value={[]} onChange={onChange} />);

    const input = screen.getByRole("textbox", { name: "标签" });
    await user.click(input);
    await user.paste(" 剧 情 ");
    await user.keyboard("{enter}");

    expect(onChange).toHaveBeenCalledWith(["剧情"]);
  });

  test("拒绝重复标签，并用空输入退格删除最后一个", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TagInput value={["剧情", "招募"]} onChange={onChange} />);
    const input = screen.getByRole("textbox", { name: "标签" });

    await user.type(input, "剧情{enter}");
    expect(onChange).not.toHaveBeenCalled();

    await user.clear(input);
    await user.type(input, "{backspace}");
    expect(onChange).toHaveBeenCalledWith(["剧情"]);
  });

  test("点击容器会聚焦真实输入框", async () => {
    const user = userEvent.setup();
    render(<TagInput value={[]} onChange={vi.fn()} />);
    const input = screen.getByRole("textbox", { name: "标签" });

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

    await user.type(screen.getByRole("textbox", { name: "标签" }), "推");

    expect(screen.queryByRole("button", { name: "剧情" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "推理" }));
    expect(onChange).toHaveBeenCalledWith(["剧情", "推理"]);
  });

  test("无候选时允许创建输入内容，达到上限后禁用输入", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(<TagInput value={[]} onChange={onChange} max={2} />);

    await user.type(screen.getByRole("textbox", { name: "标签" }), "新标签");
    await user.click(screen.getByRole("button", { name: "创建“新标签”" }));
    expect(onChange).toHaveBeenCalledWith(["新标签"]);

    rerender(<TagInput value={["剧情", "招募"]} onChange={onChange} max={2} />);
    expect(screen.getByPlaceholderText("标签已满")).toBeDisabled();
  });

  test("候选查询期间显示加载态", async () => {
    const user = userEvent.setup();
    mockUseTags.mockReturnValue({ data: undefined, isLoading: true });
    render(<TagInput value={[]} onChange={vi.fn()} />);

    await user.type(screen.getByRole("textbox", { name: "标签" }), "剧");

    expect(screen.getByText("搜索中…")).toBeInTheDocument();
  });
});
