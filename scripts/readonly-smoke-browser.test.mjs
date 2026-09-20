import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { chromium } from "@playwright/test";
import { installReadonlySmokeGuard } from "./readonly-smoke-policy.mjs";

test("真实浏览器在网络前阻断写入、重定向 GET 写入和真实会话", async () => {
  const received = [];
  const server = createServer((request, response) => {
    received.push({ path: request.url, cookie: request.headers.cookie, auth: request.headers.authorization });
    if (request.url === "/api/v1/health") {
      response.writeHead(302, { location: "/api/v1/check-in" });
      response.end();
      return;
    }
    response.setHeader("Content-Type", "text/html");
    response.setHeader("Set-Cookie", "smoke-session=must-not-send; Path=/");
    response.end("<html><body>read only</body></html>");
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ serviceWorkers: "block", extraHTTPHeaders: { authorization: "fake-session-must-not-send" } });
    await context.addCookies([{ name: "session", value: "fake-cookie-must-not-send", url: origin }]);
    const blocked = await installReadonlySmokeGuard(context, origin);
    const page = await context.newPage();
    await page.goto(origin);
    await page.evaluate(async () => {
      await Promise.all([
        fetch("/api/v1/threads", { method: "POST", body: "fake payload" }),
        fetch("/api/v1/auth/logout"), fetch("/api/v1/uploads"),
        fetch("/api/v1/health"), fetch("/api/v1/auth/refresh", { method: "POST" }),
      ].map((promise) => promise.catch(() => null)));
    });
    assert.deepEqual(received.map((request) => request.path), ["/", "/api/v1/health"]);
    assert.ok(received.every((request) => !request.cookie && !request.auth));
    assert.ok(!(await context.cookies()).some((cookie) => cookie.name === "smoke-session"));
    assert.ok(blocked.some((request) => request.method === "REDIRECT_BLOCKED"));
    assert.ok(blocked.some((request) => request.path === "/api/v1/threads" && request.method === "POST"));
    await context.close();
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
});
