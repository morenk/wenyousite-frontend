import AxeBuilder from "@axe-core/playwright";
import { THEME_PALETTES } from "@wenyousite/foundation/theme";
import { expect, test, type Page } from "@playwright/test";

import { THEME_STORAGE_KEY } from "../src/lib/theme";

async function mockAnonymousSession(page: Page) {
  await page.route("**/api/v1/auth/refresh", (route) =>
    route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ code: 1001, message: "unauthorized" }),
    }),
  );
}

test("外观偏好在首屏解析、键盘切换、系统变化与刷新后保持一致", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await page.addInitScript(({ storageKey, guardKey }) => {
    if (sessionStorage.getItem(guardKey)) return;
    localStorage.removeItem(storageKey);
    sessionStorage.setItem(guardKey, "ready");
  }, { storageKey: THEME_STORAGE_KEY, guardKey: "wenyousite-theme-e2e-ready" });
  await mockAnonymousSession(page);
  await page.goto("/login");

  const root = page.locator("html");
  await expect(root).toHaveAttribute("data-theme-preference", "system");
  await expect(root).toHaveAttribute("data-theme", "dark");
  await expect(root).toHaveCSS("color-scheme", "dark");
  const themeColor = page.locator('meta[name="theme-color"]');
  await expect(themeColor).toHaveCount(1);
  await expect(themeColor).toHaveAttribute(
    "content",
    THEME_PALETTES.dark.background,
  );

  await page.getByRole("button", { name: "外观：跟随系统" }).click();
  const lightOption = page.getByRole("radio", { name: "亮色" });
  await lightOption.focus();
  await page.keyboard.press("Space");
  await expect(page.getByRole("button", { name: "外观：亮色" })).toBeVisible();
  await expect(root).toHaveAttribute("data-theme", "light");
  expect(await page.evaluate((key) => localStorage.getItem(key), THEME_STORAGE_KEY)).toBe("light");

  await page.reload();
  await expect(root).toHaveAttribute("data-theme-preference", "light");
  await expect(root).toHaveAttribute("data-theme", "light");

  await page.getByRole("button", { name: "外观：亮色" }).click();
  await page.getByText("跟随系统", { exact: true }).click();
  await expect(root).toHaveAttribute("data-theme", "dark");
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await expect(root).toHaveAttribute("data-theme", "light");

  await page.getByRole("button", { name: "外观：跟随系统" }).click();
  await page.getByText("黑夜", { exact: true }).click();
  await expect(root).toHaveAttribute("data-theme", "dark");
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await expect(root).toHaveAttribute("data-theme", "dark");
});

test("黑夜认证页无 WCAG A/AA 自动检测违规", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await page.addInitScript((storageKey) => localStorage.setItem(storageKey, "dark"), THEME_STORAGE_KEY);
  await mockAnonymousSession(page);
  await page.goto("/login");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator('meta[name="theme-color"]')).toHaveCount(1);

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(results.violations).toEqual([]);
});
