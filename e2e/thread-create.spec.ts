import { test, expect } from "@playwright/test";

const TEST_EMAIL = "test@wenyou.site";
const TEST_PASSWORD = "E2eTest123!";

test.describe("主题帖创建流程", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    const loginInput = page.getByLabel("邮箱或用户名");
    await loginInput.waitFor({ state: "visible" });

    await loginInput.fill(TEST_EMAIL);
    await page.getByLabel("密码").fill(TEST_PASSWORD);
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

  test("编辑器顶栏工具栏可见", async ({ page }) => {
    await page.goto("/threads/create");
    await page.waitForSelector(".milkdown-editor .ProseMirror", {
      timeout: 30000,
    });

    // 点击编辑器获取焦点，顶栏工具栏应可见（TopBar 固定工具栏）
    const editor = page.locator(".ProseMirror");
    await editor.click();

    const topBar = page.locator(".milkdown-top-bar .top-bar-item");
    await expect(topBar.first()).toBeVisible({ timeout: 5000 });

    // 顶栏按钮带中文本地化 tooltip
    const boldBtn = topBar.nth(0);
    await boldBtn.hover();
    await expect(boldBtn).toHaveAttribute("title", /粗体|斜体|删除线|行内代码/);
  });

  test("上传并插入图片后编辑器工具栏仍可见", async ({ page }) => {
    await page.goto("/threads/create");
    const createButton = page.getByRole("button", { name: "新建主题帖" });
    if (await createButton.isVisible().catch(() => false)) {
      await createButton.click();
    }
    await page.waitForSelector(".milkdown-editor .ProseMirror", { timeout: 30000 });

    const imageButton = page.locator('.milkdown-top-bar .top-bar-item[title="图片"]').first();
    await expect(imageButton).toBeVisible();
    const chooserPromise = page.waitForEvent("filechooser");
    await imageButton.click();
    const chooser = await chooserPromise;
    await chooser.setFiles("public/globe.svg");

    await expect(page.locator(".milkdown-image-block img").first()).toBeVisible({ timeout: 45000 });
    await expect(page.locator(".milkdown-top-bar").first()).toBeVisible();
    await expect(imageButton).toBeVisible();
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
    expect(new URL(page.url()).pathname).toBe("/");
  });
});
