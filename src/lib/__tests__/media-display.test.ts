import { describe, expect, test } from "vitest";
import fixture from "../../../contracts/media-display-v1-fixtures.json";
import { findMediaDisplay, getMediaDisplayUrl, type MediaDisplay } from "@/lib/media-display";

describe("后端完整展示契约", () => {
  test("完整动画使用display，持久来源身份不变", () => {
    const sample = fixture.cases.find((entry) => entry.id === "full-animation")!;
    const media = { url: sample.sourceUrl!, display: sample.display as MediaDisplay };
    expect(getMediaDisplayUrl(media)).toBe(sample.expectedDisplayUrl);
    expect(media.url).toBe(sample.expectedPersistedUrl);
    expect(media.display.loopCount).toBe(0);
  });
  test("历史null明确兼容来源，不伪造已转码地址", () => {
    const sample = fixture.cases.find((entry) => entry.id === "legacy-pending")!;
    expect(getMediaDisplayUrl({ url: sample.sourceUrl!, display: null })).toBe(sample.sourceUrl);
  });
  test("正文映射只做精确唯一匹配，不剥离query、hash或改写路径", () => {
    const sample = fixture.cases.find((entry) => entry.id === "markdown-identities")!;
    const mappings = sample.mediaDisplays!.map((item) => ({ ...item, display: item.display as MediaDisplay }));
    expect(findMediaDisplay(mappings[0].sourceUrl, mappings)).toEqual(mappings[0].display);
    expect(findMediaDisplay(mappings[0].sourceUrl + "?v=2", mappings)).toBeNull();
    expect(findMediaDisplay(mappings[0].sourceUrl, [...mappings, ...mappings])).toBeNull();
  });
  test("静态和有限循环语义按服务端保持", () => {
    const still = fixture.cases.find((entry) => entry.id === "static")!.display!;
    expect([still.animated, still.frameCount, still.durationMs, still.loopCount]).toEqual([false, 1, 0, 1]);
    expect(fixture.cases.find((entry) => entry.id === "finite-loop")!.display!.loopCount).toBe(3);
  });
});
