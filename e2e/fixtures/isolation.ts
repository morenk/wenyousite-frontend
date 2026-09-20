import { test as base } from "@playwright/test";
import { requireIsolationRunner } from "../../scripts/e2e-isolation-gate.mjs";

/** 即使调用方替换 Playwright 配置，也必须先经过同一隔离门禁。 */
export const test = base.extend<object, { isolationIdentity: void }>({
  isolationIdentity: [async ({}, use) => {
    requireIsolationRunner();
    await use();
  }, { scope: "worker", auto: true }],
});
