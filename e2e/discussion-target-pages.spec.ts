import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

const firstThread = "cmtjrn0xc05rp7qvw9t7zs1iv";
const longPost = "cmtvt31qc00497qc2xwuu6ama";
const secondThread = "cmtrvxfsy004s7q8a240qqb29";
const root = "cmtwi05qf00i57qvy2gl4hd1j";
const shortReply = "cmtwkqods000m7q1it9sf3vm1";
const fixturePath = process.env.DISCUSSION_REPRO_FILE;

test.describe("负责人原地址的实际正文", () => {
  test.skip(!fixturePath, "原始正文仅在本地提供，使用 DISCUSSION_REPRO_FILE 指向只读接口快照");
  test.beforeEach(async ({ page }) => {
    const records = JSON.parse(readFileSync(fixturePath!, "utf8"));
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.route("**/api/v1/**", async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith("/auth/refresh")) return route.fulfill({ status: 401, json: { code: 40100, message: "未登录", data: null } });
      if (path.endsWith("/posts/latest")) return route.fulfill({ json: { code: 0, message: "ok", data: { id: longPost, threadId: firstThread, subthreadId: records[`/api/v1/posts/${longPost}`].data.subthreadId, parentPostId: null } } });
      if (records[path]) return route.fulfill({ json: records[path] });
      return route.fulfill({ json: { code: 0, message: "ok", data: [], meta: { cursor: null, hasMore: false } } });
    });
  });
  async function aligned(page: Page, id: string, bar: boolean) {
    const target = page.locator(`#post-${id}`);
    await expect(target).toBeVisible();
    await expect.poll(async () => target.evaluate((element, withBar) => {
      const nav = document.querySelector<HTMLElement>('[data-slot="thread-reading-bar"]');
      return element.getBoundingClientRect().top - (withBar && nav ? nav.offsetHeight + 8 : 0);
    }, bar)).toBeCloseTo(24, 0);
    await page.waitForTimeout(1300);
    await expect(target.locator('a[href^="/users/"]').first()).toBeInViewport();
  }
  test("主楼原坐标的长正文位于阅读栏下方", async ({ page }) => {
    await page.goto(`/threads/${firstThread}?post=${longPost}`);
    await aligned(page, longPost, true);
  });
  test("最新发言入口定位同一长正文", async ({ page }) => {
    await page.goto(`/threads/${firstThread}`);
    await page.getByRole("button", { name: "跳到最新发言", exact: true }).first().click();
    await aligned(page, longPost, true);
  });
  for (const width of [1024, 1440]) {
    test(`AT 长短回复混排保留指定短回复 ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/threads/${secondThread}/posts/${root}/replies?post=${shortReply}`);
      await aligned(page, shortReply, false);
    });
  }
});
