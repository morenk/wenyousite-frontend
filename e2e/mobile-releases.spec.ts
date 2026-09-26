import { expect, type Page } from "@playwright/test";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "./fixtures/typography";
import { privateJSON, readAdminFixtures, readMobileReleaseFixtures, requireIsolationRunner } from "../scripts/e2e-isolation-gate.mjs";

async function login(page: Page, role: "ADMIN" | "SUPER_ADMIN") {
  const run = await requireIsolationRunner();
  const fixture = readAdminFixtures(run);
  const account = fixture.accounts.find((entry: { role: string }) => entry.role === role)!;
  const before = new Set(readdirSync(fixture.mailboxPath));
  // 登录失败仅输出固定错误，防止 Playwright 调用日志带出 fill 的账号或口令。
  try {
    await page.goto("/station");
    await page.getByLabel("账号", { exact: true }).fill(account.email);
    await page.getByLabel("密码", { exact: true }).fill(account.password);
    await page.getByRole("button", { name: "继续", exact: true }).click();
    await page.getByLabel("6 位验证码").waitFor();
    let code: string | undefined;
    await expect.poll(() => {
      for (const name of readdirSync(fixture.mailboxPath).filter((value) => !before.has(value))) {
        const mail = privateJSON(join(fixture.mailboxPath, name));
        if (mail.to === account.email) code = String(mail.html).match(/>([0-9]{6})</)?.[1];
      }
      return Boolean(code);
    }).toBe(true);
    await page.getByLabel("6 位验证码").fill(code!);
    await page.getByRole("button", { name: "登录", exact: true }).click();
    await page.getByRole("navigation", { name: "管理功能" }).waitFor();
  } catch { throw new Error(`本轮 ${role} 管理员登录失败（敏感诊断已隐藏）`); }
}

async function adminRequest(page: Page, method: string, path: string, body?: object) {
  await requireIsolationRunner();
  return page.evaluate(async ({ method, path, body }) => {
    const session = await fetch("/api/v1/admin/auth/session").then((response) => response.json());
    const response = await fetch(`/api/v1/admin/mobile-releases${path}`, {
      method, headers: { "Content-Type": "application/json", "X-CSRF-Token": session.data.csrfToken },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, body: await response.json() };
  }, { method, path, body });
}

async function publicRelease(page: Page, build: number) {
  await requireIsolationRunner();
  return page.evaluate(async (build) => {
    const response = await fetch(`/api/v1/mobile-releases/android/${build}`, { credentials: "omit" });
    return { status: response.status, body: await response.json() };
  }, build);
}

function evidenceSource() {
  const files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean).sort();
  const digest = createHash("sha256");
  for (const file of files) { digest.update(file); digest.update(readFileSync(file)); }
  return { sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(), sourceDigest: digest.digest("hex") };
}

test("真实管理员创建、冲突恢复、公开快照保护与明暗窄屏候选", async ({ page }) => {
  test.setTimeout(120000);
  const run = await requireIsolationRunner();
  const published = readMobileReleaseFixtures(run).published;
  const build = 1960000097;
  const output = join(process.cwd(), ".e2e-results", `mobile-releases-${run.manifest.runId}`);
  mkdirSync(output, { recursive: true, mode: 0o700 });
  await login(page, "ADMIN");
  await page.getByRole("link", { name: "移动端版本" }).click();
  await page.getByRole("button", { name: "新建版本说明" }).click();
  let dialog = page.getByRole("dialog", { name: "新建版本说明" });
  await dialog.getByLabel("Android 版本名").fill("0.8.0-web-e2e");
  await dialog.getByLabel("构建号").fill(String(build));
  await dialog.getByLabel("更新摘要").fill("更顺畅的阅读体验");
  await dialog.getByLabel("逐条更新内容").fill("阅读进度更清晰\n修复长内容换行\n<b>这仍是纯文本</b>");
  await dialog.getByRole("button", { name: "保存草稿" }).click();
  dialog = page.getByRole("dialog", { name: "版本说明", exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "确认说明", exact: true })).toHaveCount(0);
  const list = await adminRequest(page, "GET", "?platform=android");
  const record = list.body.data.find((entry: { buildNumber: number }) => entry.buildNumber === build);
  expect(record.status).toBe("DRAFT");
  expect((await publicRelease(page, build)).status).toBe(404);
  expect((await adminRequest(page, "POST", `/${record.id}/confirm`, { revision: record.revision })).status).toBe(403);
  expect((await adminRequest(page, "PATCH", `/${published.id}`, { revision: published.revision, summary: "越权修正", items: ["拒绝写入"] })).status).toBe(403);
  await dialog.getByLabel("更新摘要").fill("保留我的修正");
  expect((await adminRequest(page, "PATCH", `/${record.id}`, { revision: record.revision, summary: "另一管理员的新稿", items: ["并发改动"] })).status).toBe(200);
  await dialog.getByRole("button", { name: "保存草稿" }).click();
  await expect(dialog.getByRole("button", { name: "读取最新内容" })).toBeVisible();
  await expect(dialog.getByLabel("更新摘要")).toHaveValue("保留我的修正");
  await dialog.getByRole("button", { name: "读取最新内容" }).click();
  await expect(dialog.getByRole("region", { name: "最新服务端草稿（输入已保留，请核对）" })).toContainText("另一管理员的新稿");
  await dialog.getByRole("button", { name: "保存草稿" }).click();
  await expect(dialog.getByRole("button", { name: "保存草稿" })).toBeDisabled();
  await dialog.getByRole("button", { name: "关闭版本说明" }).click();
  await page.getByRole("row").filter({ hasText: published.versionName }).getByRole("button", { name: "查看" }).click();
  await expect(page.getByRole("dialog").getByLabel("更新摘要")).toBeDisabled();
  await page.getByRole("dialog").getByRole("button", { name: "关闭版本说明" }).click();
  await page.getByRole("button", { name: "退出登录" }).click();
  await login(page, "SUPER_ADMIN");
  await page.getByRole("link", { name: "移动端版本" }).click();
  await page.getByRole("row").filter({ hasText: String(build) }).getByRole("button", { name: "查看" }).click();
  dialog = page.getByRole("dialog", { name: "版本说明", exact: true });
  await dialog.getByRole("button", { name: "确认说明", exact: true }).click();
  await expect(dialog.getByText("待发布", { exact: true })).toBeVisible();
  expect((await publicRelease(page, build)).status).toBe(404);
  await expect(dialog.getByRole("region", { name: "已确认说明" })).toContainText("保留我的修正");
  await expect(dialog.locator("img, a")).toHaveCount(0);
  await dialog.getByRole("button", { name: "关闭版本说明" }).click();
  await page.getByRole("row").filter({ hasText: published.versionName }).getByRole("button", { name: "查看" }).click();
  dialog = page.getByRole("dialog", { name: "版本说明", exact: true });
  const changedSummary = "已发布说明修正：阅读更顺畅，长内容也能清晰展示。";
  await dialog.getByLabel("更新摘要").fill(changedSummary);
  await dialog.getByLabel("逐条更新内容").fill("改进主题帖阅读中的滚动定位和长段落排版，使查阅上下文更加方便。\n修复部分显示问题，保留正在阅读的位置。\n优化更新说明，让每次升级的变化更容易了解。");
  await dialog.getByRole("button", { name: "保存草稿" }).click();
  await expect(dialog.getByRole("button", { name: "确认修正并更新公开说明" })).toBeEnabled();
  const beforeConfirmation = await publicRelease(page, published.buildNumber);
  expect(beforeConfirmation.status).toBe(200);
  expect(beforeConfirmation.body.data.summary).toBe(published.published.summary);
  await expect(dialog.getByRole("region", { name: "当前公开说明" })).toContainText(published.published.summary);
  await dialog.getByRole("button", { name: "确认修正并更新公开说明" }).click();
  await expect(dialog.getByRole("region", { name: "当前公开说明" })).toContainText(changedSummary);
  const afterConfirmation = await publicRelease(page, published.buildNumber);
  expect(afterConfirmation.body.data.summary).toBe(changedSummary);
  expect(afterConfirmation.body.data.publishedAt).toBe(published.published.publishedAt);
  await dialog.getByRole("button", { name: "关闭版本说明" }).click();
  await expect(page.locator("[data-sonner-toast]")).toHaveCount(0);
  const pictures: { path: string; width: number; height: number; theme: string }[] = [];
  for (const width of [1024, 1366]) {
    for (const theme of ["light", "dark"] as const) {
      await page.setViewportSize({ width, height: 768 }); await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await expect(page.getByRole("table", { name: "移动端版本列表" })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
      const listPath = join(output, `list-${width}-${theme}.png`);
      await page.screenshot({ path: listPath, mask: [page.locator("aside > div").last()], maskColor: "#777777" }); pictures.push({ path: listPath, width, height: 768, theme });
      await page.getByRole("row").filter({ hasText: published.versionName }).getByRole("button", { name: "查看" }).click();
      const popup = page.getByRole("dialog", { name: "版本说明", exact: true });
      await expect(popup.getByRole("region", { name: "草稿预览" })).toContainText(changedSummary);
      const editorPath = join(output, `editor-${width}-${theme}.png`);
      await popup.screenshot({ path: editorPath }); pictures.push({ path: editorPath, width, height: 768, theme });
      await popup.getByRole("region", { name: "当前公开说明" }).scrollIntoViewIfNeeded();
      const publicPath = join(output, `public-${width}-${theme}.png`);
      await popup.screenshot({ path: publicPath }); pictures.push({ path: publicPath, width, height: 768, theme });
      await page.keyboard.press("Escape"); await expect(popup).toHaveCount(0);
    }
  }
  writeFileSync(join(output, "evidence.json"), JSON.stringify({ ...evidenceSource(), runId: run.manifest.runId, candidateId: process.env.WENYOU_E2E_CANDIDATE_ID, capturedAt: new Date().toISOString(), pictures, status: "候选／待人工验收", dataSource: "本轮合成隔离数据" }, null, 2), { mode: 0o600 });
});
