import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import userEvent from "@testing-library/user-event";
import { VerticalToolPanel } from "../vertical-tool-panel";
import * as clipboard from "@/lib/tools/clipboard";
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const choose = async (label: string, name: string) => { await userEvent.click(screen.getByRole("combobox", { name: label })); await userEvent.click(screen.getByRole("option", { name })); };
const set = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
describe("竖排页设置与文本操作", () => {
  test("SSR在hydration前禁用表单与Select，避免原生提交泄露输入", () => {
    const container = document.createElement("div"); container.innerHTML = renderToStaticMarkup(<VerticalToolPanel />);
    expect(container.querySelector("fieldset")).toHaveAttribute("disabled");
    expect(container.querySelector("textarea#vertical-input")).toBeDisabled();
    expect(container.querySelector('button[type="submit"]')).toBeDisabled();
    for (const select of container.querySelectorAll('[role="combobox"]')) expect(select).toHaveAttribute("disabled");
  });
  test("默认设置、示例与embedded仅复制", async () => {
    render(<VerticalToolPanel embedded />);
    expect(screen.getByLabelText("页宽（每页列数）")).toHaveValue(10); expect(screen.getByLabelText("页高（每列字数）")).toHaveValue(20);
    expect(screen.getByLabelText("列间空格数")).toHaveValue(2); expect(screen.getByRole("combobox", { name: "阅读顺序" })).toHaveTextContent("从右向左");
    expect(screen.queryByRole("button", { name: "打开文本" })).not.toBeInTheDocument(); expect(screen.queryByRole("button", { name: "下载结果" })).not.toBeInTheDocument(); expect(document.querySelector('input[type="file"]')).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "示例：静夜思" })); expect(screen.getByLabelText("输入文字")).toHaveValue("床前明月光，\n疑是地上霜。\n举头望明月，\n低头思故乡。");
    await userEvent.click(screen.getByRole("button", { name: "生成文字" })); await waitFor(() => expect(screen.getByLabelText("生成结果")).not.toHaveValue(""));
    await userEvent.click(screen.getByRole("button", { name: "清空" })); expect(screen.getByLabelText("输入文字")).toHaveValue(""); expect(screen.queryByRole("button", { name: "复制全部" })).not.toBeInTheDocument();
  });
  test("分页与自定义分隔、左读切换，隐藏空格字段不阻断", async () => {
    render(<VerticalToolPanel />); set("输入文字", "甲乙丙丁戊己庚辛"); set("页宽（每页列数）", "3"); set("页高（每列字数）", "2"); set("列间空格数", "1");
    await userEvent.click(screen.getByRole("button", { name: "生成文字" })); await waitFor(() => expect(screen.getByLabelText("生成结果")).toHaveValue("戊 丙 甲\n己 丁 乙\n\n      庚\n      辛"));
    set("输入文字", "A中\nB文"); set("页宽（每页列数）", "2"); set("列间空格数", ""); await choose("列间分隔", "自定义"); expect(screen.getByLabelText("自定义分隔符")).toHaveValue(" | ");
    await userEvent.click(screen.getByRole("button", { name: "生成文字" })); await waitFor(() => expect(screen.getByLabelText("生成结果")).toHaveValue("B  | A \n文 | 中"));
    await choose("阅读顺序", "从左向右"); await userEvent.click(screen.getByRole("button", { name: "生成文字" })); await waitFor(() => expect(screen.getByLabelText("生成结果")).toHaveValue("A  | B \n中 | 文"));
    set("页宽（每页列数）", "0"); await userEvent.click(screen.getByRole("button", { name: "生成文字" })); expect(await screen.findByText("页宽至少 1 列")).toBeInTheDocument();
  });
  test("普通Web仅保留文本操作，生成和复制不依赖文件入口", async () => {
    const copy = vi.spyOn(clipboard, "copyToolText").mockResolvedValue(true);
    render(<VerticalToolPanel />);
    expect(screen.queryByRole("button", { name: "打开文本" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "下载结果" })).not.toBeInTheDocument();
    expect(document.querySelector('input[type="file"]')).toBeNull();
    expect(screen.queryByText(/UTF-8|64 KiB|读取本地文件/)).not.toBeInTheDocument();
    set("输入文字", "甲乙"); set("页宽（每页列数）", "1"); set("页高（每列字数）", "2");
    await userEvent.click(screen.getByRole("button", { name: "生成文字" }));
    await userEvent.click(screen.getByRole("button", { name: "复制全部" }));
    expect(copy).toHaveBeenCalledWith("甲\n乙");
    await userEvent.click(screen.getByRole("button", { name: "清空" }));
    expect(screen.getByLabelText("输入文字")).toHaveValue("");
    expect(screen.getByRole("button", { name: "复制全部" })).toBeDisabled();
  });
});
