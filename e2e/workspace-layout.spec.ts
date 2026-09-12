import { test } from "./fixtures/typography";
import { expect, type Page } from "@playwright/test";

const layoutUser = {
  id: "workspace-layout-user",
  email: "workspace-layout@example.test",
  username: "布局测试用户",
  avatar: null,
  role: "USER",
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
  await expect(nav.getByRole("link", { name: "通知" })).toBeHidden();
  await expect(nav.getByRole("link", { name: "私聊" })).toBeHidden();
  await expect(nav.getByRole("link", { name: "收藏" })).toBeHidden();
  await expect(nav.getByRole("link", { name: layoutUser.username })).toBeHidden();
  await expect(nav.getByRole("button", { name: "打开发布菜单" })).toBeVisible();
  await expect(nav.getByRole("button", { name: "退出" })).toBeVisible();

  const visibleControls = await nav.locator("a, button").evaluateAll((elements) =>
    elements
      .filter((element) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
      })
      .map((element) =>
        element.getAttribute("aria-label") ??
        element.getAttribute("title") ??
        element.textContent?.trim() ??
        "",
      ),
  );
  expect(visibleControls).toEqual([
    "温油站首页",
    "打开发布菜单",
    "发现",
    "动态",
    "搜索",
    "外观：跟随系统",
    "退出",
  ]);

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

for (const zoom of [1, 2]) {
  test(`系统字体：私聊正文中文混排 ${zoom * 100}% 等效缩放`, async ({ page }) => {
    await page.setViewportSize({ width: 2560, height: 1800 });
    await mockWorkspaceSession(page);
    const content = "今晚记录城市与旅途中的温暖故事 ".repeat(8) + "Web 2026 🎲🌙";
    const conversation = {
      id: "font-conversation", status: "ACCEPTED", requestDirection: "NONE",
      otherUser: { id: "font-peer", username: "混排用户 Web 123 🌙", avatar: null, isDeactivated: false },
      lastMessage: null, unreadCount: 0, archivedAt: null,
      lastMessageAt: "2026-08-06T20:00:00Z", createdAt: "2026-08-06T19:00:00Z",
      canSend: true, canAccept: false, canDecline: false, isBlocked: false,
    };
    await page.route("**/api/v1/direct-conversations/**", (route) => {
      const path = new URL(route.request().url()).pathname;
      const data = path.endsWith("/messages") ? [{
        id: "font-message", conversationId: conversation.id, senderId: "font-peer",
        content, media: null, sticker: null, recalledAt: null, createdAt: "2026-08-06T20:00:00Z",
      }] : path.endsWith("/unread") ? { total: 0 } : path.endsWith("/font-conversation") ? conversation : [];
      return route.fulfill({ json: { code: 0, message: "ok", data, meta: { cursor: null, hasMore: false } } });
    });
    await page.goto("/messages/font-conversation");
    await page.locator("html").evaluate((element, scale) => { element.style.zoom = String(scale); }, zoom);
    const bubble = page.locator("p").filter({ hasText: content });
    await expect(bubble).toBeVisible();
    await expect(bubble).toHaveCSS("font-family", "system-ui, sans-serif");
    await expect(bubble).toHaveCSS("font-size", "16px");
    await expect(bubble).toHaveCSS("line-height", "28px");
    const geometry = await bubble.evaluate((element) => ({ width: element.clientWidth, scroll: element.scrollWidth, height: element.clientHeight }));
    expect(geometry.scroll).toBeLessThanOrEqual(geometry.width + 1);
    expect(geometry.height).toBeGreaterThan(28);
  });
}
