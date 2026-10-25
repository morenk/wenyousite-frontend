import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { EditorTextColorPicker, readRecentTextColors } from "../editor-text-color-picker";
afterEach(() => { cleanup(); localStorage.clear(); });
function show(color: string | null | undefined = undefined) {
 const onApply = vi.fn(() => true), onCancel = vi.fn();
 render(<EditorTextColorPicker controls={{ enabled: true, color, accountId: "account", onApply, onCancel }} onModeChange={vi.fn()} />);
 return { onApply, onCancel };
}
test("混色无错误预选；默认T与五预设及自定义同行", () => {
 const { onApply } = show();
 expect(screen.queryAllByRole("button", { pressed: true })).toHaveLength(0);
 expect(screen.queryByRole("group", { name: "最近使用的颜色" })).toBeNull();
 expect(screen.getByRole("button", { name: "默认文字颜色" }).querySelector('[data-icon-semantic="editor.text-color"]')).toHaveAttribute("data-icon-glyph", "type");
 fireEvent.click(screen.getByRole("button", { name: "蓝色" }));
 expect(onApply).toHaveBeenCalledWith("#2563EB");
});
test("RGB只预览，整数边界和取消不修改正文", async () => {
 const { onApply, onCancel } = show();
 await userEvent.setup().click(screen.getByRole("button", { name: "自定义" }));
 for (const value of ["", "-1", "256", "1.5", "a"]) {
   fireEvent.change(screen.getByRole("textbox", { name: "R" }), { target: { value } });
   expect(screen.getByRole("button", { name: "应用" })).toBeDisabled();
 }
 fireEvent.change(screen.getByRole("textbox", { name: "R" }), { target: { value: "0" } });
 fireEvent.change(screen.getByRole("textbox", { name: "G" }), { target: { value: "255" } });
 fireEvent.change(screen.getByRole("textbox", { name: "B" }), { target: { value: "0" } });
 expect(screen.getByRole("button", { name: "应用" })).toBeEnabled();
 expect(onApply).not.toHaveBeenCalled();
 await userEvent.setup().click(screen.getByRole("button", { name: "取消" }));
 expect(onCancel).toHaveBeenCalledOnce(); expect(onApply).not.toHaveBeenCalled();
});
test("自定义应用一次；最近色按账号去重最多4，选最近色重排", async () => {
 localStorage.setItem("wenyou:text-colors:account", JSON.stringify(["#111111", "#222222", "#333333", "#444444"]));
 const { onApply } = show();
 expect(screen.getByRole("group", { name: "最近使用的颜色" }).children).toHaveLength(4);
 fireEvent.click(screen.getByRole("button", { name: "最近颜色 #333333" }));
 expect(readRecentTextColors("account")).toEqual(["#333333", "#111111", "#222222", "#444444"]);
 fireEvent.click(screen.getByRole("button", { name: "自定义" }));
 for (const name of ["R", "G", "B"]) fireEvent.change(screen.getByRole("textbox", { name }), { target: { value: "255" } });
 fireEvent.click(screen.getByRole("button", { name: "应用" }));
 expect(onApply).toHaveBeenLastCalledWith("#FFFFFF");
 expect(readRecentTextColors("account")).toEqual(["#FFFFFF", "#333333", "#111111", "#222222"]);
 expect(readRecentTextColors("other")).toEqual([]);
});
test("应用失败不写最近色", () => {
 render(<EditorTextColorPicker controls={{ enabled: true, color: "#123456", accountId: "account", onApply: () => false, onCancel: vi.fn() }} onModeChange={vi.fn()} />);
 fireEvent.click(screen.getByRole("button", { name: "自定义" }));
 fireEvent.click(screen.getByRole("button", { name: "应用" }));
 expect(readRecentTextColors("account")).toEqual([]);
});

test("色相及色盘键盘更新RGB预览，直到应用才提交", () => {
 const { onApply } = show("#FF0000");
 fireEvent.click(screen.getByRole("button", { name: "自定义" }));
 expect(screen.getByRole("textbox", { name: "R" })).toHaveFocus();
 fireEvent.change(screen.getByRole("slider", { name: "色相" }), { target: { value: "120" } });
 expect(screen.getByRole("textbox", { name: "R" })).toHaveValue("0");
 expect(screen.getByRole("textbox", { name: "G" })).toHaveValue("255");
 fireEvent.keyDown(screen.getByRole("slider", { name: "饱和度与亮度" }), { key: "ArrowLeft" });
 expect(screen.getByRole("textbox", { name: "R" })).toHaveValue("3");
 expect(screen.getByRole("textbox", { name: "B" })).toHaveValue("3");
 expect(onApply).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole("button", { name: "应用" }));
 expect(onApply).toHaveBeenCalledExactlyOnceWith("#03FF03");
});
test("损坏最近色安全忽略并按规范RGB去重", () => {
 localStorage.setItem("wenyou:text-colors:account", JSON.stringify(["#abcdef", "#ABCDEF", 123, "red", "#000000", "#111111", "#222222", "#333333"]));
 expect(readRecentTextColors("account")).toEqual(["#ABCDEF", "#000000", "#111111", "#222222"]);
 localStorage.setItem("wenyou:text-colors:account", "{");
 expect(readRecentTextColors("account")).toEqual([]);
});
