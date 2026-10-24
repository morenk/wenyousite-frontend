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
  expect(screen.getByRole("combobox", { name: "字体" })).toBeEnabled();
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


test("缩略样张加载文字不影响按字体名称键盘定位", async () => {
  const user = userEvent.setup();
  const { controls } = setup({
    options: [{ value: "a", label: "Alpha" }, { value: "b", label: "Beta" }],
    renderThumbnail: () => <span aria-hidden="true">样张</span>,
  });
  await user.click(screen.getByRole("combobox", { name: "字体" }));
  await user.keyboard("b{Enter}");
  expect(screen.getByRole("combobox", { name: "字体" })).toHaveTextContent("Beta");
  await user.click(screen.getByRole("button", { name: "应用" }));
  expect(controls.onApply).toHaveBeenCalledWith("b");
});


test("动态字体按语言平铺，点选立即应用；不挂载字库预览", async () => {
  const { controls } = setup({ value: "a", previewMode: "automatic",
    options: [{ value: "a", label: "甲字体", group: "中文" }, { value: "b", label: "Beta", group: "英文" }],
    renderThumbnail: () => <span aria-hidden="true">样张</span>, onOpen: vi.fn(),
  });
  expect(controls.onOpen).toHaveBeenCalledOnce();
  expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  expect(screen.queryByRole("tab", { name: "其他" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "甲字体" })).toHaveAttribute("aria-pressed", "true");
  expect(controls.renderPreview).not.toHaveBeenCalled();
  const user = userEvent.setup();
  await user.click(screen.getByRole("tab", { name: "英文" }));
  await user.click(screen.getByRole("button", { name: "Beta" }));
  expect(controls.onApply).toHaveBeenCalledExactlyOnceWith("b");
  expect(readRecentTextFonts("test-account", controls.options)).toEqual(["b"]);
});

test("当前日文字体决定初始筛选，未知分组才出现其他；关闭不应用", async () => {
  const { controls } = setup({ value: "ja", previewMode: "automatic", options: [
    { value: "ja", label: "日文字体", group: "日文" }, { value: "future", label: "未来字体", group: "新语言" },
  ] });
  expect(screen.getByRole("tab", { name: "日文" })).toHaveAttribute("aria-selected", "true");
  await userEvent.setup().click(screen.getByRole("tab", { name: "其他" }));
  expect(screen.getByRole("button", { name: "未来字体" })).toBeInTheDocument();
  await userEvent.setup().click(screen.getByRole("button", { name: "关闭字体面板" }));
  expect(controls.onCancel).toHaveBeenCalledOnce();
  expect(controls.onApply).not.toHaveBeenCalled();
});

test("动态列表离线仍可恢复默认，应用失败保留面板且不记最近使用", async () => {
  const { controls, rerender } = setup({ previewMode: "automatic", value: "a", options: [{value: "a", label: "甲字体", group: "中文"}], error: "读取失败" });
  expect(screen.getByRole("button", { name: "甲字体" })).toBeDisabled();
  await userEvent.setup().click(screen.getByRole("button", { name: "系统默认" }));
  expect(controls.onApply).toHaveBeenCalledWith(null);
  rerender(<EditorTextFontPicker controls={{...controls, error: undefined, onApply: () => false}}/>);
  await userEvent.setup().click(screen.getByRole("button", { name: "甲字体" }));
  expect(screen.getByRole("alert")).toHaveTextContent("未能应用字体");
  expect(readRecentTextFonts("test-account", controls.options)).toEqual([]);
});

test("动态字体行支持上下键和首尾定位，语言分段使用标准方向键", async () => {
  setup({previewMode:"automatic",options:[{value:"a",label:"甲",group:"中文"},{value:"b",label:"乙",group:"中文"}]});
  const user=userEvent.setup();
  screen.getByRole("button",{name:"甲"}).focus();
  await user.keyboard("{ArrowDown}");expect(screen.getByRole("button",{name:"乙"})).toHaveFocus();
  await user.keyboard("{Home}");expect(screen.getByRole("button",{name:"甲"})).toHaveFocus();
  screen.getByRole("tab",{name:"中文"}).focus();await user.keyboard("{ArrowRight}");
  expect(screen.getByRole("tab",{name:"日文"})).toHaveFocus();
});


test("目录首次离线时仍能将现有字体恢复默认，未核验的新字体不可选或应用", async () => {
  const { controls } = setup({ value: options[0]!.value, error: "字体列表加载失败" });
  const user = userEvent.setup();
  expect(screen.getByRole("button", { name: "应用" })).toBeDisabled();
  await user.click(screen.getByRole("combobox", { name: "字体" }));
  expect(screen.getByRole("option", { name: "测试字体 2" })).toHaveAttribute("aria-disabled", "true");
  await user.click(screen.getByRole("option", { name: "测试字体 2" }));
  expect(controls.onApply).not.toHaveBeenCalled();
  await user.click(screen.getByRole("option", { name: "系统默认" }));
  expect(screen.getByRole("button", { name: "应用" })).toBeEnabled();
  await user.click(screen.getByRole("button", { name: "应用" }));
  expect(controls.onApply).toHaveBeenCalledExactlyOnceWith(null);
});


test("目录延迟返回时定位当前字体语言，用户切换后不被后台刷新重置", async () => {
 const {controls,rerender}=setup({previewMode:"automatic",value:"ja",options:[],loading:true});
 const loaded=[{value:"ja",label:"日文字体",group:"日文"}];
 rerender(<EditorTextFontPicker controls={{...controls,loading:false,options:loaded}}/>);
 expect(screen.getByRole("tab",{name:"日文"})).toHaveAttribute("aria-selected","true");
 await userEvent.setup().click(screen.getByRole("tab",{name:"英文"}));
 rerender(<EditorTextFontPicker controls={{...controls,loading:false,options:loaded.map(option=>({...option}))}}/>);
 expect(screen.getByRole("tab",{name:"英文"})).toHaveAttribute("aria-selected","true");
});

test("v2语言组遵循目录顺序，不按名称、最近使用或选中项重排，原会话可更新顺序", () => {
  const a = { value: "tfv-a", label: "A字体", group: "中文" };
  const z = { value: "tfv-z", label: "Z字体", group: "中文" };
  localStorage.setItem("wenyou:text-fonts:test-account", JSON.stringify([a.value]));
  const { controls, rerender } = setup({ options: [z, a], value: a.value, previewMode: "automatic" });
  const labels = () => within(screen.getByLabelText("中文字体")).getAllByRole("button").map(button => button.getAttribute("aria-label"));
  expect(labels()).toEqual(["Z字体", "A字体"]);
  fireEvent.click(screen.getByRole("button", { name: "Z字体" }));
  rerender(<EditorTextFontPicker controls={{ ...controls, value: z.value }} />);
  expect(labels()).toEqual(["Z字体", "A字体"]);
  rerender(<EditorTextFontPicker controls={{ ...controls, value: z.value, options: [a, z] }} />);
  expect(labels()).toEqual(["A字体", "Z字体"]);
  expect(screen.getByRole("button", { name: "Z字体" })).toHaveAttribute("aria-pressed", "true");
});
