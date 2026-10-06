/** 仅连接已核验的合成 RP 预览；凭据留在 0600 私有文件，写入随反馈批次清理。 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, statSync } from "node:fs";
import { resolve, join } from "node:path";
import { chromium, expect } from "@playwright/test";
import { validateDescriptor, verifyRuntime } from "./dev-preview-policy.mjs";

const [descriptorPath, accountsPath, contentPath, task] = process.argv.slice(2);
if (![descriptorPath, accountsPath, contentPath].every((path) => path?.startsWith("/")) || !task) {
  throw new Error("用法：node scripts/test-preview-rp.mjs /absolute/consumer.json /absolute/sample-accounts.json /absolute/sample-content.json task-id");
}
const root = resolve(import.meta.dirname, "..");
const d = validateDescriptor(JSON.parse(readFileSync(descriptorPath, "utf8")));
const permission = statSync(accountsPath);
assert.equal(permission.uid, process.getuid());
assert.equal(permission.mode & 0o077, 0, "样例账号文件必须为当前用户私有");
const accounts = JSON.parse(readFileSync(accountsPath, "utf8"));
const content = JSON.parse(readFileSync(contentPath, "utf8"));
for (const sample of [accounts, content]) {
  assert.equal(sample.version, 1); assert.equal(sample.isolatedSample, true); assert.equal(sample.runId, d.runId);
}
assert.equal(d.snapshot.sourceKind, "synthetic-thread-identities", "必须使用已登记的 RP 合成样例批次");
await Promise.all([verifyRuntime(d, "backend"), verifyRuntime(d, "media")]);
const status = () => JSON.parse(execFileSync(process.execPath, ["scripts/dev-preview.mjs", "status", "--task", task], { cwd: root, encoding: "utf8" }));
const state = status();
assert.equal(state.status, "ready"); assert.equal(state.runId, d.runId);
const report = { kind: "isolated-rp-synthetic-browser", runId: d.runId, sessionId: d.sessionId,
  sourceCommit: state.sourceCommit, sourceDigest: state.sourceDigest, steps: [], screenshots: [], forbiddenRequests: 0, browserClosed: false };
const browser = await chromium.launch({ headless: true });
let failure;
const account = (role) => {
  const value = accounts.accounts.find((item) => item.role === role);
  assert.ok(value?.account && value?.password, "缺少指定角色合成账号");
  return value;
};
const login = async (role) => {
  const context = await browser.newContext({ baseURL: d.web.origin, viewport: { width: 1440, height: 1000 }, colorScheme: "light" });
  await context.route("**/*", async (route) => {
    const request = route.request(); const url = new URL(request.url());
    const read = ["GET", "HEAD"].includes(request.method());
    const safe = url.origin === d.web.origin ? read || url.pathname.startsWith("/api/v1/")
      : url.origin === d.media.origin ? read || ["PUT", "OPTIONS"].includes(request.method())
      : read && url.origin === "https://cn-nb1.rains3.com";
    if (!safe) { report.forbiddenRequests++; await route.abort("blockedbyclient"); return; }
    await route.continue();
  });
  const page = await context.newPage(); page.setDefaultTimeout(45000);
  const identityResponse = await page.request.get("/__preview/identity");
  assert.equal(identityResponse.status(), 200); assert.equal(identityResponse.headers()["x-wenyou-preview-run"], d.runId);
  const bound = await identityResponse.json(); assert.equal(bound.runId, d.runId);
  const credentials = account(role);
  await page.goto("/login");
  await page.getByLabel("邮箱或用户名").fill(credentials.account);
  await page.getByLabel("密码", { exact: true }).fill(credentials.password);
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await page.waitForURL(d.web.origin + "/");
  await page.goto("/threads/" + content.threadId + "?subthread=" + content.subthreadId);
  await expect(page.locator("#post-" + content.historicalFloorId)).toBeVisible();
  return page;
};
const responseFor = (page, method, suffix) => page.waitForResponse((response) =>
  response.request().method() === method && new URL(response.url()).pathname.endsWith(suffix) && response.ok());
const screenshot = async (page, name) => {
  const path = ".dev-preview/" + name + ".png";
  await page.screenshot({ path: join(root, path) }); report.screenshots.push(path);
};
const openSettings = async (page) => {
  await page.getByRole("button", { name: "发表回复…", exact: true }).click();
  await page.getByRole("button", { name: "发表身份" }).click();
  await page.getByRole("menuitem", { name: /^(设置帖内身份|编辑.+的帖内资料)$/ }).click();
  return page.getByRole("dialog", { name: /^(设置帖内身份|编辑帖内资料)$/ });
};
const startFloor = async (page, text) => {
  await page.getByRole("button", { name: "发表回复…", exact: true }).click();
  const editor = page.getByRole("textbox", { name: "楼层正文", exact: true });
  await editor.fill(text);
  return editor;
};
const publish = async (page, mode, text) => {
  await startFloor(page, text);
  await expect(page.getByRole("button", { name: "发表身份" })).toBeVisible();
  if (mode === "ACCOUNT") {
    await page.getByRole("button", { name: "发表身份" }).click();
    await page.getByRole("menuitemradio", { name: /^站内身份：/ }).click();
  }
  const pending = responseFor(page, "POST", "/subthreads/" + content.subthreadId + "/posts");
  await page.getByRole("button", { name: "发布", exact: true }).click();
  const response = await pending;
  assert.equal(response.request().postDataJSON().identityMode, mode);
  const data = (await response.json()).data;
  assert.equal(Boolean(data.author?.rpIdentity), mode === "RP");
  report.steps.push("publish-" + mode);
};
try {
  const owner = await login("OWNER");
  const historical = owner.locator("#post-" + content.historicalFloorId);
  await historical.getByRole("button", { name: "夜渡", exact: true }).click();
  const card = owner.getByRole("dialog", { name: "帖内身份", exact: true });
  await expect(card.getByText("现为", { exact: true })).toBeVisible();
  await expect(card.getByText("白鸦", { exact: true })).toBeVisible();
  const accountLink = card.getByRole("link", { name: /^查看.+的用户主页$/ });
  await expect(accountLink).toBeVisible();
  const accountName = (await accountLink.innerText()).trim();
  await screenshot(owner, "rp-historical-card-light");
  await card.getByRole("button", { name: "关闭", exact: true }).click();
  await owner.getByRole("combobox", { name: "只看某人的楼层", exact: true }).click();
  await owner.getByRole("option").filter({ hasText: accountName }).click();
  await expect(owner.locator("#post-" + content.historicalFloorId)).toBeVisible();
  await expect(owner.locator("#post-" + content.accountFloorId)).toBeVisible();
  report.steps.push("historical-card-current-name-stable-account-filter");
  await owner.reload();
  await publish(owner, "RP", "隔离交互验收：RP 发言 " + d.runId);
  await publish(owner, "ACCOUNT", "隔离交互验收：站内发言 " + d.runId);
  const settings = await openSettings(owner);
  const longName = "🌙".repeat(24);
  await settings.getByLabel("帖内昵称", { exact: true }).fill(longName);
  const saved = owner.waitForResponse((response) => response.request().method() === "PUT" && new URL(response.url()).pathname.startsWith("/api/v1/threads/" + content.threadId + "/rp-identities/") && response.ok());
  await settings.getByRole("button", { name: "保存昵称", exact: true }).click(); await saved;
  await expect(settings).not.toBeVisible();
  await owner.getByRole("button", { name: "取消", exact: true }).click();
  await startFloor(owner, "保留草稿内容");
  await expect(owner.getByRole("button", { name: "发表身份" })).toContainText(longName);
  await screenshot(owner, "rp-composer-long-light");
  await owner.emulateMedia({ colorScheme: "dark" }); await owner.setViewportSize({ width: 1024, height: 850 });
  await expect(owner.locator("html")).toHaveAttribute("data-theme", "dark");
  await screenshot(owner, "rp-composer-long-dark-1024");
  assert.ok(await owner.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "窄屏不能产生页面横向滚动");
  report.steps.push("24-unicode-codepoints-light-dark-1024");
  await owner.getByRole("button", { name: "取消", exact: true }).click();
  await owner.getByRole("button", { name: "放弃内容", exact: true }).click();
  await owner.emulateMedia({ colorScheme: "light" }); await owner.setViewportSize({ width: 1440, height: 1000 });
  const restored = await openSettings(owner);
  await restored.getByLabel("帖内昵称", { exact: true }).fill("主持人");
  await restored.getByRole("button", { name: "保存昵称", exact: true }).click();
  await expect(restored).not.toBeVisible();
  await owner.getByRole("button", { name: "取消", exact: true }).click();
  const player = await login("PLAYER");
  const draft = await startFloor(player, "开关变化后保留的正文");
  await expect(player.getByRole("button", { name: "发表身份" })).toContainText("白鸦");
  await owner.getByRole("button", { name: "更多帖子信息与操作", exact: true }).click();
  await owner.getByRole("button", { name: "管理主题帖", exact: true }).click();
  await owner.getByRole("button", { name: "关闭帖内身份", exact: true }).click();
  await owner.getByRole("alertdialog", { name: "关闭帖内身份", exact: true }).getByRole("button", { name: "关闭帖内身份", exact: true }).click();
  await expect(owner.getByRole("button", { name: "启用帖内身份", exact: true })).toBeVisible();
  await player.getByRole("button", { name: "发布", exact: true }).click();
  const changed = player.getByRole("alertdialog", { name: "发言身份已变化", exact: true });
  await expect(changed).toBeVisible();
  await changed.getByRole("button", { name: "继续编辑", exact: true }).click();
  await expect(draft).toContainText("开关变化后保留的正文");
  await player.getByRole("button", { name: "发布", exact: true }).click();
  const confirmed = responseFor(player, "POST", "/subthreads/" + content.subthreadId + "/posts");
  await changed.getByRole("button", { name: "确认身份并发表", exact: true }).click();
  assert.equal((await confirmed).request().postDataJSON().identityMode, "ACCOUNT");
  report.steps.push("external-disable-preserves-draft-requires-account-confirmation");
  await player.reload();
  await expect(player.locator("#post-" + content.historicalFloorId).getByRole("button", { name: "夜渡", exact: true })).toHaveCount(0);
  await owner.getByRole("button", { name: "启用帖内身份", exact: true }).click();
  await expect(owner.getByRole("button", { name: "关闭帖内身份", exact: true })).toBeVisible();
  await player.reload();
  await expect(player.locator("#post-" + content.historicalFloorId).getByRole("button", { name: "夜渡", exact: true })).toBeVisible();
  report.steps.push("off-reopen-restores-historical-projection");
  const reader = await login("READER");
  await startFloor(reader, "");
  await expect(reader.getByRole("button", { name: "发表身份" })).toHaveCount(0);
  await expect(reader.getByRole("button", { name: /^(设置帖内身份|编辑帖内资料)$/ })).toHaveCount(0);
  report.steps.push("reader-not-eligible");
  assert.equal(report.forbiddenRequests, 0);
  await Promise.all([verifyRuntime(d, "backend"), verifyRuntime(d, "media")]);
  report.finalSourceDigest = status().sourceDigest;
} catch (error) {
  failure = error; report.failedAfter = report.steps.at(-1) ?? "preflight";
  let diagnostic = String(error.message).split("\n").slice(0, 5).join("\n");
  for (const value of accounts.accounts) diagnostic = diagnostic.replaceAll(value.account, "[account]").replaceAll(value.password, "[password]");
  report.diagnostic = diagnostic;
} finally {
  await browser.close(); report.browserClosed = true; report.passed = !failure;
  writeFileSync(join(root, ".dev-preview/rp-browser-report.json"), JSON.stringify(report, null, 2), { mode: 0o600 });
}
if (failure) { console.error("隔离 RP 验收失败，阶段：" + report.failedAfter + "；详情仅写私有报告"); process.exitCode = 1; }
else console.log(JSON.stringify(report));
