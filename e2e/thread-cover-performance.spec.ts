import { test, expect } from "@playwright/test";
import { coverHttpFixture } from "./helpers/cover-http";

for (const count of [4, 8, 12]) for (const gif of [false, true]) {
  test(`同条件性能 ${count} 张 ${gif ? "GIF原图" : "WebP预览"}`, async ({ page, baseURL }) => {
    const fixture = await coverHttpFixture(baseURL!, { count, gif });
    const policy = process.env.COVER_BENCH_POLICY ?? "visible";
    const expected = policy === "single" ? 1 : count;
    // 数量压力场景使用扩展视口高度，保留实际卡片布局，不代表普通手机屏幕。
    await page.setViewportSize({ width: 1440, height: 600 + count * 340 });
    const samples = [];
    try {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto(fixture.origin, { waitUntil: "domcontentloaded" });
      await expect(page.locator("[data-thread-cover]")).toHaveCount(count);
      for (const cache of ["cold", "warm"]) {
        const beforeBytes = [...fixture.bytes.values()].reduce((a, b) => a + b, 0);
        const start = await page.evaluate(() => performance.now());
        await page.emulateMedia({ reducedMotion: "no-preference" });
        await expect(page.locator("img[data-cover-animation]")).toHaveCount(expected);
        await expect.poll(() => page.locator("img[data-cover-animation]").evaluateAll((imgs) => imgs.every((img) => (img as HTMLImageElement).complete && (img as HTMLImageElement).naturalWidth > 0 && getComputedStyle(img).visibility === "visible"))).toBe(true);
        const visibleAt = await page.evaluate(() => performance.now());
        const frames = await page.evaluate(() => new Promise<{ frames: number; p95Ms: number; maxMs: number; over32Ms: number }>((resolve) => {
          const deltas: number[] = []; let last = performance.now(); const end = last + 1200;
          const sample = (now: number) => { deltas.push(now - last); last = now;
            if (now >= end) { const ordered = [...deltas].sort((a, b) => a - b); resolve({ frames: deltas.length, p95Ms: ordered[Math.floor(ordered.length * 0.95)], maxMs: Math.max(...deltas), over32Ms: deltas.filter((d) => d > 32).length }); }
            else requestAnimationFrame(sample);
          }; requestAnimationFrame(sample);
        }));
        samples.push({ policy, count, format: gif ? "gif" : "webp", cache, mounted: expected,
          triggerToObservedVisibleMs: visibleAt - start, transferredBodyBytes: [...fixture.bytes.values()].reduce((a, b) => a + b, 0) - beforeBytes,
          cumulativeRequests: fixture.animationRequests().reduce((n, [, amount]) => n + amount, 0), ...frames });
        await page.emulateMedia({ reducedMotion: "reduce" }); await expect(page.locator("img[data-cover-animation]")).toHaveCount(0);
      }
      console.info("封面性能样本", JSON.stringify(samples));
      await test.info().attach(`cover-performance-${count}-${gif ? "gif" : "webp"}.json`, { body: JSON.stringify(samples, null, 2), contentType: "application/json" });
    } finally { await fixture.close(); }
  });
}
