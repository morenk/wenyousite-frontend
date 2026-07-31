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

  test("子贴与楼层管理流程", async ({ page }) => {
    await page.goto("/threads/create");
    await page.waitForSelector(".milkdown-editor .ProseMirror", {
      timeout: 30000,
    });

    // 添加子贴
    await page.getByText("添加子贴").click();
    const subTitleInput = page.getByPlaceholder("主帖 / 设定区 / 剧情区");
    await expect(subTitleInput).toBeVisible();
    await subTitleInput.fill("设定区");
    await page.getByRole("button", { name: "添加", exact: true }).click();

    // 等待子贴出现在列表中
    await expect(page.getByText("设定区").first()).toBeVisible({ timeout: 10000 });

    // 展开新子贴，出现楼层区域
    await page.getByText("设定区").first().click();
    await expect(page.getByText("该子贴暂无楼层")).toBeVisible({ timeout: 10000 });

    // 点击新子贴楼层列表的添加按钮（作用域限定到空态文本所在容器）
    await page
      .getByText("该子贴暂无楼层")
      .locator("xpath=..")
      .getByText("添加楼层")
      .click();

    // 编辑器接管，输入楼层内容
    const editor = page.locator(".milkdown-editor .ProseMirror");
    await editor.click();
    await editor.pressSequentially("设定区首楼内容", { delay: 20 });

    // 等待字数统计更新（markdownUpdated 异步触发，确保 form.content 已写入）
    await expect(page.locator(".tabular-nums")).toHaveText(/8\/10000/);

    // 点击编辑器保存按钮（作用域限定到"正在编辑"标签所在容器）
    await page
      .getByText("正在编辑：设定区 的新楼层")
      .locator("xpath=..")
      .getByRole("button", { name: "添加楼层", exact: true })
      .click();

    // 等待 toast 提示
    await expect(page.getByText("楼层已添加").first()).toBeVisible({
      timeout: 10000,
    });

    // 楼层内容应出现在列表
    await expect(page.getByText("设定区首楼内容")).toBeVisible({
      timeout: 10000,
    });
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
