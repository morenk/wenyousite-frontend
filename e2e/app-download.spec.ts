import AxeBuilder from "@axe-core/playwright";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { expect, type Page } from "@playwright/test";
import jsQR from "jsqr";
import { test } from "./fixtures/isolation";
import { availableDownload, downloadHeaders } from "../src/test/app-download";

async function anonymous(page: Page) {
  await page.route("**/api/v1/auth/refresh", (route) => route.fulfill({
    status: 401, contentType: "application/json", body: JSON.stringify({ code: 40100, message: "unauthorized", data: null }),
  }));
}

for (const theme of ["light", "dark"] as const) {
  for (const width of [1280, 390]) {
    test(`accessible-layout / entry-anonymous ${theme} ${width}`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await anonymous(page);
      const files: string[] = [];
      await page.route("**/api/v1/app-downloads/android", (route) => route.fulfill({
        json: { code: 0, message: "ok", data: availableDownload() },
      }));
      await page.route("**/api/v1/app-downloads/android/*/file", (route) => {
        files.push(route.request().method()); return route.fulfill({ status: 503 });
      });
      await page.goto("/login");
      await page.getByRole("button", { name: "外观：跟随系统" }).click();
      const entry = page.getByRole("link", { name: "下载 APP", exact: true });
      await entry.focus();
      await page.screenshot({ path: testInfo.outputPath(`menu-${theme}-${width}.png`) });
      await page.keyboard.press("Enter");
      await expect(page).toHaveURL(/\/download$/);
      await expect(page.getByText("32.0 MiB", { exact: true })).toBeVisible();
      const download = page.getByRole("button", { name: "下载 Android 安装包", exact: true });
      await download.hover(); await download.focus();
      await page.getByRole("button", { name: "重新获取下载信息" }).click();
      await expect(download).toBeEnabled();
      expect(files).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

      if (width === 1280) {
        const qr = page.getByRole("img", { name: "用手机打开温油站下载页" });
        await expect(qr).toBeVisible();
        const screenshot = await qr.screenshot();
        const pixels = await page.evaluate(async (base64) => {
          const image = new Image();
          image.src = `data:image/png;base64,${base64}`;
          await image.decode();
          const canvas = document.createElement("canvas"); canvas.width = 352; canvas.height = 352;
          const ctx = canvas.getContext("2d")!; ctx.drawImage(image, 0, 0, 352, 352);
          return Array.from(ctx.getImageData(0, 0, 352, 352).data);
        }, screenshot.toString("base64"));
        expect(jsQR(new Uint8ClampedArray(pixels), 352, 352)?.data).toBe("https://wenyou.site/download");
        await expect(page.getByRole("link", { name: "wenyou.site/download" })).toHaveAttribute("href", "https://wenyou.site/download");
      }
      const accessibility = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
      expect(accessibility.violations).toEqual([]);
      await page.screenshot({ path: testInfo.outputPath(`download-${theme}-${width}.png`), fullPage: true });
    });
  }
}

test("download-browser-handoff 单次键盘激活交给浏览器保存隔离样本", async ({ page }) => {
  await anonymous(page);
  const body = Buffer.from("isolated-download-fixture");
  const info = availableDownload();
  info.release!.sizeBytes = body.length;
  info.release!.sha256 = createHash("sha256").update(body).digest("hex");
  const files: string[] = [];
  await page.route("**/api/v1/app-downloads/android", (route) => route.fulfill({ json: { code: 0, message: "ok", data: info } }));
  await page.route("**/api/v1/app-downloads/android/*/file", (route) => {
    const method = route.request().method(); files.push(method);
    return route.fulfill({ status: 200, headers: {
      ...downloadHeaders(info.release!), "X-Frame-Options": "DENY", "Content-Security-Policy": "frame-ancestors 'none'",
    }, body: method === "HEAD" ? undefined : body });
  });
  await page.goto("/download");
  const button = page.getByRole("button", { name: "下载 Android 安装包", exact: true });
  await expect(button).toBeEnabled();
  expect(files).toEqual([]);
  await button.focus();
  const downloaded = page.waitForEvent("download");
  await page.keyboard.press("Enter");
  const download = await downloaded;
  expect(download.suggestedFilename()).toBe(info.release!.fileName);
  expect(await download.failure()).toBeNull();
  expect(await readFile((await download.path())!)).toEqual(body);
  expect(files).toEqual(["HEAD", "GET"]);
  await expect(page.getByText("已交给浏览器下载，请在下载列表查看。若未开始，请稍后重新获取下载信息再试。")).toBeVisible();
});

test("download-rate-limited / download-service-unavailable 不自动重试文件", async ({ page }) => {
  await anonymous(page);
  const files: string[] = [];
  let status = 429;
  await page.route("**/api/v1/app-downloads/android", (route) => route.fulfill({ json: { code: 0, message: "ok", data: availableDownload() } }));
  await page.route("**/api/v1/app-downloads/android/*/file", (route) => {
    files.push(route.request().method());
    return route.fulfill({ status, headers: status === 429 ? { "Retry-After": "1" } : {} });
  });
  await page.goto("/download");
  await page.getByRole("button", { name: "下载 Android 安装包", exact: true }).click();
  await expect(page.getByText("下载请求较多", { exact: true })).toBeVisible();
  const retry = page.getByRole("button", { name: "重新获取下载信息" });
  await expect(retry).toBeDisabled(); await expect(retry).toBeEnabled();
  expect(files).toEqual(["HEAD"]);
  status = 503;
  await retry.click();
  await page.getByRole("button", { name: "下载 Android 安装包", exact: true }).click();
  await expect(page.getByText("下载暂不可用", { exact: true })).toBeVisible();
  expect(files).toEqual(["HEAD", "HEAD"]);
});

for (const failure of [
  { status: 429, body: "" },
  { status: 429, body: JSON.stringify({ code: 42900, message: "稍后重试", data: null }) },
  { status: 503, body: "" },
  { status: 502, body: "" },
]) {
  test(`HEAD 成功后 GET ${failure.status} ${failure.body ? "JSON" : "空正文"} 保留页面与手动恢复入口`, async ({ page }) => {
    await anonymous(page);
    const files: string[] = [];
    let informationRequests = 0;
    await page.route("**/api/v1/app-downloads/android", (route) => {
      informationRequests++;
      return route.fulfill({ json: { code: 0, message: "ok", data: availableDownload() } });
    });
    await page.route("**/api/v1/app-downloads/android/*/file", (route) => {
      const method = route.request().method(); files.push(method);
      return method === "HEAD"
        ? route.fulfill({ status: 200, headers: downloadHeaders() })
        : route.fulfill({ status: failure.status, body: failure.body, headers: {
          "Retry-After": "60", "Content-Type": "application/json",
          "Content-Security-Policy": "frame-ancestors 'none'", "X-Frame-Options": "DENY",
        } });
    });
    await page.goto("/download");
    const failedGet = page.waitForResponse((response) => response.request().method() === "GET" && response.url().endsWith("/42/file"));
    await page.getByRole("button", { name: "下载 Android 安装包", exact: true }).click();
    expect((await failedGet).status()).toBe(failure.status);
    await expect(page).toHaveURL(/\/download$/);
    await expect(page.getByText("已交给浏览器下载，请在下载列表查看。若未开始，请稍后重新获取下载信息再试。")).toBeVisible();
    const retry = page.getByRole("button", { name: "重新获取下载信息" });
    await expect(retry).toBeEnabled();
    await expect(page.getByRole("button", { name: "下载 Android 安装包", exact: true })).toBeDisabled();
    expect(files).toEqual(["HEAD", "GET"]);
    await retry.click();
    await expect(page.getByRole("button", { name: "下载 Android 安装包", exact: true })).toBeEnabled();
    expect(informationRequests).toBe(2);
    expect(files).toEqual(["HEAD", "GET"]);
  });
}
