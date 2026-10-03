import AxeBuilder from "@axe-core/playwright";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { expect, type Page } from "@playwright/test";
import { test } from "./fixtures/isolation";
import { availableDownload, downloadHeaders } from "../src/test/app-download";

const android = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36";
const ios = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const handoff = "已交给浏览器下载，请在下载列表查看。若未开始，可重试下载。";
const frame = 'iframe[title^="Android 安装包下载"]';

async function anonymous(page: Page) {
  await page.route("**/api/v1/auth/refresh", (route) => route.fulfill({
    status: 401, json: { code: 40100, message: "unauthorized", data: null },
  }));
}
async function menu(page: Page) {
  await page.getByRole("button", { name: "外观：跟随系统" }).click();
  return page.getByRole("button", { name: "下载 APP", exact: true });
}
async function fixture(page: Page) {
  await anonymous(page);
  const body = Buffer.from("isolated-download-fixture");
  const info = availableDownload();
  info.release!.sizeBytes = body.length;
  info.release!.sha256 = createHash("sha256").update(body).digest("hex");
  const requests: string[] = [];
  await page.route("**/api/v1/app-downloads/android", (route) => {
    requests.push("information");
    return route.fulfill({ json: { code: 0, message: "ok", data: info } });
  });
  await page.route("**/api/v1/app-downloads/android/*/file", (route) => {
    const method = route.request().method(); requests.push(method);
    return route.fulfill({ status: 200, headers: {
      ...downloadHeaders(info.release!), "X-Frame-Options": "DENY", "Content-Security-Policy": "frame-ancestors 'none'",
    }, body: method === "HEAD" ? undefined : body });
  });
  return { requests, info, body };
}
async function expectSaved(page: Page, activate: () => Promise<unknown>, body: Buffer) {
  const downloaded = page.waitForEvent("download");
  await activate();
  const download = await downloaded;
  expect(await download.failure()).toBeNull();
  expect(await readFile((await download.path())!)).toEqual(body);
  return download;
}

for (const theme of ["light", "dark"] as const) {
  for (const width of [1280, 390]) {
    test(`accessible-layout / desktop-entry ${theme} ${width}`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      const { requests } = await fixture(page);
      await page.goto("/login");
      await expect(page.getByRole("dialog", { name: "温油站 APP" })).toHaveCount(0);
      const entry = await menu(page);
      await entry.hover(); await entry.focus();
      const accessibility = await new AxeBuilder({ page }).include('[data-slot="theme-menu-popup"]').withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
      expect(accessibility.violations).toEqual([]);
      expect(requests).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`menu-${theme}-${width}.png`), fullPage: true });
    });
  }
}

test("download-browser-handoff 键盘一次激活保存文件，菜单和 SPA 导航保留载体", async ({ page }) => {
  const { requests, info, body } = await fixture(page);
  await page.goto("/login");
  const entry = await menu(page);
  await entry.focus();
  const download = await expectSaved(page, () => page.keyboard.press("Enter"), body);
  expect(download.suggestedFilename()).toBe(info.release!.fileName);
  expect(requests).toEqual(["information", "HEAD", "GET"]);
  await expect(page.getByText(handoff)).toBeVisible();
  await expect(entry).toBeDisabled();
  const carrier = await page.locator(frame).elementHandle();
  await page.keyboard.press("Escape");
  await expect(page.locator(frame)).toHaveCount(1);
  await page.locator('a[href="/register"]').click();
  await expect(page).toHaveURL(/\/register$/);
  expect(await carrier!.evaluate((element) => element.isConnected)).toBe(true);
  await menu(page);
  await expect(page.getByText(handoff)).toBeVisible();
  await expectSaved(page, () => page.getByRole("button", { name: "重试下载" }).click(), body);
  expect(requests).toEqual(["information", "HEAD", "GET", "information", "HEAD", "GET"]);
  expect(await carrier!.evaluate((element) => element.isConnected)).toBe(true);
  await expect(page.locator(frame)).toHaveCount(2);
});

test("download-rate-limited / download-service-unavailable 等待结束不自动重试", async ({ page }) => {
  const { requests } = await fixture(page);
  let status = 429;
  await page.route("**/api/v1/app-downloads/android/*/file", (route) => {
    requests.push(route.request().method());
    return route.fulfill({ status, headers: status === 429 ? { "Retry-After": "1" } : {} });
  });
  await page.goto("/login");
  await (await menu(page)).click();
  await expect(page.getByRole("status").filter({ hasText: "下载请求较多" })).toBeVisible();
  const retry = page.getByRole("button", { name: "重试下载" });
  await expect(retry).toBeDisabled(); await expect(retry).toBeEnabled();
  expect(requests).toEqual(["information", "HEAD"]);
  status = 503;
  await retry.click();
  await expect(page.getByText("暂时无法下载，请重试。")).toBeVisible();
  expect(requests).toEqual(["information", "HEAD", "information", "HEAD"]);
  await expect(page.locator(frame)).toHaveCount(0);
});

for (const failure of [
  { status: 429, body: "" },
  { status: 429, body: JSON.stringify({ code: 42900, message: "稍后重试", data: null }) },
  { status: 503, body: "" },
  { status: 502, body: "" },
]) {
  test(`HEAD 成功后 GET ${failure.status} ${failure.body ? "JSON" : "空正文"} 留在原页面且可重试`, async ({ page }) => {
    const { requests } = await fixture(page);
    await page.route("**/api/v1/app-downloads/android/*/file", (route) => {
      const method = route.request().method(); requests.push(method);
      return method === "HEAD"
        ? route.fulfill({ status: 200, headers: downloadHeaders() })
        : route.fulfill({ status: failure.status, body: failure.body, headers: {
          "Retry-After": "60", "Content-Type": "application/json",
          "Content-Security-Policy": "frame-ancestors 'none'", "X-Frame-Options": "DENY",
        } });
    });
    // 与 HEAD 使用相同的制品元数据。
    await page.route("**/api/v1/app-downloads/android", (route) => {
      requests.push("information");
      return route.fulfill({ json: { code: 0, message: "ok", data: availableDownload() } });
    });
    await page.goto("/login");
    const failedGet = () => page.waitForResponse((response) => response.request().method() === "GET" && response.url().endsWith("/42/file"));
    const first = failedGet();
    await (await menu(page)).click();
    expect((await first).status()).toBe(failure.status);
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByText(handoff)).toBeVisible();
    const retry = page.getByRole("button", { name: "重试下载" });
    await expect(retry).toBeEnabled();
    expect(requests).toEqual(["information", "HEAD", "GET"]);
    const second = failedGet();
    await retry.click();
    expect((await second).status()).toBe(failure.status);
    await expect(page).toHaveURL(/\/login$/);
    expect(requests).toEqual(["information", "HEAD", "GET", "information", "HEAD", "GET"]);
  });
}

for (const platform of ["android", "ios"] as const) {
  test.describe(`mobile-device-prompt ${platform}`, () => {
    test.use({ userAgent: platform === "android" ? android : ios, hasTouch: true, viewport: { width: 390, height: 900 } });
    for (const theme of ["light", "dark"] as const) {
      test(`first-visit / session-once ${theme}`, async ({ page }, testInfo) => {
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        const { requests } = await fixture(page);
        await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
        await page.goto("/login");
        const prompt = page.getByRole("dialog", { name: "温油站 APP" });
        await expect(prompt).toBeVisible();
        await expect.poll(() => prompt.evaluate((element) => element.contains(document.activeElement))).toBe(true);
        await expect(prompt.getByRole("button", { name: "下载 APP", exact: true })).toHaveCount(platform === "android" ? 1 : 0);
        if (platform === "ios") await expect(prompt.getByText(/暂无 iOS 版本/)).toBeVisible();
        const accessibility = await new AxeBuilder({ page }).include('[role="dialog"]').withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
        expect(accessibility.violations).toEqual([]);
        await page.screenshot({ path: testInfo.outputPath(`${platform}-${theme}-390.png`), fullPage: true });
        await prompt.getByRole("button", { name: "继续使用网页" }).click();
        await expect(prompt).toHaveCount(0);
        await page.locator('a[href="/register"]').click();
        await expect(page).toHaveURL(/\/register$/);
        await expect(prompt).toHaveCount(0);
        await page.reload();
        await expect(page.getByRole("button", { name: "外观：跟随系统" })).toBeVisible();
        await expect(prompt).toHaveCount(0);
        expect(requests).toEqual([]);
        expect(errors).toEqual([]);
      });
    }
    if (platform === "android") {
      test("关闭提示与菜单不取消预检，两个入口共享结果", async ({ page }) => {
        const { requests, body, info } = await fixture(page);
        let finishHead!: () => void;
        const headGate = new Promise<void>((resolve) => { finishHead = resolve; });
        await page.route("**/api/v1/app-downloads/android/*/file", async (route) => {
          const method = route.request().method(); requests.push(method);
          if (method === "HEAD") await headGate;
          return route.fulfill({ headers: downloadHeaders(info.release!), body: method === "HEAD" ? undefined : body });
        });
        await page.goto("/login");
        await page.getByRole("dialog").getByRole("button", { name: "下载 APP", exact: true }).click();
        await expect(page.getByRole("button", { name: "正在确认下载…" })).toBeDisabled();
        await page.keyboard.press("Escape");
        await menu(page);
        await expect(page.getByRole("button", { name: "正在确认下载…" })).toBeDisabled();
        await page.keyboard.press("Escape");
        await expectSaved(page, async () => { finishHead(); }, body);
        expect(requests).toEqual(["information", "HEAD", "GET"]);
        await menu(page);
        await expect(page.getByText(handoff)).toBeVisible();
        await expect(page.getByRole("button", { name: "下载 APP", exact: true })).toBeDisabled();
        await page.reload();
        await expect(page.getByRole("button", { name: "外观：跟随系统" })).toBeVisible();
        await expect(page.getByRole("dialog", { name: "温油站 APP" })).toHaveCount(0);
      });
    }
  });
}
