import { expect, type Page, type TestInfo } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { readIsolation } from "../scripts/e2e-isolation-gate.mjs";
import { test } from "./fixtures/isolation";
import AxeBuilder from "@axe-core/playwright";

// 这里只保存本文件全 mock 合成资料的画面，不保存真实账号或人工预览数据。
async function captureSettings(page: Page, info: TestInfo, name: string, selector?: string) {
  const { manifest } = readIsolation();
  const directory = resolve(".e2e-results", `settings-visual-${manifest.runId}`);
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const options = { path: info.outputPath(name), animations: "disabled" as const };
  const screenshot = selector
    ? await page.locator(selector).screenshot(options)
    : await page.screenshot({ ...options, fullPage: true });
  writeFileSync(resolve(directory, name), screenshot, { mode: 0o600 });
}

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
  const reads: string[] = [];
  const writes: Record<string, unknown>[] = [];
  let failNext = false;
  await page.route("**/api/v1/**", async (route) => {
    const { pathname } = new URL(route.request().url());
    if (route.request().method() === "GET") reads.push(pathname);
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
  return { writes, reads, setUser: (values: Partial<typeof user>) => { user = { ...user, ...values }; }, failNext: () => { failNext = true; } };
}

for (const colorScheme of ["light", "dark"] as const) {
  test(`${colorScheme} 下首末行与单行组的高亮贴合边界且焦点不挤压文字`, async ({ page }, testInfo) => {
    await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1440, height: 1100 });
    await mockSettings(page, true);
    await page.goto("/me");
    for (const [label, position] of [["头像", "first"], ["主页背景", "last"], ["等级与创作激励", "single"]]) {
      const entry = page.getByRole("button", { name: label, exact: true });
      await expect(entry).toBeVisible();
      await page.evaluate(() => {
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      });
      await entry.hover();
      const geometry = await entry.evaluate((button) => {
        const group = button.closest('[data-slot="stack-list"]')!;
        const row = button.parentElement!;
        const box = button.getBoundingClientRect();
        const groupBox = group.getBoundingClientRect();
        const style = getComputedStyle(button);
        const separator = getComputedStyle(row, "::after");
        return {
          x: box.x, width: box.width, height: box.height,
          groupX: groupBox.x, groupWidth: groupBox.width,
          labelInset: button.firstElementChild!.getBoundingClientRect().x - box.x,
          topRadius: style.borderTopLeftRadius, bottomRadius: style.borderBottomLeftRadius,
          groupRadius: getComputedStyle(group).borderTopLeftRadius,
          separator: { left: separator.left, right: separator.right, width: separator.borderBottomWidth, display: separator.display },
        };
      });
      expect(geometry.x).toBe(geometry.groupX);
      expect(geometry.width).toBe(geometry.groupWidth);
      expect(geometry.height).toBeGreaterThanOrEqual(64);
      expect(geometry.labelInset).toBe(20);
      expect(geometry.topRadius).toBe(position === "last" ? "0px" : geometry.groupRadius);
      expect(geometry.bottomRadius).toBe(position === "first" ? "0px" : geometry.groupRadius);
      if (position === "first") expect(geometry.separator).toMatchObject({ left: "20px", right: "20px", width: "1px" });
      else expect(geometry.separator.display).toBe("none");
      await captureSettings(page, testInfo, `boundary-${colorScheme}-${position}-hover.png`, '[data-slot="page-shell"]');
      await page.mouse.down();
      await expect(entry).toHaveCSS("transform", "none");
      await captureSettings(page, testInfo, `boundary-${colorScheme}-${position}-pressed.png`, '[data-slot="page-shell"]');
      await page.mouse.move(0, 0);
      await page.mouse.up();
      await page.keyboard.press("Tab");
      await entry.focus();
      await expect(entry).toBeFocused();
      await expect(entry).toHaveCSS("outline-width", "2px");
      await expect(entry).toHaveCSS("outline-offset", "-2px");
      await expect(entry).toHaveCSS("box-shadow", "none");
      await captureSettings(page, testInfo, `boundary-${colorScheme}-${position}-focus.png`, '[data-slot="page-shell"]');
    }
  });

  test(`${colorScheme} 下分组首页、单层焦点与桌面排版`, async ({ page }, testInfo) => {
    await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
    const mock = await mockSettings(page, true);
    await page.goto("/me");
    await expect(page.getByRole("button", { name: "头像", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "设置", level: 1 })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "设置分区" })).toHaveCount(0);
    await expect(page.locator("main").getByRole("textbox")).toHaveCount(0);
    await expect(page.locator("main").getByRole("checkbox")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /保存|永久注销/ })).toHaveCount(0);
    expect(mock.reads.some((path) => path.endsWith("/auth/sessions") || path.endsWith("/users/me/blocks"))).toBe(false);
    for (const width of [1024, 1280, 1440, 1920]) {
      await page.setViewportSize({ width, height: 1100 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      const rows = page.locator('[data-slot="settings-row"]');
      const boxes = await rows.evaluateAll((nodes) => nodes.map((node) => { const r = node.getBoundingClientRect(); return { x: r.x, width: r.width, height: r.height }; }));
      expect(boxes).toHaveLength(11);
      for (const box of boxes) { expect(box.height).toBeGreaterThanOrEqual(64); expect(box.x).toBe(boxes[0].x); expect(box.width).toBe(boxes[0].width); }
      const groups = page.locator("main section");
      for (const group of await groups.all()) {
        const container = group.locator('[data-slot="stack-list"]');
        await expect(container).toHaveCSS("border-top-width", "0px");
        await expect(container.locator('[data-slot="settings-row"]').last()).toHaveCSS("border-bottom-width", "0px");
      }
      await captureSettings(page, testInfo, `settings-${colorScheme}-${width}.png`, '[data-slot="page-shell"]');
    }
    await page.setViewportSize({ width: 1440, height: 1100 });
    await page.getByRole("button", { name: "个人简介", exact: true }).focus();
    const focused = page.getByRole("button", { name: "个人简介", exact: true });
    await expect(focused).toHaveCSS("outline-width", "2px");
    await expect(focused).toHaveCSS("box-shadow", "none");
    await captureSettings(page, testInfo, `settings-${colorScheme}-focus.png`);
    expect((await new AxeBuilder({ page }).include("main").analyze()).violations).toEqual([]);
    await page.setViewportSize({ width: 1920, height: 1200 });
    await page.evaluate(() => { document.documentElement.style.zoom = "2"; });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1920);
    await focused.click();
    const dialog = page.getByRole("dialog", { name: "个人简介" });
    await expect(dialog).toBeVisible();
    const textarea = dialog.getByRole("textbox", { name: "个人简介" });
    await expect(textarea).toBeFocused();
    await expect(textarea).toHaveCSS("outline-offset", "-1px");
    await expect(textarea).toHaveCSS("box-shadow", "none");
    const bounds = (await dialog.boundingBox())!;
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(1920);
    await captureSettings(page, testInfo, `settings-${colorScheme}-200-percent.png`);
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(focused).toBeFocused();
  });

  test(`${colorScheme} 下简介输入框只保留单层焦点并保留错误色`, async ({ page }, testInfo) => {
    await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await mockSettings(page);
    await page.goto("/me");
    await page.getByRole("button", { name: "个人简介", exact: true }).click();
    const textarea = page.getByRole("textbox", { name: "个人简介" });
    await expect(textarea).toBeFocused();
    await expect(textarea).toHaveCSS("outline-width", "2px");
    await expect(textarea).toHaveCSS("outline-offset", "-1px");
    await expect(textarea).toHaveCSS("box-shadow", "none");
    await captureSettings(page, testInfo, `bio-${colorScheme}-focus.png`);
    const normalColor = await textarea.evaluate((element) => getComputedStyle(element).outlineColor);
    await textarea.fill("");
    await page.getByRole("button", { name: "保存", exact: true }).click();
    await expect(textarea).toBeFocused();
    await expect(textarea).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByText("简介不能为空；暂不支持清空已填写的简介。")).toBeVisible();
    await expect.poll(() => textarea.evaluate((element, originalColor) => {
      const style = getComputedStyle(element);
      return style.outlineColor === style.borderTopColor && style.outlineColor !== originalColor;
    }, normalColor)).toBe(true);
    await expect(textarea).toHaveCSS("box-shadow", "none");
    await captureSettings(page, testInfo, `bio-${colorScheme}-error-focus.png`);
  });

  test(`${colorScheme} 下管理与编辑共用单个弹窗，裁剪入口不常驻首页`, async ({ page }, testInfo) => {
    await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1024, height: 900 });
    const mock = await mockSettings(page, true);
    await page.goto("/me");
    for (const [name, title] of [["头像", "头像"], ["用户名", "修改用户名"], ["个人简介", "个人简介"], ["主页背景", "主页背景"], ["主页公开范围", "主页公开范围"], ["登录终端", "登录终端"], ["黑名单", "黑名单"], ["等级与创作激励", "等级与创作激励"], ["注销账号", "注销账号"]]) {
      const trigger = page.getByRole("button", { name, exact: true });
      await trigger.click();
      const dialog = page.getByRole("dialog", { name: title, exact: true });
      await expect(dialog).toBeVisible();
      await expect(page.getByRole("dialog")).toHaveCount(1);
      if (name === "头像") await expect(dialog.getByRole("button", { name: "移除头像" })).toBeVisible();
      if (name === "主页背景") {
        await expect(dialog.getByRole("img", { name: "温油读者 的主页背景", exact: true })).toBeVisible();
        await dialog.getByRole("tab", { name: "移动端 · 2:1" }).click();
        await expect(dialog.getByRole("tabpanel", { name: "移动端 · 2:1" })).toBeVisible();
      }
      if (name === "注销账号") await expect(dialog.getByRole("button", { name: "永久注销" })).toBeDisabled();
      expect((await new AxeBuilder({ page }).include('[role="dialog"]').analyze()).violations).toEqual([]);
      await captureSettings(page, testInfo, `${name}-${colorScheme}.png`);
      await page.keyboard.press("Escape");
      await expect(dialog).not.toBeVisible();
      await expect(trigger).toBeFocused();
    }
    expect(mock.reads.some((path) => path.endsWith("/auth/sessions"))).toBe(true);
    expect(mock.reads.some((path) => path.endsWith("/users/me/blocks"))).toBe(true);
  });
}

test("草稿关闭与历史返回先确认，失败可重试，保存后更新摘要", async ({ page }) => {
  const mock = await mockSettings(page);
  await page.goto("/me/password");
  await page.getByRole("link", { name: "返回设置" }).click();
  await page.getByRole("button", { name: "个人简介", exact: true }).click();
  await page.getByRole("textbox", { name: "个人简介" }).fill("未保存的简介草稿");
  await page.evaluate(() => history.back());
  const confirmation = page.getByRole("alertdialog", { name: "放弃未保存修改" });
  await expect(confirmation).toBeVisible();
  await expect(page).toHaveURL(/\/me#security$/);
  await confirmation.getByRole("button", { name: "继续编辑" }).click();
  await expect(page.getByRole("textbox")).toHaveValue("未保存的简介草稿");
  await page.keyboard.press("Escape");
  await expect(confirmation).toBeVisible();
  await confirmation.getByRole("button", { name: "继续编辑" }).click();
  mock.failNext();
  await page.getByRole("button", { name: "保存" }).click();
  await expect(page.getByText("操作太频繁，请稍后再试", { exact: true })).toBeVisible();
  await expect(page.getByRole("textbox")).toHaveValue("未保存的简介草稿");
  await page.getByRole("button", { name: "保存" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.getByText("未保存的简介草稿", { exact: true })).toBeVisible();
  expect(mock.writes.at(-1)).toEqual({ bio: "未保存的简介草稿" });
  await page.getByRole("button", { name: "个人简介", exact: true }).click();
  await page.getByRole("textbox").fill("");
  await page.getByRole("button", { name: "保存" }).click();
  await expect(page.getByText("简介不能为空；暂不支持清空已填写的简介。")).toBeVisible();
  expect(mock.writes).toHaveLength(2);
  await page.getByRole("button", { name: "取消", exact: true }).click();
  await confirmation.getByRole("button", { name: "放弃修改", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByRole("button", { name: "主页公开范围", exact: true }).click();
  await page.getByRole("checkbox", { name: "公开收藏" }).uncheck();
  await page.getByRole("button", { name: "保存" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  expect(mock.writes.at(-1)).toEqual({ showRecentReplies: true, showPlayerBadges: true, showBookmarks: false });
  await page.reload();
  await page.getByRole("button", { name: "主页公开范围", exact: true }).click();
  await expect(page.getByRole("checkbox", { name: "公开收藏" })).not.toBeChecked();
});

test("旧设置入口定位到对应行，邮箱密码仍为独立页面", async ({ page }) => {
  await mockSettings(page);
  for (const [path, hash, label] of [["/me/security", "security", "邮箱"], ["/me/appearance", "appearance", "主页背景"], ["/me/privacy", "privacy", "主页公开范围"], ["/me#profile-appearance", "appearance", "主页背景"]]) {
    await page.goto(path);
    await expect(page).toHaveURL(new RegExp(`/me#${hash}$`));
    await expect(page.getByRole(label === "邮箱" ? "link" : "button", { name: label, exact: true })).toBeInViewport();
  }
  await page.getByRole("link", { name: "密码", exact: true }).click();
  await expect(page.getByRole("heading", { name: "修改密码", level: 1 })).toBeVisible();
  await page.getByRole("link", { name: "返回设置" }).click();
  await page.getByRole("link", { name: "邮箱", exact: true }).click();
  await expect(page.getByRole("heading", { name: "更换邮箱", level: 1 })).toBeVisible();
});

test("账号管理按需加载、失败保留列表、注销必须二次确认", async ({ page }) => {
  await mockSettings(page);
  let sessions = [
    { id: "current", platform: "web", isCurrent: true, createdAt: "2026-09-01T00:00:00Z", expiresAt: "2027-09-01T00:00:00Z" },
    { id: "mobile", platform: "mobile", isCurrent: false, createdAt: "2026-09-01T00:00:00Z", expiresAt: "2027-09-01T00:00:00Z" },
  ];
  let blocked = [{ id: "record", blocked: { id: "blocked-user", username: "黑名单用户", avatar: null } }];
  let failedOnce = false;
  let deletes = 0;
  await page.route("**/api/v1/auth/sessions**", async (route) => {
    if (route.request().method() === "DELETE") {
      if (!failedOnce) { failedOnce = true; return route.fulfill({ status: 500, json: { code: 50000, message: "退出失败，请稍后重试" } }); }
      sessions = sessions.filter((session) => session.isCurrent);
    }
    return route.fulfill({ json: { code: 0, data: sessions } });
  });
  await page.route("**/api/v1/users/me/blocks", (route) => route.fulfill({ json: { code: 0, data: blocked } }));
  await page.route("**/api/v1/users/me/block/*", (route) => { blocked = []; return route.fulfill({ json: { code: 0, data: null } }); });
  await page.route("**/api/v1/users/me", async (route) => {
    if (route.request().method() !== "DELETE") return route.fallback();
    deletes++;
    return route.fulfill({ status: 500, json: { code: 50000, message: "注销失败，请稍后重试" } });
  });
  await page.goto("/me");
  await page.getByRole("button", { name: "登录终端", exact: true }).click();
  await expect(page.getByText("当前终端")).toBeVisible();
  await expect(page.getByRole("button", { name: "退出登录", exact: true })).toHaveCount(1);
  await page.getByRole("button", { name: "退出登录", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText("退出失败，请稍后重试");
  await expect(page.getByText("移动端登录")).toBeVisible();
  await page.getByRole("button", { name: "退出登录", exact: true }).click();
  await expect(page.getByText("移动端登录")).not.toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "黑名单", exact: true }).click();
  await page.getByRole("button", { name: "取消拉黑" }).click();
  await expect(page.getByText("黑名单为空")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "注销账号", exact: true }).click();
  await expect(page.getByRole("button", { name: "永久注销", exact: true })).toBeDisabled();
  await page.getByRole("textbox", { name: "注销确认文字" }).fill("注销账号");
  await page.getByRole("button", { name: "永久注销", exact: true }).click();
  const confirm = page.getByRole("alertdialog", { name: "注销账号" });
  await expect(confirm).toBeVisible();
  expect(deletes).toBe(0);
  await confirm.getByRole("button", { name: "取消", exact: true }).click();
  expect(deletes).toBe(0);
  await page.getByRole("button", { name: "永久注销", exact: true }).click();
  await confirm.getByRole("button", { name: "永久注销", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText("注销失败，请稍后重试");
  await expect(page.getByRole("textbox", { name: "注销确认文字" })).toHaveValue("注销账号");
  expect(deletes).toBe(1);
});

test("长文本和空资料保持列对齐，简介摘要最多两行", async ({ page }, testInfo) => {
  const mock = await mockSettings(page);
  mock.setUser({ username: "很长的用户名用于桌面布局检查", bio: "中英混排 Hello 😀 很长的个人简介。".repeat(12), email: "long-address-for-settings@example.test" });
  await page.setViewportSize({ width: 1024, height: 1000 });
  await page.goto("/me");
  const row = page.getByRole("button", { name: "个人简介", exact: true });
  await expect(row).toBeVisible();
  const summary = row.locator(".line-clamp-2");
  expect(await summary.evaluate((node) => node.getBoundingClientRect().height)).toBeLessThanOrEqual(40);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1024);
  await captureSettings(page, testInfo, "settings-long-text.png", '[data-slot="page-shell"]');
  await row.click();
  await expect(page.getByRole("textbox", { name: "个人简介" })).toHaveValue("中英混排 Hello 😀 很长的个人简介。".repeat(12));
  await page.keyboard.press("Escape");
  mock.setUser({ bio: "", avatar: null, profileCover: null });
  await page.reload();
  await expect(page.getByRole("button", { name: "个人简介", exact: true })).toContainText("未填写");
  await expect(page.getByRole("button", { name: "主页背景", exact: true })).toContainText("未设置");
  await captureSettings(page, testInfo, "settings-empty.png", '[data-slot="page-shell"]');
});

test("头像与背景在同一弹窗内裁剪，取消草稿后返回选择入口", async ({ page }, testInfo) => {
  await mockSettings(page);
  await page.goto("/me");
  for (const [label, input, title] of [["头像", "avatar-file-input", "裁剪头像"], ["主页背景", "profile-cover-file-input", "调整主页背景"]]) {
    const entry = page.getByRole("button", { name: label, exact: true });
    await entry.click();
    await page.getByTestId(input).setInputFiles(resolve("public/pwa-icon-192.png"));
    const crop = page.getByRole("dialog", { name: title, exact: true });
    await expect(crop).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(1);
    await expect(crop.getByRole("button", { name: label === "头像" ? "保存头像" : "保存背景", exact: true })).toBeEnabled();
    await captureSettings(page, testInfo, `${input}-crop.png`);
    await crop.getByRole("button", { name: "取消", exact: true }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "放弃修改", exact: true }).click();
    const management = page.getByRole("dialog", { name: label, exact: true });
    await expect(management).toBeVisible();
    await expect(management.getByRole("button", { name: label === "头像" ? "上传头像" : "上传背景", exact: true })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(entry).toBeFocused();
  }
});
