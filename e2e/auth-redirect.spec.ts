import { expect, test } from "@playwright/test";

test.describe("匿名登录回跳", () => {
  test("受保护页面保留完整 pathname、query 和 hash", async ({ page }) => {
    await page.goto("/bookmarks?folder=folder-1#saved");

    await expect(page).toHaveURL((url) => (
      url.pathname === "/login"
      && url.searchParams.get("next") === "/bookmarks?folder=folder-1#saved"
    ));
    await expect(page.getByText("登录温油站", { exact: true })).toBeVisible();
  });

  test("公开页登录入口复用同一返回地址规则", async ({ page }) => {
    await page.goto("/moments?source=navigation#following");
    await page.getByRole("tab", { name: "关注" }).click();
    await page.getByRole("button", { name: "登录" }).click();

    await expect(page).toHaveURL((url) => (
      url.pathname === "/login"
      && url.searchParams.get("next") === "/moments?source=navigation#following"
    ));
  });
});
