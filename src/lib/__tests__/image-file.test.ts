import { describe, expect, test } from "vitest";
import { createImageFileFromBlob } from "@/lib/image-file";

describe("createImageFileFromBlob", () => {
  test("WebP 编码结果保留 WebP MIME 与扩展名", () => {
    const file = createImageFileFromBlob(
      new Blob(["webp"], { type: "image/webp" }),
      "avatar.png",
      123,
    );

    expect(file.name).toBe("avatar.webp");
    expect(file.type).toBe("image/webp");
    expect(file.lastModified).toBe(123);
  });

  test("Safari 回退为 PNG 时使用实际 MIME 与扩展名", () => {
    const file = createImageFileFromBlob(
      new Blob(["png"], { type: "image/png" }),
      "avatar.webp",
    );

    expect(file.name).toBe("avatar.png");
    expect(file.type).toBe("image/png");
  });

  test("拒绝空结果或不可上传的编码格式", () => {
    expect(() => createImageFileFromBlob(new Blob([], { type: "image/png" }), "avatar"))
      .toThrow("图片编码失败");
    expect(() => createImageFileFromBlob(new Blob(["x"], { type: "application/octet-stream" }), "avatar"))
      .toThrow("图片编码失败");
  });
});
