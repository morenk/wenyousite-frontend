import { expect, type Page } from "@playwright/test";
import { test } from "./fixtures/typography";

const now = "2026-09-20T08:00:00.000Z";
const content = (index: number, type = "thread") => ({
  id: "content-" + index, type, title: type === "thread" ? "中文主题 " + index : null,
  summary: "公开内容 " + index, content: type === "moment" ? "# 保留字面文字 **原文**" : "可查看的正文",
  author: { id: "author-1", username: "测试作者" }, createdAt: now, updatedAt: now,
  hidden: false, parentHidden: false, canRestore: false, restoreBlockedReason: null,
  threadId: type === "post" ? "content-1" : null, parentPostId: null, momentId: null, parentCommentId: null,
  category: type === "thread" ? "RPG" : null, tags: [], version: 1, mediaIds: [], media: [], auditLogs: [],
});
async function mockAdmin(page: Page) {
  await page.clock.install({ time: new Date(now) });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/api/v1/**", (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const reply = (data: unknown, meta?: object) => route.fulfill({ json: { code: 0, message: "ok", data, ...(meta ? { meta } : {}) } });
    if (url.pathname.endsWith("/admin/auth/session")) return reply({ csrfToken: "test", user: { id: "admin-1", username: "管理员", role: "SUPER_ADMIN" }, session: { elevatedUntil: "2026-09-21T00:00:00.000Z" } });
    if (url.pathname.endsWith("/admin/thread-categories")) return reply([{ id: "cat-1", slug: "RPG", name: "角色扮演", isActive: true }, { id: "cat-2", slug: "OTHER", name: "其他", isActive: true }]);
    if (url.pathname.endsWith("/admin/tags")) return reply([{ id: "tag-1", name: "日常", isActive: true }]);
    if (url.pathname.endsWith("/admin/content")) {
      const start = url.searchParams.get("cursor") ? 21 : 1;
      const length = url.searchParams.get("limit") === "50" ? 40 : 20;
      return reply(Array.from({ length }, (_, index) => content(start + index, url.searchParams.get("type") ?? "thread")), { cursor: start === 1 && length === 20 ? "opaque-next" : null, hasMore: start === 1 && length === 20 });
    }
    const detail = url.pathname.match(/\/admin\/content\/(thread|post|moment|moment_comment)\/content-(\d+)$/);
    if (detail) return reply(content(Number(detail[2]), detail[1]));
    if (url.pathname.endsWith("/admin/users/author-1")) return reply({ id: "author-1", username: "测试作者", email: "admin-console@example.test", role: "USER", moderationStatus: "ACTIVE", createdAt: now, currentSanction: null, bio: "正常用户资料", level: 4, lastActiveDate: null, contentCounts: { thread: 40, post: 3, moment: 2, moment_comment: 1 } });
    return reply([]);
  });
}

test.describe("综合管理后台", () => {
  test.beforeEach(async ({ page }) => { await mockAdmin(page); });
  for (const width of [1024, 1366, 1920]) {
    for (const colorScheme of ["light", "dark"] as const) {
      test(`${width}px ${colorScheme} 紧凑内容列表`, async ({ page }, testInfo) => {
        await page.setViewportSize({ width, height: 768 });
        await page.emulateMedia({ colorScheme });
        await page.goto("/station/content");
        await expect(page.getByRole("table", { name: "内容列表" })).toBeVisible();
        await expect(page.getByRole("link", { name: "中文主题 1", exact: true })).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
        const aside = await page.locator("aside").boundingBox();
        expect(aside?.width).toBe(208);
        const rows = page.getByRole("table", { name: "内容列表" }).locator("tbody tr");
        await expect(rows).toHaveCount(20);
        if (width === 1366) {
          const twelfth = await rows.nth(11).boundingBox();
          expect(twelfth!.y + twelfth!.height).toBeLessThanOrEqual(768);
        }
        const scroller = page.locator('[data-slot="admin-table-scroll"]').first();
        await scroller.evaluate((element) => { element.scrollLeft = element.scrollWidth; });
        const action = await rows.first().locator('[data-slot="admin-table-action-cell"]').boundingBox();
        const box = await scroller.boundingBox();
        expect(action!.x + action!.width).toBeLessThanOrEqual(box!.x + box!.width + 1);
        await page.screenshot({ path: testInfo.outputPath(`content-${width}-${colorScheme}.png`) });
      });
    }
  }
  test("详情返回恢复筛选、分页和滚动，重新筛选回首页", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto("/station/content?authorId=author-1");
    await page.getByRole("button", { name: "下一页", exact: true }).click();
    await expect(page.getByText("第 2 页", { exact: false })).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, 160));
    const scroll = await page.evaluate(() => window.scrollY);
    await page.getByRole("link", { name: "中文主题 21", exact: true }).click();
    await expect(page.getByRole("heading", { name: "内容详情" })).toBeVisible();
    await page.getByRole("link", { name: "返回内容列表" }).click();
    await expect(page.getByText("第 2 页", { exact: false })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "作者编号", exact: true })).toHaveValue("author-1");
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(scroll);
    await page.getByRole("textbox", { name: "关键词", exact: true }).fill("不同筛选");
    await expect(page.getByText("第 1 页", { exact: false })).toBeVisible();
    await page.getByRole("textbox", { name: "关键词", exact: true }).clear();
    await expect(page.getByText("第 1 页", { exact: false })).toBeVisible();
  });
  test("用户资料关联正常内容，动态正文不解释Markdown", async ({ page }) => {
    await page.goto("/station/users/author-1");
    await expect(page.getByText("暂无记录", { exact: true })).toBeVisible();
    await expect(page.getByText("正常用户资料")).toBeVisible();
    await page.getByRole("link", { name: "动态 2", exact: true }).click();
    await expect(page.getByRole("tab", { name: "动态", exact: true })).toHaveAttribute("aria-selected", "true");
    await page.getByRole("link", { name: "公开内容 1", exact: true }).click();
    await expect(page.getByText("# 保留字面文字 **原文**", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "保留字面文字" })).toHaveCount(0);
  });
  test("分类标签弹窗支持真实点击选择与保存", async ({ page }) => {
    let saved: Record<string, unknown> | undefined;
    await page.route("**/admin/content/thread/content-1/taxonomy", async (route) => {
      saved = route.request().postDataJSON();
      await route.fulfill({ json: { code: 0, message: "ok", data: { ...content(1), category: "OTHER", tags: [{ id: "tag-1", name: "日常", isActive: true }], version: 2 } } });
    });
    await page.goto("/station/content/thread/content-1");
    await page.getByRole("button", { name: "分类与标签", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "分类与标签" });
    await dialog.getByRole("combobox", { name: "分类", exact: true }).click();
    await page.getByRole("option", { name: "其他", exact: true }).click();
    await dialog.getByRole("combobox", { name: "标签", exact: true }).click();
    await page.getByRole("option", { name: "日常", exact: true }).click();
    await page.keyboard.press("Escape");
    await dialog.getByRole("textbox", { name: "理由", exact: true }).fill("整理分类与标签");
    await dialog.getByRole("button", { name: "保存", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    expect(saved).toEqual({ version: 1, category: "OTHER", tagIds: ["tag-1"], reason: "整理分类与标签" });
  });
  test("内容状态失败留在表单，双击不重复提交", async ({ page }) => {
    let requests = 0;
    await page.route("**/admin/content/thread/content-1/hide", async (route) => { requests += 1; await new Promise((resolve) => setTimeout(resolve, 200)); await route.fulfill({ status: 409, json: { code: 40900, message: "内容状态已改变" } }); });
    await page.goto("/station/content/thread/content-1");
    await page.getByRole("button", { name: "隐藏", exact: true }).click();
    await page.getByRole("textbox", { name: "理由", exact: true }).fill("测试隐藏理由");
    await page.getByRole("button", { name: "确认隐藏", exact: true }).dblclick();
    await expect(page.getByRole("alert")).toHaveText("内容状态已改变");
    await expect(page.getByRole("textbox", { name: "理由", exact: true })).toHaveValue("测试隐藏理由");
    expect(requests).toBe(1);
  });
  test("键盘与200%缩放仍能访问内容操作", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto("/station/content");
    await expect(page.getByRole("link", { name: "中文主题 1", exact: true })).toBeVisible();
    await page.evaluate(() => { document.documentElement.style.zoom = "2"; });
    const table = page.locator('[data-slot="admin-table-scroll"]').first();
    await table.evaluate((element) => { element.scrollLeft = element.scrollWidth; });
    const view = page.getByRole("link", { name: "查看", exact: true }).first();
    await view.focus();
    await expect(view).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "内容详情" })).toBeVisible();
  });
});
