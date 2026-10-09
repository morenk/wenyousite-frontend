import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TextToolPanel } from "../text-tool-panel";
import { NameToolPanel } from "../name-tool-panel";
import * as names from "@/lib/tools/names";
import * as clipboard from "@/lib/tools/clipboard";
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
describe("文字工具交互", () => {
  test("竖排配置、生成、复制失败与清空", async () => {
    render(<TextToolPanel tool="vertical" />);
    fireEvent.change(screen.getByLabelText("输入文字"), { target: { value: "甲乙丙丁" } });
    fireEvent.change(screen.getByLabelText("每列字数"), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText("列间空格数"), { target: { value: "1" } });
    await userEvent.click(screen.getByRole("button", { name: "生成文字" }));
    await waitFor(() => expect(screen.getByLabelText("生成结果")).toHaveValue("丙 甲\n丁 乙"));
    vi.spyOn(clipboard, "copyToolText").mockResolvedValue(false);
    await userEvent.click(screen.getByRole("button", { name: "复制全部" }));
    expect(await screen.findByText("复制未成功，请长按或选中结果手动复制")).toBeInTheDocument();
    vi.mocked(clipboard.copyToolText).mockResolvedValue(true);
    await userEvent.click(screen.getByRole("button", { name: "复制全部" }));
    expect(await screen.findByText("已复制")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "清空" }));
    expect(screen.getByLabelText("生成结果")).toHaveValue("");
    expect(screen.getByRole("button", { name: "复制全部" })).toBeDisabled();
  });
  test("摩斯未知字符显式报错", async () => {
    render(<TextToolPanel tool="morse" />);
    fireEvent.change(screen.getByLabelText("文字或摩斯码"), { target: { value: "中文A" } });
    await userEvent.click(screen.getByRole("button", { name: "生成文字" }));
    expect(await screen.findByText(/国际摩斯不支持这些字符/)).toBeInTheDocument();
    expect(screen.getByLabelText("生成结果")).toHaveValue("");
  });
  test("花体输出可复制字符", async () => {
    render(<TextToolPanel tool="fancy" />);
    fireEvent.change(screen.getByLabelText("输入文字"), { target: { value: "Be" } });
    await userEvent.click(screen.getByRole("button", { name: "生成文字" }));
    await waitFor(() => expect(screen.getByLabelText("生成结果")).toHaveValue("ℬℯ"));
  });
  test("姓名异步加载期间禁用控件、失败可重试，固定姓与去重提示", async () => {
    const loader = vi.spyOn(names, "loadNameData").mockRejectedValueOnce(new Error("network"));
    render(<NameToolPanel />);
    fireEvent.change(screen.getByLabelText("固定姓氏（可选）"), { target: { value: "林" } });
    await userEvent.click(screen.getByRole("button", { name: "生成名字" }));
    expect(await screen.findByRole("button", { name: "重试生成" })).toBeInTheDocument();
    let resolve!: (value: names.NameData) => void;
    loader.mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
    await userEvent.click(screen.getByRole("button", { name: "重试生成" }));
    expect(screen.getByRole("combobox", { name: "国家" })).toBeDisabled();
    expect(screen.getByLabelText("固定姓氏（可选）")).toBeDisabled();
    resolve({ source: "test", given: { generic: ["知遥"] }, family: { generic: ["王"] } });
    await waitFor(() => expect(screen.getByLabelText("生成结果")).toHaveValue("林知遥"));
    expect(screen.getByText(/已生成 1 个不同名字/)).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "国家" })).not.toBeDisabled();
  });
});
