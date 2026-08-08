import { afterEach, describe, expect, test, vi } from "vitest";
import {
  compressMomentImage,
  getMomentFeedAspectRatio,
  getMomentImageDimensions,
  MOMENT_FEED_MIN_ASPECT_RATIO,
  MOMENT_IMAGE_MAX_EDGE,
  validateMomentImageFile,
} from "@/lib/moment-image";

describe("动态图片压缩", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  test("横图与竖图都按长边 1920px 等比缩放", () => {
    expect(getMomentImageDimensions(4000, 3000)).toEqual({ width: 1920, height: 1440 });
    expect(getMomentImageDimensions(3000, 4000)).toEqual({ width: 1440, height: 1920 });
    expect(getMomentImageDimensions(800, 1200)).toEqual({ width: 800, height: 1200 });
    expect(MOMENT_IMAGE_MAX_EDGE).toBe(1920);
  });

  test("拒绝不可计算或非正数的图片尺寸", () => {
    expect(() => getMomentImageDimensions(0, 100)).toThrow("无法读取图片尺寸");
    expect(() => getMomentImageDimensions(100, Number.NaN)).toThrow("无法读取图片尺寸");
    expect(() => getMomentImageDimensions(Number.POSITIVE_INFINITY, 100)).toThrow("无法读取图片尺寸");
  });

  test("信息流保留较矮封面的原始比例，只限制过长竖图", () => {
    expect(getMomentFeedAspectRatio(1600, 900)).toBeCloseTo(16 / 9);
    expect(getMomentFeedAspectRatio(1000, 1000)).toBe(1);
    expect(getMomentFeedAspectRatio(1280, 1920)).toBe(MOMENT_FEED_MIN_ASPECT_RATIO);
    expect(getMomentFeedAspectRatio(null, null)).toBe(MOMENT_FEED_MIN_ASPECT_RATIO);
  });

  test("动态拒绝 GIF，避免前端压缩后静默丢失动画", () => {
    const gif = new File(["gif"], "animated.gif", { type: "image/gif" });
    expect(validateMomentImageFile(gif)).toMatch(/暂不支持动图/);
  });

  test("原图只参与本地绘制，上传文件统一输出为 WebP", async () => {
    const close = vi.fn();
    vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue({
      width: 4000,
      height: 3000,
      close,
    }));
    const drawImage = vi.fn();
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => ({ drawImage })),
      toBlob: vi.fn((callback: BlobCallback, type?: string, quality?: number) => {
        expect(type).toBe("image/webp");
        expect(quality).toBe(0.82);
        callback(new Blob(["compressed"], { type: "image/webp" }));
      }),
    };
    const createElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tagName, options) => (
      tagName === "canvas"
        ? canvas as unknown as HTMLCanvasElement
        : createElement(tagName, options)
    ));

    const original = new File(["original image bytes"], "holiday.JPG", { type: "image/jpeg" });
    const compressed = await compressMomentImage(original);

    expect(canvas.width).toBe(1920);
    expect(canvas.height).toBe(1440);
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 1920, 1440);
    expect(compressed).not.toBe(original);
    expect(compressed.name).toBe("holiday.webp");
    expect(compressed.type).toBe("image/webp");
    expect(close).toHaveBeenCalledOnce();
  });

  test("取消后不会继续编码或上传", async () => {
    const controller = new AbortController();
    controller.abort();
    const file = new File(["image"], "photo.jpg", { type: "image/jpeg" });

    await expect(compressMomentImage(file, { signal: controller.signal })).rejects.toMatchObject({
      name: "AbortError",
    });
  });

  test("图片解码或 Canvas 不可用时返回可理解错误并释放 bitmap", async () => {
    const file = new File(["image"], "photo.jpg", { type: "image/jpeg" });
    vi.stubGlobal("createImageBitmap", vi.fn().mockRejectedValueOnce(new Error("decode")));
    await expect(compressMomentImage(file)).rejects.toThrow("无法读取图片，请更换图片后重试");

    const close = vi.fn();
    vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue({ width: 100, height: 100, close }));
    const createElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tagName, options) => (
      tagName === "canvas"
        ? { width: 0, height: 0, getContext: () => null } as unknown as HTMLCanvasElement
        : createElement(tagName, options)
    ));

    await expect(compressMomentImage(file)).rejects.toThrow("当前浏览器不支持图片压缩");
    expect(close).toHaveBeenCalledOnce();
  });

  test("编码返回空 Blob 时失败；编码后取消仍释放 bitmap", async () => {
    const file = new File(["image"], "photo.jpg", { type: "image/jpeg" });
    const close = vi.fn();
    vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue({ width: 100, height: 100, close }));
    const createElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tagName, options) => (
      tagName === "canvas"
        ? {
            width: 0,
            height: 0,
            getContext: () => ({ drawImage: vi.fn() }),
            toBlob: (callback: BlobCallback) => callback(null),
          } as unknown as HTMLCanvasElement
        : createElement(tagName, options)
    ));

    await expect(compressMomentImage(file)).rejects.toThrow("图片压缩失败，请更换图片后重试");
    expect(close).toHaveBeenCalledOnce();

    vi.restoreAllMocks();
    const controller = new AbortController();
    const abortedClose = vi.fn();
    vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue({ width: 100, height: 100, close: abortedClose }));
    const freshCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tagName, options) => (
      tagName === "canvas"
        ? {
            width: 0,
            height: 0,
            getContext: () => ({ drawImage: vi.fn() }),
            toBlob: (callback: BlobCallback) => {
              controller.abort();
              callback(new Blob(["compressed"], { type: "image/webp" }));
            },
          } as unknown as HTMLCanvasElement
        : freshCreateElement(tagName, options)
    ));

    await expect(compressMomentImage(file, { signal: controller.signal })).rejects.toMatchObject({
      name: "AbortError",
    });
    expect(abortedClose).toHaveBeenCalledOnce();
  });
});
