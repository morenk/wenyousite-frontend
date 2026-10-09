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
