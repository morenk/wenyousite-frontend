import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { EditorTextFontPicker, readRecentTextFonts, type EditorFontControls } from "../editor-text-font-picker";

// 合成选项仅测界面，不是候选目录或正式 fontId。
const options = Array.from({ length: 29 }, (_, index) => ({ value: `fixture-option-${index}`, label: `测试字体 ${index + 1}` }));
afterEach(() => { cleanup(); localStorage.clear(); });
function setup(overrides: Partial<EditorFontControls> = {}) {
  const controls: EditorFontControls = {
    options, value: undefined, enabled: true, accountId: "test-account",
    onApply: vi.fn(() => true), onCancel: vi.fn(),
    renderPreview: vi.fn((option) => <span>{option.label} 中文 Aa</span>), ...overrides,
  };
  const view = render(<EditorTextFontPicker controls={controls} />);
  return { ...view, controls };
}
async function choose(label: string) {
  const user = userEvent.setup();
  await user.click(screen.getByRole("combobox", { name: "字体" }));
  await user.click(await screen.findByRole("option", { name: label }));
}

test("打开29项列表不挂载字体预览；选项变化不写正文，显式预览只处理一项", async () => {
  const { controls } = setup();
  expect(screen.getByRole("combobox", { name: "字体" })).toHaveTextContent("混合字体");
  expect(screen.getByRole("button", { name: "应用" })).toBeDisabled();
  await choose("测试字体 12");
  expect(controls.renderPreview).not.toHaveBeenCalled();
  expect(controls.onApply).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "预览" }));
  expect(controls.renderPreview).toHaveBeenCalledExactlyOnceWith(options[11]);
  expect(screen.getByLabelText("字体预览")).toHaveTextContent("测试字体 12 中文 Aa");
  await choose("测试字体 13");
  expect(screen.queryByLabelText("字体预览")).not.toBeInTheDocument();
  expect(controls.renderPreview).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: "取消" }));
  expect(controls.onCancel).toHaveBeenCalledOnce();
  expect(controls.onApply).not.toHaveBeenCalled();
});

test("系统默认只提交清除字体的空值，不记录为自定义字体", async () => {
  const { controls } = setup({ value: options[0]!.value });
  await choose("系统默认");
  expect(screen.getByRole("button", { name: "预览" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "应用" }));
  expect(controls.onApply).toHaveBeenCalledExactlyOnceWith(null);
  expect(readRecentTextFonts("test-account", options)).toEqual([]);
});

test("成功应用才按账号记录白名单最近项，去重限4；损坏与撤下选项不恢复", async () => {
  localStorage.setItem("wenyou:text-fonts:test-account", JSON.stringify([options[1]!.value, "unknown-font", 12, options[1]!.value, ...options.slice(2, 8).map((entry) => entry.value)]));
  expect(readRecentTextFonts("test-account", options)).toEqual(options.slice(1, 5).map((entry) => entry.value));
  const { controls } = setup({ value: options[3]!.value });
  fireEvent.click(screen.getByRole("button", { name: "应用" }));
  expect(controls.onApply).toHaveBeenCalledExactlyOnceWith(options[3]!.value);
  expect(readRecentTextFonts("test-account", options)).toEqual([options[3]!.value, options[1]!.value, options[2]!.value, options[4]!.value]);
  expect(readRecentTextFonts("other-account", options)).toEqual([]);
  expect(readRecentTextFonts(undefined, options)).toEqual([]);
  expect(readRecentTextFonts("test-account", [])).toEqual([]);
  await userEvent.setup().click(screen.getByRole("combobox", { name: "字体" }));
  const recentGroup = screen.getByRole("group", { name: "最近使用" });
  expect(within(recentGroup).getAllByRole("option")).toHaveLength(4);
  expect(screen.getAllByRole("option")).toHaveLength(30);
  localStorage.setItem("wenyou:text-fonts:test-account", "{");
  expect(readRecentTextFonts("test-account", options)).toEqual([]);
  localStorage.setItem("wenyou:text-fonts:test-account", '{}');
  expect(readRecentTextFonts("test-account", options)).toEqual([]);
});

test("按适配层分组展示29项，最近项不重复；跨组选择仍对应原选项且不预载", async () => {
  // 数量和顺序均为合成 UI 样本，不定义正式语言目录。
  const grouped = options.map((option, index) => ({ ...option, group: ["中文", "日文", "英文"][index % 3]! }));
  localStorage.setItem("wenyou:text-fonts:test-account", JSON.stringify([grouped[1]!.value]));
  const { controls } = setup({ options: grouped });
  const user = userEvent.setup();
  await user.click(screen.getByRole("combobox", { name: "字体" }));
  expect(screen.getAllByRole("option")).toHaveLength(30);
  expect(within(screen.getByRole("group", { name: "最近使用" })).getAllByRole("option")).toHaveLength(1);
  for (const label of ["中文", "日文", "英文"]) {
    const expected = grouped.filter((option) => option.group === label && option.value !== grouped[1]!.value);
    expect(within(screen.getByRole("group", { name: label })).getAllByRole("option").map((option) => option.textContent)).toEqual(expected.map((option) => option.label));
  }
  await user.click(within(screen.getByRole("group", { name: "英文" })).getByRole("option", { name: grouped[26]!.label }));
  expect(controls.renderPreview).not.toHaveBeenCalled();
  expect(controls.onApply).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "预览" }));
  expect(controls.renderPreview).toHaveBeenCalledExactlyOnceWith(grouped[26]);
  await user.click(screen.getByRole("button", { name: "应用" }));
  expect(controls.onApply).toHaveBeenCalledExactlyOnceWith(grouped[26]!.value);
});

test("加载、错误和禁用保留取消出口；目录重试不调用正文命令", () => {
  const { controls, rerender } = setup({ loading: true, onRetry: vi.fn() });
  expect(screen.getByRole("status")).toHaveTextContent("正在加载字体列表");
  expect(screen.getByRole("combobox", { name: "字体" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "应用" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "取消" })).toBeEnabled();
  rerender(<EditorTextFontPicker controls={{ ...controls, loading: false, error: "字体列表加载失败" }} />);
  expect(screen.getByRole("alert")).toHaveTextContent("字体列表加载失败");
  fireEvent.click(screen.getByRole("button", { name: "重试" }));
  expect(controls.onRetry).toHaveBeenCalledOnce();
  rerender(<EditorTextFontPicker controls={{ ...controls, loading: false, enabled: false }} />);
  expect(screen.getByRole("combobox", { name: "字体" })).toBeDisabled();
  expect(controls.onApply).not.toHaveBeenCalled();
});

test("命令失败显示错误且不记最近项；未知值不能应用或预览", () => {
  const { controls, rerender } = setup({ value: options[0]!.value, onApply: vi.fn(() => false) });
  fireEvent.click(screen.getByRole("button", { name: "应用" }));
  expect(screen.getByRole("alert")).toHaveTextContent("未能应用字体");
  expect(readRecentTextFonts("test-account", options)).toEqual([]);
  rerender(<EditorTextFontPicker controls={{ ...controls, options: [] }} />);
  expect(screen.getByRole("status")).toHaveTextContent("暂无可用字体");
  expect(screen.getByRole("button", { name: "应用" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "预览" })).toBeDisabled();
});

test("禁用本机存储仍可应用；键盘可选择系统默认", async () => {
  const user = userEvent.setup();
  const { controls } = setup({ value: options[0]!.value });
  const store = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("storage disabled"); });
  fireEvent.click(screen.getByRole("button", { name: "应用" }));
  expect(controls.onApply).toHaveBeenCalledExactlyOnceWith(options[0]!.value);
  store.mockRestore();
  screen.getByRole("combobox", { name: "字体" }).focus();
  await user.keyboard("{Enter}{Home}{Enter}");
  expect(screen.getByRole("combobox", { name: "字体" })).toHaveTextContent("系统默认");
});


test("目录撤下候选后不从最近记录恢复；原选项不能继续应用或预览", () => {
  localStorage.setItem("wenyou:text-fonts:test-account", JSON.stringify([options[13]!.value, options[0]!.value]));
  const { controls, rerender } = setup({ value: options[13]!.value });
  fireEvent.click(screen.getByRole("button", { name: "预览" }));
  expect(screen.getByLabelText("字体预览")).toBeInTheDocument();
  const remaining = options.slice(0, 11);
  rerender(<EditorTextFontPicker controls={{ ...controls, options: remaining }} />);
  expect(readRecentTextFonts("test-account", remaining)).toEqual([options[0]!.value]);
  expect(screen.getByRole("button", { name: "应用" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "预览" })).toBeDisabled();
  expect(screen.queryByLabelText("字体预览")).not.toBeInTheDocument();
  expect(controls.onApply).not.toHaveBeenCalled();
});
