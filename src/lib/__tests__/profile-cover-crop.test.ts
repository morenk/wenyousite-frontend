import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { getCroppedProfileCoverBlob } from "@/lib/profile-cover-crop";

class FakeImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  set src(_value: string) {
    this.onload?.();
  }
}

const originalGetContext = HTMLCanvasElement.prototype.getContext;
const originalToBlob = HTMLCanvasElement.prototype.toBlob;
const { mockDrawImage, mockToBlob } = vi.hoisted(() => ({
  mockDrawImage: vi.fn(),
  mockToBlob: vi.fn(),
}));

beforeEach(() => {
  vi.stubGlobal("Image", FakeImage);
  HTMLCanvasElement.prototype.getContext = (() => ({
    drawImage: mockDrawImage,
  })) as unknown as typeof originalGetContext;
  mockToBlob.mockImplementation((callback: BlobCallback) => {
    callback(new Blob(["cover"], { type: "image/webp" }));
  });
  HTMLCanvasElement.prototype.toBlob = mockToBlob as unknown as typeof originalToBlob;
});

afterEach(() => {
  vi.unstubAllGlobals();
  HTMLCanvasElement.prototype.getContext = originalGetContext;
  HTMLCanvasElement.prototype.toBlob = originalToBlob;
  mockDrawImage.mockReset();
  mockToBlob.mockReset();
});

describe("getCroppedProfileCoverBlob", () => {
  test("直接使用自然像素裁剪区并输出 1920×640 的高质量 WebP", async () => {
    const blob = await getCroppedProfileCoverBlob("blob:cover", {
      x: 120,
      y: 80,
      width: 900,
      height: 300,
    });

    expect(blob.type).toBe("image/webp");
    const [, sx, sy, sw, sh, dx, dy, dw, dh] = mockDrawImage.mock.calls[0];
    expect([sx, sy, sw, sh]).toEqual([120, 80, 900, 300]);
    expect([dx, dy, dw, dh]).toEqual([0, 0, 1920, 640]);
    expect(mockToBlob).toHaveBeenCalledWith(expect.any(Function), "image/webp", 0.92);
  });
});
