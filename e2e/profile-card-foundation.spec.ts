import { expect, type Page } from "@playwright/test";
import { test } from "./fixtures/isolation";

const userId = "profile-card-foundation";
const profile = {
  id: userId,
  username: "圆角用户",
  avatar: null,
  profileCover: {
    url: "/profile-card-cover.svg",
    mediumUrl: null,
    width: 1200,
    height: 400,
    mobile: null,
  },
  bio: "资料卡封面与内容卡外框",
  role: "USER",
  level: 2,
  receivedTipTotal: "0",
  receivedTipCount: 0,
  showRecentReplies: true,
  showPlayerBadges: true,
  showBookmarks: false,
  accountStatus: "ACTIVE",
  createdAt: "2026-09-01T00:00:00Z",
  _count: { following: 0, followers: 0 },
};

async function mockProfile(page: Page) {
  await page.route("**/profile-card-cover.svg", (route) => route.fulfill({
    contentType: "image/svg+xml",
    body: '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="400"><rect width="1200" height="400" fill="#86aab3"/></svg>',
  }));
  await page.route("**/api/v1/**", (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    if (path === `/api/v1/users/${userId}`) {
      return route.fulfill({ json: { code: 0, message: "ok", data: profile } });
    }
    if (path === `/api/v1/users/${userId}/activity-summary`) {
      return route.fulfill({ json: { code: 0, message: "ok", data: {
        momentCount: 2,
        createdThreadCount: 3,
        playedThreadCount: 4,
        replyCount: 5,
      } } });
    }
    if (path === `/api/v1/users/${userId}/recent-replies`) {
      return route.fulfill({ json: { code: 0, message: "ok", data: [] } });
    }
    if (path.endsWith("/auth/refresh")) {
      return route.fulfill({ status: 401, json: { code: 40100, message: "未登录" } });
    }
    return route.fulfill({ json: { code: 0, message: "ok", data: [] } });
  });
}

for (const width of [390, 1440] as const) {
for (const colorScheme of ["light", "dark"] as const) {
  test(`${width}px ${colorScheme} 个人页卡片、控件与浮层圆角`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 844 });
    await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
    await mockProfile(page);
    await page.goto(`/users/${userId}`);

    await expect(page.getByRole("heading", { name: profile.username })).toBeVisible();
    await expect(page.getByText("创作概览")).toBeVisible();
    await expect(page.getByText("最近回复", { exact: true })).toBeVisible();
    await expect(page.getByText(/加入温油站/)).toHaveCount(0);

    const cards = page.locator('[data-slot="card"][data-appearance="content"]');
    await expect(cards).toHaveCount(3);
    const geometry = await cards.evaluateAll((elements) => elements.map((element) => {
      const style = getComputedStyle(element);
      const cover = element.querySelector('[data-slot="profile-cover"]');
      const box = element.getBoundingClientRect();
      const coverBox = cover?.getBoundingClientRect();
      return {
        radius: style.borderTopLeftRadius,
        overflow: style.overflow,
        coverInside: !coverBox || (coverBox.left >= box.left && coverBox.right <= box.right),
      };
    }));
    expect(geometry.every((item) => item.radius === "10px")).toBe(true);
    expect(geometry.every((item) => item.overflow === "hidden" && item.coverInside)).toBe(true);

    const overview = page.locator('[data-slot="profile-tab-content"] > div');
    await expect(overview).toHaveCSS("row-gap", "8px");
    await expect(overview).toHaveCSS("column-gap", "8px");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);

    const themeTrigger = page.getByRole("button", { name: /外观：/ }).first();
    await expect(themeTrigger).toHaveCSS("border-top-left-radius", "8px");
    await themeTrigger.click();
    await expect(page.locator('[data-slot="theme-menu-popup"]')).toHaveCSS("border-top-left-radius", "12px");
    await page.screenshot({ path: testInfo.outputPath(`profile-card-${colorScheme}-${width}.png`), fullPage: true });
  });
}
}
