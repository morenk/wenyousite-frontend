import { test, expect } from "@playwright/test";

const TEST_EMAIL = "test@wenyou.site";
const TEST_PASSWORD = "E2eTest123!";

test.describe("主题帖创建流程", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.waitForSelector("#email", { state: "visible" });

    await page.fill("#email", TEST_EMAIL);
    await page.fill("#password", TEST_PASSWORD);
    await page.click('button[type="submit"]');

    await page.waitForURL("/");
  });

  test("从登录到创建主题帖完整流程", async ({ page }) => {
    await page.goto("/threads/create");
    await page.waitForURL("/threads/create");

    // 等待编辑器加载完成
    await page.waitForSelector(".milkdown-editor .ProseMirror", {
      timeout: 30000,
    });

    // 填写标题
    const titleInput = page.locator("#title");
    await expect(titleInput).toBeVisible();
    await titleInput.fill("E2E 测试帖 " + Date.now());

    // 在编辑器输入正文
    const editor = page.locator(".ProseMirror");
    await editor.click();
    await editor.pressSequentially("这是 E2E 测试正文内容。", { delay: 20 });

    // 验证字数统计出现
    const charCountEl = page.locator(".tabular-nums");
    await expect(charCountEl).toBeVisible();

    // 点击保存草稿
    const saveBtn = page.getByText("保存草稿");
    await expect(saveBtn).toBeEnabled();
    await saveBtn.click();

    // 等待 toast 提示
    await expect(page.getByText("草稿已保存").first()).toBeVisible({
      timeout: 10000,
    });

    // 点击发布
    const publishBtn = page.getByText("发布");
    await expect(publishBtn).toBeEnabled();
    await publishBtn.click();

    // 验证跳转到详情页
    await page.waitForURL(/\/threads\//, { timeout: 15000 });
    expect(page.url()).toMatch(/\/threads\/.+/);
  });

  test("编辑器工具栏可见", async ({ page }) => {
    await page.goto("/threads/create");
    await page.waitForSelector(".milkdown-editor .ProseMirror", {
      timeout: 30000,
    });

    // 点击编辑器获取焦点，工具栏应出现
    const editor = page.locator(".ProseMirror");
    await editor.click();

    // 工具栏是浮动在选区上方的，但可能不会自动显示（需要选中文字）
    // 至少验证斜杠菜单可以触发
    await editor.pressSequentially("/", { delay: 50 });
    // 斜杠菜单应该出现
    const slashMenu = page.locator(".milkdown-slash-menu");
    await expect(slashMenu.first()).toBeVisible({ timeout: 5000 });
  });

  test("提交前校验：空标题发布被阻止", async ({ page }) => {
    await page.goto("/threads/create");
    await page.waitForSelector(".milkdown-editor .ProseMirror", {
      timeout: 30000,
    });

    // 直接点发布（标题为空时使用默认草稿标题）
    const publishBtn = page.getByText("发布");
    await expect(publishBtn).toBeEnabled();
    await publishBtn.click();

    // 应显示 toast 提示缺少标题
    await expect(page.getByText(/标题/).first()).toBeVisible({
      timeout: 5000,
    });

    // 仍在创建页
    expect(page.url()).toContain("/threads/create");
  });

  test("放弃创建：点击放弃按钮", async ({ page }) => {
    // 用 dialog handler 监听 confirm
    page.on("dialog", (dialog) => dialog.accept());

    await page.goto("/threads/create");
    await page.waitForSelector(".milkdown-editor .ProseMirror", {
      timeout: 30000,
    });

    const cancelBtn = page.getByText("放弃");
    await expect(cancelBtn).toBeEnabled();
    await cancelBtn.click();

    // 应跳回首页
    await page.waitForURL("/", { timeout: 10000 });
    expect(page.url()).toBe("http://localhost:3001/");
  });
});
