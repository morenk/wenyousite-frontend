import { test, expect } from "@playwright/test";
import { coverHttpFixture } from "./helpers/cover-http";
test.use({ viewport: { width: 1440, height: 2200 } });
for (const route of ["/", "/users/cover-owner/threads", "/users/cover-owner/bookmarks", "/bookmarks"]) {
  test(`各列表可见封面同时播放 ${route}`, async ({ page, baseURL }) => {
    const fixture = await coverHttpFixture(baseURL!, { count: 4 });
    try {
      await page.goto(fixture.origin + route); await expect(page.locator("img[data-cover-animation]")).toHaveCount(4);
      await expect.poll(() => page.locator("img[data-cover-animation]").evaluateAll((imgs) => imgs.every((img) => (img as HTMLImageElement).naturalWidth > 0 && getComputedStyle(img).visibility === "visible"))).toBe(true);
      const handles = await page.locator("img[data-cover-animation]").elementHandles();
      for (let i = 0; i < 8; i++) { await page.evaluate(() => scrollBy(0, 1)); await page.waitForTimeout(30); }
      expect(await Promise.all(handles.map((h) => h.evaluate((img) => img.isConnected)))).toEqual([true, true, true, true]);
    } finally { await fixture.close(); }
  });
}
test("50%进入、持续可见1%保持、完全离屏释放且重入新建", async ({ page, baseURL }) => {
  const fixture = await coverHttpFixture(baseURL!, { count: 8 }); await page.setViewportSize({ width: 1440, height: 900 });
  try {
    await page.emulateMedia({ reducedMotion: "reduce" }); await page.goto(fixture.origin);
    const target = page.locator("[data-thread-cover]").nth(4);
    const position = await target.evaluate((node) => { const r = node.getBoundingClientRect(); return { top: r.top + scrollY, height: r.height }; });
    const enter = async (fraction: number) => page.evaluate(({ top, height, fraction }) => scrollTo(0, top - innerHeight + height * fraction), { ...position, fraction });
    await enter(0.49); await page.emulateMedia({ reducedMotion: "no-preference" }); await page.waitForTimeout(150);
    await expect(target.locator("img[data-cover-animation]")).toHaveCount(0);
    await enter(0.51); await expect(target.locator("img[data-cover-animation]")).toHaveCount(1);
    const original = await target.locator("img[data-cover-animation]").elementHandle();
    await enter(0.01); await page.waitForTimeout(80); expect(await original!.evaluate((img) => img.isConnected)).toBe(true);
    await enter(0); await expect(target.locator("img[data-cover-animation]")).toHaveCount(0); expect(await original!.evaluate((img) => img.isConnected)).toBe(false);
    await enter(0.49); await page.waitForTimeout(80); await expect(target.locator("img[data-cover-animation]")).toHaveCount(0);
    await enter(0.51); await expect(target.locator("img[data-cover-animation]")).toHaveCount(1);
  } finally { await fixture.close(); }
});
test("减少动态效果与遮挡立即停止全部，取消导航点击不重启", async ({ page, baseURL }) => {
  const fixture = await coverHttpFixture(baseURL!, { count: 4 });
  try {
    await page.goto(fixture.origin); await expect(page.locator("img[data-cover-animation]")).toHaveCount(4);
    const handles = await page.locator("img[data-cover-animation]").elementHandles();
    await page.locator('a[href="/threads/cover-test-0"]').first().evaluate((a) => a.addEventListener("click", (e) => e.preventDefault(), { once: true }));
    await page.locator('a[href="/threads/cover-test-0"]').first().click(); await page.waitForTimeout(150);
    expect(await Promise.all(handles.map((h) => h.evaluate((img) => img.isConnected)))).toEqual([true, true, true, true]);
    await page.evaluate(() => { const d = document.createElement("div"); d.id = "cover-test-dialog"; d.setAttribute("role", "dialog"); document.body.append(d); });
    await expect(page.locator("img[data-cover-animation]")).toHaveCount(0);
    await page.evaluate(() => document.querySelector("#cover-test-dialog")!.remove()); await expect(page.locator("img[data-cover-animation]")).toHaveCount(4);
    await page.emulateMedia({ reducedMotion: "reduce" }); await expect(page.locator("img[data-cover-animation]")).toHaveCount(0);
  } finally { await fixture.close(); }
});
test("未知媒体/旧服务/失败poster不回退原动画，预览失败也不级联原GIF", async ({ page, baseURL }) => {
  const fixture = await coverHttpFixture(baseURL!, { count: 4 });
  fixture.items[0].coverMedia.animated = null; fixture.items[0].coverMedia.posterUrl = null;
  Reflect.deleteProperty(fixture.items[1], "coverMedia");
  try {
    await page.route("**/__cover-all__/2/poster.webp", (route) => route.fulfill({ status: 404, body: "" }));
    await page.route("**/__cover-all__/3/preview.webp", (route) => route.fulfill({ status: 404, body: "" }));
    await page.goto(fixture.origin); await page.waitForTimeout(300); await expect(page.locator("img[data-cover-animation]")).toHaveCount(0);
    expect(fixture.animationRequests().some(([url]) => url.endsWith(".gif"))).toBe(false);
  } finally { await fixture.close(); }
});

test("慢RSC期间可见旧页保持原实例，真正提交后旧页释放", async ({ page, baseURL }) => {
  const fixture = await coverHttpFixture(baseURL!, { count: 4 }); let release = () => {};
  const pending = new Promise<void>((resolve) => { release = resolve; }); let blocked = false;
  try {
    await page.route("**/bookmarks?*", async (route) => { if (route.request().headers().rsc === "1") { blocked = true; await pending; } await route.continue(); });
    await page.goto(fixture.origin); await expect(page.locator("img[data-cover-animation]")).toHaveCount(4);
    const old = await page.locator("img[data-cover-animation]").elementHandles();
    await page.locator('a[href="/bookmarks"]:visible').first().click(); await expect.poll(() => blocked).toBe(true);
    await page.waitForTimeout(250); expect(await Promise.all(old.map((h) => h.evaluate((img) => img.isConnected)))).toEqual([true, true, true, true]);
    release(); await expect(page).toHaveURL(/\/bookmarks/); await expect(page.locator("img[data-cover-animation]")).toHaveCount(4);
    await expect.poll(async () => Promise.all(old.map((h) => h.evaluate((img) => img.isConnected)))).toEqual([false, false, false, false]);
  } finally { release(); await fixture.close(); }
});
test("实际尺寸只重置对应封面，不重建其他持续可见项", async ({ page, baseURL }) => {
  const fixture = await coverHttpFixture(baseURL!, { count: 4 });
  try {
    await page.goto(fixture.origin); await expect(page.locator("img[data-cover-animation]")).toHaveCount(4);
    const old = await page.locator("img[data-cover-animation]").elementHandles();
    await page.locator("[data-thread-cover]").first().evaluate((node) => { (node as HTMLElement).style.width = "65%"; });
    await expect.poll(() => old[0].evaluate((img) => img.isConnected)).toBe(false);
    expect(await Promise.all(old.slice(1).map((h) => h.evaluate((img) => img.isConnected)))).toEqual([true, true, true]);
    await expect(page.locator("img[data-cover-animation]")).toHaveCount(4);
  } finally { await fixture.close(); }
});

test("pagehide/pageshow 生命周期停止全部，迟到图片响应不恢复隐藏页面", async ({ page, baseURL }) => {
  const fixture = await coverHttpFixture(baseURL!, { count: 4, delayMs: 250 });
  try {
    await page.goto(fixture.origin); await expect(page.locator("img[data-cover-animation]")).toHaveCount(4);
    // 在真实浏览器分发页面生命周期事件；隐藏Tab的visibilityState分支由控制器单测覆盖。
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true })));
    await expect(page.locator("img[data-cover-animation]")).toHaveCount(0);
    await page.waitForTimeout(400); await expect(page.locator("img[data-cover-animation]")).toHaveCount(0);
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })));
    await expect(page.locator("img[data-cover-animation]")).toHaveCount(4);
  } finally { await fixture.close(); }
});

test("完整display在无poster、poster等待/失败时仍按50%门禁起播", async ({ page, baseURL }) => {
  const fixture = await coverHttpFixture(baseURL!, { count: 4, fullDisplay: true });
  fixture.items[0].coverMedia.posterUrl = null;
  let release!: () => void;
  const pending = new Promise<void>((resolve) => { release = resolve; });
  try {
    await page.route("**/__cover-all__/1/poster.webp", async (route) => { await pending; await route.fulfill({ status: 503, body: "" }); });
    await page.route("**/__cover-all__/2/poster.webp", (route) => route.fulfill({ status: 503, body: "" }));
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(fixture.origin, { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-thread-cover]")).toHaveCount(4);
    expect(fixture.animationRequests()).toHaveLength(0);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await expect(page.locator("img[data-cover-animation]")).toHaveCount(4);
    await expect.poll(() => fixture.animationRequests().length).toBe(4);
    expect(fixture.animationRequests().every(([url]) => url.endsWith("full.webp"))).toBe(true);
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true })));
    await expect(page.locator("img[data-cover-animation]")).toHaveCount(0);
    release();
    await page.waitForTimeout(150);
    await expect(page.locator("img[data-cover-animation]")).toHaveCount(0);
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })));
    await expect(page.locator("img[data-cover-animation]")).toHaveCount(4);
  } finally { release(); await fixture.close(); }
});

test("无poster完整display的49%进入不下载，51%进入起播，省流拦截", async ({ page, baseURL }) => {
  const fixture = await coverHttpFixture(baseURL!, { count: 8, fullDisplay: true });
  fixture.items.forEach((item) => { item.coverMedia.posterUrl = null; });
  await page.setViewportSize({ width: 1440, height: 900 });
  try {
    await page.emulateMedia({ reducedMotion: "reduce" }); await page.goto(fixture.origin);
    const target = page.locator("[data-thread-cover]").nth(4);
    const bounds = await target.evaluate((node) => { const r = node.getBoundingClientRect(); return { top: r.top + scrollY, height: r.height }; });
    const enter = (fraction: number) => page.evaluate(({ top, height, fraction }) => scrollTo(0, top - innerHeight + height * fraction), { ...bounds, fraction });
    await enter(0.49); await page.emulateMedia({ reducedMotion: "no-preference" }); await page.waitForTimeout(150);
    await expect(target.locator("img[data-cover-animation]")).toHaveCount(0);
    expect(fixture.counts.get("/__cover-all__/4/full.webp") ?? 0).toBe(0);
    await enter(0.51); await expect(target.locator("img[data-cover-animation]")).toHaveCount(1);
    await expect.poll(() => fixture.counts.get("/__cover-all__/4/full.webp")).toBe(1);
    await page.evaluate(() => {
      // 对应站内“封面省流”设置；现策略不读取NetworkInformation.saveData。
      localStorage.setItem("wenyou:cover-data-saver", "true");
      window.dispatchEvent(new CustomEvent("wenyou:cover-preference", { detail: true }));
    });
    await expect(page.locator("img[data-cover-animation]")).toHaveCount(0);
  } finally { await fixture.close(); }
});
