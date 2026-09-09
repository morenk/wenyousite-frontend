// @vitest-environment node
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, expect, test } from "vitest";

const root = process.cwd();
const roots: string[] = [];
const newline = "markdown-editor-newline-v1-fixtures.json";
function workspace() {
  const temporary = mkdtempSync(join(tmpdir(), "wenyou-doc-truth-"));
  roots.push(temporary);
  const frontend = join(temporary, "wenyousite-frontend");
  const backend = join(temporary, "wenyousite-backend");
  mkdirSync(frontend);
  mkdirSync(backend);
  for (const name of ["src", "docs", "AGENTS.md", "README.md", "package.json", "foundation.lock.json"])
    symlinkSync(join(root, name), join(frontend, name));
  cpSync(join(root, "contracts"), join(frontend, "contracts"), { recursive: true });
  cpSync(join(root, "contracts"), join(backend, "contracts"), { recursive: true });
  return { frontend, backend };
}
function check(frontend: string) {
  return spawnSync(process.execPath, ["--import", resolve("node_modules/tsx/dist/loader.mjs"), resolve("scripts/check-doc-truth.ts")], {
    cwd: frontend, encoding: "utf8",
  });
}
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

test("真实文档门禁：共享文件逐字相同通过", () => {
  const { frontend } = workspace();
  const result = check(frontend);
  expect(result.stderr).toBe("");
  expect(result.status).toBe(0);
});

test.each([newline, "markdown-editor-roundtrip-v7-fixtures.json", "editor-clipboard-v2-fixtures.json", "rich-text-behavior-v1-fixtures.json"])(
  "真实文档门禁：仅 %s 空白漂移也失败并指出前后端文件", (name) => {
    const { frontend, backend } = workspace();
    const file = join(backend, "contracts", name);
    writeFileSync(file, readFileSync(file, "utf8") + " ");
    const result = check(frontend);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(`前后端 ${name} 不一致`);
  },
);
