import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import fontCatalog from "../contracts/thread-font-catalog-v1.json";
import type { components } from "../src/api/types";
import { expect } from "@playwright/test";
import { test } from "./fixtures/isolation";
import { loginAsE2eUser, openFreshThreadDraft } from "./fixtures/auth";
import { requireIsolationRunner } from "../scripts/e2e-isolation-gate.mjs";

const manifestBytes = readFileSync("contracts/thread-font-manifest-v1.json");
const manifestHash = createHash("sha256").update(manifestBytes).digest("hex");

test("字体与颜色的选区应用、真实保存、旧端保护、复制及草稿恢复", async ({ page }) => {
  test.setTimeout(180000);
  const run = await requireIsolationRunner();
  // 此用例保留 v1-only 能力回归；先让浏览器经隔离 HTTP 代理读取真实 meta。
  // route.fetch 使用的请求上下文会发 CONNECT，被隔离代理按设计拒绝。
  await page.goto("/");
  const metadata = await page.evaluate(async () => {
    const response = await fetch("/api/v1/meta");
    return { status: response.status, contentType: response.headers.get("content-type"), body: await response.text() };
  });
  expect(metadata.status, "v1 能力夹具必须读取完整 meta 响应").toBe(200);
  expect(metadata.contentType).toContain("application/json");
  const v1Metadata = JSON.parse(metadata.body);
  expect(v1Metadata.data.capabilities.textFontV1Supported).toBe(true);
  v1Metadata.data.capabilities.textFontV2Supported = false;
  v1Metadata.data.capabilities.textFontV2WriteEnabled = false;
  await page.route("**/api/v1/meta", route => route.fulfill({ json: v1Metadata }));
  // 正式 runner 未发布字体资源；仅替换目录资源配置并在浏览器内模拟离线。
  // API 写入仍经本轮隔离代理，字体外网请求在发出前被此路由消费。
  await page.route("**/api/v1/meta/text-fonts", async route => {
    if (route.request().method() !== "GET") return route.continue();
    await route.fulfill({ json: { code: 0, data: { ...fontCatalog,
      assetBaseUrl: "https://offline-fonts.wenyou.site/",
      manifest: { path: `fonts/v1/${manifestHash}.json`, sha256: manifestHash, bytes: manifestBytes.byteLength },
    } } });
  });
  const assets: string[] = [];
  await page.route("https://offline-fonts.wenyou.site/**", route => {
    assets.push(route.request().url()); return route.fulfill({ status: 503, body: "offline test" });
  });
  const loggedIn = page.waitForResponse(r => r.request().method() === "POST" && new URL(r.url()).pathname === "/api/v1/auth/login");
  await loginAsE2eUser(page);
  const owner = (await (await loggedIn).json()).data;
  const headers = { Authorization: "Bearer " + owner.accessToken, "X-Text-Font-Version": "1", "X-Text-Color-Version": "1", "X-Markdown-Contract-Version": "6" };
  const request = async (method: string, path: string, data?: unknown, font = true) => page.evaluate(async ({ method, path, data, headers }) => {
    const response = await fetch(path, { method, headers: { ...headers, ...(data ? { "Content-Type": "application/json" } : {}) }, ...(data ? { body: JSON.stringify(data) } : {}) });
    return { status: response.status, headers: Object.fromEntries(response.headers), body: await response.json() };
  }, { method, path, data, headers: font ? headers : { Authorization: headers.Authorization, "X-Text-Color-Version": "1", "X-Markdown-Contract-Version": "6" } });
  const meta = (await request("GET", "/api/v1/meta")).body.data;
  expect(meta.capabilities.textFontV1Supported).toBe(true);
  const runtimePolicy = (await request("GET", "/api/v1/meta/text-fonts/runtime-policy")).body.data;
  expect(runtimePolicy.policyVersion).toBe(2); expect(runtimePolicy.manifestSha256).toBe(manifestHash);
  expect(meta.capabilities.textFontV1WriteEnabled).toBe(true);
  await openFreshThreadDraft(page);
  await page.getByLabel("主题帖标题").fill("字体隔离验收 " + Date.now());
  const initial = page.locator(".ProseMirror");
  await initial.fill("正文中文 Aa"); await initial.press("Control+A"); await initial.press("Control+b");
  await page.getByRole("button", { name: "切换正文样式" }).click();
  await page.getByRole("button", { name: "红色", exact: true }).click();
  await initial.press("Control+A");
  await page.getByRole("button", { name: "切换正文样式" }).click();
  await page.getByRole("button", { name: "字体", exact: true }).click();
  const before = await initial.innerHTML();
  await page.getByRole("combobox", { name: "字体" }).click();
  await expect(page.getByRole("option")).toHaveCount(29); // 28款加系统默认
  await expect(page.getByRole("option", { name: "小城拉风体", exact: true })).toHaveCount(0);
  for (const name of ["中文", "日文", "英文"]) await expect(page.getByRole("group", { name, exact: true })).toBeVisible();
  await page.getByRole("option", { name: "文楷", exact: true }).click();
  expect(await initial.innerHTML()).toBe(before); expect(assets).toHaveLength(0);
  await page.getByRole("button", { name: "预览", exact: true }).click();
  await expect.poll(() => assets.length).toBeGreaterThanOrEqual(1);
  // v2 可静默重试暂时失败；预览仍只请求当前 manifest，不预载字体全集。
  expect(new Set(assets)).toEqual(new Set([`https://offline-fonts.wenyou.site/fonts/v1/${manifestHash}.json`]));
  expect(await initial.innerHTML()).toBe(before);
  await page.getByRole("button", { name: "应用", exact: true }).click();
  await expect(initial.locator('[data-wenyou-font-v1="wenkai"]')).toHaveText("正文中文 Aa");
  await initial.press("Control+z"); await expect(initial.locator('[data-wenyou-font-v1]')).toHaveCount(0);
  await initial.press("Control+Shift+z"); await expect(initial.locator('[data-wenyou-font-v1="wenkai"]')).toHaveText("正文中文 Aa");
  await page.getByRole("button", { name: "发布", exact: true }).click();
  await page.waitForURL(url => /^\/threads\/[^/]+$/.test(url.pathname) && url.pathname !== "/threads/create");
  const threadId = new URL(page.url()).pathname.split("/").at(-1)!;
  const thread: components["schemas"]["ThreadDetailResponseDto"] = (await request("GET", "/api/v1/threads/" + threadId)).body.data;
  const body = thread.subthreads.find(s => s.id === thread.defaultSubthreadId)!.bodyPost!;
  expect(body.content).toContain('<span data-wenyou-font-v1="wenkai" data-wenyou-color-v1="#D14343">**正文中文 Aa**</span>');
  // 退役字体不能通过真实 API 新建；历史保源另由共享语料及阅读验收覆盖。
  const retired = await request("POST", "/api/v1/subthreads/" + thread.defaultSubthreadId + "/posts", { content: '<span data-wenyou-font-v1="xiaocheng-lafeng">拒绝新增</span>', textFontVersion: 1, textColorVersion: 1, markdownContractVersion: 6, clientRequestId: crypto.randomUUID() });
  expect(retired.status).toBe(409); expect(retired.body.code).toBe(40020);
  const source = '<span data-wenyou-font-v1="wenkai" data-wenyou-color-v1="#D14343">**中文😀** *斜体* ~~删除~~ [链接](https://example.com) `字面`</span> 普通文字 <span data-wenyou-font-v1="longcang">分片正文</span> <span data-wenyou-font-v1="kaitou-yokoku-gothic">怪盗 あいうえお</span> <span data-wenyou-font-v1="yuji-boku">あいうえお</span>';
  const created = await request("POST", "/api/v1/subthreads/" + thread.defaultSubthreadId + "/posts", { content: source, textFontVersion: 1, textColorVersion: 1, markdownContractVersion: 6, clientRequestId: crypto.randomUUID() });
  expect(created.status).toBe(201); const post = created.body.data;
  await page.reload(); const floor = page.locator("#post-" + post.id);
  await expect(floor.locator('[data-wenyou-font-v1="wenkai"]')).toHaveCount(1);
  await expect(floor.locator('[data-wenyou-font-v1="longcang"]')).toHaveText("分片正文");
  await expect(floor.locator('[data-wenyou-font-v1="kaitou-yokoku-gothic"]')).toHaveText("怪盗 あいうえお");
  await expect(floor.locator('[data-wenyou-font-v1="yuji-boku"]')).toHaveText("あいうえお");
  await expect(floor.locator('[data-wenyou-font-v1] strong')).toHaveCSS("color", "rgb(209, 67, 67)");
  for (const fontId of ["wenkai", "longcang", "kaitou-yokoku-gothic", "yuji-boku"]) {
    await expect(floor.locator(`[data-wenyou-font-v1="${fontId}"]`)).toHaveAttribute("data-font-load", "fallback");
  }
  await floor.screenshot({ path: ".e2e-results/" + run.manifest.runId + "-text-font-fallback.png" });
  const legacy = await request("GET", "/api/v1/posts/" + post.id, undefined, false);
  expect(legacy.body.data.content).not.toContain("data-wenyou-font-v1");
  expect(legacy.body.data.content).toContain('data-wenyou-color-v1="#D14343"');
  expect(legacy.headers.vary).toContain("X-Text-Font-Version");
  const rejected = await request("PATCH", "/api/v1/posts/" + post.id, { content: "旧端覆盖", version: post.version, textColorVersion: 1 }, false);
  expect(rejected.status).toBe(409); expect(rejected.body.code).toBe(40019);
  await page.evaluate(() => Object.defineProperty(navigator, "clipboard", { configurable: true, value: { write: async (items: ClipboardItem[]) => {
    const entry = items[0]!; (window as unknown as { copied: { html: string; text: string } }).copied = { html: await (await entry.getType("text/html")).text(), text: await (await entry.getType("text/plain")).text() };
  } } }));
  await floor.getByRole("button", { name: "更多楼层操作", exact: true }).click();
  await page.getByRole("menuitem", { name: "复制内容", exact: true }).click();
  await page.waitForFunction(() => !!(window as unknown as { copied?: unknown }).copied);
  const copied = await page.evaluate(() => (window as unknown as { copied: { html: string; text: string } }).copied);
  expect(copied.html).toContain('data-wenyou-font-v1="longcang"'); expect(copied.html).toContain('data-wenyou-font-v1="yuji-boku"'); expect(copied.html).toContain('data-wenyou-font-v1="wenkai"'); expect(copied.html).toContain('data-wenyou-color-v1="#D14343"');
  await floor.getByRole("button", { name: "更多楼层操作", exact: true }).click(); await page.getByRole("menuitem", { name: "编辑", exact: true }).click();
  expect(copied.html).toContain('data-wenyou-font-v1="kaitou-yokoku-gothic"');
  const editor = page.getByRole("textbox", { name: "编辑正文", exact: true });
  await expect(editor.locator('[data-wenyou-font-v1="wenkai"]')).toHaveCount(9);
  await expect(editor.locator('[data-wenyou-font-v1="longcang"]')).toHaveText("分片正文");
  await expect(editor.locator('[data-wenyou-font-v1="yuji-boku"]')).toHaveText("あいうえお");
  await editor.press("Control+End"); await page.keyboard.insertText(" Web编辑");
  const saving = page.waitForResponse(r => r.request().method() === "PATCH" && new URL(r.url()).pathname.endsWith("/posts/" + post.id));
  await page.getByRole("button", { name: "保存修改", exact: true }).click(); expect((await saving).status()).toBe(200);
  const saved = (await request("GET", "/api/v1/posts/" + post.id)).body.data;
  expect(saved.content).toContain('data-wenyou-font-v1="wenkai" data-wenyou-color-v1="#D14343"'); expect(saved.content).toContain("**中文😀**"); expect(saved.content).toContain("Web编辑");
  expect(saved.content).toContain('<span data-wenyou-font-v1="kaitou-yokoku-gothic">怪盗 あいうえお</span>');
  expect(saved.content).toContain('<span data-wenyou-font-v1="longcang">分片正文</span>');
  expect(saved.content).toContain('<span data-wenyou-font-v1="yuji-boku">あいうえお');
  const state: components["schemas"]["DraftStateResponseDto"] = (await request("GET", "/api/v1/drafts/state")).body.data;
  const previous = state.drafts.find(d => d.slot === 1);
  const draft = previous ? await request("PATCH", "/api/v1/drafts/" + previous.id, { content: source, version: previous.version, textFontVersion: 1, textColorVersion: 1, markdownContractVersion: 6 }) : await request("POST", "/api/v1/drafts", { content: source, slot: 1, textFontVersion: 1, textColorVersion: 1, markdownContractVersion: 6, clientRequestId: crypto.randomUUID() });
  expect(draft.status).toBe(previous ? 200 : 201);
  await page.getByRole("button", { name: "发表回复…", exact: true }).click();
  const composing = page.getByRole("textbox", { name: "楼层正文", exact: true });
  await composing.evaluate((element, payload) => { const clipboardData = new DataTransfer(); clipboardData.setData("text/html", payload.html); clipboardData.setData("text/plain", payload.text); element.dispatchEvent(new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData })); }, copied);
  await expect(composing.locator('[data-wenyou-font-v1="wenkai"]')).toHaveCount(9);
  await composing.press("Control+End"); await page.keyboard.insertText(" 临时修改");
  await page.getByRole("button", { name: "正文草稿", exact: true }).click();
  await page.getByRole("region", { name: "正文草稿", exact: true }).getByRole("button", { name: "恢复", exact: true }).first().click();
  await page.getByRole("button", { name: "覆盖并恢复", exact: true }).click();
  await expect(composing.locator('[data-wenyou-font-v1="wenkai"]')).toHaveCount(9); await expect(composing).not.toContainText("临时修改");
  await page.locator("body").click({ position: { x: 2, y: 2 } });
  await expect(composing).toHaveCount(0);
  expect((await request("GET", "/api/v1/drafts/" + draft.body.data.id)).body.data.content).toBe(source);
});
