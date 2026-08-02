/** avatar-crop 裁剪工具测试：drawImage 源矩形必须直接使用 croppedAreaPixels（原图自然像素），不得二次缩放 */

import { describe, test, expect, vi, afterEach, beforeEach } from "vitest";
import { getCroppedBlob } from "@/lib/avatar-crop";

class FakeImage {
  naturalWidth = 0;
  naturalHeight = 0;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  set src(_value: string) {
    this.onload?.();
  }
}

const originalGetContext = HTMLCanvasElement.prototype.getContext;
const originalToBlob = HTMLCanvasElement.prototype.toBlob;
const { mockDrawImage } = vi.hoisted(() => ({ mockDrawImage: vi.fn() }));

beforeEach(() => {
  vi.stubGlobal("Image", FakeImage);
  HTMLCanvasElement.prototype.getContext = (() => ({
    drawImage: mockDrawImage,
  })) as unknown as typeof originalGetContext;
  HTMLCanvasElement.prototype.toBlob = (function (
    this: HTMLCanvasElement,
    cb: BlobCallback,
  ) {
    cb(new Blob(["fake"], { type: "image/webp" }));
  }) as unknown as typeof originalToBlob;
});

afterEach(() => {
  vi.unstubAllGlobals();
  HTMLCanvasElement.prototype.getContext = originalGetContext;
  HTMLCanvasElement.prototype.toBlob = originalToBlob;
  mockDrawImage.mockReset();
});

describe("getCroppedBlob", () => {
  test("源矩形直接使用裁剪区像素坐标，无二次缩放", async () => {
    const blob = await getCroppedBlob("blob:fake", { x: 300, y: 200, width: 400, height: 400 });

    expect(blob).toBeInstanceOf(Blob);
    expect(mockDrawImage).toHaveBeenCalledTimes(1);
    const [image, sx, sy, sw, sh, dx, dy, dw, dh] = mockDrawImage.mock.calls[0];
    expect(image).toBeInstanceOf(FakeImage);
    // 源矩形 = croppedAreaPixels 原值
    expect(sx).toBe(300);
    expect(sy).toBe(200);
    expect(sw).toBe(400);
    expect(sh).toBe(400);
    // 目标矩形 = 512×512
    expect(dx).toBe(0);
    expect(dy).toBe(0);
    expect(dw).toBe(512);
    expect(dh).toBe(512);
  });

  test("不同裁剪区域坐标同样直接透传", async () => {
    await getCroppedBlob("blob:fake", { x: 10, y: 20, width: 120, height: 120 });
    const [, sx, sy, sw, sh] = mockDrawImage.mock.calls[0];
    expect([sx, sy, sw, sh]).toEqual([10, 20, 120, 120]);
  });
});
