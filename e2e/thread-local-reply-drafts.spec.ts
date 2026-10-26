import { BRAND_NAME } from "@wenyousite/foundation/brand";
import { expect, type Page } from "@playwright/test";
import { test } from "./fixtures/isolation";
import { loginAsE2eUser, openFreshThreadDraft } from "./fixtures/auth";

async function createThread(page: Page) {
  await loginAsE2eUser(page);
  await openFreshThreadDraft(page);
  await page.locator("#title").fill("回复本地保存隔离回归");
  await page.locator(".ProseMirror").fill("隔离主题正文");
  await page.getByRole("button", { name: "发布", exact: true }).click();
  await page.waitForURL((url) => /^\/threads\/[^/]+$/.test(url.pathname) && url.pathname !== "/threads/create");
  return page.url();
}
async function openReply(page: Page) {
  await page.getByRole("button", { name: "发表回复…", exact: true }).click();
  const editor = page.getByRole("textbox", { name: "楼层正文", exact: true });
  await expect(editor).toBeVisible();
  return editor;
}

test("关闭云自动保存的真实回复编辑器：站内离开、外部返回、刷新与重开标签恢复，成功发表清稿", async ({ page, context }) => {
  test.setTimeout(120_000);
  const url = await createThread(page);
  const cloudWrites: string[] = [];
  context.on("request", (request) => {
    if (/\/api\/v1\/drafts(?:\/|$)/.test(new URL(request.url()).pathname) && !["GET", "HEAD"].includes(request.method())) cloudWrites.push(request.method());
  });
  let editor = await openReply(page);
  // 显式核验云保存关闭，后续本地恢复不启用它。
  await page.getByRole("button", { name: "正文草稿", exact: true }).click();
  await expect(page.getByRole("switch", { name: "自动保存到草稿 1" })).toHaveAttribute("aria-checked", "false");
  await page.getByRole("button", { name: "收起正文草稿" }).click();
  await editor.fill("站内导航后保留");
  const home = page.getByRole("link", { name: BRAND_NAME + "首页", exact: true }).first();
  await home.click();
  await page.waitForURL("/");
  await page.goBack();
  editor = await openReply(page);
  await expect(editor).toHaveText("站内导航后保留");
  await editor.fill("最后文字立即刷新");
  await page.reload();
  editor = await openReply(page);
  await expect(editor).toHaveText("最后文字立即刷新");
  await page.goto("about:blank");
  await page.goBack();
  editor = await openReply(page);
  await expect(editor).toHaveText("最后文字立即刷新");
  const reopened = await context.newPage();
  await page.close();
  await reopened.goto(url);
  editor = await openReply(reopened);
  await expect(editor).toHaveText("最后文字立即刷新");
  await reopened.screenshot({ path: test.info().outputPath("local-reply-restored.png"), fullPage: true });
  await reopened.getByRole("button", { name: "发布", exact: true }).click();
  await expect(reopened.getByText("发布成功", { exact: true }).first()).toBeVisible();
  await reopened.reload();
  editor = await openReply(reopened);
  await expect(editor).toBeEmpty();
  expect(cloudWrites).toEqual([]);
});


test("两个真实标签并发输入后通过条件恢复按钮取回双方正文", async ({ page, context }) => {
  test.setTimeout(120_000);
  const url = await createThread(page);
  const first = await openReply(page);
  await first.fill("共同起点");
  const secondPage = await context.newPage();
  await secondPage.goto(url);
  const second = await openReply(secondPage);
  await expect(second).toHaveText("共同起点");
  await first.fill("第一标签的正文");
  await second.fill("第二标签的正文");
  const recover = secondPage.getByRole("button", { name: "恢复另一份本地稿", exact: true });
  await expect(recover).toBeVisible();
  await recover.click();
  await secondPage.getByRole("button", { name: "恢复", exact: true }).click();
  await expect(secondPage.getByRole("textbox", { name: "楼层正文", exact: true })).toHaveText("第一标签的正文");
  await recover.click();
  await secondPage.getByRole("button", { name: "恢复", exact: true }).click();
  await expect(secondPage.getByRole("textbox", { name: "楼层正文", exact: true })).toHaveText("第二标签的正文");
});
