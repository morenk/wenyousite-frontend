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
    return response([]);
  });
}

test.describe("站务台流体工作区布局", () => {
  test.beforeEach(async ({ page }) => {
    await mockStation(page);
  });

  test("1600px 下用户台账占满工作区，管理动作按需弹出", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await page.goto("/station/users");
    await expect(page.getByRole("heading", { name: "用户与处罚" })).toBeVisible();
    await expect(page.getByText(managedUser.username)).toBeVisible();

    const shell = page.locator('[data-slot="station-shell"]');
    const workspace = page.locator('[data-layout="full-table"]');
    const tableScroller = page.locator('[data-slot="admin-table-scroll"]');
    const pageWidth = await page.evaluate(() => ({
      client: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    expect(pageWidth.scroll).toBeLessThanOrEqual(pageWidth.client);

    const shellBox = await shell.boundingBox();
    const workspaceBox = await workspace.boundingBox();
    expect(shellBox).not.toBeNull();
    expect(workspaceBox).not.toBeNull();
    expect(shellBox!.width).toBeCloseTo(pageWidth.scroll, 0);
    expect(workspaceBox!.x).toBeCloseTo(264, 0);
    expect(workspaceBox!.x + workspaceBox!.width).toBeCloseTo(shellBox!.width - 24, 0);
    await expect(page.locator('[data-slot="admin-action-rail"]')).toHaveCount(0);

    const tableBox = await tableScroller.boundingBox();
    expect(tableBox).not.toBeNull();
    expect(tableBox!.width).toBeGreaterThan(1280);
    expect(await tableScroller.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(false);

    await page.getByRole("button", { name: "管理" }).click();
    const dialog = page.getByRole("dialog", { name: `管理 ${managedUser.username}` });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: "暂停账号" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "永久封禁" })).toBeVisible();
    expect(await page.evaluate(() => (
      document.documentElement.scrollWidth <= document.documentElement.clientWidth
    ))).toBe(true);
    await expect(page).toHaveScreenshot("station-users-1600.png", {
      animations: "disabled",
      fullPage: true,
      maxDiffPixels: 20,
    });
  });

  test("1920px 下通知台账全宽展示，新建表单按需弹出", async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto("/station/announcements");
    await expect(page.getByRole("heading", { name: "站内通知", exact: true })).toBeVisible();
    await expect(page.getByText(campaign.title)).toBeVisible();

    const workspaceBox = await page.locator('[data-layout="full-table"]').boundingBox();
    expect(workspaceBox).not.toBeNull();
    expect(workspaceBox!.width).toBeGreaterThan(1600);
    await expect(page.locator('[data-slot="admin-action-rail"]')).toHaveCount(0);

    await page.getByRole("button", { name: "新建通知" }).click();
    const dialog = page.getByRole("dialog", { name: "新建站内通知" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel("标题")).toBeVisible();
    await expect(dialog.getByRole("button", { name: "创建发送计划" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1920);
    await expect(page).toHaveScreenshot("station-announcements-1920.png", {
      animations: "disabled",
      fullPage: true,
      maxDiffPixels: 20,
    });
  });

  test("1366px 下页面不横向滚动，案件台账占满导航右侧", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.goto("/station/cases");
    await expect(page.getByRole("heading", { name: "案件工作台" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "形成治理决定" })).toHaveCount(0);

    const pageWidth = await page.evaluate(() => ({
      client: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    expect(pageWidth.client).toBe(1366);
    expect(pageWidth.scroll).toBeLessThanOrEqual(pageWidth.client);
    const workspace = page.locator('[data-layout="full-table"]');
    const queue = workspace.locator("section").first();
    const queueBox = await queue.boundingBox();
    expect(queueBox).not.toBeNull();
    expect(queueBox!.x).toBeCloseTo(240, 0);
    expect(queueBox!.width).toBeCloseTo(pageWidth.scroll - 240, 0);
    expect(queueBox!.x + queueBox!.width).toBeCloseTo(pageWidth.scroll, 0);
    await expect(page.locator('[data-slot="admin-action-rail"]')).toHaveCount(0);

    const tableScroller = queue.locator('[data-slot="admin-table-scroll"]');
    await tableScroller.evaluate((element) => {
      element.scrollLeft = element.scrollWidth;
    });
    const scrollBox = await tableScroller.boundingBox();
    const actionCellBox = await queue.getByRole("cell", { name: "处理", exact: true }).boundingBox();
    expect(scrollBox).not.toBeNull();
    expect(actionCellBox).not.toBeNull();
    expect(actionCellBox!.x + actionCellBox!.width).toBeCloseTo(scrollBox!.x + scrollBox!.width, 0);

    await queue.getByRole("button", { name: "处理", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "主题帖治理案件" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("heading", { name: "形成治理决定" })).toBeVisible();
    const dialogBox = await dialog.boundingBox();
    expect(dialogBox).not.toBeNull();
    expect(dialogBox!.width).toBeGreaterThan(1100);
  });

  test("窄桌面下只有表格容器横向滚动，操作列固定在表格右缘", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 900 });
    await page.goto("/station/announcements");
    await expect(page.getByRole("heading", { name: "站内通知", exact: true })).toBeVisible();
    await expect(page.getByText(campaign.title)).toBeVisible();

    const tableScroller = page.locator('[data-slot="admin-table-scroll"]');
    const tableOverflow = await tableScroller.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
    expect(tableOverflow.clientWidth).toBeLessThan(tableOverflow.scrollWidth);
    expect(tableOverflow.scrollWidth).toBeGreaterThanOrEqual(1024);

    await tableScroller.evaluate((element) => {
      element.scrollLeft = element.scrollWidth;
    });
    expect(await tableScroller.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
    expect(await page.evaluate(() => document.scrollingElement?.scrollLeft ?? 0)).toBe(0);
    expect(await page.evaluate(() => (
      document.documentElement.scrollWidth <= document.documentElement.clientWidth
    ))).toBe(true);

    const scrollBox = await tableScroller.boundingBox();
    const actionCellBox = await page.getByRole("cell", { name: "取消", exact: true }).boundingBox();
    expect(scrollBox).not.toBeNull();
    expect(actionCellBox).not.toBeNull();
    expect(actionCellBox!.x + actionCellBox!.width).toBeCloseTo(scrollBox!.x + scrollBox!.width, 0);
  });
});
