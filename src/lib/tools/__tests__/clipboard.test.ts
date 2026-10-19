import { afterEach, expect, test, vi } from "vitest";
import { copyToolText } from "../clipboard";
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); document.body.innerHTML = ""; });
test("优先异步剪贴板", async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal("navigator", { clipboard: { writeText } });
  expect(await copyToolText("文字")).toBe(true); expect(writeText).toHaveBeenCalledWith("文字");
});
test("拒绝或缺失时受控DOM回退并恢复焦点/选择", async () => {
  vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) } });
  const button = document.createElement("button"); button.textContent = "copy"; document.body.append(button); button.focus();
  const range = document.createRange(); range.selectNodeContents(button); document.getSelection()?.addRange(range);
  const copy = vi.fn(() => { expect(document.querySelector("textarea")?.value).toBe("结果"); return true; });
  Object.defineProperty(document, "execCommand", { configurable: true, value: copy });
  expect(await copyToolText("结果")).toBe(true); expect(copy).toHaveBeenCalledWith("copy");
  expect(document.querySelector("textarea")).toBeNull(); expect(document.activeElement).toBe(button);
  expect(document.getSelection()?.toString()).toBe("copy");
});
test("回退不支持或失败返回false", async () => {
  vi.stubGlobal("navigator", {});
  Object.defineProperty(document, "execCommand", { configurable: true, value: () => { throw new Error("unsupported"); } });
  expect(await copyToolText("结果")).toBe(false);
  Object.defineProperty(document, "execCommand", { configurable: true, value: () => false });
  expect(await copyToolText("结果")).toBe(false);
});

test("弹窗焦点圈定内降级复制并恢复输入框选区", async () => {
  vi.stubGlobal("navigator", {});
  const dialog = document.createElement("div");
  dialog.setAttribute("role", "dialog");
  const original = document.createElement("textarea");
  original.value = "原有输入内容";
  dialog.append(original);
  document.body.append(dialog);
  original.focus();
  original.setSelectionRange(1, 4, "backward");
  const trap = () => {
    if (!dialog.contains(document.activeElement)) original.focus();
  };
  document.addEventListener("focusin", trap);
  Object.defineProperty(document, "execCommand", { configurable: true, value: () => {
    const temporary = document.activeElement as HTMLTextAreaElement;
    expect(temporary).not.toBe(original);
    expect(dialog.contains(temporary)).toBe(true);
    expect(temporary.value).toBe("待复制文本");
    expect(temporary.selectionStart).toBe(0);
    expect(temporary.selectionEnd).toBe(5);
    return true;
  } });
  try {
    expect(await copyToolText("待复制文本")).toBe(true);
    expect(document.activeElement).toBe(original);
    expect([original.selectionStart, original.selectionEnd, original.selectionDirection]).toEqual([1, 4, "backward"]);
    expect(dialog.querySelectorAll("textarea")).toHaveLength(1);
  } finally {
    document.removeEventListener("focusin", trap);
  }
});
