import type { Page } from "@playwright/test";

/** 只捕获发言载荷；避开 CDP 对流式 Request 正文为空的限制，不记录登录或凭证。 */
export async function captureRpWrites(page: Page) {
  await page.addInitScript(() => {
    type Write = { method: string; path: string; body: Record<string, unknown> };
    const state = window as unknown as { rpWrites: Write[] };
    state.rpWrites = [];
    const originalFetch = window.fetch;
    window.fetch = async (input, init) => {
      const request = new Request(input instanceof Request ? input.clone() : input, init);
      const path = new URL(request.url).pathname;
      if ((request.method === "POST" && /\/subthreads\/[^/]+\/posts$/.test(path))
        || (request.method === "PATCH" && /\/posts\/[^/]+$/.test(path))
        || (request.method === "PUT" && /\/rp-identities\/[^/]+$/.test(path))) {
        state.rpWrites.push({ method: request.method, path, body: await request.clone().json() });
      }
      return originalFetch(input, init);
    };
  });
}

export async function latestRpWrite(page: Page, method: string) {
  return page.evaluate((method) => (window as unknown as {
    rpWrites: { method: string; body: Record<string, unknown> }[];
  }).rpWrites.findLast((entry) => entry.method === method)!.body, method);
}

export async function rpBrowserRequest(page: Page, method: string, path: string, data?: unknown, headers: Record<string, string> = {}) {
  return page.evaluate(async ({ method, path, data, headers }) => {
    const response = await fetch(path, {
      method, headers: { ...headers, ...(data ? { "Content-Type": "application/json" } : {}) },
      ...(data ? { body: JSON.stringify(data) } : {}),
    });
    const text = await response.text();
    return { status: response.status, headers: Object.fromEntries(response.headers), body: text ? JSON.parse(text) : null };
  }, { method, path, data, headers });
}
