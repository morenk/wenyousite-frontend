import { expect, test, type Page } from "@playwright/test";

const layoutUser = {
  id: "moment-layout-user",
  email: "moment-layout@example.test",
  username: "动态布局测试用户",
  avatar: null,
  role: "USER",
  emailVerified: true,
};

const portraitImage = {
  id: "portrait-image",
  url: "/visual/portrait.webp",
  thumbnailUrl: null,
  feedUrl: null,
  mediumUrl: "/visual/portrait-medium.webp",
  width: 1200,
  height: 1600,
};

const landscapeCover = {
  id: "landscape-cover",
  url: "/visual/landscape.webp",
  thumbnailUrl: null,
  feedUrl: null,
  mediumUrl: "/visual/landscape-medium.webp",
  width: 1600,
  height: 1000,
};

const detail = {
  id: "moment-layout",
  authorId: layoutUser.id,
  author: { id: layoutUser.id, username: layoutUser.username, avatar: null, level: 1 },
  title: "固定舞台测试",
  contentExcerpt: "切换图片时正文不移动",
  content: "切换图片时正文不移动",
  coverType: "IMAGE",
  textCoverTheme: "ROSE",
  coverMedia: landscapeCover,
  imageCount: 2,
  images: [portraitImage, landscapeCover],
  version: 1,
  canEdit: true,
  canDelete: true,
  likeCount: 0,
  commentCount: 0,
  bookmarkCount: 0,
  tipTotal: "0",
  viewerLiked: false,
  viewerBookmarked: false,
  createdAt: "2026-08-08T12:00:00.000Z",
  updatedAt: "2026-08-08T12:00:00.000Z",
};

const previewReply = {
  id: "moment-reply-preview",
  momentId: detail.id,
  author: { id: "reply-preview-user", username: "预览回复者", avatar: null, level: 1 },
  content: "首屏预览回复",
  media: null,
  sticker: null,
  parentCommentId: "moment-comment-root",
  replyToComment: null,
  deleted: false,
  canDelete: false,
  createdAt: "2026-08-08T12:01:00.000Z",
};

const targetReply = {
  ...previewReply,
  id: "moment-reply-target",
  author: { id: "reply-target-user", username: "目标回复者", avatar: null, level: 1 },
  content: "通知需要定位的具体回复",
  createdAt: "2026-08-08T14:00:00.000Z",
};

const longReplyRoot = {
  id: "moment-comment-root",
  momentId: detail.id,
  author: { id: "root-comment-user", username: "主评论者", avatar: null, level: 1 },
  content: "拥有很多楼中楼的主评论",
  media: null,
  sticker: null,
  parentCommentId: null,
  replyToComment: null,
  deleted: false,
  canDelete: false,
  createdAt: "2026-08-08T12:00:00.000Z",
  replyCount: 108,
  replies: [previewReply],
};

const feedMoments = Array.from({ length: 18 }, (_, index) => {
  const isTarget = index === 17;
  return {
    id: isTarget ? detail.id : `moment-feed-${index + 1}`,
    authorId: layoutUser.id,
    author: {
      id: layoutUser.id,
      username: layoutUser.username,
      avatar: null,
      level: 1,
      deletedAt: null,
    },
    title: isTarget ? detail.title : `恢复滚动测试 ${index + 1}`,
    contentExcerpt: isTarget ? detail.contentExcerpt : "用于撑开动态瀑布流的普通文字",
    coverType: isTarget ? "IMAGE" : "TEXT",
    coverMedia: isTarget ? landscapeCover : null,
    textCoverTheme: index % 2 === 0 ? "ROSE" : "LAVENDER",
    imageCount: isTarget ? 2 : 0,
    likeCount: index,
    commentCount: 0,
    bookmarkCount: 0,
    tipTotal: "0",
    viewerLiked: false,
    viewerBookmarked: false,
    createdAt: "2026-08-08T12:00:00.000Z",
    updatedAt: "2026-08-08T12:00:00.000Z",
  };
});

async function mockMoments(
  page: Page,
  options: { longReplyThread?: boolean; portraitCover?: boolean } = {},
) {
  await page.route("**/visual/**", (route) => {
    const portrait = route.request().url().includes("portrait");
    const [width, height] = portrait ? [120, 160] : [160, 100];
    return route.fulfill({
      contentType: "image/svg+xml",
      body: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#f7f5f8"/><circle cx="${width * 0.5}" cy="${height * 0.42}" r="${Math.min(width, height) * 0.22}" fill="#f3c6dd"/><path d="M${width * 0.18} ${height * 0.82} Q${width * 0.5} ${height * 0.56} ${width * 0.82} ${height * 0.82}" fill="none" stroke="#704c65" stroke-width="4" stroke-linecap="round"/></svg>`,
    });
  });

  await page.route("**/api/v1/**", (route) => {
    const { pathname } = new URL(route.request().url());
    const response = (data: unknown, meta?: Record<string, unknown>) => route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ code: 0, message: "ok", data, ...(meta ? { meta } : {}) }),
    });

    if (pathname.endsWith("/auth/refresh")) {
      return response({ accessToken: "moment-layout-token", user: layoutUser });
    }
    if (pathname.endsWith("/wallet/check-in")) {
      return response({ claimedNow: false, rewardAmount: "0", balance: "0" });
    }
    if (pathname.endsWith("/notifications/unread")) {
      return response({ unreadCount: 0 });
    }
    if (pathname.endsWith("/direct-conversations/unread")) {
      return response({ unreadMessageCount: 0, pendingRequestCount: 0, total: 0 });
    }
    if (pathname === "/api/v1/moments") {
      return response(feedMoments, { cursor: null, hasMore: false });
    }
    if (pathname === "/api/v1/moments/moment-layout/comments") {
      return response(options.longReplyThread ? [longReplyRoot] : [], { cursor: null, hasMore: false });
    }
    if (pathname === "/api/v1/moments/moment-layout/comments/moment-reply-target/context") {
      return response(options.longReplyThread ? {
        root: longReplyRoot,
        target: targetReply,
        replyCount: longReplyRoot.replyCount,
      } : null);
    }
    if (pathname === "/api/v1/moments/moment-layout/comments/moment-comment-root/replies") {
      return response(options.longReplyThread ? [previewReply] : [], { cursor: null, hasMore: false });
    }
    if (pathname === "/api/v1/moments/moment-layout") {
      return response({
        ...detail,
        ...(options.longReplyThread ? { commentCount: 109 } : {}),
        ...(options.portraitCover ? { coverMedia: portraitImage } : {}),
      });
    }
    return response(null);
  });
}

test("动态详情以封面比例固定图片舞台，切图不推动正文", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await mockMoments(page, { portraitCover: true });
  await page.goto("/moments/moment-layout");

  const heading = page.getByRole("heading", { name: "固定舞台测试" });
  // Embla 会同时保留所有幻灯片；用首张图片的固定舞台测量尺寸，避免多元素定位歧义。
  const imageFrame = page.locator('[data-slot="moment-detail-image"]').first();
  await expect(heading).toBeVisible();
  await expect(heading).toBeInViewport();
  const firstImage = page.getByAltText("固定舞台测试，第 1 张图片");
  await expect(firstImage).toBeVisible();
  await expect.poll(
    () => firstImage.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0),
  ).toBe(true);
  await expect(page.getByRole("dialog", { name: "动态详情" })).toHaveCount(0);
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  await expect(page).toHaveScreenshot("moment-detail-1440.png", {
    fullPage: true,
    animations: "disabled",
  });

  const frameBefore = await imageFrame.boundingBox();
  const headingBefore = await heading.boundingBox();
  expect(frameBefore).not.toBeNull();
  expect(headingBefore).not.toBeNull();
  expect(frameBefore!.height).toBeGreaterThanOrEqual(670);
  expect(headingBefore!.y).toBeGreaterThanOrEqual(0);
  expect(headingBefore!.y + headingBefore!.height).toBeLessThanOrEqual(1000);
  expect(headingBefore!.y + headingBefore!.height).toBeLessThan(frameBefore!.y);

  await page.getByRole("button", { name: "下一张图片" }).click();
  await expect(page.getByAltText("固定舞台测试，第 2 张图片")).toBeVisible();

  const frameAfter = await imageFrame.boundingBox();
  const headingAfter = await heading.boundingBox();
  expect(frameAfter).not.toBeNull();
  expect(headingAfter).not.toBeNull();
  expect(Math.abs(frameAfter!.height - frameBefore!.height)).toBeLessThan(1);
  expect(Math.abs(headingAfter!.y - headingBefore!.y)).toBeLessThan(1);

  await page.getByRole("button", { name: "返回动态" }).click();
  await expect(page).toHaveURL(/\/moments$/);
  await expect(page.getByRole("tab", { name: "发现" })).toHaveAttribute("aria-selected", "true");
});

test("详情替换固定中栏，返回时恢复关注流和滚动位置", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 800 });
  await mockMoments(page);
  await page.goto("/moments");

  await page.getByRole("tab", { name: "关注" }).click();
  await expect(page.getByRole("tab", { name: "关注" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("feed", { name: "动态瀑布流" })).toBeVisible();

  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const targetCard = page.locator('[data-moment-id="moment-layout"]');
  await expect(targetCard).toBeVisible();
  await targetCard.scrollIntoViewIfNeeded();
  const feedScrollY = await page.evaluate(() => window.scrollY);
  const targetOffset = (await targetCard.boundingBox())?.y;
  expect(feedScrollY).toBeGreaterThan(500);
  expect(targetOffset).toBeDefined();

  const main = page.locator('[data-slot="app-chrome"] > main');
  const leftRail = page.getByRole("complementary", { name: "全局导航" });
  const rightRail = page.getByRole("complementary", { name: "快捷信息" });
  const shell = page.locator('[data-slot="page-shell"]');
  const before = await Promise.all([
    main.boundingBox(),
    leftRail.boundingBox(),
    rightRail.boundingBox(),
    shell.boundingBox(),
  ]);

  await targetCard.locator('a[href="/moments/moment-layout"]').first().click();
  await expect(page).toHaveURL(/\/moments\/moment-layout$/);
  await expect(page.getByRole("heading", { name: "固定舞台测试" })).toBeVisible();
  await expect(page.getByRole("dialog", { name: "动态详情" })).toHaveCount(0);

  const after = await Promise.all([
    main.boundingBox(),
    leftRail.boundingBox(),
    rightRail.boundingBox(),
    shell.boundingBox(),
  ]);
  before.forEach((beforeBox, index) => {
    const afterBox = after[index];
    if (!beforeBox || !afterBox) throw new Error("未能测量动态页布局");
    expect(Math.abs(afterBox.x - beforeBox.x)).toBeLessThan(1);
    expect(Math.abs(afterBox.width - beforeBox.width)).toBeLessThan(1);
  });

  const detailReading = page.locator('[data-slot="moment-detail-reading"]');
  const detailCarousel = page.locator('[data-slot="moment-detail-carousel"]');
  const detailTitleCard = page.locator('[data-slot="moment-detail-title-card"]');
  const detailToolbar = page.locator('[data-slot="moment-detail-toolbar"]');
  const [readingBox, carouselBox, titleCardBox, toolbarBox, detailShellBox] = await Promise.all([
    detailReading.boundingBox(),
    detailCarousel.boundingBox(),
    detailTitleCard.boundingBox(),
    detailToolbar.boundingBox(),
    shell.boundingBox(),
  ]);
  if (!readingBox || !carouselBox || !titleCardBox || !toolbarBox || !detailShellBox) {
    throw new Error("未能测量动态详情排版");
  }
  expect(carouselBox.width).toBeGreaterThanOrEqual(640);
  for (const alignedBox of [readingBox, titleCardBox, toolbarBox]) {
    expect(Math.abs(alignedBox.x - carouselBox.x)).toBeLessThan(1);
    expect(Math.abs(alignedBox.width - carouselBox.width)).toBeLessThan(1);
  }
  expect(Math.abs(
    carouselBox.x + carouselBox.width / 2 - (detailShellBox.x + detailShellBox.width / 2),
  )).toBeLessThan(1);

  await page.getByRole("button", { name: "返回动态" }).click();
  await expect(page).toHaveURL(/\/moments$/);
  await expect(page.getByRole("tab", { name: "关注" })).toHaveAttribute("aria-selected", "true");
  await expect.poll(
    async () => Math.abs(((await targetCard.boundingBox())?.y ?? Number.POSITIVE_INFINITY) - targetOffset!),
  ).toBeLessThan(2);
  await expect(targetCard).toBeInViewport();
});

test("动态通知目标直达具体楼中楼，长讨论可从悬浮按钮收起", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 800 });
  await mockMoments(page, { longReplyThread: true });
  await page.goto(
    "/moments/moment-layout?comment=moment-comment-root&reply=moment-reply-target#moment-comment-moment-reply-target",
  );

  const target = page.locator("#moment-comment-moment-reply-target");
  await expect(target).toContainText("通知需要定位的具体回复");
  await expect(target).toHaveAttribute("aria-current", "location");
  await expect(target).toBeInViewport();

  const collapse = page.getByRole("button", { name: "收起 108 条回复" });
  await expect(collapse).toBeVisible();
  await expect(collapse.locator("xpath=..")).toHaveCSS("position", "sticky");

  await collapse.click();
  await expect(target).toHaveCount(0);
  await expect(page.getByRole("button", { name: "展开全部 108 条回复" })).toBeVisible();
});
