import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

const fixture = (name: string) => readFileSync(path.join(process.cwd(), "e2e/fixtures/moment-animation", name));
const user = { id: "moment-animation-user", email: "animation@example.test", username: "播放验收", avatar: null, role: "USER", level: 1 };
const asset = (id: string, sticker = false) => ({ id, url: `/moment-animation/${id}.gif`, thumbnailUrl: `/moment-animation/${id}.webp`, feedUrl: null, mediumUrl: `/moment-animation/${id}.gif`, animated: true, contentType: "image/gif", width: sticker ? null : 960, height: sticker ? null : 640 });
const images = [asset("first"), asset("second")];
const reply = { id: "reply", momentId: "animation", author: user, content: "楼中楼动画", media: asset("reply", true), sticker: null, parentCommentId: "comment", replyToComment: null, deleted: false, canDelete: false, createdAt: "2026-09-10T12:00:00Z" };
const comments = [{ ...reply, id: "comment", content: "可见评论同时播放", parentCommentId: null, media: null, sticker: asset("sticker", true), replyCount: 1, replies: [reply] }];
const detail = { id: "animation", authorId: user.id, author: user, title: "动态播放验收", content: "动态图仅详情播放", contentExcerpt: "动态图仅详情播放", coverType: "IMAGE", textCoverTheme: "ROSE", coverMedia: images[0], images, imageCount: 2, version: 1, canEdit: false, canDelete: false, canInteract: true, likeCount: 0, commentCount: 2, bookmarkCount: 0, tipTotal: "0", viewerLiked: false, viewerBookmarked: true, createdAt: "2026-09-10T12:00:00Z", updatedAt: "2026-09-10T12:00:00Z" };

async function mock(page: Page, options: { preview?: "missing" | "failed"; failAnimation?: boolean } = {}) {
  const requests: string[] = [];
  let failAnimation = !!options.failAnimation;
  page.on("request", (request) => { if (request.url().includes("/moment-animation/")) requests.push(new URL(request.url()).pathname); });
  await page.route("**/moment-animation/**", (route) => {
    const url = route.request().url();
    if ((url.endsWith(".webp") && options.preview === "failed") || (url.endsWith(".gif") && failAnimation)) return route.fulfill({ status: 503, body: "fixture failure" });
    const file = url.endsWith(".webp") ? "thumbnail.webp" : /sticker|reply/.test(url) ? "sticker.gif" : "gallery.gif";
    return route.fulfill({ contentType: url.endsWith(".webp") ? "image/webp" : "image/gif", body: fixture(file) });
  });
  await page.route("**/api/v1/**", (route) => {
    const pathname = new URL(route.request().url()).pathname;
    const respond = (data: unknown, meta?: unknown) => route.fulfill({ contentType: "application/json", body: JSON.stringify({ code: 0, message: "ok", data, ...(meta ? { meta } : {}) }) });
    if (pathname.endsWith("/auth/refresh")) return respond({ accessToken: "test-in-memory-only", user });
    if (pathname.endsWith("/wallet/check-in")) return respond({ claimedNow: false, rewardAmount: "0", balance: "0" });
    if (pathname.endsWith("/notifications/unread")) return respond({ unreadCount: 0 });
    if (pathname.endsWith("/direct-conversations/unread")) return respond({ unreadMessageCount: 0, pendingRequestCount: 0, total: 0 });
    if (pathname === "/api/v1/moments/animation/comments") return respond(comments, { cursor: null, hasMore: false });
    if (pathname === "/api/v1/moments/animation") return respond(detail);
    if (pathname.endsWith("/bookmark-folders")) return respond([{ id: "folder", name: "默认收藏夹", isDefault: true, momentBookmarkCount: 1, threadCount: 0, createdAt: detail.createdAt }]);
    if (pathname === "/api/v1/users/moment-animation-user") return respond({ ...user, bio: "", profileCover: null, receivedTipTotal: "0", receivedTipCount: 0, showRecentReplies: true, showPlayerBadges: true, showBookmarks: true, accountStatus: "ACTIVE", createdAt: detail.createdAt, _count: { moments: 1, following: 0, followers: 0 }, stats: { momentCount: 1 } });
    if (pathname === "/api/v1/moments" || pathname.endsWith("/moments/bookmarks") || pathname.endsWith("/search/moments") || pathname.endsWith("/users/moment-animation-user/moments") || pathname.endsWith("/users/moment-animation-user/moment-bookmarks")) {
      return respond([{ ...detail, bookmarkFolderId: "folder", coverMedia: options.preview === "missing" ? { ...images[0], thumbnailUrl: null } : images[0] }], { cursor: null, hasMore: false });
    }
    return respond(null);
  });
  return { requests, recover: () => { failAnimation = false; } };
}

async function changes(page: Page, alt: string) {
  const image = page.getByAltText(alt).last();
  await image.evaluate((element) => element.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" }));
  await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0)).toBe(true);
  const centerColor = (png: Buffer) => page.evaluate(async (bytes) => {
    const bitmap = await createImageBitmap(new Blob([new Uint8Array(bytes)], { type: "image/png" }));
    const canvas = document.createElement("canvas");
    canvas.width = 1; canvas.height = 1;
    const context = canvas.getContext("2d")!;
    context.drawImage(bitmap, Math.floor(bitmap.width / 2), Math.floor(bitmap.height / 2), 1, 1, 0, 0, 1, 1);
    bitmap.close();
    return Array.from(context.getImageData(0, 0, 1, 1).data).slice(0, 3).join(",");
  }, Array.from(png));
  let first: Buffer = Buffer.alloc(0);
  let firstColor = "";
  await expect.poll(async () => {
    first = await image.screenshot({ animations: "allow" });
    firstColor = await centerColor(first);
    return firstColor === "255,0,0" || firstColor === "0,0,255";
  }, { timeout: 4000 }).toBe(true);
  await test.info().attach(`${alt}-visible-bounds`, { body: JSON.stringify(await image.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const top = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
    return { rect: rect.toJSON(), centerElement: top?.tagName, centerAlt: top?.getAttribute("alt") };
  })), contentType: "application/json" });
  let changed: Buffer = first;
  await expect.poll(async () => {
    changed = await image.screenshot({ animations: "allow" });
    return centerColor(changed);
  }, { timeout: 4000 }).toBe(firstColor === "255,0,0" ? "0,0,255" : "255,0,0");
  await test.info().attach(`${alt}-frame-1`, { body: first, contentType: "image/png" });
  await test.info().attach(`${alt}-frame-2`, { body: changed, contentType: "image/png" });
}

test("真实 GIF：轮播/评论/楼中楼可见播放，灯箱仅当前且恢复详情", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1200 });
  const { requests } = await mock(page);
  await page.goto("/moments/animation");
  const first = page.getByAltText("动态播放验收，第 1 张图片");
  const second = page.getByAltText("动态播放验收，第 2 张图片");
  await expect(first).toHaveAttribute("src", images[0].url);
  await expect(second).toHaveAttribute("src", images[1].thumbnailUrl);
  expect(requests).not.toContain(images[1].url);
  await changes(page, "动态播放验收，第 1 张图片");
  await page.getByRole("button", { name: "下一张图片", exact: true }).click();
  await expect(second).toHaveAttribute("src", images[1].url);
  await expect(first).toHaveAttribute("src", images[0].thumbnailUrl);
  await page.getByAltText("评论表情包").scrollIntoViewIfNeeded();
  await expect(page.getByAltText("评论表情包")).toHaveAttribute("src", "/moment-animation/sticker.gif");
  await expect(page.getByAltText("评论图片")).toHaveAttribute("src", "/moment-animation/reply.gif");
  await changes(page, "评论表情包"); await changes(page, "评论图片");
  await page.getByRole("button", { name: "查看评论表情包" }).click();
  const lightbox = page.getByRole("dialog", { name: "查看大图" });
  await expect(lightbox).toBeVisible();
  await expect(page.locator('article img[src$=".gif"]')).toHaveCount(0);
  const sticker = lightbox.getByAltText("评论表情包");
  await expect(sticker).toHaveAttribute("src", "/moment-animation/sticker.gif");
  await expect.poll(async () => Math.round((await sticker.boundingBox())!.width)).toBe(100);
  await lightbox.getByRole("button", { name: "放大", exact: true }).click();
  await expect.poll(async () => Math.round((await sticker.boundingBox())!.width)).toBe(200);
  const box = (await sticker.boundingBox())!;
  await page.mouse.move(box.x + 50, box.y + 50); await page.mouse.down(); await page.mouse.move(box.x + 90, box.y + 80); await page.mouse.up();
  await expect(sticker).toBeInViewport();
  await lightbox.getByRole("button", { name: "关闭大图", exact: true }).click();
  await expect(lightbox).toHaveCount(0);
  await expect(page.getByAltText("评论表情包")).toHaveAttribute("src", "/moment-animation/sticker.gif");
  await second.scrollIntoViewIfNeeded();
  await page.getByRole("button", { name: "查看大图：动态播放验收，第 2 张图片" }).click();
  await expect(lightbox.locator('img[src$=".gif"]')).toHaveCount(1);
  await expect(page.locator('article img[src$=".gif"]')).toHaveCount(0);
  await page.keyboard.press("ArrowLeft");
  await expect(lightbox.getByAltText("动态播放验收，第 1 张图片")).toHaveAttribute("src", images[0].url);
  await expect(lightbox.locator('img[src$=".gif"]')).toHaveCount(1);
  await page.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, value: true }); document.dispatchEvent(new Event("visibilitychange")); });
  await expect(page.locator('img[src$=".gif"]')).toHaveCount(0);
  await page.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, value: false }); document.dispatchEvent(new Event("visibilitychange")); });
  await expect(lightbox.locator('img[src$=".gif"]')).toHaveCount(1);
  await page.keyboard.press("Escape");
  await page.evaluate(() => { document.body.style.minHeight = "5000px"; window.scrollTo(0, 4500); });
  await expect(page.locator('img[src$=".gif"]')).toHaveCount(0);
  await page.goto("/moments");
  await expect(page.getByAltText(detail.title)).toHaveAttribute("src", images[0].thumbnailUrl);
  await expect(page.locator('img[src$=".gif"]')).toHaveCount(0);
});

test("全部列表入口不请求原动画，缺失/失败预览只占位", async ({ page }) => {
  const { requests } = await mock(page);
  for (const url of ["/moments", "/moments?feed=FOLLOWING", "/search?q=播放", "/users/moment-animation-user/moments", "/bookmarks?type=moments"]) {
    await page.goto(url);
    if (url.includes("FOLLOWING")) await page.getByRole("tab", { name: "关注", exact: true }).click();
    if (url.startsWith("/bookmarks")) await page.getByRole("tab", { name: "动态", exact: true }).click();
    await expect(page.getByAltText(detail.title)).toHaveAttribute("src", images[0].thumbnailUrl);
    await page.getByAltText(detail.title).hover();
    await page.getByAltText(detail.title).evaluate((image) => image.closest("a")?.focus());
    await expect(page.getByAltText(detail.title)).toHaveAttribute("src", images[0].thumbnailUrl);
    expect(requests.filter((url) => url.endsWith(".gif"))).toEqual([]);
  }
  await test.info().attach("list-media-requests", { body: JSON.stringify(requests, null, 2), contentType: "application/json" });
  for (const preview of ["missing", "failed"] as const) {
    const other = await page.context().newPage();
    const mocked = await mock(other, { preview });
    await other.goto("/moments");
    await expect(other.getByText("图片暂不可用")).toBeVisible();
    expect(mocked.requests.filter((url) => url.endsWith(".gif"))).toEqual([]);
    await other.close();
  }
});

test("真实网络失败后切图和前后台不重试，点击重试才恢复", async ({ page }) => {
  const mocked = await mock(page, { failAnimation: true });
  await page.goto("/moments/animation");
  await expect(page.getByRole("button", { name: "重试动图" }).first()).toBeVisible();
  const count = mocked.requests.filter((url) => url === images[0].url).length;
  await page.getByRole("button", { name: "下一张图片", exact: true }).click();
  await page.getByRole("button", { name: "上一张图片", exact: true }).click();
  await expect(page.getByAltText("动态播放验收，第 1 张图片")).toHaveAttribute("src", images[0].thumbnailUrl);
  await page.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, value: true }); document.dispatchEvent(new Event("visibilitychange")); });
  await expect(page.locator('img[src$=".gif"]')).toHaveCount(0);
  await page.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, value: false }); document.dispatchEvent(new Event("visibilitychange")); });
  await expect(page.getByAltText("动态播放验收，第 1 张图片")).toHaveAttribute("src", images[0].thumbnailUrl);
  expect(mocked.requests.filter((url) => url === images[0].url)).toHaveLength(count);
  mocked.recover();
  await page.locator('[data-slot="moment-detail-carousel"]').getByRole("button", { name: "重试动图" }).first().click();
  await expect(page.getByAltText("动态播放验收，第 1 张图片")).toHaveAttribute("src", images[0].url);
  await changes(page, "动态播放验收，第 1 张图片");
});
