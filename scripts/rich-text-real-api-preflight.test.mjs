import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { promisify } from "node:util";
import { execFile } from "node:child_process";
const run = promisify(execFile);

test("真实 API 预检在隔离协议接入前拒绝所有目标，且不触达目标服务", async () => {
  let requests = 0;
  const server = createServer((_request, response) => { requests++; response.end("{}"); });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    for (const target of ["https://wenyou.site", "http://127.0.0.1:3000", `http://127.0.0.1:${server.address().port}`,
      "http://secret-user:secret-password@127.0.0.1:3100"]) {
      for (const [command, args] of [
        [process.execPath, ["scripts/rich-text-real-api-preflight.mjs", "--require-credentials"]],
        ["bash", ["scripts/test-rich-text-real-api.sh"]],
        ["bash", ["scripts/test-standalone-e2e.sh"]],
      ]) {
        await assert.rejects(run(command, args, { env: { ...process.env, BACKEND_URL: target, E2E_ENV: "test", E2E_EMAIL: "fake", E2E_PASSWORD: "fake" } }),
          (error) => error.code === 1 && error.stderr.includes("写入型 E2E 已关闭") && !error.stderr.includes("secret-password"));
      }
    }
    assert.equal(requests, 0);
  } finally { await new Promise((resolve) => server.close(resolve)); }
});
