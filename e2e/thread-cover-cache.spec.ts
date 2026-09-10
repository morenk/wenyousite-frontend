import { test, expect } from "@playwright/test";
import { coverHttpFixture } from "./helpers/cover-http";
test.use({ viewport: { width: 1440, height: 2200 } });
test("所有可见预览复用HTTP缓存，冷热重挂与重入不重复传输", async ({ page, context, baseURL }) => {
  const fixture = await coverHttpFixture(baseURL!, { count: 4 });
  try {
    await page.goto(fixture.origin, { waitUntil: "domcontentloaded" });
    await expect(page.locator("img[data-cover-animation]")).toHaveCount(4);
    await expect.poll(() => fixture.animationRequests().length).toBe(4);
    for (let i = 0; i < 3; i++) {
      await page.emulateMedia({ reducedMotion: "reduce" }); await expect(page.locator("img[data-cover-animation]")).toHaveCount(0);
      await page.emulateMedia({ reducedMotion: "no-preference" }); await expect(page.locator("img[data-cover-animation]")).toHaveCount(4);
    }
    await page.setViewportSize({ width: 1440, height: 600 });
    await expect.poll(() => page.locator("img[data-cover-animation]").count()).toBeLessThan(4);
    await page.setViewportSize({ width: 1440, height: 2200 }); await expect(page.locator("img[data-cover-animation]")).toHaveCount(4);
    const revisit = await context.newPage(); await revisit.setViewportSize({ width: 1440, height: 2200 });
    await revisit.goto(fixture.origin); await expect(revisit.locator("img[data-cover-animation]")).toHaveCount(4); await revisit.close();
    expect(fixture.animationRequests().every(([, n]) => n === 1)).toBe(true);
    expect(fixture.animationRequests().some(([url]) => url.endsWith(".gif"))).toBe(false);
    console.info("可见多播缓存", JSON.stringify({ requests: Object.fromEntries(fixture.counts), bytes: Object.fromEntries(fixture.bytes) }));
  } finally { await fixture.close(); }
});
test("GIF原图回退并播也复用缓存，不预加载尚未达到可见阈值的项", async ({ page, baseURL }) => {
  const fixture = await coverHttpFixture(baseURL!, { count: 4, gif: true });
  try {
    await page.goto(fixture.origin); await expect(page.locator("img[data-cover-animation]")).toHaveCount(4);
    expect(fixture.animationRequests().every(([url]) => url.endsWith(".gif"))).toBe(true);
    await page.emulateMedia({ reducedMotion: "reduce" }); await expect(page.locator("img[data-cover-animation]")).toHaveCount(0);
    await page.emulateMedia({ reducedMotion: "no-preference" }); await expect(page.locator("img[data-cover-animation]")).toHaveCount(4);
    expect(fixture.animationRequests().every(([, n]) => n === 1)).toBe(true);
  } finally { await fixture.close(); }
});
