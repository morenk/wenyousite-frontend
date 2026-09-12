import { describe, expect, test } from "vitest";
import { selectThreadCoverPreview } from "../thread-cover-preview";

const small = { url: "/small.webp", width: 480, height: 270, bytes: 100 };
const large = { url: "/large.webp", width: 800, height: 450, bytes: 200 };
describe("列表动画预览选档", () => {
  test.each([
    [320, 180, 1, small.url],
    [320, 180, 2, large.url],
    [480, 270, 1, small.url],
    [481, 200, 1, large.url],
    [300, 271, 1, large.url],
    [1000, 800, 3, large.url],
  ])("实际框 %sx%s DPR%s 选择 %s", (width, height, dpr, url) => {
    expect(selectThreadCoverPreview([large, small], { width, height, dpr })).toBe(url);
  });
  test("竖图按两维满足，单档和不放大小图仍返回仅有资源", () => {
    const portrait = [{ ...small, width: 270, height: 480 }, { ...large, width: 450, height: 800 }];
    expect(selectThreadCoverPreview(portrait, { width: 300, height: 169, dpr: 1 })).toBe(large.url);
    expect(selectThreadCoverPreview([small], { width: 600, height: 800, dpr: 2 })).toBe(small.url);
    expect(selectThreadCoverPreview([small], { width: 100, height: 100, dpr: Number.NaN })).toBe(small.url);
  });
  test.each([
    undefined, null, [], [small, large, { ...small, url: "/third.webp" }],
    [{ ...small, bytes: 0 }], [{ ...small, height: -1 }], [{ ...small, width: 801 }],
    [{ ...small, width: 1.5 }], [{ ...small, url: " " }], [small, small],
    [small, { ...small, url: "/duplicate-size.webp" }],
  ])("缺失或无效变体回退由可信原媒体路径决定：%j", (variants) => {
    expect(selectThreadCoverPreview(variants, { width: 320, height: 180, dpr: 1 })).toBeNull();
  });
});
