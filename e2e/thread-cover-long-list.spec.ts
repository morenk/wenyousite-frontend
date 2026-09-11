import { test, expect } from "@playwright/test";
import { coverHttpFixture } from "./helpers/cover-http";
test.use({ viewport: { width: 1440, height: 1000 } });
test("累计1000卡片连续快滑的几何读取与帧间隔记录", async ({ page, baseURL }) => {
  const fixture = await coverHttpFixture(baseURL!, { count: 1000, sharedPoster: true });
  try {
    await page.addInitScript(() => {
      const state = window as Window & { coverRectReads?: number }; state.coverRectReads = 0;
      const original = HTMLElement.prototype.getBoundingClientRect;
      HTMLElement.prototype.getBoundingClientRect = function () {
        if (this.hasAttribute("data-thread-cover")) state.coverRectReads! += 1;
        return original.call(this);
      };
    });
    await page.goto(fixture.origin, { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-thread-cover]")).toHaveCount(1000);
    // 模拟已浏览累计历史项：让全部poster完成并注册，静态poster共用URL避免测试本身制造24MB传输。
    await page.locator("img[data-cover-poster]").evaluateAll((imgs) => imgs.forEach((img) => { (img as HTMLImageElement).loading = "eager"; }));
    await expect.poll(() => page.locator("img[data-cover-poster]").evaluateAll((imgs) => imgs.filter((img) => (img as HTMLImageElement).naturalWidth > 0).length)).toBe(1000);
    await page.waitForTimeout(100);
    await expect.poll(() => page.locator("img[data-cover-animation]").count()).toBeGreaterThan(0);
    const sample = await page.evaluate(async () => {
      const state = window as Window & { coverRectReads?: number }; state.coverRectReads = 0;
      const gaps: number[] = []; let last = performance.now(), running = true;
      const frame = (now: number) => { gaps.push(now - last); last = now; if (running) requestAnimationFrame(frame); }; requestAnimationFrame(frame);
      const start = performance.now();
      for (let i = 0; i < 30; i++) { scrollBy(0, 400); await new Promise((resolve) => setTimeout(resolve, 40)); }
      running = false; const elapsed = performance.now() - start; gaps.sort((a, b) => a - b);
      return { totalCards: 1000, coverRectReads: state.coverRectReads, elapsedMs: elapsed, sampledFrames: gaps.length,
        p95FrameGapMs: gaps[Math.floor(gaps.length * 0.95)], maxFrameGapMs: Math.max(...gaps), over32Ms: gaps.filter((gap) => gap > 32).length };
    });
    expect(sample.coverRectReads).toBeLessThan(1000);
    console.info("长列表快滑观测", JSON.stringify({ ...sample, animationRequests: fixture.animationRequests().reduce((n, [, amount]) => n + amount, 0), transferredImageBodyBytes: [...fixture.bytes.values()].reduce((a, b) => a + b, 0) }));
    await test.info().attach("cover-long-list.json", { body: JSON.stringify(sample, null, 2), contentType: "application/json" });
  } finally { await fixture.close(); }
});
