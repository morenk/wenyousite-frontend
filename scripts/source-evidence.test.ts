// @vitest-environment node
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { evidenceSource } from "./source-evidence.mjs";

test("源码证据严格记录未暂存删除与新文件，不要求先暂存才能验收", () => {
  const directory = mkdtempSync(join(tmpdir(), "wenyou-source-evidence-"));
  const git = (...args: string[]) => execFileSync("git", args, { cwd: directory, stdio: "pipe" });
  try {
    git("init");
    writeFileSync(join(directory, "legacy.ts"), "legacy component");
    git("add", "legacy.ts");
    git("-c", "user.name=Evidence Test", "-c", "user.email=evidence@example.test", "commit", "-m", "fixture");
    const initial = evidenceSource(directory);
    unlinkSync(join(directory, "legacy.ts"));
    const deleted = evidenceSource(directory);
    expect(deleted.sourceCommit).toBe(initial.sourceCommit);
    expect(deleted.sourceDigest).not.toBe(initial.sourceDigest);
    expect(evidenceSource(directory)).toEqual(deleted);
    writeFileSync(join(directory, "current.ts"), "replacement component");
    const added = evidenceSource(directory);
    expect(added.sourceDigest).not.toBe(deleted.sourceDigest);
    writeFileSync(join(directory, "current.ts"), "changed replacement");
    expect(evidenceSource(directory).sourceDigest).not.toBe(added.sourceDigest);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
