import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { THEME_PALETTES } from "@wenyousite/foundation/theme";

import { THEME_STORAGE_KEY } from "../src/lib/theme";

const fixedNow = new Date("2026-08-08T12:00:00Z");

const threads = [
  {
    id: "visual-thread-1",
    title: "暮色列车：寻找失落的终点站",
    category: "RPG",
    categoryInfo: { slug: "RPG", name: "RPG", isActive: true },
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
    coverImages: [],
  },
  {
    id: "visual-thread-2",
    title: "群星议会第三次联合会议",
    category: "NATION",
    categoryInfo: { slug: "NATION", name: "国策", isActive: true },
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
    coverImages: [],
  },
  {
    id: "visual-thread-3",
    title: "雨夜公寓连续失踪事件",
    category: "DEDUCTION",
    categoryInfo: { slug: "DEDUCTION", name: "演绎", isActive: true },
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
    coverImages: [],
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
            mergedIntoId: null,
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
            mergedIntoId: null,
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
            mergedIntoId: null,
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

async function expectBrandPinkTopicTag(page: Page) {
  const tag = page.getByRole("link", {
    name: "查看 #都市奇谭 标签下的主题帖",
  });
  await expect(tag).toHaveCSS("min-height", "32px");

  const palette = await tag.evaluate((element) => {
    const probe = document.createElement("span");
    probe.style.cssText = [
      "color:var(--element-topic-tag-foreground)",
      "background-color:var(--element-topic-tag-surface)",
      "border-color:var(--element-topic-tag-border)",
    ].join(";");
    document.body.append(probe);
    const style = getComputedStyle(element);
    const probeStyle = getComputedStyle(probe);
    const result = {
      color: style.color,
      backgroundColor: style.backgroundColor,
      borderColor: style.borderColor,
      fontWeight: style.fontWeight,
      expectedColor: probeStyle.color,
      expectedBackgroundColor: probeStyle.backgroundColor,
      expectedBorderColor: probeStyle.borderColor,
      expectedFontWeight: getComputedStyle(document.documentElement)
        .getPropertyValue("--element-topic-tag-font-weight")
        .trim(),
    };
    probe.remove();
    return result;
  });

  expect(palette.color).toBe(palette.expectedColor);
  expect(palette.backgroundColor).toBe(palette.expectedBackgroundColor);
  expect(palette.borderColor).toBe(palette.expectedBorderColor);
  expect(palette.fontWeight).toBe(palette.expectedFontWeight);
}

for (const viewport of [
  { width: 1024, height: 900 },
  { width: 1440, height: 1100 },
] as const) {
  test(`首页亮色阅读视觉基线 ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.addInitScript((storageKey) => localStorage.setItem(storageKey, "light"), THEME_STORAGE_KEY);
    await mockHome(page);
    await page.goto("/");
    await hideDevIndicator(page);
    await expect(page.getByRole("heading", { name: "发现主题帖" })).toBeVisible();
    await expect(page.getByText("暮色列车：寻找失落的终点站")).toBeVisible();
    await expect(page.locator('[data-slot="category-marker"]')).toHaveCount(0);
    await expectBrandPinkTopicTag(page);

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
      await expect(contextRail.getByText("按玩法发现")).toHaveCount(0);
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
  await page.addInitScript((storageKey) => localStorage.setItem(storageKey, "light"), THEME_STORAGE_KEY);
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

test("首页温暖墨紫黑夜视觉基线", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await page.addInitScript((storageKey) => localStorage.setItem(storageKey, "dark"), THEME_STORAGE_KEY);
  await mockHome(page);
  await page.goto("/");
  await hideDevIndicator(page);
  await expect(page.getByRole("heading", { name: "发现主题帖" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const themeColor = page.locator('meta[name="theme-color"]');
  await expect(themeColor).toHaveCount(1);
  await expect(themeColor).toHaveAttribute(
    "content",
    THEME_PALETTES.dark.background,
  );
  await expect(page.getByRole("button", { name: "外观：黑夜" })).toBeVisible();
  await expectBrandPinkTopicTag(page);
  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(accessibility.violations).toEqual([]);
  await expect(page).toHaveScreenshot("home-dark-1440.png", {
    fullPage: true,
    animations: "disabled",
  });
});
