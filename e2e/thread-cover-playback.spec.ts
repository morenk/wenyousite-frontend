import { readFileSync } from "node:fs";
import path from "node:path";
import { test, expect, type Page } from "@playwright/test";
import type { components } from "../src/api/types";

const fixture = (name: string) => readFileSync(path.join(process.cwd(), "src/lib/__tests__/fixtures/images", name));
const originals = new Set<string>();
const image = (id: number, kind: "poster" | "animation") => `/__cover-fixture__/${id}/${kind}.${kind === "poster" ? "webp" : "gif"}`;
function thread(id: number) {
  return {
    id: `cover-test-${id}`, title: `封面测试帖子 ${id}`, category: "RPG", categoryInfo: { slug: "RPG", name: "角色扮演", isActive: true },
    status: "RECRUITING", visibility: "PUBLIC", published: true, pinned: false,
    createdAt: "2026-09-09T00:00:00Z", updatedAt: "2026-09-09T00:00:00Z", deletedAt: null, tipTotal: "0",
    owner: { id: "cover-owner", username: "封面测试", avatar: null, level: 1 }, defaultSubthread: null,
    topicTags: [], _count: { members: 1, players: 1, posts: 1 }, preview: "用于验证列表播放和静态资源请求",
    coverImages: [image(id, "animation")],
    coverMedia: { url: image(id, "animation"), animated: true as boolean | null, posterUrl: image(id, "poster") as string | null } as components["schemas"]["ThreadCoverMediaResponseDto"],
    bookmarkId: `bookmark-${id}`, bookmarkFolderId: "folder-test",
  };
}

async function mockApi(page: Page, items = Array.from({ length: 15 }, (_, i) => thread(i))) {
  originals.clear();
  await page.route("**/__cover-fixture__/**", async (route) => {
    const url = route.request().url();
    if (url.includes("/animation.")) originals.add(new URL(url).pathname);
    await route.fulfill({ contentType: url.endsWith(".gif") ? "image/gif" : "image/webp",
      body: fixture(url.includes("/animation.") ? (url.endsWith(".webp") ? "animated.webp" : "animated.gif") : "static.webp"),
      headers: { "Cache-Control": "public, max-age=31536000, immutable" } });
  });
  // 所有 API 与图片均由本地 fixture 提供，不访问真实账号和业务数据。
  await page.route("**/api/v1/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    let data: unknown = [];
    if (pathname.endsWith("/auth/refresh")) {
      data = { accessToken: "cover-test-memory-token", user: { id: "cover-owner", username: "封面测试", email: "cover@example.invalid", avatar: null, role: "USER" } };
    } else if (pathname.endsWith("/thread-categories")) {
      data = [{ id: "category-test", slug: "RPG", name: "角色扮演", isActive: true, sortOrder: 0 }];
    } else if (pathname.endsWith("/threads") || pathname.endsWith("/created-threads") || pathname.endsWith("/played-threads") || pathname.endsWith("/bookmarks")) data = items;
    else if (pathname.endsWith("/bookmark-folders")) data = [{ id: "folder-test", name: "默认收藏", itemCount: items.length, isDefault: true }];
    else if (pathname.endsWith("/notifications/unread")) data = { unreadCount: 0 };
    else if (pathname.endsWith("/direct-conversations/unread")) data = { unreadMessageCount: 0, pendingRequestCount: 0, total: 0 };
    else if (pathname.endsWith("/meta")) data = { markdownContractVersion: 5 };
    else if (pathname === "/api/v1/users/cover-owner") data = {
      id: "cover-owner", username: "封面测试", avatar: null, profileCover: null, bio: "", role: "USER", level: 1,
      receivedTipTotal: "0", receivedTipCount: 0, showRecentReplies: true, showPlayerBadges: true, showBookmarks: true,
      accountStatus: "ACTIVE", createdAt: "2026-09-09T00:00:00Z", _count: { following: 0, followers: 0, threads: items.length, posts: 0 },
    };
    else if (/\/threads\/cover-test-/.test(pathname)) {
      await route.fulfill({ status: 404, json: { code: 404, message: "测试详情占位", data: null } }); return;
    }
    await route.fulfill({ json: { code: 0, message: "ok", data, meta: { cursor: null, hasMore: false } } });
  });
}

const animations = (page: Page) => page.locator("img[data-cover-animation]");
const posters = (page: Page) => page.locator("img[data-cover-poster]");
async function expectOne(page: Page) {
  await expect(animations(page)).toHaveCount(1);
  const winner = await page.locator("[data-thread-cover]").evaluateAll((covers) => {
    const candidates = covers.map((cover) => ({ cover, rect: cover.getBoundingClientRect() }))
      .filter(({ rect }) => Math.max(0, Math.min(innerHeight, rect.bottom) - Math.max(0, rect.top)) / rect.height >= 0.5)
      .sort((a, b) => Math.hypot(a.rect.x + a.rect.width / 2 - innerWidth / 2, a.rect.y + a.rect.height / 2 - innerHeight / 2)
        - Math.hypot(b.rect.x + b.rect.width / 2 - innerWidth / 2, b.rect.y + b.rect.height / 2 - innerHeight / 2));
    return candidates[0]?.cover.getAttribute("data-cover-url");
  });
  await expect(animations(page)).toHaveAttribute("src", winner!);
}

test.use({ viewport: { width: 1440, height: 1000 } });

test("首页只下载中心动画，滚动中无动画，停稳后换一张；点击封面进详情", async ({ page }) => {
  await mockApi(page);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(posters(page).first()).toBeVisible();
  await expectOne(page);
  expect(originals.size).toBe(1);
  await page.evaluate(() => {
    (window as Window & { coverScrolling?: ReturnType<typeof setInterval> }).coverScrolling = setInterval(() => scrollBy(0, 8), 40);
  });
  await expect(animations(page)).toHaveCount(0);
  await page.waitForTimeout(400);
  expect(originals.size).toBe(1);
  await page.evaluate(() => clearInterval((window as Window & { coverScrolling?: ReturnType<typeof setInterval> }).coverScrolling));
  await expectOne(page);
  const current = animations(page);
  const id = await current.evaluate((img) => img.closest("article")?.querySelector("a[href^='/threads/']")?.getAttribute("href"));
  await current.click({ force: true });
  await expect(page).toHaveURL(new RegExp(id!));
  await expect(animations(page)).toHaveCount(0);
});

test("外观菜单省流量持久化，首次加载与减少动态效果均不请求原动画", async ({ page }) => {
  await mockApi(page);
  await page.addInitScript(() => localStorage.setItem("wenyou:cover-data-saver", "true"));
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(posters(page).first()).toBeVisible();
  await page.waitForTimeout(700);
  expect(originals.size).toBe(0);
  await page.getByRole("button", { name: /^外观：/ }).click();
  const toggle = page.getByRole("checkbox", { name: /省流量/ });
  await expect(toggle).toBeChecked();
  await toggle.uncheck();
  await page.keyboard.press("Escape");
  await expectOne(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(animations(page)).toHaveCount(0);
  const count = originals.size;
  await page.evaluate(() => scrollBy(0, 700));
  await page.waitForTimeout(700);
  expect(originals.size).toBe(count);
});

test("旧后端、未知外链与失败poster均不回退请求原图", async ({ page }) => {
  const unknown = thread(1); unknown.coverMedia = { url: image(1, "animation"), animated: null, posterUrl: null };
  const legacy = thread(2);
  Reflect.deleteProperty(legacy, "coverMedia");
  const broken = thread(3);
  await mockApi(page, [unknown, legacy, broken]);
  await page.route("**/__cover-fixture__/3/poster.webp", (route) => route.fulfill({ status: 404, body: "" }));
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-thread-cover]")).toHaveCount(3);
  await page.waitForTimeout(700);
  expect(originals.size).toBe(0);
  await expect(animations(page)).toHaveCount(0);
});

test("搜索与自有收藏复用同一调度，页面切换不会留下旧动画", async ({ page }) => {
  await mockApi(page);
  await page.goto("/search?q=封面");
  await page.getByRole("tab", { name: "主题帖", exact: true }).click();
  await expectOne(page);
  await page.locator('a[href="/bookmarks"]:visible').first().click();
  await expect(page).toHaveURL(/\/bookmarks/);
  await expectOne(page);
  await expect(page.locator("article").first().getByRole("link").first()).toHaveAttribute("href", "/threads/cover-test-0");
});

test("已发出的原图响应晚到不会恢复离选中的动画", async ({ page }) => {
  await mockApi(page);
  let release: (() => void) | undefined;
  const blocked = new Promise<void>((resolve) => { release = resolve; });
  const requests: { url: string; outcome: string }[] = [];
  page.on("requestfinished", (request) => { if (request.url().includes("/animation.")) requests.push({ url: new URL(request.url()).pathname, outcome: "finished" }); });
  page.on("requestfailed", (request) => { if (request.url().includes("/animation.")) requests.push({ url: new URL(request.url()).pathname, outcome: "failed" }); });
  await page.route("**/__cover-fixture__/*/animation.gif", async (route) => {
    await blocked;
    await route.fulfill({ contentType: "image/gif", body: fixture("animated.gif") }).catch(() => undefined);
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(animations(page)).toHaveCount(1);
  const stale = await animations(page).getAttribute("src");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(animations(page)).toHaveCount(0);
  release?.();
  await page.waitForTimeout(500);
  await expect(animations(page)).toHaveCount(0);
  await expect(page.locator(`img[src="${stale}"]`)).toHaveCount(0);
  // 原生 img 的底层请求可能完成或被浏览器终止；只记录实际行为，不把卸载等同网络取消。
  await test.info().attach("late-image-network.json", { body: JSON.stringify(requests), contentType: "application/json" });
  console.info("迟到图片请求观察", JSON.stringify(requests));
});

test("真实动画WebP响应可播放，解码成功后隐藏首帧避免透明残影", async ({ page }) => {
  const item = thread(0);
  item.coverImages = ["/__cover-fixture__/0/animation.webp"];
  item.coverMedia.url = item.coverImages[0];
  await mockApi(page, [item]);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(animations(page)).toHaveAttribute("src", item.coverMedia.url);
  await expect(animations(page)).toBeVisible();
  await expect(posters(page)).toHaveClass(/invisible/);
  const decoded = await animations(page).evaluate((img) => (img as HTMLImageElement).naturalWidth);
  expect(decoded).toBeGreaterThan(0);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(animations(page)).toHaveCount(0);
  await expect(posters(page)).toBeVisible();
});


test("个人主页帖子与公开收藏使用相同静态首帧和中心播放", async ({ page }) => {
  await mockApi(page);
  await page.goto("/users/cover-owner/threads");
  await page.locator("[data-thread-cover]").first().scrollIntoViewIfNeeded();
  await expectOne(page);
  await page.locator('a[href="/users/cover-owner/bookmarks"]').click();
  await expect(page).toHaveURL(/\/users\/cover-owner\/bookmarks/);
  await expect(page.getByRole("tablist", { name: "帖子分类" })).toHaveCount(0);
  await expect(page.locator("[data-thread-cover]")).toHaveCount(15);
  await page.locator("[data-thread-cover]").first().scrollIntoViewIfNeeded();
  await expectOne(page);
  expect(originals.size).toBeLessThanOrEqual(2);
});


test.describe("按列表实际尺寸选择动画预览", () => {
  test.use({ deviceScaleFactor: 2 });
  test("DPR与两维尺寸选档，resize停稳后换档，不下载原图，点击仍进详情", async ({ page }) => {
    const item = thread(0);
    const small = "/__cover-fixture__/0/preview480.webp";
    const large = "/__cover-fixture__/0/preview800.webp";
    item.coverMedia.previewVariants = [
      { url: small, width: 480, height: 270, bytes: 100 },
      { url: large, width: 800, height: 450, bytes: 200 },
    ];
    await mockApi(page, [item]);
    const previewRequests = new Set<string>();
    await page.route("**/__cover-fixture__/*/preview*.webp", async (route) => {
      previewRequests.add(new URL(route.request().url()).pathname);
      await route.fulfill({ contentType: "image/webp", body: fixture("animated.webp") });
    });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(animations(page)).toHaveAttribute("src", large);
    await expect(animations(page)).toBeVisible();
    await expect(posters(page)).toHaveClass(/invisible/);
    expect([...previewRequests]).toEqual([large]);
    expect(originals.size).toBe(0);
    await page.setViewportSize({ width: 375, height: 800 });
    await expect(animations(page)).toHaveAttribute("src", small);
    await expect(animations(page)).toBeVisible();
    expect(originals.size).toBe(0);
    const target = await animations(page).evaluate((img) => img.closest("article")?.querySelector("a[href^='/threads/']")?.getAttribute("href"));
    await animations(page).click({ force: true });
    await expect(page).toHaveURL(new RegExp(target!));
    await expect(animations(page)).toHaveCount(0);
  });
});
