import { describe, expect, test } from "vitest";

import { getStickerDisplayUrl, STICKER_DISPLAY_STYLE } from "@/lib/sticker-display";

describe("sticker display", () => {
  test("静态表情使用缩略图以避免下载完整资产", () => {
    expect(getStickerDisplayUrl({
      url: "https://cdn.example.com/sticker.webp",
      thumbnailUrl: "https://cdn.example.com/sticker_thumb.webp",
      animated: false,
    })).toBe("https://cdn.example.com/sticker_thumb.webp");
  });

  test("动图与缺少缩略图的旧数据回退到规范化主资产", () => {
    expect(getStickerDisplayUrl({
      url: "https://cdn.example.com/animated.webp",
      thumbnailUrl: "https://cdn.example.com/animated_thumb.webp",
      animated: true,
    })).toBe("https://cdn.example.com/animated.webp");
    expect(getStickerDisplayUrl({
      url: "https://cdn.example.com/legacy.webp",
      animated: false,
    })).toBe("https://cdn.example.com/legacy.webp");
  });

  test("所有业务表情引用同一个 CSS 最大尺寸 Token", () => {
    expect(STICKER_DISPLAY_STYLE).toMatchObject({
      maxWidth: "min(var(--sticker-display-max), 100%)",
      maxHeight: "var(--sticker-display-max)",
    });
  });
});
