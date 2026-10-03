import { randomBytes } from "node:crypto";
import { readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, type Locator } from "@playwright/test";
import { test } from "./fixtures/isolation";
import { privateJSON, readAdminFixtures, requireIsolationRunner } from "../scripts/e2e-isolation-gate.mjs";

test.use({ trace: "off", screenshot: "off", video: "off" });

async function fillPrivate(control: Locator, value: string) {
  try { await control.fill(value); }
  catch { throw new Error("隔离测试凭据填写失败，敏感诊断已隐藏"); }
}

test("真实设置 API：资料与隐私、终端、黑名单、邮箱、密码退出和注销", async ({ page }) => {
  test.setTimeout(180000);
  const run = await requireIsolationRunner();
  const mailbox = readAdminFixtures(run).mailboxPath;
  const username = `settings${randomBytes(6).toString("hex")}`;
  const email = `${username}@e2e.invalid`;
  const nextEmail = `${username}new@e2e.invalid`;
  const password = `Settings1!${randomBytes(16).toString("hex")}`;
  const nextPassword = `Changed2!${randomBytes(16).toString("hex")}`;
  const steps: string[] = [];
  let stage = "register";
  let passed = false;
  const call = async (method: string, path: string, data?: object, token?: string) => {
    await requireIsolationRunner();
    // 经浏览器统一隔离网络门禁，明确不带 Web Cookie，单独验证原生终端。
    try {
      return await page.evaluate(async ({ method, path, data, token }) => {
        const response = await fetch(`/api/v1${path}`, {
          method, credentials: "omit", headers: {
            "X-Client-Platform": "mobile",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(data ? { "Content-Type": "application/json" } : {}),
          },
          ...(data ? { body: JSON.stringify(data) } : {}),
        });
        return { status: response.status, body: await response.json() };
      }, { method, path, data, token });
    } catch { throw new Error(`隔离 API 请求失败：${method} ${path}，敏感诊断已隐藏`); }
  };
  const mailCode = async (to: string, before: Set<string>) => {
    let code: string | undefined;
    await expect.poll(() => {
      for (const name of readdirSync(mailbox).filter((file) => !before.has(file))) {
        const mail = privateJSON(join(mailbox, name));
        if (mail.to === to) code = String(mail.html).match(/>([0-9]{6})</)?.[1];
      }
      return Boolean(code);
    }).toBe(true);
    return code!;
  };
  const login = async (account: string, secret: string) => {
    await requireIsolationRunner();
    await page.goto("/login");
    await fillPrivate(page.getByLabel("邮箱或用户名"), account);
    await fillPrivate(page.getByLabel("密码", { exact: true }), secret);
    await page.getByRole("button", { name: "登录", exact: true }).click();
    await expect(page).toHaveURL("/");
    await page.goto("/me");
    await expect(page.getByRole("heading", { name: "设置", exact: true })).toBeVisible();
  };
  try {
    await page.goto("/login");
    const beforeRegistration = new Set(readdirSync(mailbox));
    expect((await call("POST", "/auth/register/request-code", { email })).status).toBe(200);
    const registration = await call("POST", "/auth/register/verify-and-complete", {
      email, username, password, code: await mailCode(email, beforeRegistration),
    });
    expect(registration.status).toBe(201);
    const userId = registration.body.data.user.id;
    const mobileToken = registration.body.data.accessToken as string;
    const mobileRefresh = registration.body.data.refreshToken as string;
    expect((await call("POST", `/users/me/block/${run.credentials.E2E_USER_ID}`, undefined, mobileToken)).status).toBe(201);
    await login(email, password);
    steps.push(stage);

    stage = "profile-and-privacy";
    await page.getByRole("button", { name: "个人简介", exact: true }).click();
    await page.getByRole("textbox", { name: "个人简介" }).fill("设置真实隔离回归：简介已保存。");
    await page.getByRole("button", { name: "保存", exact: true }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await page.getByRole("button", { name: "主页公开范围", exact: true }).click();
    await page.getByRole("checkbox", { name: "公开收藏" }).uncheck();
    await page.getByRole("button", { name: "保存", exact: true }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await page.reload();
    await expect(page.getByText("设置真实隔离回归：简介已保存。", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "主页公开范围", exact: true }).click();
    await expect(page.getByRole("checkbox", { name: "公开收藏" })).not.toBeChecked();
    await page.keyboard.press("Escape");
    steps.push(stage);

    stage = "revoke-session";
    await page.getByRole("button", { name: "登录终端", exact: true }).click();
    const sessions = page.getByRole("dialog", { name: "登录终端", exact: true });
    await expect(sessions.getByRole("listitem")).toHaveCount(2);
    await sessions.getByRole("button", { name: "退出登录", exact: true }).click();
    await expect(sessions.getByRole("listitem")).toHaveCount(1);
    expect((await call("POST", "/auth/refresh", { refreshToken: mobileRefresh })).status).toBe(401);
    await page.keyboard.press("Escape");
    steps.push(stage);

    stage = "unblock";
    await page.getByRole("button", { name: "黑名单", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "取消拉黑", exact: true }).click();
    await expect(page.getByText("黑名单为空", { exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await page.reload();
    await page.getByRole("button", { name: "黑名单", exact: true }).click();
    await expect(page.getByText("黑名单为空", { exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    steps.push(stage);

    stage = "change-email";
    const beforeChange = await call("POST", "/auth/login", { account: email, password });
    expect(beforeChange.status).toBe(200);
    const revokedByEmail = beforeChange.body.data;
    await page.getByRole("link", { name: "邮箱", exact: true }).click();
    await fillPrivate(page.getByLabel("当前密码", { exact: true }), password);
    await fillPrivate(page.getByLabel("新邮箱", { exact: true }), nextEmail);
    const beforeEmail = new Set(readdirSync(mailbox));
    await page.getByRole("button", { name: "发送验证码", exact: true }).click();
    await expect(page.getByRole("button", { name: /秒后重发/ })).toBeDisabled();
    const code = await mailCode(nextEmail, beforeEmail);
    const wrongCode = `${(Number(code[0]) + 1) % 10}${code.slice(1)}`;
    await fillPrivate(page.getByLabel("验证码", { exact: true }), wrongCode);
    await page.getByRole("button", { name: "确认更换", exact: true }).click();
    await expect(page.getByLabel("验证码", { exact: true })).toHaveAttribute("aria-invalid", "true");
    await fillPrivate(page.getByLabel("验证码", { exact: true }), code);
    await page.getByRole("button", { name: "确认更换", exact: true }).click();
    await expect(page).toHaveURL(/\/login\?next=%2Fme%23security$/);
    expect((await call("GET", "/users/me", undefined, revokedByEmail.accessToken)).status).toBe(401);
    expect((await call("POST", "/auth/refresh", { refreshToken: revokedByEmail.refreshToken })).status).toBe(401);
    await fillPrivate(page.getByLabel("邮箱或用户名"), nextEmail);
    await fillPrivate(page.getByLabel("密码", { exact: true }), password);
    await page.getByRole("button", { name: "登录", exact: true }).click();
    await expect(page).toHaveURL(/\/me#security$/);
    await expect(page.getByRole("heading", { name: "设置", exact: true })).toBeVisible();
    steps.push(stage);

    stage = "change-password-and-logout";
    await page.getByRole("link", { name: "密码", exact: true }).click();
    await fillPrivate(page.getByLabel("当前密码", { exact: true }), password);
    await fillPrivate(page.getByLabel("新密码", { exact: true }), nextPassword);
    await fillPrivate(page.getByLabel("确认新密码", { exact: true }), nextPassword);
    await page.getByRole("button", { name: "保存新密码", exact: true }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.goto("/me/password");
    await expect(page).toHaveURL(/\/login\?next=%2Fme%2Fpassword$/);
    expect((await call("POST", "/auth/login", { account: nextEmail, password })).status).toBe(401);
    await login(nextEmail, nextPassword);
    steps.push(stage);

    stage = "deactivate";
    let deletes = 0;
    page.on("request", (request) => {
      if (new URL(request.url()).pathname === "/api/v1/users/me" && request.method() === "DELETE") deletes++;
    });
    await page.getByRole("button", { name: "注销账号", exact: true }).click();
    await expect(page.getByRole("button", { name: "永久注销", exact: true })).toBeDisabled();
    await page.getByRole("textbox", { name: "注销确认文字" }).fill("注销账号");
    await page.getByRole("button", { name: "永久注销", exact: true }).click();
    const confirmation = page.getByRole("alertdialog", { name: "注销账号", exact: true });
    await confirmation.getByRole("button", { name: "取消", exact: true }).click();
    expect(deletes).toBe(0);
    await page.getByRole("button", { name: "永久注销", exact: true }).click();
    await confirmation.getByRole("button", { name: "永久注销", exact: true }).click();
    await expect(page).toHaveURL("/");
    expect(deletes).toBe(1);
    await page.goto("/me/email");
    await expect(page).toHaveURL(/\/login\?next=%2Fme%2Femail$/);
    const deleted = await call("GET", `/users/${userId}`);
    expect(deleted.status).toBe(200);
    expect(deleted.body.data.isDeactivated).toBe(true);
    expect((await call("POST", "/auth/login", { account: nextEmail, password: nextPassword })).status).toBe(401);
    steps.push(stage);
    passed = true;
  } finally {
    // 只保留阶段结果；账号、口令、验证码、令牌和邮件随 runner 资源一起回收。
    writeFileSync(join(process.cwd(), ".e2e-results", `settings-real-api-${run.manifest.runId}.json`), JSON.stringify({
      runId: run.manifest.runId, candidateId: process.env.WENYOU_E2E_CANDIDATE_ID,
      actualWebOrigin: process.env.E2E_BASE_URL, actualBackendOrigin: run.manifest.backendURL,
      passed, stage, steps,
    }), { mode: 0o600 });
  }
});
