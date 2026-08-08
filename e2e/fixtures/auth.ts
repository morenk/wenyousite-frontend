import { expect, type Page } from "@playwright/test";

function requiredCredential(name: "E2E_EMAIL" | "E2E_PASSWORD") {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} 未配置；请参考 .env.e2e.example 使用专用测试账号`);
  }
  return value;
}

export async function loginAsE2eUser(page: Page) {
  await page.goto("/login");
  const loginInput = page.getByLabel("邮箱或用户名");
  await loginInput.waitFor({ state: "visible" });
  await loginInput.fill(requiredCredential("E2E_EMAIL"));
  await page.getByLabel("密码").fill(requiredCredential("E2E_PASSWORD"));
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await page.waitForURL("/");
}

/** 每个用例显式新建草稿，避免复用测试账号遗留草稿造成选择器分叉。 */
export async function openFreshThreadDraft(page: Page) {
  await page.goto("/threads/create");
  const createButton = page.getByRole("button", { name: "新建主题帖" });
  await expect(createButton).toBeVisible();
  await createButton.click();
  await page.waitForSelector(".milkdown-editor .ProseMirror", { timeout: 30000 });
  const categorySelect = page.getByLabel("分区");
  const firstActiveCategory = categorySelect.locator('option:not([value=""]):not([disabled])').first();
  await expect(firstActiveCategory).toBeAttached({ timeout: 15000 });
  const categorySlug = await firstActiveCategory.getAttribute("value");
  if (!categorySlug) throw new Error("测试环境没有可用主题帖分类");
  await categorySelect.selectOption(categorySlug);
}
