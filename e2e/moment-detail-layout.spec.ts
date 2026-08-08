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
  url: "https://cdn.example.com/portrait.webp",
  thumbnailUrl: null,
  feedUrl: null,
  mediumUrl: "https://cdn.example.com/portrait-medium.webp",
  width: 1200,
  height: 1600,
};

const landscapeCover = {
  id: "landscape-cover",
  url: "https://cdn.example.com/landscape.webp",
  thumbnailUrl: null,
  feedUrl: null,
  mediumUrl: "https://cdn.example.com/landscape-medium.webp",
  width: 1600,
  height: 1000,
};

async function mockMomentDetail(page: Page) {
  await page.route("https://cdn.example.com/**", (route) => route.fulfill({
    contentType: "image/svg+xml",
    body: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="10"/>',
  }));

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
    if (pathname === "/api/v1/moments/moment-layout/comments") {
      return response([], { cursor: null, hasMore: false });
    }
    if (pathname === "/api/v1/moments/moment-layout") {
      return response({
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
      });
    }
    return response(null);
  });
}

test("动态详情以封面比例固定图片舞台，切图不推动正文", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await mockMomentDetail(page);
  await page.goto("/moments/moment-layout");

  const heading = page.getByRole("heading", { name: "固定舞台测试" });
  const imageFrame = page.locator('[data-slot="moment-detail-image"]');
  await expect(heading).toBeVisible();
  await expect(page.getByAltText("固定舞台测试，第 1 张图片")).toBeVisible();

  const frameBefore = await imageFrame.boundingBox();
  const headingBefore = await heading.boundingBox();
  expect(frameBefore).not.toBeNull();
  expect(headingBefore).not.toBeNull();

  await page.getByRole("button", { name: "下一张图片" }).click();
  await expect(page.getByAltText("固定舞台测试，第 2 张图片")).toBeVisible();

  const frameAfter = await imageFrame.boundingBox();
  const headingAfter = await heading.boundingBox();
  expect(frameAfter).not.toBeNull();
  expect(headingAfter).not.toBeNull();
  expect(Math.abs(frameAfter!.height - frameBefore!.height)).toBeLessThan(1);
  expect(Math.abs(headingAfter!.y - headingBefore!.y)).toBeLessThan(1);
});
