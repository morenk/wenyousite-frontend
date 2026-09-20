import { expect, type BrowserContext } from "@playwright/test";
import { test } from "./fixtures/typography";

async function setup(context: BrowserContext, loggedIn = false) {
  const state = { loggedIn, sessionCalls: 0, userError: false, remember: undefined as boolean | undefined, requests: [] as Array<{ path: string; method: string; auth?: string; csrf?: string }> };
  await context.route("**/api/v1/**", async route => {
    const request = route.request(); const path = new URL(request.url()).pathname;
    state.requests.push({ path, method: request.method(), auth: request.headers().authorization, csrf: request.headers()["x-csrf-token"] });
    const reply = (data: unknown, meta?: object) => route.fulfill({ json: { code: 0, data, ...(meta ? { meta } : {}) } });
    const reject = (status: number, code: number) => route.fulfill({ status, json: { code, message: "请求未获授权" } });
    const session = () => ({ csrfToken: "admin-csrf", user: { id: "admin-a", username: "会话管理员", role: "ADMIN" }, session: { id: "session-a", expiresAt: new Date(Date.now() + 604800000).toISOString(), idleMinutes: state.remember ? 10080 : 30, elevatedUntil: null } });
    if (path.endsWith("/auth/refresh")) return reply({ accessToken: "community-access", user: { id: "community", username: "社区用户", email: "community@example.test", avatar: null, role: "USER" } });
    if (path.endsWith("/admin/auth/session")) { state.sessionCalls++; return state.loggedIn ? reply(session()) : reject(401, 40117); }
    if (path.endsWith("/admin/auth/challenge")) return reply({ challengeId: "test-challenge", expiresIn: 600 });
    if (path.endsWith("/admin/auth/verify")) { state.remember = request.postDataJSON().rememberDevice; state.loggedIn = true; return reply(session()); }
    if (path.endsWith("/admin/auth/logout")) { state.loggedIn = false; return reply({}); }
    if (path.endsWith("/admin/users")) {
      if (!state.loggedIn) return reject(401, 40118);
      if (state.userError) return reject(403, 40300);
      return reply([{ id: "normal-user", username: "正常用户缓存", email: "user@example.test", role: "USER", moderationStatus: "ACTIVE", currentSanction: null, createdAt: "2026-08-01T00:00:00Z" }], { cursor: null, hasMore: false });
    }
    return reply([]);
  });
  return state;
}
for (const colorScheme of ["light", "dark"] as const) {
  test(`${colorScheme} 记住设备与安全回跳，后台请求不带社区Bearer`, async ({ context, page }, testInfo) => {
    const state = await setup(context); await page.setViewportSize({ width: 1366, height: 768 }); await page.emulateMedia({ colorScheme });
    await page.goto("/station?returnTo=" + encodeURIComponent("/station/users?q=alice"));
    await expect(page).toHaveTitle("温油站管理后台");
    await expect(page.getByText("登录已失效，请重新登录")).toHaveCount(0);
    const checkbox = page.getByRole("checkbox", { name: "记住此设备（7天）" }); await expect(checkbox).not.toBeChecked();
    await page.getByLabel("账号", { exact: true }).fill("admin@example.test"); await page.getByLabel("密码", { exact: true }).fill("password123");
    await checkbox.focus(); await page.keyboard.press("Space"); await expect(checkbox).toBeChecked();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`admin-login-${colorScheme}.png`) });
    await page.getByRole("button", { name: "继续", exact: true }).click();
    await page.getByLabel("6 位验证码").fill("123456"); await page.getByRole("button", { name: "登录", exact: true }).click();
    await expect(page).toHaveURL(/\/station\/users\?q=alice$/); await expect(page.getByText("正常用户缓存")).toBeVisible();
    expect(state.remember).toBe(true); expect(state.requests.filter(r => r.path.includes("/admin/")).every(r => !r.auth)).toBe(true);
    expect(state.requests.some(r => r.path.includes("check-in"))).toBe(false);
  });
}
test("其他标签退出后本标签清空旧内容并回登录，不形成重定向循环", async ({ context, page }) => {
  const state = await setup(context, true); const second = await context.newPage();
  await page.goto("/station/users?q=first"); await second.goto("/station/users?q=second");
  await expect(second.getByText("正常用户缓存")).toBeVisible();
  await page.getByRole("button", { name: "退出登录" }).click();
  await expect(page).toHaveURL(/\/station$/);
  await expect(second).toHaveURL(/\/station\?returnTo=/); await expect(second.getByText("正常用户缓存")).toHaveCount(0);
  const calls = state.sessionCalls; await second.waitForTimeout(400); expect(state.sessionCalls).toBe(calls);
  expect(state.requests.find(r => r.path.endsWith("/admin/auth/logout"))?.csrf).toBe("admin-csrf");
});
test("带旧列表缓存的业务请求确认到期后立即隐藏后台", async ({ context, page }) => {
  const state = await setup(context, true); await page.goto("/station/users"); await expect(page.getByText("正常用户缓存")).toBeVisible();
  state.loggedIn = false;
  await page.getByPlaceholder("用户名或邮箱").fill("new-query");
  await expect(page).toHaveURL(/\/station\?returnTo=/);
  await expect(page.getByText("正常用户缓存")).toHaveCount(0);
  await expect(page.getByText("登录已失效，请重新登录")).toBeVisible();
});
test("业务403不退出后台，也不清除社区身份", async ({ context, page }) => {
  const state = await setup(context, true); await page.goto("/station/users"); await expect(page.getByText("正常用户缓存")).toBeVisible();
  state.userError = true; await page.getByPlaceholder("用户名或邮箱").fill("forbidden");
  await expect(page.getByText("用户列表加载失败")).toBeVisible(); await expect(page).toHaveURL(/\/station\/users/);
  await expect(page.getByRole("heading", { name: "用户管理" })).toBeVisible();
});
