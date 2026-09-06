import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function mockSettings(page: Page) {
  let user = {
    id: "settings-workspace-user", username: "温油读者", email: "settings-workspace@example.test",
    role: "USER", avatar: null, profileCover: null, bio: "原来的个人简介", level: 3,
    experience: 120, currentLevelExperience: 100, nextLevelExperience: 200,
    receivedTipTotal: "9007199254740993", receivedTipCount: 7,
    showRecentReplies: true, showPlayerBadges: true, showBookmarks: true,
  };
  const writes: Record<string, unknown>[] = [];
  let failNext = false;
  await page.route("**/api/v1/**", async (route) => {
    const { pathname } = new URL(route.request().url());
    let data: unknown = [];
    if (pathname.endsWith("/auth/refresh")) data = { accessToken: "mock-settings-workspace-token", user };
    else if (pathname.endsWith("/users/me")) {
      if (route.request().method() === "PATCH") {
        const body = route.request().postDataJSON();
        writes.push(body);
        if (failNext) {
          failNext = false;
          await route.fulfill({ status: 429, json: { code: 42900, message: "操作太频繁，请稍后再试" } });
          return;
        }
        user = { ...user, ...body };
      }
      data = user;
    } else if (pathname.endsWith("/notifications/unread")) data = { unreadCount: 0 };
    else if (pathname.endsWith("/direct-conversations/unread")) data = { total: 0 };
    else if (pathname.endsWith("/wallet/check-in")) data = { claimedNow: false, rewardAmount: "0", balance: "0" };
    await route.fulfill({ json: { code: 0, message: "ok", data } });
  });
  return { writes, failNext: () => { failNext = true; } };
}

for (const colorScheme of ["light", "dark"] as const) {
  test(`${colorScheme} 下四个设置分区排版、预览与无障碍检查`, async ({ page }, testInfo) => {
    await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
    await mockSettings(page);
    for (const [path, title] of [["/me", "基本资料"], ["/me/appearance", "主页外观"], ["/me/privacy", "隐私设置"], ["/me/security", "账号安全"]]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { name: title, level: 2 })).toBeVisible();
      const navigation = page.getByRole("navigation", { name: "设置分区" });
      await expect(navigation.getByRole("link", { name: title })).toHaveAttribute("aria-current", "page");
      for (const width of [1024, 1280, 1440, 1920]) {
        await page.setViewportSize({ width, height: 1000 });
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
        const nav = (await navigation.boundingBox())!;
        const content = (await page.locator('[data-slot="settings-title"]').boundingBox())!;
        expect(nav.x + nav.width).toBeLessThan(content.x);
      }
      await page.setViewportSize({ width: 1920, height: 1200 });
      await page.evaluate(() => { document.documentElement.style.zoom = "2"; });
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1920);
      await expect(navigation.getByRole("link", { name: title })).toBeInViewport();
      await page.evaluate(() => { document.documentElement.style.zoom = ""; });
      await page.setViewportSize({ width: 1440, height: 1000 });
      if (path === "/me/appearance") {
        await expect(page.getByRole("tab", { name: "电脑端 · 3:1" })).toHaveAttribute("aria-selected", "true");
        await page.getByRole("tab", { name: "移动端 · 2:1" }).click();
        await expect(page.getByRole("tab", { name: "移动端 · 2:1" })).toHaveAttribute("aria-selected", "true");
        await page.getByRole("tab", { name: "电脑端 · 3:1" }).click();
      }
      await page.screenshot({ path: testInfo.outputPath(`${path.split("/").at(-1)}-${colorScheme}.png`), fullPage: true });
      expect((await new AxeBuilder({ page }).include("main").analyze()).violations).toEqual([]);
    }
    await page.getByRole("link", { name: "修改密码", exact: true }).click();
    await expect(page.getByRole("navigation", { name: "设置分区" }).getByRole("link", { name: "账号安全" })).toHaveAttribute("aria-current", "page");
    await page.getByRole("link", { name: "返回账号安全" }).click();
    await expect(page.getByText("s***@example.test")).toBeVisible();
  });
}

test("简介草稿跨用户名保存保留，失败可重试，导航与历史返回先确认", async ({ page }) => {
  const mock = await mockSettings(page);
  await page.goto("/me/privacy");
  await page.getByRole("navigation", { name: "设置分区" }).getByRole("link", { name: "基本资料" }).click();
  await page.getByLabel("个人简介").fill("未保存的简介草稿");
  await page.getByRole("button", { name: "修改用户名", exact: true }).click();
  await page.getByLabel("新用户名", { exact: true }).fill("新的用户名");
  await page.getByRole("button", { name: "保存用户名", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.getByLabel("个人简介")).toHaveValue("未保存的简介草稿");
  expect(mock.writes).toEqual([{ username: "新的用户名" }]);
  await page.evaluate(() => history.back());
  const confirmation = page.getByRole("alertdialog", { name: "放弃未保存修改" });
  await expect(confirmation).toBeVisible();
  await expect(page).toHaveURL(/\/me$/);
  await confirmation.getByRole("button", { name: "继续编辑" }).click();
  await expect(page.getByLabel("个人简介")).toHaveValue("未保存的简介草稿");
  await page.getByRole("navigation", { name: "设置分区" }).getByRole("link", { name: "主页外观" }).click();
  await expect(confirmation).toBeVisible();
  await confirmation.getByRole("button", { name: "继续编辑" }).click();
  mock.failNext();
  await page.getByRole("button", { name: "保存简介" }).click();
  await expect(page.getByText("操作太频繁，请稍后再试", { exact: true })).toBeVisible();
  await expect(page.getByLabel("个人简介")).toHaveValue("未保存的简介草稿");
  await page.getByRole("button", { name: "保存简介" }).click();
  await expect(page.getByText("已保存", { exact: true })).toBeVisible();
  expect(mock.writes.at(-1)).toEqual({ bio: "未保存的简介草稿" });
  await page.getByLabel("个人简介").fill("");
  await page.getByRole("button", { name: "保存简介" }).click();
  await expect(page.getByText("简介不能为空；暂不支持清空已填写的简介。")).toBeVisible();
  expect(mock.writes).toHaveLength(3);
  await page.evaluate(() => history.back());
  await confirmation.getByRole("button", { name: "放弃修改", exact: true }).click();
  await expect(page).toHaveURL(/\/me\/privacy$/);
  await page.getByRole("checkbox", { name: "公开收藏" }).uncheck();
  await page.getByRole("button", { name: "保存隐私设置" }).click();
  await expect(page.getByText("已保存", { exact: true })).toBeVisible();
  expect(mock.writes.at(-1)).toEqual({ showRecentReplies: true, showPlayerBadges: true, showBookmarks: false });
  await page.reload();
  await expect(page.getByRole("checkbox", { name: "公开收藏" })).not.toBeChecked();
  await page.goto("/me#profile-appearance");
  await expect(page).toHaveURL(/\/me\/appearance$/);
});
