import { readFileSync } from "node:fs";
import { createServer, request } from "node:http";
import path from "node:path";
import type { AddressInfo } from "node:net";
import { test, expect } from "@playwright/test";

// 不使用 Playwright route：拦截会禁用 HTTP 缓存，不能验证浏览器真实复用行为。
// 临时本地服务器承接全部 API/图片，其他请求代理到隔离候选站，不写入真实业务。
async function coverHttpFixture(candidate: string, previewDelayMs = 0) {
  const counts = new Map<string, number>();
  const bytes = new Map<string, number>();
  const image = (id: number, kind: string) => `/__cover-cache__/${id}/${kind}.${kind === "animation" ? "gif" : "webp"}`;
  const items = Array.from({ length: 8 }, (_, id) => ({
    id: `cache-test-${id}`, title: `缓存验收帖子 ${id}`, category: "RPG",
    categoryInfo: { slug: "RPG", name: "角色扮演", isActive: true },
    status: "RECRUITING", visibility: "PUBLIC", published: true, pinned: false,
    createdAt: "2026-09-09T00:00:00Z", updatedAt: "2026-09-09T00:00:00Z",
    deletedAt: null, tipTotal: "0", defaultSubthread: null, topicTags: [],
    owner: { id: "cache-owner", username: "缓存验收", avatar: null, level: 1 },
    _count: { members: 1, players: 1, posts: 1 }, preview: "本地 HTTP 缓存验收",
    coverImages: [image(id, "animation")],
    coverMedia: { url: image(id, "animation"), animated: true, posterUrl: image(id, "poster"), previewVariants: [
      { url: image(id, "preview480"), width: 480, height: 270, bytes: 100 },
      { url: image(id, "preview800"), width: 800, height: 450, bytes: 200 },
    ] },
  }));
  const server = createServer((req, res) => {
    const pathname = new URL(req.url!, "http://127.0.0.1").pathname;
    if (pathname.startsWith("/__cover-cache__/")) {
      const animation = pathname.endsWith(".gif");
      const body = readFileSync(path.join(process.cwd(), "src/lib/__tests__/fixtures/images", animation ? "animated.gif" : pathname.includes("/preview") ? "animated.webp" : "static.webp"));
      counts.set(pathname, (counts.get(pathname) ?? 0) + 1);
      bytes.set(pathname, (bytes.get(pathname) ?? 0) + body.length);
      res.writeHead(200, {
        "Content-Type": animation ? "image/gif" : "image/webp",
        "Content-Length": body.length,
        "Cache-Control": pathname.includes("/uncached/") ? "no-store" : "public, max-age=31536000, immutable",
      });
      if (pathname.includes("/preview") && previewDelayMs) setTimeout(() => res.end(body), previewDelayMs);
      else res.end(body);
      return;
    }
    if (pathname === "/__cover-cache-control__") {
      res.writeHead(200, { "Content-Type": "text/html", "Cache-Control": "no-store" });
      res.end('<!doctype html><img src="/__cover-cache__/uncached/animation.gif">');
      return;
    }
    if (pathname.startsWith("/api/v1/")) {
      let data: unknown = [];
      if (pathname.endsWith("/auth/refresh")) {
        res.writeHead(401, { "Content-Type": "application/json", "Cache-Control": "no-store" });
        res.end(JSON.stringify({ code: 401, message: "本地匿名会话", data: null }));
        return;
      }
      if (pathname.endsWith("/threads")) data = items;
      else if (pathname.endsWith("/thread-categories")) data = [{ id: "cache-category", slug: "RPG", name: "角色扮演", isActive: true, sortOrder: 0 }];
      else if (pathname.endsWith("/meta")) data = { markdownContractVersion: 5 };
      res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      res.end(JSON.stringify({ code: 0, message: "ok", data, meta: { cursor: null, hasMore: false } }));
      return;
    }
    const upstream = request(new URL(req.url!, candidate), {
      method: req.method,
      headers: { ...req.headers, host: new URL(candidate).host },
    }, (incoming) => {
      res.writeHead(incoming.statusCode ?? 502, incoming.headers);
      incoming.pipe(res);
    });
    upstream.on("error", () => { res.writeHead(502); res.end("候选站代理失败"); });
    req.pipe(upstream);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return {
    origin: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    counts, bytes,
    close: () => new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
      server.closeAllConnections();
    }),
  };
}

test.use({ viewport: { width: 1440, height: 1000 } });

test("稳定封面URL在真实HTTP缓存中复用，反复挂卸及再访问不重复传输", async ({ page, context, baseURL }) => {
  const fixture = await coverHttpFixture(baseURL!);
  const animations = page.locator("img[data-cover-animation]");
  const ready = async () => {
    await expect(animations).toHaveCount(1);
    await expect(animations).toBeVisible();
    await expect.poll(() => animations.evaluate((img) => (img as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  };
  try {
    await page.goto(fixture.origin, { waitUntil: "domcontentloaded" });
    await ready();
    const source = (await animations.getAttribute("src"))!;
    expect(fixture.counts.get(source)).toBe(1);
    const animationRequests = () => [...fixture.counts.entries()].filter(([url]) => /\/preview\d+\.webp$/.test(url));
    expect(animationRequests()).toHaveLength(1);
    expect([...fixture.counts.keys()].some((url) => url.endsWith("/animation.gif"))).toBe(false);

    // 真实组件停止并卸载，然后重新创建原生 img；稳定 URL 应命中浏览器缓存。
    for (let iteration = 0; iteration < 3; iteration += 1) {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await expect(animations).toHaveCount(0);
      await page.emulateMedia({ reducedMotion: "no-preference" });
      await ready();
      await expect(animations).toHaveAttribute("src", source);
      expect(fixture.counts.get(source)).toBe(1);
    }
    await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
    await ready();
    await expect(animations).not.toHaveAttribute("src", source);
    await page.evaluate(() => scrollTo(0, 0));
    await ready();
    await expect(animations).toHaveAttribute("src", source);
    expect(fixture.counts.get(source)).toBe(1);

    // 同一浏览器会话的新页面也从 HTTP 缓存取图，独立于旧 React 实例。
    const revisit = await context.newPage();
    await revisit.goto(fixture.origin, { waitUntil: "domcontentloaded" });
    await expect(revisit.locator("img[data-cover-animation]")).toBeVisible();
    await expect(revisit.locator("img[data-cover-animation]")).toHaveAttribute("src", source);
    expect(fixture.counts.get(source)).toBe(1);
    await revisit.close();

    // no-store 对照证明服务端计数能够发现重复下载，并非请求未被统计。
    const control = "/__cover-cache__/uncached/animation.gif";
    // 每次新文档排除同一文档的已解码图片复用；no-store 跨文档必须重新传输。
    for (let iteration = 0; iteration < 2; iteration += 1) {
      const controlPage = await context.newPage();
      await controlPage.goto(fixture.origin + "/__cover-cache-control__");
      await expect.poll(() => controlPage.locator("img").evaluate((img) => (img as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
      await controlPage.close();
    }
    expect(fixture.counts.get(control)).toBe(2);
    const evidence = { requests: Object.fromEntries(fixture.counts), transferredImageBytes: Object.fromEntries(fixture.bytes) };
    await test.info().attach("native-cover-http-cache.json", { body: JSON.stringify(evidence, null, 2), contentType: "application/json" });
    console.info("真实 HTTP 封面缓存验收", JSON.stringify(evidence));
  } finally {
    await fixture.close();
  }
});


test("冷请求更早发出，热缓存快速重挂且没有预播或额外下载", async ({ page, baseURL }) => {
  const fixture = await coverHttpFixture(baseURL!, 180);
  try {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(fixture.origin, { waitUntil: "domcontentloaded" });
    await expect(page.locator("img[data-cover-poster]").first()).toBeVisible();
    await expect.poll(() => page.locator("img[data-cover-poster]").first().evaluate((img) => (img as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    expect([...fixture.counts.keys()].some((url) => /preview|animation/.test(url))).toBe(false);
    const samples = [];
    for (const state of ["cold", "hot"]) {
      const start = await page.evaluate(() => {
        const state = window as Window & { coverLoadedAt?: number }; state.coverLoadedAt = undefined;
        const loaded = (event: Event) => {
          if (event.target instanceof HTMLImageElement && event.target.hasAttribute("data-cover-animation")) {
            state.coverLoadedAt = performance.now(); document.removeEventListener("load", loaded, true);
          }
        };
        document.addEventListener("load", loaded, true);
        return performance.now();
      });
      await page.emulateMedia({ reducedMotion: "no-preference" });
      const visible = await page.evaluate(() => new Promise<{ time: number; source: string; loadedAt?: number }>((resolve) => {
        const sample = () => {
          const img = document.querySelector<HTMLImageElement>("img[data-cover-animation]");
          if (img?.complete && img.naturalWidth && getComputedStyle(img).visibility === "visible") {
            resolve({ time: performance.now(), source: img.src, loadedAt: (window as Window & { coverLoadedAt?: number }).coverLoadedAt }); return;
          }
          requestAnimationFrame(sample);
        };
        sample();
      }));
      const resource = await page.evaluate((url) => {
        const entries = performance.getEntriesByName(url) as PerformanceResourceTiming[];
        const latest = entries[entries.length - 1];
        return { start: latest.startTime, responseEnd: latest.responseEnd, transferred: latest.transferSize };
      }, visible.source);
      const newResource = resource.start >= start;
      samples.push({ state, triggerToVisibleMs: visible.time - start, triggerToRequestMs: newResource ? resource.start - start : null,
        loadToVisibleMs: visible.loadedAt === undefined ? null : visible.time - visible.loadedAt,
        newResourceTiming: newResource, transferSize: newResource ? resource.transferred : 0 });
      expect([...fixture.counts.entries()].filter(([url]) => /preview/.test(url))).toHaveLength(1);
      expect([...fixture.counts.entries()].filter(([url]) => /preview/.test(url))[0][1]).toBe(1);
      expect([...fixture.counts.keys()].some((url) => url.endsWith("animation.gif"))).toBe(false);
      await page.emulateMedia({ reducedMotion: "reduce" });
      await expect(page.locator("img[data-cover-animation]")).toHaveCount(0);
    }
    await test.info().attach("cover-start-latency.json", { body: JSON.stringify(samples, null, 2), contentType: "application/json" });
    console.info("封面起播调度与元素可见延迟（非像素变化）", JSON.stringify(samples));
    expect(samples[0].triggerToRequestMs).not.toBeNull();
    expect(samples[0].triggerToRequestMs!).toBeLessThan(250);
    expect(samples[1].triggerToVisibleMs).toBeLessThan(250);
  } finally { await fixture.close(); }
});


test("每40ms离散滚动持续800ms冷热均不请求中途候选，停下后只有一张", async ({ page, baseURL }) => {
  const fixture = await coverHttpFixture(baseURL!);
  try {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(fixture.origin, { waitUntil: "domcontentloaded" });
    await expect.poll(() => page.locator("img[data-cover-poster]").first().evaluate((img) => (img as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    const samples = [];
    for (const state of ["cold", "hot"]) {
      await page.evaluate(() => scrollTo(0, 0));
      await page.emulateMedia({ reducedMotion: "no-preference" });
      const motion = await page.evaluate(async () => {
        let maxMounted = 0, endedAt = 0, scrolledAt = 0;
        const scrolled = () => { scrolledAt = performance.now(); };
        const ended = () => { endedAt = performance.now(); };
        window.addEventListener("scroll", scrolled, true); window.addEventListener("scrollend", ended, true);
        for (let i = 0; i < 20; i++) {
          scrollBy(0, 8); await new Promise((resolve) => setTimeout(resolve, 40));
          maxMounted = Math.max(maxMounted, document.querySelectorAll("img[data-cover-animation]").length);
        }
        window.removeEventListener("scroll", scrolled, true); window.removeEventListener("scrollend", ended, true);
        return { maxMounted, endedAt, scrolledAt };
      });
      expect(motion.maxMounted).toBe(0);
      const before = [...fixture.counts.entries()].filter(([url]) => /preview/.test(url));
      expect(before).toHaveLength(state === "cold" ? 0 : 1);
      await expect(page.locator("img[data-cover-animation]")).toBeVisible();
      const visible = await page.locator("img[data-cover-animation]").evaluate((img) => {
        const entries = performance.getEntriesByName((img as HTMLImageElement).src) as PerformanceResourceTiming[];
        return { observedAt: performance.now(), requestStart: entries[entries.length - 1].startTime };
      });
      const requests = [...fixture.counts.entries()].filter(([url]) => /preview/.test(url));
      expect(requests).toHaveLength(1); expect(requests[0][1]).toBe(1);
      samples.push({ state, ...motion, ...visible, scrollendToRequestMs: state === "cold" ? visible.requestStart - motion.endedAt : null });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await expect(page.locator("img[data-cover-animation]")).toHaveCount(0);
    }
    console.info("连续滚动请求验收", JSON.stringify(samples));
    await test.info().attach("cover-continuous-scroll.json", { body: JSON.stringify(samples, null, 2), contentType: "application/json" });
  } finally { await fixture.close(); }
});


test("可信wheel输入连续滚动时不下载动画，输入停止后只选一个", async ({ page, baseURL }) => {
  const fixture = await coverHttpFixture(baseURL!);
  try {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(fixture.origin, { waitUntil: "domcontentloaded" });
    await expect.poll(() => page.locator("img[data-cover-poster]").first().evaluate((img) => (img as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    await page.mouse.move(720, 500);
    await page.evaluate(() => {
      const state = window as Window & { trustedCoverWheels?: number; coverMotionTimes?: { event: string; time: number }[] }; state.trustedCoverWheels = 0; state.coverMotionTimes = [];
      for (const name of ["wheel", "scroll", "scrollend"]) window.addEventListener(name, () => state.coverMotionTimes!.push({ event: name, time: performance.now() }), { capture: true, passive: true });
      window.addEventListener("wheel", (event) => { if (event.isTrusted) state.trustedCoverWheels! += 1; }, { passive: true });
    });
    await page.emulateMedia({ reducedMotion: "no-preference" });
    const started = Date.now();
    for (let i = 0; i < 20; i++) {
      const tick = Date.now();
      await page.mouse.wheel(0, 8);
      await page.waitForTimeout(Math.max(1, 40 - (Date.now() - tick)));
      expect(await page.locator("img[data-cover-animation]").count()).toBe(0);
    }
    console.info("可信输入时序", JSON.stringify(await page.evaluate(() => ({ events: (window as Window & { coverMotionTimes?: unknown[] }).coverMotionTimes, resources: performance.getEntriesByType("resource").filter((entry) => entry.name.includes("/preview")).map((entry) => ({ start: entry.startTime })) }))));
    expect([...fixture.counts.keys()].filter((url) => /preview/.test(url))).toHaveLength(0);
    await expect(page.locator("img[data-cover-animation]")).toBeVisible();
    expect([...fixture.counts.entries()].filter(([url]) => /preview/.test(url))).toHaveLength(1);
    const trustedWheels = await page.evaluate(() => (window as Window & { trustedCoverWheels?: number }).trustedCoverWheels);
    expect(trustedWheels).toBe(20);
    console.info("可信wheel输入验收", JSON.stringify({ trustedWheels, durationMs: Date.now() - started, previewRequests: 1 }));
  } finally { await fixture.close(); }
});
