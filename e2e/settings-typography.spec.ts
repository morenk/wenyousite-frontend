import { expect, test } from "@playwright/test";
import { expectFunctionalTitles } from "./fixtures/typography";

const user = {
  id: "settings-font-user", username: "字体检查用户", email: "settings-font@example.test",
  role: "USER", avatar: null, profileCover: null, bio: "", level: 1,
  experience: 0, currentLevelExperience: 0, nextLevelExperience: 100,
  receivedTipTotal: "0", receivedTipCount: 0,
  showRecentReplies: true, showPlayerBadges: true, showBookmarks: true,
};

for (const colorScheme of ["light", "dark"] as const) {
  test(`${colorScheme} 下账号设置标题使用黑体，品牌保留文楷`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
    await page.route("**/api/v1/**", (route) => {
      const { pathname } = new URL(route.request().url());
      let data: unknown = [];
      if (pathname.endsWith("/auth/refresh")) data = { accessToken: "settings-font-token", user };
      if (pathname.endsWith("/users/me")) data = user;
      if (pathname.endsWith("/notifications/unread")) data = { unreadCount: 0 };
      if (pathname.endsWith("/direct-conversations/unread")) data = { total: 0 };
      if (pathname.endsWith("/wallet/check-in")) data = { claimedNow: false, rewardAmount: "0", balance: "0" };
      return route.fulfill({ json: { code: 0, message: "ok", data } });
    });

    for (const [path, title] of [
      ["/me", "基本资料"], ["/me/appearance", "主页外观"], ["/me/privacy", "隐私设置"], ["/me/password", "修改密码"],
      ["/me/email", "更换邮箱"], ["/me/security", "账号安全"],
    ]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { name: title, level: 2 })).toBeVisible();
      await expectFunctionalTitles(page.locator('main h1, main [data-slot="settings-title"]'));
      await expect(page.getByRole("heading", { name: "资料与设置", level: 1 })).toHaveCSS("font-size", "28px");
      await expect(page.getByRole("heading", { name: "资料与设置", level: 1 })).toHaveCSS("line-height", "36px");
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1440);
    }
    await expect(page.getByRole("link", { name: "温油站首页", exact: true }).locator(".font-display"))
      .toHaveCSS("font-family", /^"LXGW WenKai",/);
  });
}
