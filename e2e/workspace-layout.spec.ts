import { expect, test, type Page } from "@playwright/test";

const layoutUser = {
  id: "workspace-layout-user",
  email: "workspace-layout@example.test",
  username: "布局测试用户",
  avatar: null,
  role: "USER",
  emailVerified: true,
};

async function mockWorkspaceSession(page: Page) {
  await page.route("**/api/v1/**", (route) => {
    const { pathname } = new URL(route.request().url());
    const response = (data: unknown, meta?: Record<string, unknown>) => route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ code: 0, message: "ok", data, ...(meta ? { meta } : {}) }),
    });

    if (pathname.endsWith("/auth/refresh")) {
      return response({ accessToken: "workspace-layout-token", user: layoutUser });
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
    if (pathname.endsWith("/threads/draft")) {
      return response([]);
    }
    if (pathname.endsWith("/direct-conversations")) {
      return response([], { cursor: null, hasMore: false });
    }
    return response(null);
  });
}

async function expectCompactWorkspaceNav(page: Page) {
  const nav = page.getByRole("complementary", { name: "全局导航" });
  await expect(nav).toHaveAttribute("data-compact", "true");
  await expect(nav.getByText("温油站", { exact: true })).toBeHidden();
  await expect(nav.getByText("发现", { exact: true })).toBeHidden();

  const box = await nav.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeLessThanOrEqual(72);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1440);
}

test.describe("工作区导航", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await mockWorkspaceSession(page);
  });

  test("创建主题帖在宽屏仍使用图标栏", async ({ page }) => {
    await page.goto("/threads/create");
    await expect(page.getByRole("heading", { name: "创建主题帖" })).toBeVisible();
    await expectCompactWorkspaceNav(page);
    await expect(page).toHaveScreenshot("workspace-create-1440.png", {
      animations: "disabled",
    });
  });

  test("私聊在宽屏仍使用图标栏", async ({ page }) => {
    await page.goto("/messages");
    await expect(page.getByRole("heading", { name: "私聊" })).toBeVisible();
    await expectCompactWorkspaceNav(page);
    await expect(page).toHaveScreenshot("workspace-messages-1440.png", {
      animations: "disabled",
    });
  });
});
