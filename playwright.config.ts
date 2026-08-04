import { defineConfig, devices } from "@playwright/test";

if (process.env.E2E_ENV !== "test") {
  throw new Error("E2E_ENV 必须显式设为 test");
}

const backendUrl = new URL(process.env.BACKEND_URL || "http://127.0.0.1:3000");
if (!new Set(["127.0.0.1", "localhost", "::1"]).has(backendUrl.hostname)) {
  throw new Error("Playwright E2E 会写入测试数据，只允许连接本机后端");
}

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  timeout: 60000,
  expect: { timeout: 15000 },
  webServer: {
    command: "pnpm dev:e2e",
    url: "http://127.0.0.1:3101",
    reuseExistingServer: false,
  },
  use: {
    baseURL: "http://127.0.0.1:3101",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
