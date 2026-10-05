import { expect, type Page } from "@playwright/test";
import { captureRpWrites, latestRpWrite } from "./fixtures/rp-browser";
import { test } from "./fixtures/isolation";
import { loginAsE2eUser, openFreshThreadDraft } from "./fixtures/auth";

const responseFor = (page: Page, method: string, suffix: string) => page.waitForResponse((response) =>
  response.request().method() === method && new URL(response.url()).pathname.endsWith(suffix) && response.ok());
const openChoice = (page: Page) => page.getByRole("button", { name: "发表身份", exact: true }).click();
const openComposer = (page: Page) => page.getByRole("button", { name: "发表回复…", exact: true }).click();

test("多身份创建、逐条选择、同角色历史卡和归档确认保留账号权属", async ({ page }) => {
  test.setTimeout(180000);
  await captureRpWrites(page);
  await loginAsE2eUser(page);
  await openFreshThreadDraft(page);
  await page.getByLabel("主题帖标题").fill("多身份隔离验收 " + Date.now());
  await page.locator(".ProseMirror").fill("正文在开启身份前发表。");
  await page.getByRole("button", { name: "发布", exact: true }).click();
  await page.waitForURL((url) => /^\/threads\/[^/]+$/.test(url.pathname) && url.pathname !== "/threads/create");
  const threadPath = new URL(page.url()).pathname;
  await page.goto(threadPath + "/edit");
  const enabled = responseFor(page, "PATCH", "/identity-settings");
  await page.getByRole("button", { name: "启用帖内身份" }).click();
  await enabled;
  await page.goto(threadPath);
  await openComposer(page);
  let denyCollectionRefresh = false;
  await page.route("**/api/v1/threads/*/rp-identities", (route) => {
    if (denyCollectionRefresh && route.request().method() === "GET") return route.fulfill({
      status: 503, json: { code: 50000, message: "隔离测试：集合刷新失败" },
    });
    return route.continue();
  });
  const create = async (name: string, first: boolean, failRefresh = false) => {
    await openChoice(page);
    await page.getByRole("menuitem", { name: first ? "设置帖内身份" : "新增帖内身份", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "设置帖内身份", exact: true });
    await dialog.getByLabel("帖内昵称").fill(name);
    const refreshFailure = failRefresh ? page.waitForResponse((response) =>
      response.status() === 503 && new URL(response.url()).pathname.endsWith("/rp-identities")) : undefined;
    denyCollectionRefresh = failRefresh;
    const response = responseFor(page, "POST", "/rp-identities");
    await dialog.getByRole("button", { name: "创建身份", exact: true }).click();
    const saved = (await (await response).json()).data;
    await expect(dialog).not.toBeVisible();
    await expect(page.getByRole("button", { name: "发表身份" })).toContainText(name);
    if (refreshFailure) await refreshFailure;
    denyCollectionRefresh = false;
    return saved.identityId as string;
  };
  const a = await create("白鸦", true);
  const b = await create("夜渡", false, true);
  expect(a === b).toBe(false);
  const publish = async (content: string, identityId?: string) => {
    const editor = page.getByRole("textbox", { name: "楼层正文", exact: true });
    await editor.fill(content);
    const pending = page.waitForResponse((response) => response.request().method() === "POST" &&
      /\/subthreads\/[^/]+\/posts$/.test(new URL(response.url()).pathname) && response.ok());
    await page.getByRole("button", { name: "发布", exact: true }).click();
    const response = await pending;
    const input = await latestRpWrite(page, "POST");
    expect(input.identityMode).toBe(identityId ? "RP" : "ACCOUNT");
    expect(input.identityId).toBe(identityId);
    const post = (await response.json()).data;
    expect(post.author.rpIdentity?.id).toBe(identityId);
    await expect(page.locator("#post-" + post.id)).toBeVisible();
    return post.id as string;
  };
  const historicalB = await publish("角色B的历史发言", b);
  await openComposer(page);
  // 新空稿始终使用站内身份，不继承上次选择或任何RP。
  await expect(page.getByRole("button", { name: "发表身份" })).toContainText(process.env.E2E_USERNAME!);
  await openChoice(page);
  const accountItem = page.getByRole("menuitemradio", { name: /^站内身份：/ });
  const accountName = (await accountItem.getAttribute("aria-label"))!.replace("站内身份：", "");
  await accountItem.click();
  await openChoice(page);
  await page.getByRole("menuitem", { name: "编辑夜渡的帖内资料", exact: true }).click();
  const editorDialog = page.getByRole("dialog", { name: "编辑帖内资料", exact: true });
  await editorDialog.getByLabel("帖内昵称").fill("夜渡归来");
  const renamed = responseFor(page, "PUT", "/rp-identities/" + b);
  await editorDialog.getByRole("button", { name: "保存资料" }).click(); await renamed;
  await expect(editorDialog).not.toBeVisible();
  await expect(page.getByRole("button", { name: "发表身份" })).toContainText(accountName);
  const accountPost = await publish("站内身份发言");
  await expect(page.locator("#post-" + accountPost).getByRole("link", { name: accountName, exact: true })).toBeVisible();
  const oldPost = page.locator("#post-" + historicalB);
  const historicalRead = responseFor(page, "GET", "/rp-identities/" + b);
  await oldPost.getByRole("button", { name: "夜渡", exact: true }).click(); await historicalRead;
  const card = page.getByRole("dialog", { name: "帖内身份", exact: true });
  await expect(card.getByText("夜渡", { exact: true })).toBeVisible();
  await expect(card.getByText("夜渡归来", { exact: true })).toHaveCount(0);
  await expect(card.getByText("白鸦", { exact: true })).toHaveCount(0);
  await expect(card.getByRole("button", { name: "提及" })).toHaveCount(0);
  await page.keyboard.press("Escape");

  await openComposer(page); await openChoice(page);
  await page.getByRole("menuitemradio", { name: "帖内身份：夜渡归来", exact: true }).click();
  await page.getByRole("textbox", { name: "楼层正文", exact: true }).fill("删除角色也保留此稿");
  await openChoice(page);
  await page.getByRole("menuitem", { name: "编辑夜渡归来的帖内资料", exact: true }).click();
  await page.getByRole("button", { name: "删除帖内身份", exact: true }).click();
  const removed = responseFor(page, "DELETE", "/rp-identities/" + b);
  await page.getByRole("button", { name: "删除身份", exact: true }).click(); await removed;
  await expect(page.getByRole("textbox", { name: "楼层正文", exact: true })).toHaveText("删除角色也保留此稿");
  await page.getByRole("button", { name: "发布", exact: true }).click();
  const confirm = page.getByRole("alertdialog");
  await expect(confirm).toContainText(accountName);
  const pending = page.waitForResponse((response) => response.request().method() === "POST" && /\/posts$/.test(new URL(response.url()).pathname) && response.ok());
  await page.getByRole("button", { name: "确认身份并发表", exact: true }).click();
  const final = await pending;
  expect((await latestRpWrite(page, "POST")).identityMode).toBe("ACCOUNT");
  expect((await final.json()).data.author.rpIdentity ?? null).toBeNull();
});
