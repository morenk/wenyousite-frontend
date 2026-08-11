import { test, expect } from "@playwright/test";
import { loginAsE2eUser, openFreshThreadDraft } from "./fixtures/auth";

/** 登录并发布一个测试帖，返回详情页 */
async function loginAndCreatePublishedThread(page: import("@playwright/test").Page) {
  await loginAsE2eUser(page);
  await openFreshThreadDraft(page);

  await page.locator("#title").fill("管理面板测试帖 " + Date.now());

  const editor = page.locator(".ProseMirror");
  await editor.click();
  await editor.pressSequentially("这是管理面板测试正文。", { delay: 20 });
  // 等待字数统计更新为非 0（markdownUpdated 已触发、form.content 已写入）
  await expect(page.locator(".tabular-nums")).not.toHaveText(/^0\/10000$/);

  await page.getByText("发布").click();
  // 等待跳转到详情页（threadId 由后端生成，非 create）
  await page.waitForFunction(
    () => /\/threads\/[^/]+$/.test(location.pathname) && location.pathname !== "/threads/create",
    undefined,
    { timeout: 15000 },
  );
}

/** 在详情页用 MD 编辑器发布一楼新楼层 */
async function postFloor(page: import("@playwright/test").Page, content: string) {
  await page.getByRole("button", { name: "发表回复…" }).click();
  const editor = page.locator(".milkdown-editor .ProseMirror");
  await expect(editor.first()).toBeVisible();
  await editor.first().click();
  await editor.first().pressSequentially(content, { delay: 20 });
  // 等待字数统计更新为非 0（markdownUpdated 已触发）
  await expect(page.locator(".tabular-nums").first()).not.toHaveText(/^0\/10000$/);
  await page.getByRole("button", { name: "发布" }).click();
  await expect(page.getByText("发布成功").first()).toBeVisible({ timeout: 10000 });
}

test.describe("主题帖管理面板", () => {
  test("帖主管理子贴全流程", async ({ page }) => {
    await loginAndCreatePublishedThread(page);

    // 进入管理面板
    await page.getByRole("button", { name: "管理" }).click();
    await expect(page.getByText("返回浏览")).toBeVisible();
    await page.getByRole("button", { name: "子贴", exact: true }).click();
    await expect(page.getByText("子贴目录")).toBeVisible();

    // 添加子贴
    await page.getByText("添加子贴").click();
    const subInput = page.getByPlaceholder("主帖 / 设定区 / 剧情区");
    await expect(subInput).toBeVisible();
    await subInput.fill("设定区");
    await page.getByRole("button", { name: "添加", exact: true }).click();
    await expect(page.getByText("子贴已创建").first()).toBeVisible({ timeout: 10000 });

    // 新子贴出现在目录树
    await expect(page.locator("aside").getByText("设定区")).toBeVisible({ timeout: 10000 });

    // 选中新子贴，编辑器清空
    await page.locator("aside").getByText("设定区").click();
    await expect(page.getByText("正在编辑：设定区")).toBeVisible();

    // 编辑正文并保存
    const editor = page.locator(".milkdown-editor .ProseMirror");
    await editor.click();
    await editor.pressSequentially("设定区世界观设定。", { delay: 20 });
    await expect(page.locator(".tabular-nums")).not.toHaveText(/^0\/10000$/);
    await page.getByText("保存修改").click();
    await expect(page.getByText("正文已保存").first()).toBeVisible({ timeout: 10000 });

    // 删除刚创建的子贴
    await page.locator("aside").getByTitle("删除子贴").click();
    await page.getByRole("button", { name: "删除", exact: true }).click();
    await expect(page.getByText("子贴已删除").first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator("aside").getByText("设定区")).not.toBeVisible();

    // 返回浏览
    await page.getByText("返回浏览").click();
    await expect(page.getByRole("button", { name: "管理" })).toBeVisible();
  });

  test("拖拽排序子贴", async ({ page }) => {
    await loginAndCreatePublishedThread(page);

    // 进入管理面板
    await page.getByRole("button", { name: "管理" }).click();
    await expect(page.getByText("返回浏览")).toBeVisible();
    await page.getByRole("button", { name: "子贴", exact: true }).click();

    const aside = page.locator("aside");

    // 添加两个非默认子贴（等待每个子贴真实出现在树中，不依赖 toast）
    for (const title of ["设定区", "剧情区"]) {
      await page.getByText("添加子贴").click();
      await page.getByPlaceholder("主帖 / 设定区 / 剧情区").fill(title);
      await page.getByRole("button", { name: "添加", exact: true }).click();
      await expect(aside.getByText(title)).toBeVisible({ timeout: 10000 });
    }

    // 拖拽"设定区"（第 2 个节点）到"剧情区"之后：默认子贴保持首位，重排为 [默认, 剧情区, 设定区]
    const handle = aside.getByTitle("拖拽排序").nth(1);
    const target = aside.getByText("剧情区");
    const from = await handle.boundingBox();
    const to = await target.boundingBox();
    if (!from || !to) throw new Error("无法获取拖拽元素位置");

    const reorderResponse = page.waitForResponse(
      (res) =>
        res.url().includes("/subthreads/reorder") &&
        res.request().method() === "PUT",
      { timeout: 10000 },
    );

    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, {
      steps: 12,
    });
    await page.mouse.up();

    // 等待 reorder 请求成功返回
    const reorderRes = await reorderResponse;
    expect(reorderRes.status()).toBe(200);

    // 树中仍保留所有子贴（默认子贴标题已跟随帖子标题，用主帖徽章断言）
    await expect(aside.getByText("主帖")).toBeVisible();
    await expect(aside.getByText("设定区")).toBeVisible();
    await expect(aside.getByText("剧情区")).toBeVisible();
  });

  test("拖拽子贴到主帖位置不触发交换且无错误提示", async ({ page }) => {
    await loginAndCreatePublishedThread(page);

    await page.getByRole("button", { name: "管理" }).click();
    await expect(page.getByText("返回浏览")).toBeVisible();
    await page.getByRole("button", { name: "子贴", exact: true }).click();

    const aside = page.locator("aside");

    // 添加两个非默认子贴
    for (const title of ["设定区", "剧情区"]) {
      await page.getByText("添加子贴").click();
      await page.getByPlaceholder("主帖 / 设定区 / 剧情区").fill(title);
      await page.getByRole("button", { name: "添加", exact: true }).click();
      await expect(aside.getByText(title)).toBeVisible({ timeout: 10000 });
    }

    // 记录拖拽前的树顺序
    const treeList = aside.locator("div.overflow-y-auto").first();
    const treeNodes = treeList.locator(':scope > div[class*="cursor-pointer"]');
    const orderBefore = await treeNodes.allTextContents();

    // 拖拽"设定区"（第 2 个节点）到主帖位置：主帖不作为落点，应被操作层拦截
    const handle = aside.getByTitle("拖拽排序").nth(1);
    const mainPost = aside.getByText("主帖").first();
    const from = await handle.boundingBox();
    const to = await mainPost.boundingBox();
    if (!from || !to) throw new Error("无法获取拖拽元素位置");

    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, {
      steps: 12,
    });
    await page.mouse.up();

    // 顺序不变（主帖保持首位）
    const orderAfter = await treeNodes.allTextContents();
    expect(orderAfter).toEqual(orderBefore);

    // 无"不能交换"提示或排序失败提示
    await expect(
      page.getByText("主帖必须保持在第一位，不能与其他子帖交换顺序"),
    ).not.toBeVisible();
    await expect(page.getByText(/排序保存失败/)).not.toBeVisible();
  });
});

test.describe("已发布帖统一管理", () => {
  test("帖主在管理界面编辑标题，保存后留在管理界面", async ({ page }) => {
    await loginAndCreatePublishedThread(page);
    const threadUrl = page.url();

    // 详情页只保留统一管理入口，默认打开主题帖页签
    await expect(page.getByRole("button", { name: "编辑" })).not.toBeVisible();
    await page.getByRole("button", { name: "管理" }).click();
    await expect(page).toHaveURL(`${threadUrl}/edit`);
    await expect(page.getByRole("button", { name: "主题帖" })).toBeVisible();

    // 修改标题
    const titleInput = page.locator("#title");
    const newTitle = "已编辑标题 " + Date.now();
    await titleInput.fill(newTitle);

    // 保存修改
    await page.getByRole("button", { name: "保存修改" }).click();
    await expect(page.getByText("修改已保存").first()).toBeVisible({ timeout: 10000 });

    // 保存后仍在管理界面，返回浏览后显示新标题
    await expect(page).toHaveURL(`${threadUrl}/edit`);
    await expect(page.getByText(`管理帖子：${newTitle}`)).toBeVisible({ timeout: 10000 });
    await page.getByRole("button", { name: "返回浏览" }).click();
    await expect(page.locator("h1")).toHaveText(newTitle, { timeout: 10000 });
  });

  test("旧编辑链接复用统一管理界面，匿名访问仍跳登录", async ({ page }) => {
    await loginAndCreatePublishedThread(page);
    const threadUrl = page.url();
    const threadId = threadUrl.split("/").pop();

    // 已发布帖旧链接进入相同管理面板
    await page.goto(`/threads/${threadId}/edit`);
    await expect(page.getByText(/管理帖子：/)).toBeVisible();
    await expect(page.getByRole("button", { name: "主题帖" })).toBeVisible();

    // 登出后访问应跳转登录
    await page.context().clearCookies();
    await page.goto(`/threads/${threadId}/edit`);
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("楼层编辑与删除", () => {
  test("作者编辑楼层正文", async ({ page }) => {
    await loginAndCreatePublishedThread(page);

    // 发布一楼楼层
    await postFloor(page, "待编辑的楼层正文");

    // 找到刚发布的楼层卡片（含该正文）
    const floorCard = page.locator(".rounded-xl.border").filter({ hasText: "待编辑的楼层正文" });
    await expect(floorCard.first()).toBeVisible();

    // 从卡片右上角操作菜单进入编辑
    await floorCard.first().getByRole("button", { name: "更多楼层操作" }).click();
    await page.getByRole("menuitem", { name: "编辑" }).click();
    // 编辑态编辑器在楼层卡片内、DOM 中先于底部发布表单编辑器，取第一个
    const editEditor = page.locator(".milkdown-editor .ProseMirror").first();
    await expect(editEditor).toBeVisible();
    // 全选删除后键入（fill 不触发 ProseMirror 的 markdownUpdated）
    await editEditor.click();
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.press("Backspace");
    await editEditor.pressSequentially("编辑后的楼层正文", { delay: 20 });
    // 等待 markdownUpdated 异步写入编辑器内容 + React state flush
    await expect(editEditor).toContainText("编辑后的楼层正文", { timeout: 10000 });
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: "保存" }).click();

    // 等待保存提示并验证新正文渲染（自动重试直到楼层列表刷新完成）
    await expect(page.getByText("已保存").first()).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByText("编辑后的楼层正文").first(),
    ).toBeVisible({ timeout: 10000 });
  });

  test("作者删除楼层", async ({ page }) => {
    await loginAndCreatePublishedThread(page);

    // 发布一楼楼层（楼层均可删除，子贴正文由后端拦截）
    await postFloor(page, "待删除的楼层正文");

    const floorCard = page
      .locator(".rounded-xl.border")
      .filter({ hasText: "待删除的楼层正文" })
      .first();
    await expect(floorCard).toBeVisible();

    // 从卡片右上角操作菜单删除，并在站内确认框确认
    await floorCard.getByRole("button", { name: "更多楼层操作" }).click();
    await page.getByRole("menuitem", { name: "删除" }).click();
    await page.getByRole("button", { name: "删除", exact: true }).click();

    await expect(page.getByText("楼层已删除").first()).toBeVisible({ timeout: 10000 });
    await expect(
      page.locator(".rounded-xl.border").filter({ hasText: "待删除的楼层正文" }),
    ).not.toBeVisible({ timeout: 10000 });
  });
});

test.describe("楼中楼回复", () => {
  test("独立楼中楼编辑器上传图片后工具栏仍可见", async ({ page }) => {
    await loginAndCreatePublishedThread(page);
    await postFloor(page, "图片上传测试楼层");

    const floorCard = page
      .locator(".rounded-xl.border")
      .filter({ hasText: "图片上传测试楼层" })
      .first();
    await floorCard.getByRole("button", { name: "更多楼层操作" }).click();
    await page.getByRole("menuitem", { name: "回复" }).click();
    await expect(page.getByText("楼中楼讨论").first()).toBeVisible();
    await page.getByRole("button", { name: "参与讨论" }).click();

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

  test("进入独立楼中楼页面并回复原楼层", async ({ page }) => {
    await loginAndCreatePublishedThread(page);

    // 发布一楼楼层
    await postFloor(page, "主楼正文");

    // 找到楼层卡片并进入独立楼中楼阅读页
    const floorCard = page
      .locator(".rounded-xl.border")
      .filter({ hasText: "主楼正文" })
      .first();
    await expect(floorCard).toBeVisible();

    await floorCard.getByRole("button", { name: "更多楼层操作" }).click();
    await page.getByRole("menuitem", { name: "回复" }).click();
    await page.getByRole("button", { name: "参与讨论" }).click();
    const replyEditor = page.locator(".milkdown-editor .ProseMirror").first();
    await expect(replyEditor).toBeVisible({ timeout: 10000 });

    await replyEditor.click();
    await replyEditor.pressSequentially("楼中楼回复内容", { delay: 20 });
    // 等待 markdownUpdated 写入 + React state flush（页面首个 tabular-nums 变为非 0）
    await expect(page.locator(".tabular-nums").first()).not.toHaveText(/^0\/10000$/);
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: "回复" }).click();

    // 等待回复成功 + 回复内容渲染
    await expect(page.getByText("回复成功").first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("楼中楼回复内容").first()).toBeVisible({ timeout: 10000 });

    // 独立讨论页回复数更新为 1
    await expect(page.getByText("共 1 条回复").first()).toBeVisible({ timeout: 10000 });
  });
});
