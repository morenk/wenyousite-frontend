import { afterEach, describe, expect, test, vi } from "vitest";
import { downloadToolText, readToolTextFile, TEXT_FILE_BYTE_LIMIT } from "../text-file";
const file = (bytes: Uint8Array, name = "input.txt", size = bytes.length) => ({ name, size, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) }) as File;
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });
describe("本地UTF-8文本", () => {
  test("中文、BOM和空文件准确读取", async () => {
    expect(await readToolTextFile(file(new TextEncoder().encode("\uFEFF甲乙\r\n👨‍👩‍👧‍👦"), "诗.TXT"))).toBe("甲乙\r\n👨‍👩‍👧‍👦");
    expect(await readToolTextFile(file(new Uint8Array()))).toBe("");
  });
  test("文件字节、文本长度、扩展名和非法编码都明确拒绝", async () => {
    const tooLarge = file(new Uint8Array(), "a.txt", TEXT_FILE_BYTE_LIMIT + 1);
    const read = vi.spyOn(tooLarge, "arrayBuffer");
    await expect(readToolTextFile(tooLarge)).rejects.toThrow("64 KiB"); expect(read).not.toHaveBeenCalled();
    await expect(readToolTextFile(file(new TextEncoder().encode("甲".repeat(10001))))).rejects.toThrow("10,000");
    await expect(readToolTextFile(file(new Uint8Array([0xff, 0xfe])))).rejects.toThrow("UTF-8");
    await expect(readToolTextFile(file(new Uint8Array(), "a.png"))).rejects.toThrow(".txt");
    const unreadable = new File(["x"], "a.txt");
    vi.spyOn(unreadable, "arrayBuffer").mockRejectedValue(new Error("denied"));
    await expect(readToolTextFile(unreadable)).rejects.toThrow("文件读取失败");
  });
  test("下载带BOM且正文保留所有空格，随后回收URL", async () => {
    vi.useFakeTimers();
    const create = vi.fn().mockReturnValue("blob:test"); const revoke = vi.fn();
    vi.stubGlobal("URL", { createObjectURL: create, revokeObjectURL: revoke });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    downloadToolText("B  | A \n文 | 中\n\n  ");
    const anchor = click.mock.contexts[0] as HTMLAnchorElement;
    expect(anchor?.download).toBe("竖排文字.txt"); expect(anchor?.getAttribute("href")).toBe("blob:test"); expect(anchor?.isConnected).toBe(false);
    const blob = create.mock.calls[0][0] as Blob; const bytes = new Uint8Array(await blob.arrayBuffer());
    expect(Array.from(bytes.slice(0, 3))).toEqual([239, 187, 191]);
    expect(new TextDecoder().decode(bytes)).toBe("B  | A \n文 | 中\n\n  ");
    expect(revoke).not.toHaveBeenCalled(); await vi.runAllTimersAsync(); expect(revoke).toHaveBeenCalledWith("blob:test");
  });
});
