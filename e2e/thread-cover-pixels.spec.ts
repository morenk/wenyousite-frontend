import { test, expect } from "@playwright/test";
import { coverHttpFixture } from "./helpers/cover-http";
import { centerPixel } from "./helpers/png-pixel";
test.use({ viewport: { width: 1440, height: 1600 } });
for (const gif of [false, true]) {
  test(`不同URL重入从红首帧播放且其他实例不停，保留有限循环 ${gif ? "GIF" : "WebP"}`, async ({ page, baseURL }) => {
    const fixture = await coverHttpFixture(baseURL!, { count: 2, clock: true, gif });
    try {
      await page.goto(fixture.origin); const covers = page.locator("[data-thread-cover]");
      const a = covers.nth(0).locator("img[data-cover-animation]"), b = covers.nth(1).locator("img[data-cover-animation]");
      await expect(a).toBeVisible(); await expect(b).toBeVisible();
      const red = centerPixel(await b.screenshot()); expect(red).toEqual([255, 0, 0]);
      await expect.poll(async () => centerPixel(await a.screenshot()), { timeout: 4000, intervals: [100] }).toEqual([0, 255, 0]);
      const originalA = await a.elementHandle();
      await covers.nth(1).evaluate((node) => { (node.closest("article") as HTMLElement).style.visibility = "hidden"; });
      await expect(b).toHaveCount(0);
      await covers.nth(1).evaluate((node) => { (node.closest("article") as HTMLElement).style.visibility = ""; });
      await expect(b).toBeVisible(); const restartedAt = Date.now(); expect(centerPixel(await b.screenshot())).toEqual([255, 0, 0]);
      expect(await originalA!.evaluate((img) => img.isConnected)).toBe(true);
      expect(centerPixel(await a.screenshot())).not.toEqual([255, 0, 0]);
      await page.waitForTimeout(Math.max(0, 4700 - (Date.now() - restartedAt)));
      const secondLoopPixel = centerPixel(await b.screenshot());
      expect(secondLoopPixel).toEqual([255, 0, 0]);
      console.info("有限循环第二轮像素", JSON.stringify({ gif, secondLoopPixel }));
      await page.waitForTimeout(Math.max(0, 9300 - (Date.now() - restartedAt))); expect(centerPixel(await b.screenshot())).toEqual([0, 0, 255]);
      await page.waitForTimeout(350); expect(centerPixel(await b.screenshot())).toEqual([0, 0, 255]);
      expect(fixture.animationRequests().every(([, n]) => n === 1)).toBe(true);
    } finally { await fixture.close(); }
  });
  test(`相同URL原生时钟可能联动，HTTP仅一次且不做URL隔离 ${gif ? "GIF" : "WebP"}`, async ({ page, baseURL }) => {
    const fixture = await coverHttpFixture(baseURL!, { count: 2, clock: true, sameUrl: true, gif });
    try {
      await page.goto(fixture.origin); const covers = page.locator("[data-thread-cover]");
      const a = covers.nth(0).locator("img[data-cover-animation]"), b = covers.nth(1).locator("img[data-cover-animation]");
      await expect(a).toBeVisible(); await expect(b).toBeVisible();
      await expect.poll(async () => centerPixel(await a.screenshot()), { timeout: 4000, intervals: [100] }).toEqual([0, 255, 0]);
      const before = centerPixel(await a.screenshot());
      await covers.nth(1).evaluate((node) => { (node.closest("article") as HTMLElement).style.visibility = "hidden"; }); await expect(b).toHaveCount(0);
      await covers.nth(1).evaluate((node) => { (node.closest("article") as HTMLElement).style.visibility = ""; }); await expect(b).toBeVisible();
      const reentry = centerPixel(await b.screenshot()), existing = centerPixel(await a.screenshot());
      expect(reentry).toEqual([255, 0, 0]); expect(await a.getAttribute("src")).toBe(await b.getAttribute("src"));
      expect(fixture.animationRequests()).toHaveLength(1); expect(fixture.animationRequests()[0][1]).toBe(1);
      console.info("用户接受的原生同URL时间线例外", JSON.stringify({ gif, before, reentry, existing }));
    } finally { await fixture.close(); }
  });
}
