import { afterEach, describe, expect, test, vi } from "vitest";
import { assertImageCanBeProcessed, inspectImageContainer } from "@/lib/image-container";
import { normalizeImageForUpload, uploadImageFile } from "@/lib/upload-image";
import { compressMomentImage } from "@/lib/moment-image";
import { imageFixture } from "./image-fixtures";
import { apiClient } from "@/api/client";

vi.mock("@/api/client", () => ({ apiClient: { POST: vi.fn(), GET: vi.fn() } }));
const file = (name: string, type = `image/${name.split(".").at(-1)}`) => new File([imageFixture(name)], name, { type });
function box(type: string, data: Uint8Array = new Uint8Array()) {
  const result = new Uint8Array(data.length + 8);
  new DataView(result.buffer).setUint32(0, result.length);
  result.set(new TextEncoder().encode(type), 4);
  result.set(data, 8);
  return result;
}

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe("真实编码图片容器", () => {
  test.each(["jpeg", "png", "webp", "avif", "gif"])("静态 %s 正常识别并保留格式", async (kind) => {
    expect(await assertImageCanBeProcessed(file(`static.${kind}`))).toEqual({ kind, animated: false });
  });
  test.each(["gif", "png", "webp"])("识别真实多帧 %s", (kind) => {
    expect(inspectImageContainer(imageFixture(`animated.${kind}`))).toEqual({ kind, animated: true });
  });
  test("GIF 原件和字节完整保留；错误 MIME 的 GIF 被明确拒绝", async () => {
    const bitmap = vi.fn(); vi.stubGlobal("createImageBitmap", bitmap);
    const source = file("animated.gif");
    const result = await normalizeImageForUpload(source);
    expect(result).toBe(source);
    expect(new Uint8Array(await result.arrayBuffer())).toEqual(imageFixture("animated.gif"));
    await expect(normalizeImageForUpload(file("animated.gif", "image/png"))).rejects.toThrow("声明格式");
    expect(bitmap).not.toHaveBeenCalled();
  });
  test.each(["png", "webp"])("%s 动画在正文、私信等共享上传和动态压缩之前拒绝", async (kind) => {
    const bitmap = vi.fn(); vi.stubGlobal("createImageBitmap", bitmap);
    await expect(uploadImageFile(file(`animated.${kind}`))).rejects.toThrow("暂不支持");
    await expect(compressMomentImage(file(`animated.${kind}`))).rejects.toThrow("暂不支持");
    expect(bitmap).not.toHaveBeenCalled();
    expect(apiClient.POST).not.toHaveBeenCalled();
  });
  test("单帧 acTL 也不能进入静图压缩链路", async () => {
    await expect(normalizeImageForUpload(file("single-frame-apng.png"))).rejects.toThrow("暂不支持");
  });
  test("没有 createImageBitmap 时也不能绕过动画或内容检查", async () => {
    vi.stubGlobal("createImageBitmap", undefined);
    await expect(normalizeImageForUpload(file("animated.png"))).rejects.toThrow("暂不支持");
    await expect(normalizeImageForUpload(new File(["not an image"], "fake.gif", { type: "image/gif" }))).rejects.toThrow("格式无效");
  });
  test.each(["jpeg", "png", "webp", "avif"])("静态 %s 继续进入 Canvas", async (kind) => {
    const bitmap = vi.fn().mockResolvedValue({ width: 2, height: 2, close: vi.fn() });
    vi.stubGlobal("createImageBitmap", bitmap);
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage: vi.fn() } as never);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((callback) => callback(new Blob([imageFixture("static.webp")], { type: "image/webp" })));
    expect((await normalizeImageForUpload(file(`static.${kind}`))).type).toBe("image/webp");
    expect(bitmap).toHaveBeenCalledOnce();
  });
  test("QQ JPEG 的 EOI 后附加数据继续交真实解码，不被容器检查误拒", async () => {
    const bitmap = vi.fn().mockResolvedValue({ width: 2, height: 2, close: vi.fn() });
    vi.stubGlobal("createImageBitmap", bitmap);
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage: vi.fn() } as never);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((callback) => callback(new Blob([imageFixture("static.webp")], { type: "image/webp" })));
    const source = new File([imageFixture("static.jpeg"), "QQ trailing metadata"], "qq.jpg", { type: "image/jpeg" });
    await expect(normalizeImageForUpload(source)).resolves.toHaveProperty("type", "image/webp");
    expect(bitmap).toHaveBeenCalledWith(source);
  });
  test("所有格式声明冲突、空声明和伪装为 GIF 的静图都拒绝", async () => {
    for (const kind of ["jpeg", "png", "webp", "avif", "gif"]) {
      await expect(assertImageCanBeProcessed(file(`static.${kind}`, "image/unknown"))).rejects.toThrow("声明格式");
    }
    await expect(assertImageCanBeProcessed(file("static.png", "image/gif"))).rejects.toThrow("声明格式");
    await expect(assertImageCanBeProcessed(file("static.jpeg", ""))).rejects.toThrow("声明格式");
    await expect(assertImageCanBeProcessed(file("static.gif"), true)).rejects.toThrow("暂不支持");
  });
  test("元数据载荷中的动画标记不能被当作容器块", () => {
    expect(inspectImageContainer(imageFixture("static-markers.png")).animated).toBe(false);
    const webp = imageFixture("static.webp");
    const comment = box("EXIF", new TextEncoder().encode("ANIMANMFavis"));
    new DataView(comment.buffer).setUint32(4, comment.length - 8, true);
    comment.set(new TextEncoder().encode("EXIF"), 0);
    const bytes = new Uint8Array([...webp, ...comment]);
    new DataView(bytes.buffer).setUint32(4, bytes.length - 8, true);
    expect(inspectImageContainer(bytes).animated).toBe(false);
  });
  test.each(["png", "webp", "gif"])("%s 的每个截断前缀均拒绝", (kind) => {
    const original = imageFixture(`static.${kind}`);
    for (let size = 0; size < original.length; size++) expect(() => inspectImageContainer(original.slice(0, size))).toThrow();
  });
  test("PNG 的损坏 CRC、错首块、缺数据和结尾垃圾均拒绝", () => {
    const original = imageFixture("static.png");
    const badCrc = original.slice(); badCrc[29] ^= 1;
    const badHeader = original.slice(); badHeader[12] = 0;
    for (const bytes of [badCrc, badHeader, new Uint8Array([...original, 0]), original.slice(0, 33)]) {
      expect(() => inspectImageContainer(bytes)).toThrow("格式无效");
    }
  });
  test("GIF 坏尺寸、块标签和 LZW 位数拒绝，尾随数据保持兼容", () => {
    const original = imageFixture("static.gif");
    const descriptor = original.indexOf(0x2c, 13);
    for (const [offset, value] of [[6, 0], [descriptor, 0], [descriptor + 5, 0], [descriptor + 10, 1]]) {
      const bytes = original.slice(); bytes[offset] = value;
      expect(() => inspectImageContainer(bytes)).toThrow("格式无效");
    }
    expect(inspectImageContainer(new Uint8Array([...original, 0])).kind).toBe("gif");
  });
  test("AVIF 按品牌及顶层轨道拒绝序列，截断 box 和未知品牌不假定安全", async () => {
    const original = imageFixture("static.avif");
    const sequence = original.slice(); sequence.set(new TextEncoder().encode("avis"), 8);
    expect(inspectImageContainer(sequence).animated).toBe(true);
    await expect(assertImageCanBeProcessed(new File([sequence], "sequence.avif", { type: "image/avif" }))).rejects.toThrow("暂不支持");
    expect(inspectImageContainer(new Uint8Array([...original, ...box("moov")])).animated).toBe(true);
    for (const size of [1, 2, original.length - 1]) expect(() => inspectImageContainer(original.slice(0, size))).toThrow();
    const unknown = box("ftyp", new TextEncoder().encode("heic0000heic"));
    expect(() => inspectImageContainer(unknown)).toThrow("格式无效");
    const extended = new Uint8Array(16); extended.set(new TextEncoder().encode("free"), 4);
    new DataView(extended.buffer).setUint32(0, 1);
    new DataView(extended.buffer).setBigUint64(8, BigInt(16));
    expect(inspectImageContainer(new Uint8Array([...original, ...extended])).animated).toBe(false);
    new DataView(extended.buffer).setBigUint64(8, BigInt("0xffffffffffffffff"));
    expect(() => inspectImageContainer(new Uint8Array([...original, ...extended]))).toThrow("格式无效");
    const toEnd = box("free"); new DataView(toEnd.buffer).setUint32(0, 0);
    expect(inspectImageContainer(new Uint8Array([...original, ...toEnd])).animated).toBe(false);
  });
});
