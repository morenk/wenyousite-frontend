import { test, expect } from "@playwright/test";

const TEST_EMAIL = "test@wenyou.site";
const TEST_PASSWORD = "E2eTest123!";

/** 登录并发布一个测试帖，返回详情页 */
async function loginAndCreatePublishedThread(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.waitForSelector("#email", { state: "visible" });
  await page.fill("#email", TEST_EMAIL);
  await page.fill("#password", TEST_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL("/");

  await page.goto("/threads/create");
  await page.waitForSelector(".milkdown-editor .ProseMirror", { timeout: 30000 });

  await page.locator("#title").fill("管理面板测试帖 " + Date.now());

  const editor = page.locator(".ProseMirror");
  await editor.click();
  await editor.pressSequentially("这是管理面板测试正文。", { delay: 20 });
  // 等待字数统计更新为非 0（markdownUpdated 已触发、form.content 已写入）
  await expect(page.locator(".tabular-nums")).not.toHaveText(/^0\/10000$/);

  await page.getByText("发布").click();
  await page.waitForURL(/\/threads\/.+/, { timeout: 15000 });
}

test.describe("主题帖管理面板", () => {
  test("帖主管理子贴全流程", async ({ page }) => {
    await loginAndCreatePublishedThread(page);

    // 进入管理面板
    await page.getByRole("button", { name: "管理" }).click();
    await expect(page.getByText("返回浏览")).toBeVisible();
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

    // 删除刚创建的子贴（先注册 dialog 处理器，confirm 同步触发）
    page.once("dialog", (d) => d.accept());
    await page.locator("aside").getByTitle("删除子贴").click();
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
    const orderBefore = await treeList.innerText();

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
    const orderAfter = await treeList.innerText();
    expect(orderAfter).toBe(orderBefore);

    // 无"不能交换"提示或排序失败提示
    await expect(
      page.getByText("主帖必须保持在第一位，不能与其他子帖交换顺序"),
    ).not.toBeVisible();
    await expect(page.getByText(/排序保存失败/)).not.toBeVisible();
  });
});
