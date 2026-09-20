import { expect, type Page } from "@playwright/test";
import { requireIsolationRunner } from "../../scripts/e2e-isolation-gate.mjs";

function requiredCredential(name: "E2E_EMAIL" | "E2E_PASSWORD") {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} 未由本轮隔离 runner 注入`);
  }
  return value;
}

export async function loginAsE2eUser(page: Page) {
  await requireIsolationRunner();
  await page.goto("/login");
  const loginInput = page.getByLabel("邮箱或用户名");
  await loginInput.waitFor({ state: "visible" });
  try {
    await loginInput.fill(requiredCredential("E2E_EMAIL"));
    await page.getByLabel("密码", { exact: true }).fill(requiredCredential("E2E_PASSWORD"));
  } catch {
    // Playwright 的 fill 诊断可能包含入参，禁止把本轮凭据写入错误记录。
    throw new Error("隔离账号填写失败");
  }
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await page.waitForURL("/");
}

/** 每个用例显式新建草稿，避免复用测试账号遗留草稿造成选择器分叉。 */
export async function openFreshThreadDraft(page: Page) {
  // 登录已回到首页时复用当前页面，避免无意义的整页加载和 refresh token 轮换。
  if (new URL(page.url()).pathname !== "/") await page.goto("/");
  await page.getByRole("button", { name: "打开发布菜单" }).click();
  await page.getByRole("link", { name: "发布主题帖", exact: true }).click();
  const createButton = page.getByRole("button", { name: "新建主题帖" });
  await expect(createButton).toBeVisible();
  await createButton.click();
  await page.waitForSelector(".milkdown-editor .ProseMirror", { timeout: 30000 });
  const categorySelect = page.getByLabel("分区");
  await categorySelect.click();
  const firstActiveCategory = page.locator('[role="option"]:not([data-disabled])').first();
  await expect(firstActiveCategory).toBeVisible({ timeout: 15000 });
  await firstActiveCategory.click();
}
