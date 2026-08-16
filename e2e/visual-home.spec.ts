import { expect, test, type Page } from "@playwright/test";

const fixedNow = new Date("2026-08-08T12:00:00Z");

const threads = [
  {
    id: "visual-thread-1",
    title: "暮色列车：寻找失落的终点站",
    category: "RPG",
    status: "RECRUITING",
    visibility: "PUBLIC",
    published: true,
    pinned: true,
    createdAt: "2026-08-07T12:00:00Z",
    updatedAt: "2026-08-08T11:30:00Z",
    deletedAt: null,
    tipTotal: "28",
    owner: { id: "visual-user-1", username: "南枝", avatar: null, level: 7 },
    defaultSubthread: { id: "visual-subthread-1", title: "主帖", lastPostAt: null },
    topicTags: [
      {
        id: "visual-relation-1",
        threadId: "visual-thread-1",
        tagId: "visual-tag-1",
        tag: { id: "visual-tag-1", name: "都市奇谭", color: null },
      },
      {
        id: "visual-relation-2",
        threadId: "visual-thread-1",
        tagId: "visual-tag-2",
        tag: { id: "visual-tag-2", name: "长期", color: null },
      },
    ],
    _count: { members: 5, players: 4, posts: 36 },
    preview: "午夜之后，旧站台会驶来一班时刻表上不存在的列车。我们需要在天亮前找到回程的路。",
  },
  {
    id: "visual-thread-2",
    title: "群星议会第三次联合会议",
    category: "NATION",
    status: "CLOSED",
    visibility: "PUBLIC",
    published: true,
    pinned: false,
    createdAt: "2026-08-06T08:00:00Z",
    updatedAt: "2026-08-08T10:00:00Z",
    deletedAt: null,
    tipTotal: "12",
    owner: { id: "visual-user-2", username: "白塔记录员", avatar: null, level: 4 },
    defaultSubthread: { id: "visual-subthread-2", title: "议程", lastPostAt: null },
    topicTags: [
      {
        id: "visual-relation-3",
        threadId: "visual-thread-2",
        tagId: "visual-tag-3",
        tag: { id: "visual-tag-3", name: "外交", color: null },
      },
    ],
    _count: { members: 8, players: 6, posts: 18 },
    preview: "本轮议题包括边境航道、共同防务与下一年度的资源交换协议。",
  },
  {
    id: "visual-thread-3",
    title: "雨夜公寓连续失踪事件",
    category: "DEDUCTION",
    status: "FINISHED",
    visibility: "PUBLIC",
    published: true,
    pinned: false,
    createdAt: "2026-08-01T08:00:00Z",
    updatedAt: "2026-08-07T18:00:00Z",
    deletedAt: null,
    tipTotal: "6",
    owner: { id: "visual-user-3", username: "小满", avatar: null, level: 2 },
    defaultSubthread: { id: "visual-subthread-3", title: "案卷", lastPostAt: null },
    topicTags: [],
    _count: { members: 3, players: 3, posts: 24 },
    preview: "每逢暴雨，电梯都会在不存在的十三层停下。最新的住户档案里又少了一个名字。",
  },
] as const;

async function mockHome(page: Page) {
  await page.clock.setFixedTime(fixedNow);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/api/v1/auth/refresh", (route) =>
    route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ code: 1001, message: "unauthorized" }),
    }),
  );
  await page.route("**/api/v1/thread-categories", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        code: 0,
        message: "ok",
        data: [
          {
            id: "visual-category-deduction",
            slug: "DEDUCTION",
            name: "演绎",
            description: null,
            icon: null,
            sortOrder: 10,
            isActive: true,
            createdAt: "2026-08-01T00:00:00Z",
            updatedAt: "2026-08-01T00:00:00Z",
          },
          {
            id: "visual-category-nation",
            slug: "NATION",
            name: "国策",
            description: null,
            icon: null,
            sortOrder: 20,
            isActive: true,
            createdAt: "2026-08-01T00:00:00Z",
            updatedAt: "2026-08-01T00:00:00Z",
          },
          {
            id: "visual-category-rpg",
            slug: "RPG",
            name: "RPG",
            description: null,
            icon: null,
            sortOrder: 30,
            isActive: true,
            createdAt: "2026-08-01T00:00:00Z",
            updatedAt: "2026-08-01T00:00:00Z",
          },
        ],
      }),
    }),
  );
  await page.route("**/api/v1/threads?**", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        code: 0,
        message: "ok",
        data: threads,
        meta: { cursor: null, hasMore: false },
      }),
    }),
  );
}

async function hideDevIndicator(page: Page) {
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
}

for (const viewport of [
  { width: 1024, height: 900 },
  { width: 1440, height: 1100 },
] as const) {
  test(`首页纯白轻二次元视觉基线 ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await mockHome(page);
    await page.goto("/");
    await hideDevIndicator(page);
    await expect(page.getByRole("heading", { name: "发现主题帖" })).toBeVisible();
    await expect(page.getByText("暮色列车：寻找失落的终点站")).toBeVisible();
    const firstCategoryMarker = page.locator('[data-slot="category-marker"]').first();
    await expect(firstCategoryMarker).toHaveCSS("width", "4px");
    const categoryMarkerColors = await page.locator('[data-slot="category-marker"]').evaluateAll(
      (markers) => [...new Set(markers.map((marker) => getComputedStyle(marker).backgroundColor))],
    );
    expect(categoryMarkerColors).toHaveLength(1);
    await expect(page.getByRole("link", { name: "查看 #都市奇谭 标签下的主题帖" })).toHaveCSS("min-height", "32px");

    const pageShell = page.locator('[data-slot="page-shell"]');
    const box = await pageShell.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeLessThanOrEqual(672);
    const feedBox = await page.locator('[data-slot="home-feed"]').boundingBox();
    expect(feedBox).not.toBeNull();
    expect(feedBox!.width).toBeLessThanOrEqual(672);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
    const contextRail = page.getByRole("complementary", { name: "快捷信息" });
    if (viewport.width >= 1280) {
      await expect(contextRail).toBeVisible();
    } else {
      await expect(contextRail).toBeHidden();
    }

    await expect(page).toHaveScreenshot(`home-${viewport.width}.png`, {
      fullPage: true,
      animations: "disabled",
    });
  });
}

test("宽屏保持三栏社区壳且减少动态效果", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await mockHome(page);
  await page.goto("/");
  await hideDevIndicator(page);
  await expect(page.getByRole("heading", { name: "发现主题帖" })).toBeVisible();

  const shellBox = await page.locator('[data-slot="page-shell"]').boundingBox();
  const feedBox = await page.locator('[data-slot="home-feed"]').boundingBox();
  const navBox = await page.getByRole("complementary", { name: "全局导航" }).boundingBox();
  const contextBox = await page.getByRole("complementary", { name: "快捷信息" }).boundingBox();
  expect(shellBox).not.toBeNull();
  expect(feedBox).not.toBeNull();
  expect(navBox).not.toBeNull();
  expect(contextBox).not.toBeNull();
  expect(shellBox!.width).toBeLessThanOrEqual(672);
  expect(feedBox!.width).toBeLessThanOrEqual(672);
  expect(navBox!.width).toBe(272);
  expect(contextBox!.width).toBe(272);

  const transitionDuration = await page
    .getByRole("tab", { name: "全部" })
    .evaluate((element) => getComputedStyle(element).transitionDuration);
  expect(Number.parseFloat(transitionDuration)).toBeLessThanOrEqual(0.00001);

  await expect(page).toHaveScreenshot("home-1920.png", {
    fullPage: true,
    animations: "disabled",
  });
});
