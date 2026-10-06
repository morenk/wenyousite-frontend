import { expect, type Page } from "@playwright/test";
import { test } from "./fixtures/isolation";
import { loginAsE2eUser, openFreshThreadDraft } from "./fixtures/auth";
import { readAdminFixtures, requireIsolationRunner } from "../scripts/e2e-isolation-gate.mjs";

test("平级角色@保留同名目标、账号通知去重、复制编辑和新旧读取隔离", async ({ page, browser, isolationNetwork }) => {
  test.setTimeout(180000);
  const run = await requireIsolationRunner();
  const loginResponse = page.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).pathname === "/api/v1/auth/login", { timeout: 30000 });
  await loginAsE2eUser(page);
  const owner = (await (await loginResponse).json()).data;
  const browserRequest = async (context: Page, method: string, path: string, data?: unknown, headers: Record<string, string> = {}) => {
    try {
      return await context.evaluate(async ({ method, path, data, headers }) => {
        const response = await fetch(path, { method, headers: { ...headers, ...(data ? { "Content-Type": "application/json" } : {}) }, ...(data ? { body: JSON.stringify(data) } : {}) });
        const text = await response.text();
        return { status: response.status, headers: Object.fromEntries(response.headers), body: text ? JSON.parse(text) : null };
      }, { method, path, data, headers });
    } catch { throw new Error("隔离浏览器请求失败：" + method + " " + path); }
  };
  const metaResponse = await browserRequest(page, "GET", "/api/v1/meta");
  expect(metaResponse.status).toBe(200);
  const meta = metaResponse.body.data;
  expect(meta.capabilities?.roleMentionsV6Supported).toBe(true);
  expect(meta.capabilities?.roleMentionsV6WriteEnabled).toBe(true);
  await openFreshThreadDraft(page);
  await page.getByLabel("主题帖标题").fill("平级角色提及隔离 " + Date.now());
  await page.locator(".ProseMirror").fill("角色提及验收");
  await page.getByRole("button", { name: "发布", exact: true }).click();
  await page.waitForURL((url) => /^\/threads\/[^/]+$/.test(url.pathname) && url.pathname !== "/threads/create");
  const threadId = new URL(page.url()).pathname.split("/").at(-1)!;
  const ownerHeaders = { Authorization: "Bearer " + owner.accessToken, "X-Markdown-Contract-Version": "6" };
  const request = async (context: Page, method: string, path: string, data?: unknown, headers = ownerHeaders) => {
    const response = await browserRequest(context, method, path, data, headers);
    if (response.status < 200 || response.status >= 300) throw new Error("隔离角色提及请求失败：" + method + " " + path + " " + response.status);
    return response.body.data;
  };
  await request(page, "PATCH", "/api/v1/threads/" + threadId + "/identity-settings", { enabled: true });
  const a = await request(page, "POST", "/api/v1/threads/" + threadId + "/rp-identities", { nickname: "同名角色" });
  const b = await request(page, "POST", "/api/v1/threads/" + threadId + "/rp-identities", { nickname: "同名角色" });
  expect(a.identityId).not.toBe(b.identityId);
  expect(a.account.id).toBe(owner.user.id);
  expect(b.account.id).toBe(owner.user.id);

  const sender = readAdminFixtures(run).accounts.find((account: { role: string }) => account.role === "ADMIN")!;
  const senderContext = await browser.newContext({ baseURL: process.env.E2E_BASE_URL, proxy: { server: isolationNetwork.origin } });
  try {
    const senderPage = await senderContext.newPage();
    senderPage.setDefaultTimeout(15000);
    // 浏览器 Request 的流式正文可能不在 CDP postData 中；只记录本旅程的发言正文，不读认证请求或头。
    await senderPage.addInitScript(() => {
      type Write = { method: string; path: string; body: Record<string, unknown> };
      const state = window as unknown as { rpMentionWrites: Write[] };
      state.rpMentionWrites = [];
      const originalFetch = window.fetch;
      window.fetch = async (input, init) => {
        const request = new Request(input instanceof Request ? input.clone() : input, init);
        const path = new URL(request.url).pathname;
        if ((request.method === "POST" && /\/subthreads\/[^/]+\/posts$/.test(path))
          || (request.method === "PATCH" && /\/posts\/[^/]+$/.test(path))) {
          state.rpMentionWrites.push({ method: request.method, path, body: await request.clone().json() });
        }
        return originalFetch(input, init);
      };
    });
    await senderPage.goto("/login");
    try {
      await senderPage.getByLabel("邮箱或用户名").fill(sender.email);
      await senderPage.getByLabel("密码", { exact: true }).fill(sender.password);
    } catch { throw new Error("隔离发送者登录填写失败"); }
    await senderPage.getByRole("button", { name: "登录", exact: true }).click();
    await senderPage.waitForURL("/", { timeout: 30000 });
    await senderPage.goto("/threads/" + threadId);
    await senderPage.getByRole("button", { name: "发表回复…", exact: true }).click();
    const editor = senderPage.getByRole("textbox", { name: "楼层正文", exact: true });
    let lastCandidateQuery = "";
    senderPage.on("request", (request) => { const url = new URL(request.url()); if (url.pathname.endsWith("/mention-candidates")) lastCandidateQuery = url.search; });
    for (const key of ["RP:" + a.identityId, "RP:" + b.identityId, "ACCOUNT:" + owner.user.id]) {
      await editor.pressSequentially("@");
      const menu = senderPage.getByRole("listbox", { name: "艾特候选" });
      await expect(menu).toBeVisible();
      await expect(menu.locator('[data-mention-id="RP:' + a.identityId + '"]')).toBeVisible();
      await expect(menu.locator('[data-mention-id="RP:' + b.identityId + '"]')).toBeVisible();
      const option = menu.locator('[data-mention-id="' + key + '"]');
      try { await expect(option).toBeVisible({ timeout: 15000 }); }
      catch { throw new Error("未找到目标候选：" + key + "；候选=" + JSON.stringify(await menu.locator("[data-mention-id]").evaluateAll((items) => items.map((item) => item.getAttribute("data-mention-id")))) + "；查询=" + lastCandidateQuery + "；编辑文本=" + await editor.textContent()); }
      await option.click();
      await expect(menu).toBeHidden();
    }
    await expect(editor.locator("a")).toHaveCount(3);
    const posted = senderPage.waitForResponse((response) => response.request().method() === "POST" && /\/subthreads\/[^/]+\/posts$/.test(new URL(response.url()).pathname) , { timeout: 30000 });
    await senderPage.getByRole("button", { name: "发布", exact: true }).click();
    const response = await posted;
    const publication = await response.json();
    expect(response.status(), "发表角色提及HTTP状态；code=" + publication.code).toBe(201);
    const input = await senderPage.evaluate(() => (window as unknown as { rpMentionWrites: { method: string; body: Record<string, unknown> }[] }).rpMentionWrites.findLast((entry) => entry.method === "POST")!.body);
    expect(input.markdownContractVersion).toBe(6);
    expect(input.identityMode).toBe("ACCOUNT");
    expect(input.content).toContain("?rpIdentityId=" + a.identityId);
    expect(input.content).toContain("?rpIdentityId=" + b.identityId);
    expect(input.content).toContain("?identityMode=ACCOUNT");
    const post = publication.data;
    const floor = senderPage.locator("#post-" + post.id);
    await expect(floor).toBeVisible();
    const roleBLink = floor.locator('a[data-wenyou-mention-source-href$="rpIdentityId=' + b.identityId + '"]');
    const roleRead = senderPage.waitForRequest((request) => request.method() === "GET" && new URL(request.url()).pathname.endsWith("/rp-identities/" + b.identityId), { timeout: 30000 });
    await roleBLink.click(); await roleRead;
    await expect(senderPage.getByRole("dialog", { name: "帖内身份" })).toBeVisible();
    await senderPage.keyboard.press("Escape");

    const latest = await browserRequest(page, "GET", "/api/v1/posts/" + post.id, undefined, ownerHeaders);
    expect(latest.status).toBe(200);
    expect(latest.headers.vary?.toLowerCase()).toContain("x-markdown-contract-version");
    expect(latest.body.data.content).toBe(input.content);
    const legacy = await browserRequest(page, "GET", "/api/v1/posts/" + post.id, undefined, { Authorization: ownerHeaders.Authorization });
    expect(legacy.status).toBe(200);
    expect(legacy.headers.vary?.toLowerCase()).toContain("x-markdown-contract-version");
    const legacySource = legacy.body.data.content;
    expect(legacySource).not.toContain("rpIdentityId");
    expect(legacySource).not.toContain("identityMode");

    await expect.poll(async () => {
      const response = await browserRequest(page, "GET", "/api/v1/notifications?type=mention&limit=50", undefined, ownerHeaders);
      if (response.status !== 200) return -1;
      const rows = response.body.data;
      return rows.filter((item: { target?: { postId?: string }; postId?: string }) => (item.target?.postId ?? item.postId) === post.id).length;
    }).toBe(1);

    await request(page, "PATCH", "/api/v1/threads/" + threadId + "/identity-settings", { enabled: false });
    await senderPage.reload();
    const closedFloor = senderPage.locator("#post-" + post.id);
    await expect(closedFloor.locator('[data-slot="mention-link"]').first()).toHaveText("@" + owner.user.username);
    await senderPage.evaluate(() => {
      Object.defineProperty(navigator, "clipboard", { configurable: true, value: {
        write: async (items: ClipboardItem[]) => {
          const entry = items[0]!;
          (window as unknown as { copied: { html: string; text: string } }).copied = {
            html: await (await entry.getType("text/html")).text(),
            text: await (await entry.getType("text/plain")).text(),
          };
        },
      } });
    });
    await closedFloor.getByRole("button", { name: "更多楼层操作", exact: true }).click();
    await senderPage.getByRole("menuitem", { name: "复制内容", exact: true }).click();
    const copied = await senderPage.evaluate(() => (window as unknown as { copied: { html: string; text: string } }).copied);
    expect(copied.html).toContain("?rpIdentityId=" + a.identityId);
    expect(copied.html).toContain("?rpIdentityId=" + b.identityId);
    expect(copied.html).toContain("同名角色");
    expect(copied.text).not.toContain("同名角色");
    expect(copied.text).toContain("@" + owner.user.username);

    const storedAfterClose = await browserRequest(page, "GET", "/api/v1/posts/" + post.id, undefined, ownerHeaders);
    expect(storedAfterClose.body.data.content).toBe(input.content);
    await closedFloor.getByRole("button", { name: "更多楼层操作", exact: true }).click();
    await senderPage.getByRole("menuitem", { name: "编辑", exact: true }).click();
    const editing = senderPage.getByRole("textbox", { name: "编辑正文", exact: true });
    await expect(editing.locator('a[href$="rpIdentityId=' + b.identityId + '"]')).toHaveAttribute("data-mention-display", "@" + owner.user.username);
    await editing.press("End");
    await editing.pressSequentially(" 保留原角色");
    const saved = senderPage.waitForResponse((response) => response.request().method() === "PATCH" && new URL(response.url()).pathname.endsWith("/posts/" + post.id) , { timeout: 30000 });
    await senderPage.getByRole("button", { name: "保存修改", exact: true }).click();
    const savedResponse = await saved;
    expect(savedResponse.status(), "保留原角色编辑HTTP状态").toBe(200);
    const savedInput = await senderPage.evaluate(() => (window as unknown as { rpMentionWrites: { method: string; body: Record<string, unknown> }[] }).rpMentionWrites.findLast((entry) => entry.method === "PATCH")!.body);
    expect(savedInput.markdownContractVersion).toBe(6);
    expect(savedInput.content).toContain("[@同名角色](/users/" + owner.user.id + "?rpIdentityId=" + a.identityId + ")");
    expect(savedInput.content).toContain("[@同名角色](/users/" + owner.user.id + "?rpIdentityId=" + b.identityId + ")");
    expect(savedInput.content).toContain("[@" + owner.user.username + "](/users/" + owner.user.id + "?identityMode=ACCOUNT)");
    expect(savedInput.content).toContain("保留原角色");
    await senderPage.getByRole("button", { name: "发表回复…", exact: true }).click();
    const pasteEditor = senderPage.getByRole("textbox", { name: "楼层正文", exact: true });
    await pasteEditor.evaluate((element, payload) => {
      const clipboardData = new DataTransfer();
      clipboardData.setData("text/html", payload.html);
      clipboardData.setData("text/plain", payload.text);
      element.dispatchEvent(new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData }));
    }, copied);
    await expect(pasteEditor.locator('a[href$="rpIdentityId=' + a.identityId + '"]')).toHaveText("@同名角色");
    await expect(pasteEditor.locator('a[href$="rpIdentityId=' + b.identityId + '"]')).toHaveText("@同名角色");
    await senderPage.getByRole("button", { name: "取消", exact: true }).click();
    await senderPage.getByRole("button", { name: "放弃内容", exact: true }).click();

    // 门禁返回空集合时前端不能改问旧主身份候选；全体玩家权限仍由原字段控制。
    await senderPage.route("**/api/v1/meta", (route) => route.fulfill({ status: 200, json: { data: { ...meta, capabilities: { ...meta.capabilities, roleMentionsV6WriteEnabled: false } } } }));
    const queries: string[] = [];
    await senderPage.route("**/api/v1/users/mention-candidates?**", (route) => {
      queries.push(route.request().url());
      return route.fulfill({ status: 200, json: { data: { users: [], canMentionAllPlayers: false } } });
    });
    await senderPage.reload();
    await senderPage.getByRole("button", { name: "发表回复…", exact: true }).click();
    await senderPage.getByRole("textbox", { name: "楼层正文", exact: true }).pressSequentially("@");
    await expect(senderPage.getByText("暂时无法提及用户")).toBeVisible();
    expect(queries.length).toBeGreaterThan(0);
    expect(queries.every((url) => new URL(url).searchParams.get("includeIdentities") === "true")).toBe(true);
  } finally { await senderContext.close().catch(() => {}); }
});
