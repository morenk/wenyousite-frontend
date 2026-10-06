import { expect } from "@playwright/test";
import { test } from "./fixtures/isolation";
import { loginAsE2eUser, openFreshThreadDraft } from "./fixtures/auth";
import { captureRpWrites, latestRpWrite, rpBrowserRequest } from "./fixtures/rp-browser";

test("资料楼层绑定、当前授权正文、历史身份及局部重试", async ({ page }) => {
  test.setTimeout(180000);
  await captureRpWrites(page);
  const login = page.waitForResponse((r) => r.request().method() === "POST" && new URL(r.url()).pathname.endsWith("/auth/login"));
  await loginAsE2eUser(page);
  const owner = (await (await login).json()).data;
  const headers = { Authorization: "Bearer " + owner.accessToken, "X-Markdown-Contract-Version": "6" };
  const api = async (method: string, path: string, data?: unknown) => {
    const r = await rpBrowserRequest(page, method, "/api/v1" + path, data, headers);
    expect(r.status, method + " " + path + " code=" + r.body?.code).toBeLessThan(300);
    expect(r.status).toBeGreaterThanOrEqual(200);
    return r.body?.data;
  };
  const meta = await api("GET", "/meta");
  expect(meta.capabilities.rpIdentityProfileSupported).toBe(true);
  await openFreshThreadDraft(page);
  await page.getByLabel("主题帖标题").fill("资料引用隔离 " + Date.now());
  await page.locator(".ProseMirror").fill("主题正文");
  await page.getByRole("button", { name: "发布", exact: true }).click();
  await page.waitForURL((u) => /^\/threads\/[^/]+$/.test(u.pathname) && u.pathname !== "/threads/create");
  const threadPath = new URL(page.url()).pathname;
  const threadId = threadPath.split("/").at(-1)!;
  await api("PATCH", threadPath + "/identity-settings", { enabled: true });
  const sub = await api("POST", threadPath + "/subthreads", { title: "报名资料", sortOrder: 99, content: "子贴正文", identityMode: "ACCOUNT", markdownContractVersion: 6 });
  const marker = "[[dice:v1:22222222-2222-4222-8222-222222222222:1d6]]";
  const content = "## 白鸦资料\n\n> 来自旧港的信\n\n- 灯塔\n- 指南针\n\n" + marker + "\n\n[@"+owner.user.username+"](/users/"+owner.user.id+"?identityMode=ACCOUNT)";
  const original = await api("POST", "/subthreads/" + sub.id + "/posts", { content, identityMode: "ACCOUNT", markdownContractVersion: 6 });
  const reply = await api("POST", "/subthreads/" + sub.id + "/posts", { content: "资料楼中楼", parentPostId: original.id, identityMode: "ACCOUNT", markdownContractVersion: 6 });
  const role = await api("POST", threadPath + "/rp-identities", { nickname: "白鸦" });
  await page.reload();
  await page.getByRole("button", { name: "发表回复…", exact: true }).click();

  const edit = async () => {
    await page.getByRole("button", { name: "发表身份", exact: true }).click();
    await page.getByRole("menuitem", { name: "编辑白鸦的帖内资料", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "编辑帖内资料", exact: true });
    await expect(dialog.getByLabel("资料楼层链接")).toBeVisible();
    return dialog;
  };
  let dialog = await edit();
  const badLink = "https://example.invalid/threads/" + threadId + "?post=" + original.id;
  await dialog.getByLabel("资料楼层链接").fill(badLink);
  await dialog.getByRole("button", { name: "保存资料", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("有效楼层链接");
  await expect(dialog.getByLabel("资料楼层链接")).toHaveValue(badLink);
  await dialog.getByLabel("资料楼层链接").fill("https://wenyou.site" + threadPath + "?post=" + original.id);
  const saved = page.waitForResponse((r) => r.request().method() === "PUT" && new URL(r.url()).pathname.endsWith("/rp-identities/" + role.identityId));
  await dialog.getByRole("button", { name: "保存资料", exact: true }).click();
  const bound = (await (await saved).json()).data;
  expect((await latestRpWrite(page, "PUT")).profilePostId).toBe(original.id);
  expect(bound.identityToken).toBe(role.identityToken);
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("button", { name: "发表身份", exact: true })).toContainText(owner.user.username);
  const otherRole = await api("POST", threadPath + "/rp-identities", { nickname: "同一份资料", profilePostId: original.id });
  expect(otherRole.profilePostId).toBe(original.id);
  await page.getByRole("button", { name: "发表身份", exact: true }).click();
  await page.getByRole("menuitemradio", { name: "帖内身份：白鸦", exact: true }).click();
  await page.getByRole("textbox", { name: "楼层正文", exact: true }).fill("历史发言身份");
  const published = page.waitForResponse((r) => r.request().method() === "POST" && /\/subthreads\/[^/]+\/posts$/.test(new URL(r.url()).pathname));
  await page.getByRole("button", { name: "发布", exact: true }).click();
  const publication = (await (await published).json()).data;
  expect(publication.author.rpIdentity.id).toBe(role.identityId);
  const floor = page.locator("#post-" + publication.id);
  const openCard = async () => {
    await floor.getByRole("button", { name: "白鸦", exact: true }).click();
    return page.getByRole("dialog", { name: "帖内身份", exact: true });
  };
  let card = await openCard();
  await expect(card.getByRole("heading", { name: "白鸦资料" })).toBeVisible();
  await expect(card.locator("blockquote")).toContainText("来自旧港的信");
  await expect(card.locator("li")).toHaveCount(2);
  await expect(card.locator(".dice-inline-result")).toBeVisible();
  await card.locator(".dice-inline-result").click();
  await expect(page.getByRole("button", { name: "关闭骰子结果" })).toBeVisible();
  await page.getByRole("button", { name: "关闭骰子结果" }).click();
  await expect(card.locator('[data-slot="mention-link"]')).toHaveText("@" + owner.user.username);
  await expect(card.getByRole("link", { name: "报名资料 · 1楼" })).toHaveAttribute("href", threadPath + "?post=" + original.id);
  await expect(card.getByRole("link", { name: "查看" + owner.user.username + "的用户主页" })).toBeVisible();
  await page.keyboard.press("Escape");

  await api("PATCH", "/posts/" + original.id, { content: "原帖更新后立即读取", version: original.version, markdownContractVersion: 6 });
  card = await openCard();
  await expect(card.getByText("原帖更新后立即读取")).toBeVisible();
  await expect(card.getByText("来自旧港的信")).toHaveCount(0);
  await page.keyboard.press("Escape");

  let failPost = true;
  await page.route("**/api/v1/posts/" + original.id, (route) => failPost
    ? route.fulfill({ status: 503, json: { code: 50000, message: "隔离资料网络失败" } })
    : route.continue());
  card = await openCard();
  await expect(card.getByText("资料加载失败")).toBeVisible({ timeout: 15000 });
  await expect(card.getByText("原帖更新后立即读取")).toHaveCount(0);
  failPost = false;
  await card.getByRole("button", { name: "重试", exact: true }).click();
  await expect(card.getByText("原帖更新后立即读取")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.unroute("**/api/v1/posts/" + original.id);

  await page.getByRole("button", { name: "发表回复…", exact: true }).click();
  dialog = await edit();
  const replyLink = threadPath + "/posts/" + original.id + "/replies?post=" + reply.id;
  await dialog.getByLabel("资料楼层链接").fill(replyLink);
  await dialog.getByRole("button", { name: "保存资料", exact: true }).click();
  await expect(dialog).toBeHidden();
  await page.getByRole("button", { name: "取消", exact: true }).click();
  card = await openCard();
  await expect(card.getByText("资料楼中楼")).toBeVisible();
  await expect(card.getByRole("link", { name: "报名资料 · 1楼 · 1回复" })).toHaveAttribute("href", replyLink);
  await page.keyboard.press("Escape");

  await api("DELETE", "/posts/" + reply.id);
  card = await openCard();
  await expect(card.getByText("资料暂不可用")).toBeVisible();
  await expect(card.getByText("资料楼中楼")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "发表回复…", exact: true }).click();
  dialog = await edit();
  // 编辑始终取 owner 原绑定，不能把 UNAVAILABLE 的安全投影当作已解绑。
  await expect(dialog.getByLabel("资料楼层链接")).toHaveValue(threadPath + "?post=" + reply.id);
  await dialog.getByLabel("资料楼层链接").fill("");
  await dialog.getByRole("button", { name: "保存资料", exact: true }).click();
  await expect(dialog).toBeHidden();
  expect((await latestRpWrite(page, "PUT")).clearProfilePost).toBe(true);
  await page.getByRole("button", { name: "取消", exact: true }).click();
  card = await openCard();
  await expect(card.getByRole("region", { name: "角色资料" })).toHaveCount(0);
  await expect(card.getByText("资料暂不可用")).toHaveCount(0);
  await page.keyboard.press("Escape");

  // 兼容旧后端：能力缺失时不展示或提交新字段。
  await page.route("**/api/v1/meta", (route) => route.fulfill({ status: 200, json: {
    data: { ...meta, capabilities: { ...meta.capabilities, rpIdentityProfileSupported: undefined } },
  } }));
  await page.reload();
  await page.getByRole("button", { name: "发表回复…", exact: true }).click();
  await page.getByRole("button", { name: "发表身份", exact: true }).click();
  await page.getByRole("menuitem", { name: "编辑白鸦的帖内资料", exact: true }).click();
  await expect(page.getByLabel("资料楼层链接")).toHaveCount(0);
});
