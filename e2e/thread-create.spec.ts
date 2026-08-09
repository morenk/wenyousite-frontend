import { test, expect } from "@playwright/test";
import { loginAsE2eUser, openFreshThreadDraft } from "./fixtures/auth";

test.describe("主题帖创建流程", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsE2eUser(page);
  });

  test("从登录到创建主题帖完整流程", async ({ page }) => {
    await openFreshThreadDraft(page);

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
    const publishBtn = page.getByRole("button", { name: "发布", exact: true });
    await expect(publishBtn).toBeEnabled();
    await publishBtn.click();

    // 验证跳转到详情页
    await page.waitForURL(/\/threads\//, { timeout: 15000 });
    expect(page.url()).toMatch(/\/threads\/.+/);
  });

  test("编辑器顶栏工具栏可见", async ({ page }) => {
    await openFreshThreadDraft(page);

    // 点击编辑器获取焦点，顶栏工具栏应可见（TopBar 固定工具栏）
    const editor = page.locator(".ProseMirror");
    await editor.click();

    const toolbar = page.getByRole("toolbar", { name: "正文格式工具栏" });
    await expect(toolbar).toBeVisible({ timeout: 5000 });

    // 顶栏恢复删除线、移除无序列表，并使用明确的五点骰面图标。
    await expect(toolbar.getByRole("button", { name: "删除线" })).toBeVisible();
    await expect(toolbar.getByRole("button", { name: "无序列表" })).toHaveCount(0);
    const diceButton = toolbar.getByRole("button", { name: "骰子" });
    await expect(diceButton.locator("rect[rx='4']")).toHaveCount(1);
    await expect(diceButton.locator("circle")).toHaveCount(5);
  });

  test("编辑器顶栏在窄容器保持单行并可横向滚动", async ({ page }) => {
    await openFreshThreadDraft(page);

    const host = page.locator(".milkdown-editor").first();
    const toolbar = page.getByRole("toolbar", { name: "正文格式工具栏" });
    await expect(toolbar).toBeVisible({ timeout: 5000 });
    await host.evaluate((element) => {
      element.style.width = "360px";
    });

    const metrics = await toolbar.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      itemTops: [
        ...element.querySelectorAll<HTMLElement>(
          ".top-bar-heading-button, .top-bar-item",
        ),
      ].map((item) => item.offsetTop),
    }));
    expect(
      Math.max(...metrics.itemTops) - Math.min(...metrics.itemTops),
    ).toBeLessThanOrEqual(4);
    expect(metrics.scrollWidth).toBeGreaterThan(metrics.clientWidth);

    await toolbar.evaluate((element) => {
      element.scrollLeft = element.scrollWidth;
    });
    const toolbarBox = await toolbar.boundingBox();
    const lastButtonBox = await toolbar.getByRole("button", { name: "正文草稿" }).boundingBox();
    expect(toolbarBox).not.toBeNull();
    expect(lastButtonBox).not.toBeNull();
    expect(lastButtonBox!.x + lastButtonBox!.width).toBeLessThanOrEqual(
      toolbarBox!.x + toolbarBox!.width + 1,
    );

    await toolbar.evaluate((element) => {
      element.scrollLeft = 0;
    });
    await toolbar.locator(".top-bar-heading-button").click();
    const headingMenu = toolbar.locator(".top-bar-heading-dropdown");
    await expect(headingMenu).toBeVisible();
    const menuBox = await headingMenu.boundingBox();
    expect(menuBox).not.toBeNull();
    expect(menuBox!.x).toBeGreaterThanOrEqual(8);
    expect(menuBox!.x + menuBox!.width).toBeLessThanOrEqual(
      (await page.evaluate(() => window.innerWidth)) - 8,
    );
  });

  test("上传并插入图片后编辑器工具栏仍可见", async ({ page }) => {
    await openFreshThreadDraft(page);

    const mediaId = "e2e-editor-toolbar";
    const pngBase64 =
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
    const uploadUrl = new URL("/e2e-object-upload", page.url()).toString();
    const imageUrl = `data:image/png;base64,${pngBase64}`;
    const media = {
      id: mediaId,
      userId: "e2e-user",
      url: imageUrl,
      thumbnailUrl: null,
      feedUrl: null,
      mediumUrl: null,
      key: "e2e/editor-toolbar.png",
      contentType: "image/png",
      size: 68,
      width: 1,
      height: 1,
      status: "COMPLETED",
      createdAt: "1970-01-01T00:00:00.000Z",
    };
    await page.route("**/api/v1/media/upload-url", async (route) => {
      await route.fulfill({
        json: {
          code: 0,
          message: "ok",
          data: {
            uploadUrl,
            mediaId,
            objectKey: media.key,
            publicUrl: imageUrl,
          },
        },
      });
    });
    await page.route("**/e2e-object-upload", async (route) => {
      await route.fulfill({ status: 200, body: "" });
    });
    await page.route("**/api/v1/media/upload-done", async (route) => {
      await route.fulfill({
        json: {
          code: 0,
          message: "ok",
          data: { media: { ...media, status: "PROCESSING" }, processing: true },
        },
      });
    });
    await page.route(`**/api/v1/media/${mediaId}`, async (route) => {
      await route.fulfill({ json: { code: 0, message: "ok", data: media } });
    });

    const imageButton = page.locator('.milkdown-top-bar .top-bar-item[title="图片"]').first();
    await expect(imageButton).toBeVisible();
    const chooserPromise = page.waitForEvent("filechooser");
    await imageButton.click();
    const chooser = await chooserPromise;
    await chooser.setFiles({
      name: "editor-toolbar.png",
      mimeType: "image/png",
      buffer: Buffer.from(pngBase64, "base64"),
    });

    await expect(page.locator(".milkdown-image-block img").first()).toBeVisible({ timeout: 45000 });
    await expect(page.locator(".milkdown-top-bar").first()).toBeVisible();
    await expect(imageButton).toBeVisible();
  });

  test("提交前校验：空标题发布被阻止", async ({ page }) => {
    await openFreshThreadDraft(page);

    // 直接点发布（标题为空时使用默认草稿标题）
    const publishBtn = page.getByRole("button", { name: "发布", exact: true });
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
    await openFreshThreadDraft(page);

    const cancelBtn = page.getByText("放弃");
    await expect(cancelBtn).toBeEnabled();
    await cancelBtn.click();
    await page.getByRole("button", { name: "放弃并删除" }).click();

    // 删除草稿后返回草稿选择器
    await expect(page.getByRole("button", { name: "新建主题帖" })).toBeVisible();
  });
});
