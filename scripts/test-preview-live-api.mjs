/** 显式连接已核验的交互预览；账号只从 VPS 私有文件读取，不输出凭据或页面正文。 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, statSync } from "node:fs";
import { resolve, join } from "node:path";
import { chromium, expect } from "@playwright/test";
import { validateDescriptor, verifyRuntime } from "./dev-preview-policy.mjs";

const [descriptorPath, credentialPath, task] = process.argv.slice(2);
if (!descriptorPath?.startsWith("/") || !credentialPath?.startsWith("/") || !task) throw new Error("用法：test:preview:api /absolute/consumer.json /absolute/fixture-credentials.json task-id");
const root = resolve(import.meta.dirname, "..");
const d = validateDescriptor(JSON.parse(readFileSync(descriptorPath, "utf8")));
const permission = statSync(credentialPath);
if (permission.uid !== process.getuid() || (permission.mode & 0o077)) throw new Error("验收账号必须位于当前用户私有文件");
const credentials = JSON.parse(readFileSync(credentialPath, "utf8"));
if (typeof credentials.account !== "string" || typeof credentials.password !== "string") throw new Error("私有账号文件须包含 account/password");
await Promise.all([verifyRuntime(d, "backend"), verifyRuntime(d, "media")]);
const state = JSON.parse(execFileSync(process.execPath, ["scripts/dev-preview.mjs", "status", "--task", task], { cwd: root, encoding: "utf8" }));
assert.equal(state.status, "ready"); assert.equal(state.runId, d.runId);
const report = { kind: "isolated-preview-browser", sessionId: d.sessionId, runId: d.runId, snapshotSha256: d.snapshot.sha256,
  sourceCommit: state.sourceCommit, sourceDigest: state.sourceDigest, steps: [], uploads: 0, forbiddenRequests: 0, browserClosed: false };
const browser = await chromium.launch({ headless: true });
let failure;
try {
  const context = await browser.newContext({ baseURL: d.web.origin, viewport: { width: 1440, height: 1000 } });
  await context.route("**/*", async (route) => {
    const request = route.request(); const url = new URL(request.url());
    const read = ["GET", "HEAD"].includes(request.method());
    const safe = url.origin === d.web.origin ? read || url.pathname.startsWith("/api/v1/")
      : url.origin === d.media.origin ? read || ["PUT", "OPTIONS"].includes(request.method())
      : read && url.origin === "https://cn-nb1.rains3.com";
    if (!safe) { report.forbiddenRequests++; await route.abort("blockedbyclient"); return; }
    await route.continue();
  });
  const page = await context.newPage();
  page.setDefaultTimeout(45000);
  page.on("response", (response) => { if (response.request().method() === "PUT" && new URL(response.url()).origin === d.media.origin && response.ok()) report.uploads++; });
  const apiResponse = (method, suffix) => page.waitForResponse((response) => response.request().method() === method && new URL(response.url()).pathname.endsWith(suffix) && response.ok());
  const png = { name: "preview-acceptance.png", mimeType: "image/png", buffer: readFileSync(join(root, "src/lib/__tests__/fixtures/images/static-markers.png")) };
  await page.goto("/login");
  try { await page.getByLabel("邮箱或用户名").fill(credentials.account); await page.getByLabel("密码", { exact: true }).fill(credentials.password); }
  catch { throw new Error("隔离账号填写失败"); }
  await page.getByRole("button", { name: "登录", exact: true }).click(); await page.waitForURL(d.web.origin + "/");
  report.steps.push("snapshot-password-login");
  await page.goto("/me"); await page.getByTestId("avatar-file-input").setInputFiles(png);
  await expect(page.getByRole("dialog", { name: "裁剪头像" })).toBeVisible();
  await Promise.all([apiResponse("PATCH", "/users/me/avatar"), page.getByRole("button", { name: "保存头像", exact: true }).click()]);
  await expect(page.getByText("头像已更新", { exact: true })).toBeVisible(); report.steps.push("avatar-crop-upload-worker-bind");
  const beforeRefresh = report.uploads;
  await page.reload(); await expect(page.getByRole("button", { name: "移除头像", exact: true })).toBeVisible();
  report.steps.push("httpOnly-refresh-cookie"); assert.equal(report.uploads, beforeRefresh);
  await page.getByTestId("profile-cover-file-input").setInputFiles(png);
  await expect(page.getByRole("dialog", { name: "调整主页背景" })).toBeVisible();
  await Promise.all([apiResponse("PATCH", "/users/me/profile-cover"), page.getByRole("button", { name: "保存背景", exact: true }).click()]);
  report.steps.push("web-mobile-profile-cover-upload-bind");
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: join(root, ".dev-preview/real-api-profile.png") });
  await page.emulateMedia({ colorScheme: "dark" }); await page.setViewportSize({ width: 900, height: 850 });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.screenshot({ path: join(root, ".dev-preview/real-api-profile-dark-narrow.png") });
  await page.emulateMedia({ colorScheme: "light" }); await page.setViewportSize({ width: 1440, height: 1000 });
  await Promise.all([apiResponse("DELETE", "/users/me/avatar"), page.getByRole("button", { name: "移除头像", exact: true }).click()]);
  await Promise.all([apiResponse("DELETE", "/users/me/profile-cover"), page.getByRole("button", { name: "移除背景", exact: true }).click()]);
  report.steps.push("avatar-cover-delete-isolated");
  await page.goto("/"); await page.getByRole("button", { name: "打开发布菜单" }).click();
  await page.getByRole("link", { name: "发布主题帖", exact: true }).click(); await page.getByRole("button", { name: "新建主题帖", exact: true }).click();
  await page.locator(".milkdown-editor .ProseMirror").waitFor();
  const imageButton = page.locator('.milkdown-top-bar .top-bar-item[title="图片"]').first();
  const chooser = page.waitForEvent("filechooser"); await imageButton.click(); await (await chooser).setFiles(png);
  const inserted = page.locator(".ProseMirror img").first(); await expect(inserted).toBeVisible();
  assert.equal(new URL(await inserted.getAttribute("src")).origin, d.media.origin);
  await expect(inserted).toHaveJSProperty("complete", true);
  await expect.poll(() => inserted.evaluate((node) => node.naturalWidth)).toBeGreaterThan(0);
  report.steps.push("editor-image-upload-worker-display");
  await page.screenshot({ path: join(root, ".dev-preview/real-api-editor.png") });
  assert.ok(report.uploads >= 4); assert.equal(report.forbiddenRequests, 0);
  await Promise.all([verifyRuntime(d, "backend"), verifyRuntime(d, "media")]);
} catch (error) {
  // Playwright 错误可能附带填写值、页面内容和请求 URL；私有日志外只保留阶段名。
  failure = error; report.failedAfter = report.steps.at(-1) ?? "preflight";
  report.diagnostic = String(error.message).split("\n").slice(0, 3).join("\n").replaceAll(credentials.account, "[account]").replaceAll(credentials.password, "[password]");
} finally {
  await browser.close(); report.browserClosed = true;
  report.passed = !failure;
  writeFileSync(join(root, ".dev-preview/real-api-test.json"), JSON.stringify(report, null, 2), { mode: 0o600 });
}
if (failure) { console.error(`隔离浏览器验收失败，阶段：${report.failedAfter}；未输出凭据或页面正文`); process.exitCode = 1; }
else console.log(JSON.stringify(report));
