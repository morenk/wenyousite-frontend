import { expect, test, type Page } from "@playwright/test";

const fixedNow = "2026-08-23T12:00:00.000Z";

const adminSession = {
  csrfToken: "station-layout-csrf",
  user: { id: "station-layout-admin", username: "布局站务员", role: "SUPER_ADMIN" },
  session: {
    id: "station-layout-session",
    createdAt: fixedNow,
    lastActiveAt: fixedNow,
    expiresAt: "2026-08-24T12:00:00.000Z",
    elevatedUntil: "2026-08-24T12:00:00.000Z",
  },
};

const managedUser = {
  id: "station-layout-user",
  username: "长用户名布局测试用户",
  email: "station-layout-user@example.test",
  role: "USER",
  moderationStatus: "ACTIVE",
  currentSanction: null,
  createdAt: "2026-08-01T08:00:00.000Z",
};

const moderationCase = {
  id: "station-layout-case",
  targetType: "THREAD",
  targetId: "station-layout-thread",
  status: "OPEN",
  createdAt: "2026-08-20T08:00:00.000Z",
  updatedAt: "2026-08-20T09:00:00.000Z",
  resolvedAt: null,
  _count: { reports: 2 },
  reports: [{
    id: "station-layout-report",
    reasonCode: "HARASSMENT",
    details: "持续发布针对其他用户的攻击性内容，需要站务复核上下文。",
    targetSnapshot: { title: "被举报主题" },
    status: "PENDING",
    createdAt: "2026-08-20T08:00:00.000Z",
    reporter: { id: "reporter-1", username: "举报用户", role: "USER" },
  }],
  decisions: [],
};

const campaign = {
  id: "station-layout-campaign",
  title: "维护窗口提醒",
  content: "今晚将进行短时维护，请提前保存尚未发布的内容。",
  status: "SCHEDULED",
  scheduledAt: "2026-08-23T20:00:00.000Z",
  sentAt: null,
  estimatedCount: 128,
  recipientCount: 0,
  createdAt: fixedNow,
  createdBy: { id: adminSession.user.id, username: adminSession.user.username },
};

const operationsSettings = {
  id: "station-layout-settings",
  registrationPausedUntil: null,
  contentWritesPausedUntil: null,
  maintenanceTitle: null,
  maintenanceContent: null,
  maintenanceStartsAt: null,
  maintenanceEndsAt: null,
  updatedAt: fixedNow,
};

async function mockStation(page: Page) {
  await page.clock.setFixedTime(new Date(fixedNow));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/api/v1/**", (route) => {
    const request = route.request();
    const { pathname } = new URL(request.url());
    const response = (data: unknown, meta?: Record<string, unknown>) => route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ code: 0, message: "ok", data, ...(meta ? { meta } : {}) }),
    });

    if (pathname.endsWith("/admin/auth/session")) return response(adminSession);
    if (pathname.endsWith("/admin/users")) {
      return response([managedUser], { cursor: null, hasMore: false });
    }
    if (pathname.endsWith(`/admin/cases/${moderationCase.id}`)) return response(moderationCase);
    if (pathname.endsWith("/admin/cases")) {
      return response([moderationCase], { cursor: null, hasMore: false });
    }
    if (pathname.endsWith("/admin/notification-campaigns")) {
      return response([campaign], { cursor: null, hasMore: false });
    }
    if (pathname.endsWith("/admin/operations/settings")) return response(operationsSettings);
    return response([]);
  });
}

test.describe("1600px 站务操作台布局", () => {
  test.beforeEach(async ({ page }) => {
    await mockStation(page);
  });

  test("1600px 下用户表格和 26rem 处置栏同时保有操作空间", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await page.goto("/station/users");
    await expect(page.getByRole("heading", { name: "用户与处罚" })).toBeVisible();
    await expect(page.getByText(managedUser.username)).toBeVisible();

    const shell = page.locator('[data-slot="station-shell"]');
    const actionRail = page.locator('[data-slot="admin-action-rail"]');
    const tableScroller = page.locator('[data-slot="admin-table-scroll"]');
    await expect(shell).toHaveCSS("min-width", "1600px");

    const railBox = await actionRail.boundingBox();
    expect(railBox).not.toBeNull();
    expect(railBox!.width).toBeCloseTo(416, 0);
    expect(await tableScroller.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);

    await page.getByRole("button", { name: "管理" }).click();
    await expect(actionRail.getByRole("button", { name: "暂停账号" })).toBeVisible();
    await expect(actionRail.getByRole("button", { name: "永久封禁" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1600);
    await expect(page).toHaveScreenshot("station-users-1600.png", {
      animations: "disabled",
      fullPage: true,
      maxDiffPixels: 20,
    });
  });

  test("1920px 下操作表单和运行设置使用完整剩余工作区", async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto("/station/announcements");
    await expect(page.getByRole("heading", { name: "站内通知", exact: true })).toBeVisible();
    await expect(page.getByText(campaign.title)).toBeVisible();

    const composerBox = await page.locator('[data-slot="admin-action-rail"]').boundingBox();
    expect(composerBox).not.toBeNull();
    expect(composerBox!.width).toBeCloseTo(448, 0);

    await page.goto("/station/operations");
    await expect(page.getByRole("heading", { name: "运行与紧急开关" })).toBeVisible();
    const operationsBox = await page.locator('[data-slot="admin-operations-workspace"]').boundingBox();
    expect(operationsBox).not.toBeNull();
    expect(operationsBox!.width).toBeGreaterThan(1500);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1920);
    await expect(page).toHaveScreenshot("station-operations-1920.png", {
      animations: "disabled",
      fullPage: true,
      maxDiffPixels: 20,
    });
  });

  test("1366px 下保留固定画布，案件队列内部滚动时操作列仍固定", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.goto("/station/cases");
    await expect(page.getByRole("heading", { name: "案件工作台" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "形成治理决定" })).toBeAttached();

    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeGreaterThanOrEqual(1600);
    const primary = page.locator('[data-slot="admin-primary-detail"]');
    const queue = primary.locator("section").first();
    const queueBox = await queue.boundingBox();
    expect(queueBox).not.toBeNull();
    expect(queueBox!.width).toBeCloseTo(512, 0);

    const tableScroller = queue.locator('[data-slot="admin-table-scroll"]');
    await tableScroller.evaluate((element) => {
      element.scrollLeft = element.scrollWidth;
    });
    const scrollBox = await tableScroller.boundingBox();
    const actionCellBox = await queue.getByRole("cell", { name: "查看" }).boundingBox();
    expect(scrollBox).not.toBeNull();
    expect(actionCellBox).not.toBeNull();
    expect(actionCellBox!.x + actionCellBox!.width).toBeCloseTo(scrollBox!.x + scrollBox!.width, 0);

    const decisionRail = primary.locator('[data-slot="admin-action-rail"]');
    const decisionRailBox = await decisionRail.boundingBox();
    expect(decisionRailBox).not.toBeNull();
    expect(decisionRailBox!.width).toBeCloseTo(416, 0);
  });
});
