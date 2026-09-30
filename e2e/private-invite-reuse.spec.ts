import { expect } from "@playwright/test";
import { test } from "./fixtures/isolation";
import { loginAsE2eUser, openFreshThreadDraft } from "./fixtures/auth";

// 真实隔离 API 验收；只比较凭据相等与否，不把 token 写入断言、截图或报告。
test("私密帖重复分享、重开和主动重置使用独立操作", async ({ page }) => {
  await loginAsE2eUser(page);
  await openFreshThreadDraft(page);
  await page.getByLabel("主题帖标题").fill(`邀请重复分享 ${Date.now()}`);
  await page.getByLabel("可见性").click();
  await page.getByRole("option", { name: "私密", exact: true }).click();
  await page.locator(".ProseMirror").fill("隔离环境的邀请重复分享验收。");
  await page.getByRole("button", { name: "发布", exact: true }).click();
  await page.waitForURL((url) => /^\/threads\/[^/]+$/.test(url.pathname) && url.pathname !== "/threads/create");
  const threadPath = new URL(page.url()).pathname;
  await page.goto(`${threadPath}/edit`);
  let reads = 0;
  let resets = 0;
  page.on("request", (request) => {
    if (!new URL(request.url()).pathname.endsWith("/invite-link")) return;
    if (request.method() === "PUT") reads += 1;
    if (request.method() === "POST") resets += 1;
  });
  const copy = page.getByRole("button", { name: "复制邀请链接", exact: true });
  await copy.click();
  const link = page.getByRole("textbox", { name: "当前邀请链接" });
  await expect(link).toBeVisible();
  const first = await link.inputValue();
  await expect(copy).toBeEnabled();
  await copy.click();
  await expect.poll(() => reads).toBe(2);
  await expect(copy).toBeEnabled();
  expect((await link.inputValue()) === first).toBe(true);
  expect(resets).toBe(0);
  await page.reload();
  await expect(link).toHaveCount(0);
  await copy.click();
  await expect(link).toBeVisible();
  expect((await link.inputValue()) === first).toBe(true);
  expect(resets).toBe(0);
  await expect(copy).toBeEnabled();
  await page.getByRole("button", { name: "重置邀请链接", exact: true }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText("旧邀请链接将立即失效，已加入成员的权限不受影响。");
  await dialog.getByRole("button", { name: "重置并复制", exact: true }).click();
  await expect.poll(() => resets).toBe(1);
  await expect(copy).toBeEnabled();
  const second = await link.inputValue();
  expect(second !== first).toBe(true);
  // 不将真实 token 放入 Playwright 导航日志；会话沿用当前浏览器内存/HttpOnly Cookie。
  await page.evaluate((url) => window.location.assign(url), first);
  await expect(page.getByText("邀请链接无效或已失效", { exact: true })).toBeVisible();
  await page.goto(threadPath);
  await expect(page.getByRole("button", { name: "更多帖子信息与操作" })).toBeVisible();
  await page.evaluate((url) => window.location.assign(url), second);
  await page.waitForURL((url) => url.pathname === threadPath);
  await expect(page.getByRole("button", { name: "更多帖子信息与操作" })).toBeVisible();
});
