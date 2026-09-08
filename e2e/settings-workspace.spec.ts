import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function mockSettings(page: Page, withImages = false) {
  let user = {
    id: "settings-workspace-user", username: "温油读者", email: "settings-workspace@example.test",
    role: "USER", avatar: withImages ? "/pwa-icon-192.png" : null,
    profileCover: withImages ? {
      url: "/__fixtures__/cover.svg", width: 1920, height: 640,
      mobile: { url: "/__fixtures__/cover.svg", width: 1600, height: 800 },
    } : null, bio: "原来的个人简介", level: 3,
    experience: 120, currentLevelExperience: 100, nextLevelExperience: 200,
    receivedTipTotal: "9007199254740993", receivedTipCount: 7,
    showRecentReplies: true, showPlayerBadges: true, showBookmarks: true,
  };
  if (withImages) await page.route("**/__fixtures__/cover.svg", (route) => route.fulfill({
    contentType: "image/svg+xml",
    body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 640"><rect width="1920" height="640" fill="#e7dcd8"/><circle cx="1360" cy="200" r="95" fill="#f4eee8"/><path d="M0 430Q380 180 840 430T1920 350V640H0Z" fill="#a3aaa0"/><path d="M0 530Q620 350 1200 490T1920 430V640H0Z" fill="#737f79"/></svg>',
  }));
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
  test(`${colorScheme} 下双页设置排版、预览与无障碍检查`, async ({ page }, testInfo) => {
    await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
    await mockSettings(page);
    for (const [path, title] of [["/me", "个人资料"], ["/me/security", "账号与安全"]]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { name: title, level: 1 })).toBeVisible();
      const navigation = page.getByRole("navigation", { name: "设置分区" });
      await expect(navigation.getByRole("link", { name: title })).toHaveAttribute("aria-current", "page");
      for (const width of [1024, 1280, 1440, 1920]) {
        await page.setViewportSize({ width, height: 1000 });
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
        const firstLink = (await navigation.getByRole("link", { name: "个人资料" }).boundingBox())!;
        const secondLink = (await navigation.getByRole("link", { name: "账号与安全" }).boundingBox())!;
        expect(firstLink.y).toBe(secondLink.y);
        expect(firstLink.x + firstLink.width).toBeLessThan(secondLink.x);
      }
      await page.setViewportSize({ width: 1920, height: 1200 });
      await page.evaluate(() => { document.documentElement.style.zoom = "2"; });
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1920);
      await expect(navigation.getByRole("link", { name: title })).toBeInViewport();
      await page.evaluate(() => { document.documentElement.style.zoom = ""; });
      await page.setViewportSize({ width: 1440, height: 1000 });
      if (path === "/me") {
        await expect(page.getByRole("heading", { name: "公开资料", level: 2 })).toBeVisible();
        await expect(page.getByLabel("个人简介")).toHaveAttribute("rows", "3");
        await expect(page.getByRole("tab", { name: "电脑端 · 3:1" })).toHaveAttribute("aria-selected", "true");
        await page.getByRole("tab", { name: "移动端 · 2:1" }).click();
        await expect(page.getByRole("tab", { name: "移动端 · 2:1" })).toHaveAttribute("aria-selected", "true");
        await page.getByRole("tab", { name: "电脑端 · 3:1" }).click();
      }
      await page.screenshot({ path: testInfo.outputPath(`${path.split("/").at(-1)}-${colorScheme}.png`), fullPage: true });
      expect((await new AxeBuilder({ page }).include("main").analyze()).violations).toEqual([]);
    }
    await page.getByRole("link", { name: "修改密码", exact: true }).click();
    await expect(page.getByRole("navigation", { name: "设置分区" }).getByRole("link", { name: "账号与安全" })).toHaveAttribute("aria-current", "page");
    await page.getByRole("link", { name: "返回账号与安全" }).click();
    await expect(page.getByText("s***@example.test")).toBeVisible();
  });
}

test("简介草稿跨用户名保存保留，失败可重试，导航与历史返回先确认", async ({ page }) => {
  const mock = await mockSettings(page);
  await page.goto("/me/security");
  await page.getByRole("navigation", { name: "设置分区" }).getByRole("link", { name: "个人资料" }).click();
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
  await page.getByRole("navigation", { name: "设置分区" }).getByRole("link", { name: "账号与安全" }).click();
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
  await expect(page).toHaveURL(/\/me\/security$/);
  await page.getByRole("navigation", { name: "设置分区" }).getByRole("link", { name: "个人资料" }).click();
  await page.getByRole("checkbox", { name: "公开收藏" }).uncheck();
  await page.getByRole("button", { name: "保存隐私设置" }).click();
  await expect(page.getByText("已保存", { exact: true })).toBeVisible();
  expect(mock.writes.at(-1)).toEqual({ showRecentReplies: true, showPlayerBadges: true, showBookmarks: false });
  await page.reload();
  await expect(page.getByRole("checkbox", { name: "公开收藏" })).not.toBeChecked();
  await page.goto("/me#profile-appearance");
  await expect(page).toHaveURL(/\/me#appearance$/);
  await expect(page.getByRole("heading", { name: "主页背景", level: 2 })).toBeInViewport();
  await page.goto("/me/appearance");
  await expect(page).toHaveURL(/\/me#appearance$/);
  await page.goto("/me/privacy");
  await expect(page).toHaveURL(/\/me#privacy$/);
  await expect(page.getByRole("heading", { name: "主页公开范围", level: 2 })).toBeInViewport();
});

for (const colorScheme of ["light", "dark"] as const) {
  test(`${colorScheme} 下有图片和草稿时操作不贴边，资料行与分区互不重叠`, async ({ page }, testInfo) => {
    await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
    await mockSettings(page, true);
    await page.goto("/me");
    const profile = page.getByRole("region", { name: "公开资料" });
    const appearance = page.getByRole("region", { name: "主页背景" });
    const privacy = page.getByRole("region", { name: "主页公开范围" });
    await expect(profile.getByRole("button", { name: "移除头像" })).toBeVisible();
    await expect(page.getByRole("img", { name: "温油读者 的主页背景", exact: true })).toBeVisible();
    await page.getByLabel("个人简介").fill("正在编辑的个人简介");
    await page.getByRole("checkbox", { name: "公开收藏" }).uncheck();
    for (const width of [1024, 1280, 1440, 1920]) {
      await page.setViewportSize({ width, height: 1000 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      const regions = [profile, appearance, privacy];
      for (let index = 0; index < regions.length; index++) {
        const section = regions[index];
        const bounds = (await section.boundingBox())!;
        for (const button of await section.getByRole("button").all()) {
          const box = (await button.boundingBox())!;
          expect(box.x - bounds.x).toBeGreaterThanOrEqual(24);
          expect(bounds.x + bounds.width - box.x - box.width).toBeGreaterThanOrEqual(24);
          expect(bounds.y + bounds.height - box.y - box.height).toBeGreaterThanOrEqual(24);
          expect(box.height).toBe(40);
        }
        if (index > 0) {
          const previous = (await regions[index - 1].boundingBox())!;
          expect(bounds.y - previous.y - previous.height).toBeGreaterThanOrEqual(24);
        }
      }
      const avatarAction = (await profile.getByRole("button", { name: "更换头像" }).boundingBox())!;
      const usernameAction = (await profile.getByRole("button", { name: "修改用户名" }).boundingBox())!;
      expect(usernameAction.y - avatarAction.y - avatarAction.height).toBeGreaterThanOrEqual(24);
      for (const name of ["更换头像", "移除头像", "修改用户名", "移除背景", "更换背景"]) {
        const button = page.getByRole("button", { name, exact: true });
        await expect(button).toHaveAttribute("data-control-role", "secondary");
        await expect(button).toHaveCSS("border-top-style", "solid");
      }
      for (const name of ["移动端 · 2:1", "电脑端 · 3:1"]) {
        await page.getByRole("tab", { name }).click();
        const preview = (await appearance.getByRole("tabpanel").boundingBox())!;
        const action = (await appearance.getByRole("button", { name: "更换背景" }).boundingBox())!;
        expect(action.y - preview.y - preview.height).toBeGreaterThanOrEqual(40);
      }
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.screenshot({ path: testInfo.outputPath(`profile-layout-${colorScheme}.png`), fullPage: true });
    expect((await new AxeBuilder({ page }).include("main").analyze()).violations).toEqual([]);
  });
}
