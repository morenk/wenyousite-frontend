import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { promisify } from "node:util";
import { execFile } from "node:child_process";
const run = promisify(execFile);
const apiSha = "6bfb818df4ccf5333df7b62018a9f519d91e935b";

test("真实 API 预检只输出凭据状态，缺凭据在构建/写入前阻止执行", async () => {
  const server = createServer((_request, response) => {
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify({ data: { buildSha: apiSha, markdownContractVersion: 5, ignoredSecret: "must-not-appear" } }));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const env = { ...process.env, BACKEND_URL: `http://127.0.0.1:${server.address().port}`, RICH_TEXT_EXPECTED_API_SHA: apiSha,
      E2E_EMAIL: "", E2E_PASSWORD: "" };
    const result = await run(process.execPath, ["scripts/rich-text-real-api-preflight.mjs"], { env });
    assert.equal(JSON.parse(result.stdout).status, "blocked-credentials");
    assert.ok(!result.stdout.includes("must-not-appear"));
    await assert.rejects(run(process.execPath, ["scripts/rich-text-real-api-preflight.mjs", "--require-credentials"], { env }),
      (error) => error.code === 2 && JSON.parse(error.stdout).credentials.E2E_PASSWORD === false);
    await assert.rejects(run(process.execPath, ["scripts/rich-text-real-api-preflight.mjs"], {
      env: { ...env, RICH_TEXT_EXPECTED_API_SHA: "a".repeat(40) },
    }), (error) => error.code === 1 && JSON.parse(error.stderr).reason === "api-sha-mismatch");
  } finally { await new Promise((resolve) => server.close(resolve)); }
});

test("拒绝带凭据的目标 URL，诊断不回显目标凭据", async () => {
  await assert.rejects(run(process.execPath, ["scripts/rich-text-real-api-preflight.mjs"], {
    env: { ...process.env, BACKEND_URL: "http://secret-user:secret-password@127.0.0.1:3000" },
  }), (error) => error.code === 1 && JSON.parse(error.stderr).reason === "invalid-loopback-api"
    && !error.stderr.includes("secret-password"));
});
