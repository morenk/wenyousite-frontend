// @vitest-environment node
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, expect, test } from "vitest";

const script = resolve("scripts/sync-api-contract.mjs");
const roots: string[] = [];
function workspace() {
  const root = mkdtempSync(join(tmpdir(), "wenyou-contract-sync-"));
  roots.push(root);
  const backend = join(root, "wenyousite-backend/contracts");
  const frontend = join(root, "wenyousite-frontend");
  mkdirSync(backend, { recursive: true });
  mkdirSync(join(frontend, "contracts"), { recursive: true });
  const fixtures = {
    "markdown-editor-newline-v1-fixtures.json": { contract: "wenyousite-editor-newline", version: 1 },
    "thread-cover-media-v1-fixtures.json": { schemaVersion: 1, cases: [] },
    "openapi.json": { openapi: "3.0.3", info: { version: "test" } },
    "internal-reference-v1-fixtures.json": { contract: "wenyousite-internal-reference", version: 1 },
    "editor-clipboard-v2-fixtures.json": { contract: "wenyousite-editor-clipboard", version: 2 },
    "markdown-v4-fixtures.json": { contract: "wenyousite-markdown", version: 4 },
    "markdown-v4-nodes-fixtures.json": { contract: "wenyousite-markdown-nodes", version: 1 },
    "markdown-editor-roundtrip-v7-fixtures.json": { contract: "wenyousite-markdown-editor-roundtrip", version: 7 },
    "markdown-v5-image-alignment-fixtures.json": { contract: "wenyousite-markdown-image-alignment", version: 2 },
  };
  for (const [name, value] of Object.entries(fixtures)) writeFileSync(join(backend, name), JSON.stringify(value));
  writeFileSync(join(frontend, "contracts/markdown-editor-roundtrip-v6-fixtures.json"), "old");
  writeFileSync(join(frontend, "contracts/private-notes.txt"), "keep");
  return { frontend, backend, fixtures };
}
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

test("同步全部 Markdown 事实源，只淘汰旧版 fixture，重复同步不变", () => {
  const { frontend, backend, fixtures } = workspace();
  for (let pass = 0; pass < 2; pass++) {
    execFileSync(process.execPath, [script], { cwd: frontend, env: { ...process.env, BACKEND_CONTRACT_REF: "" } });
    for (const name of Object.keys(fixtures)) {
      expect(readFileSync(join(frontend, "contracts", name), "utf8"))
        .toBe(readFileSync(join(backend, name), "utf8"));
    }
    expect(existsSync(join(frontend, "contracts/markdown-editor-roundtrip-v6-fixtures.json"))).toBe(false);
    expect(readFileSync(join(frontend, "contracts/private-notes.txt"), "utf8")).toBe("keep");
  }
});

test("来源损坏时在覆盖或清理前拒绝", () => {
  const { frontend, backend } = workspace();
  writeFileSync(join(backend, "markdown-v5-image-alignment-fixtures.json"), "{}");
  expect(() => execFileSync(process.execPath, [script], { cwd: frontend, stdio: "pipe", env: { ...process.env, BACKEND_CONTRACT_REF: "" } })).toThrow();
  expect(readFileSync(join(frontend, "contracts/markdown-editor-roundtrip-v6-fixtures.json"), "utf8")).toBe("old");
  expect(existsSync(join(frontend, "contracts/openapi.json"))).toBe(false);
});

test("精确提交同步忽略后端未提交修改，并包含封面黄金fixture", () => {
  const { frontend, backend } = workspace();
  const root = resolve(backend, "..");
  const git = (...args: string[]) => execFileSync("git", ["-C", root, ...args], { encoding: "utf8", stdio: "pipe" });
  git("init", "-q"); git("config", "user.name", "Contract Test"); git("config", "user.email", "contract@example.invalid");
  git("add", "contracts"); git("commit", "-qm", "fixture");
  const revision = git("rev-parse", "HEAD").trim();
  const committed = readFileSync(join(backend, "openapi.json"), "utf8");
  writeFileSync(join(backend, "openapi.json"), "uncommitted");
  const output = execFileSync(process.execPath, [script], { cwd: frontend, encoding: "utf8",
    env: { ...process.env, BACKEND_CONTRACT_REF: revision } });
  expect(output).toContain(revision);
  expect(readFileSync(join(frontend, "contracts/openapi.json"), "utf8")).toBe(committed);
  expect(existsSync(join(frontend, "contracts/thread-cover-media-v1-fixtures.json"))).toBe(true);
});
