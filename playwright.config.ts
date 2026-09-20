import { defineConfig, devices } from "@playwright/test";

import { readIsolation } from "./scripts/e2e-isolation-gate.mjs";
import { isolatedOrigin } from "./scripts/e2e-candidate-policy.mjs";

readIsolation();
const appOrigin = isolatedOrigin(process.env.E2E_BASE_URL);
isolatedOrigin(process.env.BACKEND_URL);

const crossBrowserMatrix = process.env.E2E_BROWSER_MATRIX === "true";

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/fixtures/global-setup.ts",
  fullyParallel: false,
  // 专用账号只有一个 Web 登录终端，避免并行用例互相撤销会话。
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60000,
  expect: { timeout: 15000 },
  use: {
    baseURL: appOrigin,
    trace: "off",
    screenshot: "off",
    video: "off",
    serviceWorkers: "block",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    ...(crossBrowserMatrix ? [
      {
        name: "firefox",
        use: { ...devices["Desktop Firefox"] },
      },
      {
        name: "webkit",
        use: { ...devices["Desktop Safari"] },
      },
    ] : []),
  ],
});
