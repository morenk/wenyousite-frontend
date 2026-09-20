import { chromium, expect } from "@playwright/test";
import { installReadonlySmokeGuard, smokeOrigin } from "./readonly-smoke-policy.mjs";

const origin = smokeOrigin(process.env.SMOKE_BASE_URL);
const browser = await chromium.launch();
try {
  // 不加载 storageState、用户目录、账号变量或真实浏览器会话。
  const context = await browser.newContext({ baseURL: origin, serviceWorkers: "block" });
  const blocked = await installReadonlySmokeGuard(context, origin);
  const page = await context.newPage();
  const health = await page.goto("/api/v1/health");
  expect(health?.ok()).toBe(true);
  await page.goto("/login");
  await expect(page.getByLabel("邮箱或用户名")).toBeVisible();
  await expect(page.getByRole("button", { name: "登录", exact: true })).toBeVisible();
  const listing = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/v1/threads");
  await page.goto("/");
  const listingResponse = await listing;
  expect(listingResponse.ok()).toBe(true);
  const publicThreads = (await listingResponse.json()).data;
  expect(Array.isArray(publicThreads)).toBe(true);
  await expect(page.getByRole("heading", { name: "发现主题帖" })).toBeVisible();
  const thread = page.locator('h3 a[href^="/threads/"]').first();
  // 空站点仍验证真实公开列表，不伪造内容或创建测试帖。
  const href = publicThreads.length ? await thread.getAttribute("href") : null;
  if (publicThreads.length) {
    expect(href).toMatch(/^\/threads\/c[a-z0-9]{24}$/i);
    const detail = page.waitForResponse((response) => new URL(response.url()).pathname === `/api/v1${href}`);
    await page.goto(href);
    expect((await detail).ok()).toBe(true);
    await expect(page.locator("h1").first()).toBeVisible();
    await page.waitForLoadState("networkidle");
  }
  // 外部媒体默认阻断，既不下载论坛附件，也不对其携带会话。
  const unexpectedWrites = blocked.filter(({ method, path }) =>
    !["GET", "HEAD"].includes(method) || path.startsWith("/api/"));
  expect(unexpectedWrites, "只读页面触发了白名单之外的 API 或写入请求，已阻断").toEqual([]);
  console.log(JSON.stringify({ status: "passed", mode: "anonymous-readonly", publicDetail: Boolean(href), blocked: blocked.length }));
  await context.close();
} finally {
  await browser.close();
}
