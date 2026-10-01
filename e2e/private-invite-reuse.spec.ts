import { expect } from "@playwright/test";
import { test } from "./fixtures/isolation";
import { loginAsE2eUser, openFreshThreadDraft } from "./fixtures/auth";

// 真实隔离 API 验收；只比较凭据相等与否，不把 token 写入断言、截图或报告。
test("私密帖单按钮重复分享、重开与剪贴板失败仍复用邀请", async ({ page }) => {
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
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
  const link = page.getByRole("textbox", { name: "当前邀请链接" });
  await expect(page.getByRole("button", { name: "重置邀请链接", exact: true })).toHaveCount(0);
  await copy.click();
  await expect(copy).toBeEnabled();
  await expect(link).toHaveCount(0);
  const first = await page.evaluate(() => navigator.clipboard.readText());
  expect(first.startsWith(`${new URL(page.url()).origin}/join/`)).toBe(true);
  await copy.click();
  await expect.poll(() => reads).toBe(2);
  await expect(copy).toBeEnabled();
  expect((await page.evaluate(() => navigator.clipboard.readText())) === first).toBe(true);
  expect(resets).toBe(0);
  await page.reload();
  await expect(link).toHaveCount(0);
  await copy.click();
  await expect.poll(() => reads).toBe(3);
  await expect(copy).toBeEnabled();
  expect((await page.evaluate(() => navigator.clipboard.readText())) === first).toBe(true);
  await expect(link).toHaveCount(0);
  await page.evaluate(() => Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async () => { throw new Error("clipboard denied"); } } }));
  await copy.click();
  await expect(link).toBeVisible();
  await expect(page.getByRole("status")).toContainText("自动复制失败，请手动复制下方链接");
  expect((await link.inputValue()) === first).toBe(true);
  expect(resets).toBe(0);
  // 不将真实 token 放入导航日志；邀请仍可用，已加入的楼主从邀请进入帖子。
  await page.evaluate((url) => window.location.assign(url), first);
  await page.waitForURL((url) => url.pathname === threadPath);
  await expect(page.getByRole("button", { name: "更多帖子信息与操作" })).toBeVisible();
});
