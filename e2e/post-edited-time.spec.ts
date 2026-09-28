import { resolve } from "node:path";
import { THEME_PALETTES } from "@wenyousite/foundation/theme";
import { expect, type Locator, type Page } from "@playwright/test";
import { test } from "./fixtures/typography";
import { loginAsE2eUser, openFreshThreadDraft } from "./fixtures/auth";
import type { components } from "../src/api/types";

type Post = components["schemas"]["PostResponseDto"];

async function writeEditor(page: Page, content: string) {
  const editor = page.locator(".milkdown-editor .ProseMirror");
  await expect(editor).toHaveCount(1);
  await editor.click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.press("Backspace");
  await editor.pressSequentially(content, { delay: 10 });
  await expect(page.locator(".tabular-nums").filter({ hasText: /^\d+\/10000$/u }))
    .toHaveText(`${content.length}/10000`);
}

async function saveEdit(page: Page, card: Locator, menu: string, id: string, content?: string): Promise<Post> {
  await card.getByRole("button", { name: menu, exact: true }).click();
  await page.getByRole("menuitem", { name: "编辑", exact: true }).click();
  await expect(page.locator(".milkdown-editor .ProseMirror")).toBeVisible();
  if (content !== undefined) await writeEditor(page, content);
  const saved = page.waitForResponse((response) =>
    new URL(response.url()).pathname === `/api/v1/posts/${id}` && response.request().method() === "PATCH");
  await page.getByRole("button", { name: "保存修改", exact: true }).click();
  const response = await saved;
  expect(response.status()).toBe(200);
  const post: Post = (await response.json()).data;
  await expect(page.locator(".milkdown-editor .ProseMirror")).toHaveCount(0);
  return post;
}

async function expectEditedTime(time: Locator, editedAt: string) {
  await expect(time).toHaveCount(1);
  await expect(time).toHaveAttribute("datetime", editedAt);
  await expect(time).toHaveText(/^编辑于/u);
  await expect(time).toHaveAttribute("title", /^编辑于\d{4}-\d{2}-\d{2}$/u);
  await expect(time).toHaveAttribute("aria-label", (await time.getAttribute("title"))!);
}

// 继承隔离 fixture：登录和写入前核验本轮资源身份，所有业务数据由 runner 清理。
test("真实 API 编辑后只展示编辑时间，原位刷新、无改动与跨页阅读一致", async ({ page }) => {
  test.setTimeout(180_000);
  await loginAsE2eUser(page);
  await openFreshThreadDraft(page);
  await page.locator("#title").fill(`编辑时间隔离回归 ${Date.now()}`);
  await writeEditor(page, "编辑时间回归的主题正文");
  await page.getByRole("button", { name: "发布", exact: true }).click();
  await page.waitForURL(/\/threads\/(?!create$)[^/]+$/u);
  const threadUrl = page.url();

  await page.getByRole("button", { name: "发表回复…", exact: true }).click();
  await writeEditor(page, "等待编辑的主楼层");
  const floorCreated = page.waitForResponse((response) =>
    /\/subthreads\/[^/]+\/posts$/u.test(new URL(response.url()).pathname) && response.request().method() === "POST");
  await page.getByRole("button", { name: "发布", exact: true }).click();
  const original: Post = (await (await floorCreated).json()).data;
  const floor = page.locator(`#post-${original.id}`);
  const floorTime = floor.getByTestId("floor-card-meta").locator("time");
  await expect(floorTime).toHaveAttribute("datetime", original.createdAt);
  await expect(floorTime).not.toHaveText(/^编辑于/u);

  const first = await saveEdit(page, floor, "更多楼层操作", original.id, "主楼层首次编辑");
  expect(first.editedAt).toBeTruthy();
  await expectEditedTime(floorTime, first.editedAt!);
  const second = await saveEdit(page, floor, "更多楼层操作", original.id, "主楼层再次编辑");
  expect(Date.parse(second.editedAt!)).toBeGreaterThan(Date.parse(first.editedAt!));
  await expectEditedTime(floorTime, second.editedAt!);
  const unchanged = await saveEdit(page, floor, "更多楼层操作", original.id);
  expect(unchanged.editedAt).toBe(second.editedAt);
  await expectEditedTime(floorTime, second.editedAt!);

  // 取消不会触发保存或改写显示时间。
  const writes: string[] = [];
  const record = (request: import("@playwright/test").Request) => {
    if (request.method() === "PATCH") writes.push(request.url());
  };
  page.on("request", record);
  await floor.getByRole("button", { name: "更多楼层操作" }).click();
  await page.getByRole("menuitem", { name: "编辑", exact: true }).click();
  await page.getByRole("button", { name: "取消", exact: true }).click();
  await expect(page.locator(".milkdown-editor .ProseMirror")).toHaveCount(0);
  expect(writes).toEqual([]);
  page.off("request", record);
  await expectEditedTime(floorTime, second.editedAt!);

  const discussionUrl = `${threadUrl}/posts/${original.id}/replies`;
  await page.goto(discussionUrl);
  await expectEditedTime(page.locator(`time[datetime="${second.editedAt}"]`), second.editedAt!);
  await page.getByRole("button", { name: "发表回复…", exact: true }).click();
  await writeEditor(page, "等待编辑的楼中楼");
  const replyCreated = page.waitForResponse((response) =>
    /\/subthreads\/[^/]+\/posts$/u.test(new URL(response.url()).pathname) && response.request().method() === "POST");
  await page.getByRole("button", { name: "回复", exact: true }).click();
  const reply: Post = (await (await replyCreated).json()).data;
  const replyCard = page.locator(`#post-${reply.id}`);
  await expect(replyCard.locator("time")).toHaveAttribute("datetime", reply.createdAt);
  const editedReply = await saveEdit(page, replyCard, "更多回复操作", reply.id, "楼中楼已编辑正文");
  await expectEditedTime(replyCard.locator("time"), editedReply.editedAt!);
  await page.reload();
  await expectEditedTime(replyCard.locator("time"), editedReply.editedAt!);
  await expectEditedTime(page.locator(`time[datetime="${second.editedAt}"]`), second.editedAt!);

  // 同一真实隔离候选覆盖明暗与较窄 PC 视口，不引入移动产品布局。
  for (const surface of ["discussion", "preview"] as const) {
    await page.goto(surface === "discussion" ? discussionUrl : threadUrl);
    await expectEditedTime(page.locator(`#post-${reply.id} time`), editedReply.editedAt!);
    if (surface === "preview") {
      await expectEditedTime(floorTime, second.editedAt!);
      await expect(floor.getByTestId("inline-reply")).toHaveCount(1);
    }
    for (const width of [1440, 1024]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const theme of ["light", "dark"] as const) {
        await page.getByRole("button", { name: /^外观：/u }).click();
        await page.getByText(theme === "dark" ? "黑夜" : "亮色", { exact: true }).click();
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        await expect(page.locator("html")).toHaveCSS("color-scheme", theme);
        await expect(page.locator('[data-slot="theme-menu-popup"]')).toBeHidden();
        const background = await page.evaluate((color) => {
          const probe = document.createElement("span");
          probe.style.backgroundColor = color;
          document.body.append(probe);
          const result = getComputedStyle(probe).backgroundColor;
          probe.remove();
          return result;
        }, THEME_PALETTES[theme].background);
        await expect(page.locator("body")).toHaveCSS("background-color", background);
        await expect(page.locator(`#post-${reply.id} time`)).toBeVisible();
        await page.screenshot({ path: resolve(`.e2e-results/post-edited-time-${surface}-${theme}-${width}.png`), fullPage: true });
      }
    }
  }
});
