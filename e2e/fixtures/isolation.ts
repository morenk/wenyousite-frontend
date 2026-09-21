import { test as base, expect } from "@playwright/test";
import { requireIsolationRunner } from "../../scripts/e2e-isolation-gate.mjs";
import { isolationProxy } from "../../scripts/e2e-network-proxy.mjs";

/** 真实网络写入在专用 HTTP 代理校验，避免 route 拦截关闭浏览器 HTTP 缓存。 */
export const test = base.extend<{ isolationNetwork: Awaited<ReturnType<typeof isolationProxy>> }, { isolationIdentity: void }>({
  isolationIdentity: [async ({}, use) => {
    await requireIsolationRunner();
    await use();
  }, { scope: "worker", auto: true }],
  isolationNetwork: async ({}, provide) => {
    const network = await isolationProxy(process.env.E2E_BASE_URL, () => requireIsolationRunner());
    try { await provide(network); }
    finally {
      await network.close();
      expect(network.violations, "隔离 HTTP 代理阻止了未验证的写入").toEqual([]);
    }
  },
  proxy: async ({ isolationNetwork }, provide) => { await provide({ server: isolationNetwork.origin }); },
});
