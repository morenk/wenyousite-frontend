import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const publicRoutes = [
  { name: "首页", path: "/" },
  { name: "登录", path: "/login" },
  { name: "注册", path: "/register" },
  { name: "搜索", path: "/search?q=推理" },
] as const;

test.describe("公共关键页面无障碍", () => {
  for (const route of publicRoutes) {
    test(`${route.name}无 WCAG A/AA 自动检测违规`, async ({ page }) => {
      await page.goto(route.path);
      await expect(page.locator("body")).toBeVisible();

      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();

      expect(results.violations).toEqual([]);
    });
  }
});
