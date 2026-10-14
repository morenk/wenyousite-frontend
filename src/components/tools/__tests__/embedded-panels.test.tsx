import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import userEvent from "@testing-library/user-event";
import { TextToolPanel } from "../text-tool-panel";
import { NameToolPanel } from "../name-tool-panel";
import { VerticalToolPanel } from "../vertical-tool-panel";
import * as clipboard from "@/lib/tools/clipboard";
import * as names from "@/lib/tools/names";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const set = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
describe("App 嵌入工具工作面", () => {
  test("文本与起名在 hydration 前禁用所有输入、生成与自定义 Select", () => {
    for (const panel of [<TextToolPanel key="morse" tool="morse" embedded />, <TextToolPanel key="fancy" tool="fancy" embedded />, <NameToolPanel key="names" embedded />]) {
      const container = document.createElement("div");
      container.innerHTML = renderToStaticMarkup(panel);
      expect(container.querySelector("fieldset")).toBeDisabled();
      for (const control of container.querySelectorAll("input, textarea, button")) expect(control).toBeDisabled();
    }
  });
  test("摩斯显式双向切换，生成前无空结果，解码与复制仍可用", async () => {
    vi.spyOn(clipboard, "copyToolText").mockResolvedValue(true);
    render(<TextToolPanel tool="morse" embedded />);
    expect(screen.queryByLabelText("生成结果")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "编码" })).toHaveAttribute("aria-pressed", "true");
    set("输入文字", "SOS");
    await userEvent.click(screen.getByRole("button", { name: "生成摩斯码" }));
    await waitFor(() => expect(screen.getByLabelText("生成结果")).toHaveValue("... --- ..."));
    await userEvent.click(screen.getByRole("button", { name: "解码" }));
    set("输入摩斯码", "... --- ...");
    await userEvent.click(screen.getByRole("button", { name: "解码为文字" }));
    await waitFor(() => expect(screen.getByLabelText("生成结果")).toHaveValue("SOS"));
    expect(screen.getByLabelText("生成结果")).toHaveAttribute("wrap", "soft");
    await userEvent.click(screen.getByRole("button", { name: "复制全部" }));
    expect(clipboard.copyToolText).toHaveBeenCalledWith("SOS");
    expect(await screen.findByText("已复制")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "清空" }));
    expect(screen.queryByLabelText("生成结果")).not.toBeInTheDocument();
  });
  test("花体选择显示真实字符样例且生成仍使用所选样式", async () => {
    render(<TextToolPanel tool="fancy" embedded />);
    expect(screen.getByRole("combobox", { name: "文字样式" })).toHaveTextContent("ℋℯ𝓁𝓁ℴ 𝒲ℯ𝓃𝓎ℴ𝓊");
    await userEvent.click(screen.getByRole("combobox", { name: "文字样式" }));
    await userEvent.click(screen.getByRole("option", { name: "粗体" }));
    set("输入文字", "Ab");
    await userEvent.click(screen.getByRole("button", { name: "生成文字" }));
    await waitFor(() => expect(screen.getByLabelText("生成结果")).toHaveValue("𝐀𝐛"));
  });
  test("竖排列间设置可展开、自定义分隔仍按原算法生成", async () => {
    render(<VerticalToolPanel embedded />);
    const summary = screen.getByText("列间设置").closest("summary")!;
    expect(summary.parentElement).not.toHaveAttribute("open");
    await userEvent.click(summary);
    expect(summary.parentElement).toHaveAttribute("open");
    await userEvent.click(screen.getByRole("combobox", { name: "列间分隔" }));
    await userEvent.click(screen.getByRole("option", { name: "自定义" }));
    set("自定义分隔符", " | "); set("输入文字", "甲乙丙丁"); set("页宽（每页列数）", "2"); set("页高（每列字数）", "2");
    await userEvent.click(summary);
    await userEvent.click(screen.getByRole("button", { name: "生成文字" }));
    await waitFor(() => expect(screen.getByLabelText("生成结果")).toHaveValue("丙 | 甲\n丁 | 乙"));
    expect(screen.getByLabelText("生成结果")).toHaveAttribute("wrap", "off");
  });
  test("名字结果可单个复制，失败提示可手动选择，仍支持复制全部", async () => {
    vi.spyOn(names, "loadNameData").mockResolvedValue({ source: "test", given: { generic: ["知遥", "星遥"] }, family: { generic: ["林"] } });
    const copy = vi.spyOn(clipboard, "copyToolText").mockResolvedValue(false);
    render(<NameToolPanel embedded />); set("生成数量", "2");
    await userEvent.click(screen.getByRole("button", { name: "生成名字" }));
    await userEvent.click(await screen.findByRole("button", { name: "复制林知遥" }));
    expect(copy).toHaveBeenCalledWith("林知遥");
    expect(await screen.findByText("复制未成功，请长按或选中结果手动复制")).toBeInTheDocument();
    expect(screen.getByText("林知遥", { exact: true })).toHaveClass("select-text");
    await userEvent.click(screen.getByRole("button", { name: "复制全部" }));
    expect(copy.mock.calls.at(-1)?.[0].split("\n").sort()).toEqual(["林星遥", "林知遥"].sort());
  });
  test("嵌入页外国姓名隐藏中文风格，返回中国时重置为常见人名", async () => {
    render(<NameToolPanel embedded />);
    await userEvent.click(screen.getByRole("combobox", { name: "起名风格" }));
    await userEvent.click(screen.getByRole("option", { name: "古风角色名（中文）" }));
    await userEvent.click(screen.getByRole("combobox", { name: "国家" }));
    await userEvent.click(screen.getByRole("option", { name: "日本" }));
    expect(screen.queryByRole("combobox", { name: "起名风格" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("combobox", { name: "国家" }));
    await userEvent.click(screen.getByRole("option", { name: "中国" }));
    expect(screen.getByRole("combobox", { name: "起名风格" })).toHaveTextContent("常见人名");
  });
  test("只在明确生成后引导到离屏结果，尊重减少动效且不抢焦点", async () => {
    const descriptor = Object.getOwnPropertyDescriptor(Element.prototype, "scrollIntoView");
    const scroll = vi.fn();
    Object.defineProperty(Element.prototype, "scrollIntoView", { configurable: true, value: scroll });
    const originalBounds = HTMLElement.prototype.getBoundingClientRect;
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      return this.tagName === "SECTION" ? new DOMRect(0, 900, 300, 300) : originalBounds.call(this);
    });
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    vi.spyOn(window, "matchMedia").mockReturnValue({ ...media, matches: true });
    try {
      render(<TextToolPanel tool="morse" />);
      expect(screen.getByLabelText("生成结果")).toHaveValue("");
      set("文字或摩斯码", "SOS");
      await userEvent.click(screen.getByRole("button", { name: "生成文字" }));
      await waitFor(() => expect(screen.getByLabelText("生成结果")).toHaveValue("... --- ..."));
      expect(scroll).not.toHaveBeenCalled();
      cleanup();
      render(<TextToolPanel tool="morse" embedded />);
      set("输入文字", "SOS"); expect(scroll).not.toHaveBeenCalled();
      const generate = screen.getByRole("button", { name: "生成摩斯码" });
      await userEvent.click(generate);
      await waitFor(() => expect(scroll).toHaveBeenCalledWith({ block: "start", behavior: "auto" }));
      expect(generate).toHaveFocus();
      set("输入文字", "A"); expect(scroll).toHaveBeenCalledTimes(1);
      vi.mocked(window.matchMedia).mockReturnValue({ ...media, matches: false });
      await userEvent.click(generate);
      await waitFor(() => expect(scroll).toHaveBeenLastCalledWith({ block: "start", behavior: "smooth" }));
    } finally {
      if (descriptor) Object.defineProperty(Element.prototype, "scrollIntoView", descriptor);
      else Reflect.deleteProperty(Element.prototype, "scrollIntoView");
    }
  });

});
