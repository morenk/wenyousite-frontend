// @vitest-environment node
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
  chmodSync,
  symlinkSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { afterEach, expect, test, vi } from "vitest";
import {
  DynamicFontCheckpoints,
  FONT_CHECKPOINTS,
} from "../e2e/fixtures/dynamic-font-checkpoints";
import {
  fontCoordinationArguments,
  fontCandidateBuildSha256,
} from "./e2e-font-coordination.mjs";
const roots: string[] = [];
afterEach(() =>
  roots
    .splice(0)
    .forEach((root) => rmSync(root, { recursive: true, force: true })),
);
function setup(mobile = true, timeoutMs = 2000) {
  const root = mkdtempSync(join(tmpdir(), "wenyou-font-checkpoint-"));
  roots.push(root);
  chmodSync(root, 0o700);
  const verify = vi.fn(async () => {});
  const checkpoints = new DynamicFontCheckpoints({
    root,
    identity: {
      runId: "e2e_" + "a".repeat(24),
      backendURL: "http://127.0.0.1:39001",
      webBuildId: "e2e-test",
      webBuildSha256: "b".repeat(64),
      sourceCommit: "c".repeat(40),
      sourceDigest: "d".repeat(64),
      webSessionId: randomUUID(),
    },
    mobileApkSha256: mobile ? "e".repeat(64) : undefined,
    verify,
    timeoutMs,
    totalWaitMs: 10000,
  });
  return { root, verify, checkpoints };
}
const mobileSessionId = randomUUID(),
  mobileSessionOpenedAt = new Date(Date.now() - 60000).toISOString();
async function acknowledge(
  checkpoints: DynamicFontCheckpoints,
  changes = {},
  file?: (path: string, value: string) => void,
) {
  const current = join(checkpoints.directory, "current.json");
  await vi.waitFor(() => expect(existsSync(current)).toBe(true));
  const record = JSON.parse(readFileSync(current, "utf8"));
  const ack = {
    schemaVersion: 1,
    runId: record.runId,
    checkpointId: record.checkpointId,
    sequence: record.sequence,
    phase: record.phase,
    versionIds: record.versionIds,
    webBuildSha256: record.webBuildSha256,
    webSessionId: record.webSessionId,
    mobileApkSha256: record.expectedMobileApkSha256,
    mobileSessionId,
    mobileProcessId: 1024,
    mobileSessionOpenedAt,
    observedAt: new Date().toISOString(),
    completed: true,
    checks: record.requiredChecks,
    evidenceSha256: "f".repeat(64),
    ...changes,
  };
  const path = join(checkpoints.directory, record.ackFile);
  if (file) file(path, JSON.stringify(ack));
  else writeFileSync(path, JSON.stringify(ack), { mode: 0o600 });
}
async function reach(
  checkpoints: DynamicFontCheckpoints,
  phase: keyof typeof FONT_CHECKPOINTS,
  changes = {},
) {
  const current = join(checkpoints.directory, "current.json");
  if (existsSync(current)) rmSync(current);
  const pending = checkpoints.checkpoint(
    phase,
    phase === "sessions-ready" ? [] : ["tfv_" + "1".repeat(32)],
  );
  // 立即挂接拒绝处理，避免验证错误先于测试 await 时产生未处理拒绝。
  void pending.catch(() => {});
  await acknowledge(checkpoints, changes);
  return pending;
}

test("独立Web完整旅程明确不计合体验收，全部检查点仍核验隔离身份", async () => {
  const f = setup(false);
  for (const phase of Object.keys(
    FONT_CHECKPOINTS,
  ) as (keyof typeof FONT_CHECKPOINTS)[])
    await f.checkpoints.checkpoint(phase, []);
  expect(f.checkpoints.summary).toMatchObject({
    mode: "web-only",
    jointAcceptance: false,
    acknowledgements: [],
  });
  expect(f.verify).toHaveBeenCalledTimes(9);
  f.checkpoints.dispose();
});
test("先等待双方固定会话，再按所有阶段显式确认；确认前绝不推进", async () => {
  const f = setup();
  let advanced = false;
  const ready = f.checkpoints.checkpoint("sessions-ready", []).then(() => {
    advanced = true;
  });
  await vi.waitFor(() =>
    expect(existsSync(join(f.checkpoints.directory, "current.json"))).toBe(
      true,
    ),
  );
  expect(advanced).toBe(false);
  expect(f.checkpoints.summary.jointAcceptance).toBe(false);
  await acknowledge(f.checkpoints);
  await ready;
  for (const phase of Object.keys(FONT_CHECKPOINTS).slice(
    1,
  ) as (keyof typeof FONT_CHECKPOINTS)[])
    await reach(f.checkpoints, phase);
  expect(f.checkpoints.summary.jointAcceptance).toBe(true);
  expect(f.checkpoints.summary.acknowledgements).toHaveLength(9);
  expect(f.verify).toHaveBeenCalledTimes(18);
  f.checkpoints.dispose();
});
test.each([
  { runId: "e2e_" + "0".repeat(24) },
  { checkpointId: randomUUID() },
  { phase: "withdrawn" },
  { sequence: 3 },
  { versionIds: ["tfv_" + "2".repeat(32)] },
  { webBuildSha256: "0".repeat(64) },
  { webSessionId: randomUUID() },
  { mobileApkSha256: "0".repeat(64) },
  { completed: false },
  { checks: ["fixed-build"] },
  { observedAt: "2000-01-01T00:00:00.000Z" },
  { mobileSessionOpenedAt: "2099-01-01T00:00:00.000Z" },
])("旧轮次、错阶段、错构建或不完整确认拒绝：%j", async (changes) => {
  const f = setup();
  await expect(
    reach(f.checkpoints, "sessions-ready", changes),
  ).rejects.toThrow();
  expect(f.checkpoints.summary.completedPhases).toEqual([]);
  f.checkpoints.dispose();
});
test("同APK重新启动Mobile也不能继续冒充原会话", async () => {
  const f = setup();
  await reach(f.checkpoints, "sessions-ready");
  await expect(
    reach(f.checkpoints, "published-v1", { mobileProcessId: 2048 }),
  ).rejects.toThrow("会话发生重启");
  expect(f.checkpoints.summary.completedPhases).toEqual(["sessions-ready"]);
  f.checkpoints.dispose();
});
test.each(["mode", "symlink", "oversized"])(
  "不接受不私有或越界的ack文件：%s",
  async (kind) => {
    const f = setup();
    const pending = f.checkpoints.checkpoint("sessions-ready", []);
    void pending.catch(() => {});
    await acknowledge(f.checkpoints, {}, (path, value) => {
      if (kind === "symlink") {
        const target = join(f.root, "elsewhere.json");
        writeFileSync(target, value, { mode: 0o600 });
        symlinkSync(target, path);
      } else {
        writeFileSync(path, kind === "oversized" ? " ".repeat(16385) : value, {
          mode: 0o600,
        });
        if (kind === "mode") chmodSync(path, 0o644);
      }
    });
    await expect(pending).rejects.toThrow("文件身份无效");
    f.checkpoints.dispose();
  },
);
test("超时或页面结束都失败，不生成Mobile确认；同run不能重新使用目录", async () => {
  const f = setup(true, 20);
  await expect(f.checkpoints.checkpoint("sessions-ready", [])).rejects.toThrow(
    "超时",
  );
  expect(f.checkpoints.summary.jointAcceptance).toBe(false);
  const another = setup();
  const pending = another.checkpoints.checkpoint("sessions-ready", []);
  void pending.catch(() => {});
  await vi.waitFor(() =>
    expect(
      existsSync(join(another.checkpoints.directory, "current.json")),
    ).toBe(true),
  );
  another.checkpoints.dispose();
  await expect(pending).rejects.toThrow();
  expect(
    () =>
      new DynamicFontCheckpoints({
        root: f.root,
        identity: {
          runId: "e2e_" + "a".repeat(24),
          backendURL: "http://127.0.0.1:39001",
          webBuildId: "other",
          webBuildSha256: "b".repeat(64),
          sourceCommit: "c".repeat(40),
          sourceDigest: "d".repeat(64),
          webSessionId: randomUUID(),
        },
        verify: async () => {},
      }),
  ).toThrow();
});
test("确认后再次核验隔离身份，资源失效时不得进入下一步", async () => {
  const f = setup();
  f.verify
    .mockResolvedValueOnce(undefined)
    .mockRejectedValueOnce(new Error("隔离资源已失效"));
  await expect(reach(f.checkpoints, "sessions-ready")).rejects.toThrow(
    "隔离资源已失效",
  );
  expect(f.checkpoints.summary.completedPhases).toEqual([]);
  f.checkpoints.dispose();
});
test("协作参数严格校验且从Playwright参数移除，错误配置不能退回web-only", () => {
  const testFile = "e2e/dynamic-text-fonts.spec.ts",
    flag = "--font-mobile-sha256=" + "a".repeat(64);
  expect(fontCoordinationArguments([testFile, flag])).toEqual({
    browserArgs: [testFile],
    mobileApkSha256: "a".repeat(64),
  });
  expect(fontCoordinationArguments([testFile]).mobileApkSha256).toBeUndefined();
  for (const args of [
    [testFile, "--font-mobile-sha256="],
    [testFile, flag, flag],
    [testFile, flag, "--matrix"],
    ["e2e/theme.spec.ts", flag],
  ])
    expect(() => fontCoordinationArguments(args)).toThrow();
});
test("构建摘要覆盖实际服务端与静态代码，拒绝链接", () => {
  const root = mkdtempSync(join(tmpdir(), "wenyou-font-build-"));
  roots.push(root);
  for (const directory of ["server", "static"])
    mkdirSync(join(root, directory));
  for (const file of [
    "BUILD_ID",
    "required-server-files.json",
    "routes-manifest.json",
    "server/page.js",
    "static/chunk.js",
  ])
    writeFileSync(join(root, file), file);
  const before = fontCandidateBuildSha256(root);
  expect(fontCandidateBuildSha256(root)).toBe(before);
  writeFileSync(join(root, "static/chunk.js"), "changed");
  expect(fontCandidateBuildSha256(root)).not.toBe(before);
  symlinkSync(join(root, "BUILD_ID"), join(root, "server/link"));
  expect(() => fontCandidateBuildSha256(root)).toThrow("符号链接");
});

test("隔离核验尚未返回时也拒绝并发检查点，失败不能重试", async () => {
  const f = setup(false);
  let finish!: () => void;
  f.verify.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  const first = f.checkpoints.checkpoint("sessions-ready", []);
  await expect(f.checkpoints.checkpoint("sessions-ready", [])).rejects.toThrow(
    "生命周期",
  );
  finish();
  await first;
  f.verify.mockRejectedValueOnce(new Error("隔离失败"));
  await expect(f.checkpoints.checkpoint("published-v1", [])).rejects.toThrow(
    "隔离失败",
  );
  await expect(f.checkpoints.checkpoint("published-v1", [])).rejects.toThrow(
    "生命周期",
  );
  expect(f.checkpoints.summary.failedPhase).toBe("published-v1");
  f.checkpoints.dispose();
});
