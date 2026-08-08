import { expect, test, type Page } from "@playwright/test";

const user = {
  id: "moment-create-user",
  email: "moment-create@example.test",
  username: "动态发布测试用户",
  avatar: null,
  role: "USER",
  emailVerified: true,
};

const createdMoment = {
  id: "moment-created",
  authorId: user.id,
  author: { id: user.id, username: user.username, avatar: null, level: 1 },
  title: "浏览器发布动态",
  contentExcerpt: "纯文字发布旅程",
  content: "纯文字发布旅程",
  coverType: "TEXT",
  textCoverTheme: "MINT",
  coverMedia: null,
  imageCount: 0,
  images: [],
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

async function mockMomentCreateApi(page: Page) {
  let createBody: Record<string, unknown> | undefined;
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const { pathname } = new URL(request.url());
    const respond = (
      data: unknown,
      options: { meta?: Record<string, unknown>; status?: number } = {},
    ) => route.fulfill({
      status: options.status ?? 200,
      contentType: "application/json",
      body: JSON.stringify({
        code: 0,
        message: "ok",
        data,
        ...(options.meta ? { meta: options.meta } : {}),
      }),
    });

    if (pathname.endsWith("/auth/refresh")) {
      return respond({ accessToken: "moment-create-token", user });
    }
    if (pathname.endsWith("/wallet/check-in")) {
      return respond({ claimedNow: false, rewardAmount: "0", balance: "0" });
    }
    if (pathname.endsWith("/notifications/unread")) {
      return respond({ unreadCount: 0 });
    }
    if (pathname.endsWith("/direct-conversations/unread")) {
      return respond({ unreadMessageCount: 0, pendingRequestCount: 0, total: 0 });
    }
    if (pathname === "/api/v1/moments" && request.method() === "GET") {
      return respond([], { meta: { cursor: null, hasMore: false } });
    }
    if (pathname === "/api/v1/moments" && request.method() === "POST") {
      createBody = request.postDataJSON() as Record<string, unknown>;
      return respond(createdMoment, { status: 201 });
    }
    if (pathname === "/api/v1/moments/moment-created") {
      return respond(createdMoment);
    }
    if (pathname === "/api/v1/moments/moment-created/comments") {
      return respond([], { meta: { cursor: null, hasMore: false } });
    }
    return respond(null);
  });
  return () => createBody;
}

test("从全站发布入口创建纯文字动态并进入详情", async ({ page }) => {
  const getCreateBody = await mockMomentCreateApi(page);
  await page.goto("/moments");
  await expect(page.getByRole("heading", { name: "动态", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "打开发布菜单" }).click();
  await page.getByRole("button", { name: /发布动态/ }).click();
  const composer = page.getByRole("dialog", { name: "发布动态" });
  await expect(composer).toBeVisible();
  await composer.getByLabel("标题").fill("  浏览器发布动态  ");
  await composer.getByLabel("正文").fill("纯文字发布旅程");
  await composer.getByRole("button", { name: "发布动态", exact: true }).click();

  await expect(page).toHaveURL(/\/moments\/moment-created$/);
  await expect(page.getByRole("heading", { name: "浏览器发布动态" })).toBeVisible();
  expect(getCreateBody()).toMatchObject({
    title: "浏览器发布动态",
    content: "纯文字发布旅程",
    mediaIds: [],
    coverMediaId: null,
  });
  expect(getCreateBody()?.clientRequestId).toEqual(expect.stringMatching(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  ));
});
